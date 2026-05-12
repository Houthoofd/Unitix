/**
 * @file architecture-detector.mjs
 * @description Orchestrateur principal de la détection d'architecture.
 *
 * Étapes d'exécution :
 *  1. Détecter les frameworks installés (via package.json)
 *  2. Scanner la structure de dossiers (chemins clés + signaux booléens)
 *  3. Scorer chaque type d'architecture connu
 *  4. Sélectionner le type avec le score le plus élevé + calculer la confiance
 *  5. Résoudre les chemins concrets
 *  6. Construire la TestStrategy adaptée
 *
 * @module detectors/architecture-detector
 */

import { detectFrameworks } from "./framework-detector.mjs";
import { detectPaths } from "./path-detector.mjs";
import { buildTestStrategy } from "./test-strategy-builder.mjs";
import { buildSourceMap } from "./source-mapper.mjs";
import { logger } from "../logger.mjs";

/** @import { ArchitectureProfile, FrameworkInfo, RawDetectedPaths, DetectedPaths, SourceDirEntry } from '../types.mjs' */

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Attribue un score à chaque type d'architecture connu en fonction
 * des signaux détectés (frameworks installés + structure de dossiers).
 *
 * Barème (exemples) :
 *  - Dossier `src/modules/`            → +5 pts clean-architecture
 *  - `nest-cli.json` présent           → +4 pts clean-architecture
 *  - `@nestjs/core` en dépendance      → +3 pts clean-architecture
 *  - Dossier `src/features/`           → +5 pts feature-based
 *  - `next` en dépendance              → +8 pts nextjs
 *  - `pnpm-workspace.yaml` présent     → +6 pts monorepo
 *
 * @param {FrameworkInfo}   frameworks
 * @param {RawDetectedPaths} paths
 * @returns {Record<string, number>} Mapping type → score
 */
function scoreArchitectures(frameworks, paths) {
  /** @type {Record<string, number>} */
  const scores = {
    "clean-architecture": 0,
    "feature-based": 0,
    "mvc-layered": 0,
    nextjs: 0,
    monorepo: 0,
  };

  // ── Clean Architecture (NestJS / DDD) ────────────────────────────────────────
  if (paths.modulesDir) scores["clean-architecture"] += 5;
  if (paths.hasUseCasesDir) scores["clean-architecture"] += 5;
  if (paths.hasDomainDir) scores["clean-architecture"] += 3;
  if (paths.hasNestCliJson) scores["clean-architecture"] += 4;
  if (frameworks.backend === "nestjs") scores["clean-architecture"] += 3;

  // ── Feature-Based (SPA React/Vue) ────────────────────────────────────────────
  if (paths.featuresDir) scores["feature-based"] += 5;
  if (frameworks.frontend === "react") scores["feature-based"] += 2;
  if (frameworks.frontend === "vue") scores["feature-based"] += 2;
  if (paths.hasViteConfig) scores["feature-based"] += 2;

  // ── MVC / Layered (Express / Fastify / Koa) ────────────────────────────────
  if (paths.controllersDir) scores["mvc-layered"] += 5;
  // services/ + controllers/ ensemble → fort signal MVC
  if (paths.servicesDir && paths.controllersDir) scores["mvc-layered"] += 3;
  if (frameworks.backend === "express") scores["mvc-layered"] += 3;
  if (frameworks.backend === "fastify") scores["mvc-layered"] += 2;
  if (frameworks.backend === "koa") scores["mvc-layered"] += 2;

  // ── Next.js ──────────────────────────────────────────────────────────────────
  if (frameworks.isNextJs) scores["nextjs"] += 8;
  if (paths.hasNextConfig) scores["nextjs"] += 5;
  if (paths.pagesDir) scores["nextjs"] += 4;
  if (paths.appRouterDir) scores["nextjs"] += 4;

  // ── Monorepo ──────────────────────────────────────────────────────────────────────
  if (frameworks.isMonorepo) scores["monorepo"] += 6;
  if (paths.packagesDir) scores["monorepo"] += 3;
  if (paths.appsDir && paths.packagesDir) scores["monorepo"] += 3;

  // ── Pénalité croisée : éviter les faux positifs feature-based sur les projets clean-arch ─
  // Si des signaux forts de clean-arch sont présents, réduire le score feature-based
  if (paths.modulesDir && paths.hasUseCasesDir) {
    scores['feature-based'] -= 4;
  }
  // Éviter que hasViteConfig booste feature-based sur un projet NestJS+Vite
  if (frameworks.backend === 'nestjs' && paths.hasViteConfig) {
    scores['feature-based'] -= 2;
  }
  // S'assurer que les scores ne sont pas négatifs
  for (const key of Object.keys(scores)) {
    if (scores[key] < 0) scores[key] = 0;
  }

  return scores;
}

/**
 * Sélectionne le type d'architecture avec le score le plus élevé.
 * Retourne `'unknown'` si tous les scores sont à 0.
 *
 * @param {Record<string, number>} scores
 * @returns {{ type: string, score: number }}
 */
function pickBest(scores) {
  let bestType = "unknown";
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return { type: bestType, score: bestScore };
}

/**
 * Convertit un score brut en niveau de confiance.
 *
 * @param {number} score
 * @returns {'high'|'medium'|'low'}
 */
function toConfidence(score) {
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

// ─── Résolution des chemins ───────────────────────────────────────────────────

/**
 * Construit l'objet DetectedPaths exposé dans l'ArchitectureProfile
 * à partir des chemins bruts du scan de dossiers.
 *
 * @param {string}          projectRoot
 * @param {RawDetectedPaths} raw
 * @returns {DetectedPaths}
 */
function resolvedPaths(projectRoot, raw) {
  return {
    root: projectRoot,
    src: raw.srcDir ?? null,
    backend: raw.backendDir ?? null,
    frontend: raw.frontendDir ?? null,
    modulesDir: raw.modulesDir ?? null,
    featuresDir: raw.featuresDir ?? null,
    controllersDir: raw.controllersDir ?? null,
    servicesDir: raw.servicesDir ?? null,
    // Pour Next.js on préfère pagesDir, sinon appRouterDir (App Router)
    pagesDir: raw.pagesDir ?? raw.appRouterDir ?? null,
    testsDir: raw.testsDir ?? null,
  };
}

/**
 * Calcule les statistiques agrégées à partir de la SourceMap.
 *
 * @param {SourceDirEntry[]} sourceMap
 * @returns {import('../types.mjs').SourceMapStats}
 */
function computeSourceMapStats(sourceMap) {
  const totalSourceFiles   = sourceMap.reduce((s, e) => s + e.sourceFiles.length, 0);
  const totalTestsExisting = sourceMap.reduce((s, e) => s + e.existingTestCount, 0);
  const totalTestsMissing  = sourceMap.reduce((s, e) => s + e.missingTestCount, 0);
  const totalDesync        = sourceMap.reduce((s, e) => s + (e.desyncCount ?? 0), 0);
  const coveragePercent    = totalSourceFiles > 0
    ? Math.round((totalTestsExisting / totalSourceFiles) * 100)
    : 0;

  return {
    totalDirs: sourceMap.length,
    totalSourceFiles,
    totalTestsExisting,
    totalTestsMissing,
    totalDesync,
    coveragePercent,
  };
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Analyse un projet et retourne son profil d'architecture complet.
 *
 * Le profil contient :
 *  - Le type d'architecture détecté et la confiance associée
 *  - Les frameworks et outils installés
 *  - Les chemins clés résolus (absolus)
 *  - La TestStrategy adaptée (règles de génération de tests)
 *  - Les scores bruts pour débugger / comprendre la décision
 *
 * @param {string} projectRoot - Chemin absolu de la racine du projet
 * @returns {Promise<ArchitectureProfile>}
 */
export async function detectArchitecture(projectRoot) {
  logger.info(`Analyse de l'architecture : ${projectRoot}`);

  // ── 1. Collecter tous les signaux en parallèle ────────────────────────────
  const [frameworks, rawPaths] = await Promise.all([
    detectFrameworks(projectRoot),
    detectPaths(projectRoot),
  ]);

  // ── 2. Scorer et sélectionner ─────────────────────────────────────────────
  const allScores = scoreArchitectures(frameworks, rawPaths);
  const { type, score } = pickBest(allScores);
  const confidence = toConfidence(score);

  logger.info(
    `Architecture détectée : \x1b[1m${type}\x1b[0m (confiance : ${confidence}, score : ${score})`,
  );

  // ── 3. Résoudre les chemins ───────────────────────────────────────────────
  const paths = resolvedPaths(projectRoot, rawPaths);

  // ── 4. Construire la stratégie de tests ─────────────────────────────────
  const testStrategy = buildTestStrategy(
    /** @type {import('../types.mjs').ArchitectureType} */ (type),
    frameworks,
    paths,
  );

  // ── 5. Cartographier TOUS les répertoires sources → tests ─────────────────
  const partialProfile = {
    type: /** @type {import('../types.mjs').ArchitectureType} */ (type),
    confidence,
    frameworks,
    paths,
    testStrategy,
    score,
    allScores,
    sourceMap: [],
    sourceMapStats: {
      totalDirs: 0,
      totalSourceFiles: 0,
      totalTestsExisting: 0,
      totalTestsMissing: 0,
      totalDesync: 0,
      coveragePercent: 0,
    },
  };

  const sourceMap = await buildSourceMap(partialProfile);
  const sourceMapStats = computeSourceMapStats(sourceMap);

  logger.info(
    `Source map : ${sourceMapStats.totalDirs} dossiers, ` +
    `${sourceMapStats.totalSourceFiles} sources, ` +
    `${sourceMapStats.totalTestsExisting} tests existants, ` +
    `${sourceMapStats.totalTestsMissing} à créer` +
    (sourceMapStats.totalDesync > 0 ? `, ${sourceMapStats.totalDesync} désynchronisés` : '') +
    ` (couverture : ${sourceMapStats.coveragePercent}%)`
  );

  return {
    type: /** @type {import('../types.mjs').ArchitectureType} */ (type),
    confidence,
    frameworks,
    paths,
    testStrategy,
    sourceMap,
    sourceMapStats,
    score,
    allScores,
  };
}
