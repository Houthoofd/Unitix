/**
 * @file engine.mjs
 * @description Orchestrateur principal du générateur de tests.
 *
 * Reçoit une GeneratorConfig complète, orchestre les scanners, generators
 * et fs-utils pour produire les fichiers de tests, et retourne un résumé.
 *
 * C'est le seul fichier du core qui connaît tous les autres modules.
 * Les consommateurs externes n'interagissent qu'avec index.mjs (API publique).
 *
 * @module core/engine
 */

import { dirname } from "path";
import { readFile } from "node:fs/promises";

import { computeFileHash, extractStoredHash } from "../utils/hash-utils.mjs";
import {
  hasSyncMarkers,
  extractManualTail,
  mergeSyncContent,
  countNonEmptyLines,
} from "../utils/sync-merger.mjs";

import { scanBackendUseCases } from "../scanners/backend-scanner.mjs";
import { scanFrontendFiles } from "../scanners/frontend-scanner.mjs";
import { generateBackendTest } from "../generators/backend-generator.mjs";
import { generateFrontendTest } from "../generators/frontend-generator.mjs";
import { ensureDir, writeFileSafe, fileExists } from "../utils/fs-utils.mjs";
import { logger } from "../utils/logger.mjs";
import { detectArchitecture } from "../detectors/architecture-detector.mjs";

/** @import { GeneratorConfig, GenerationResult, GenerationSummary, ArchitectureProfile } from '../types.mjs' */

// ─── Auto-config depuis un ArchitectureProfile ───────────────────────────────

/**
 * Construit un GeneratorConfig à partir d'un ArchitectureProfile détecté.
 *
 * Couvre les architectures supportées par les scanners existants :
 *  - clean-architecture → BackendConfig (modulesDir) + FrontendConfig si featuresDir existe
 *  - feature-based      → FrontendConfig uniquement
 *  - autres             → config minimale (pas de scan automatique possible)
 *
 * @param {ArchitectureProfile} profile
 * @param {Partial<GeneratorConfig>} [overrides] - Options CLI fusionnées (workspace, module…)
 * @returns {GeneratorConfig}
 */
function buildConfigFromProfile(profile, overrides = {}) {
  /** @type {GeneratorConfig} */
  const config = {
    projectRoot: profile.paths.root,
    workspace: overrides.workspace ?? "all",
    module: overrides.module ?? null,
    sprint: overrides.sprint ?? "all",
    dryRun: overrides.dryRun ?? false,
    force: overrides.force ?? false,
    skipExisting: overrides.skipExisting ?? true,
    verbose: overrides.verbose ?? false,
    sync: overrides.sync ?? false,
  };

  const ws = config.workspace;

  // ── Backend : use-cases (clean-architecture uniquement) ─────────────────────
  if (
    profile.paths.modulesDir &&
    profile.type === "clean-architecture" &&
    (ws === "all" || ws === "backend")
  ) {
    const backendRule = profile.testStrategy.rules.find(
      (r) => r.workspace === "backend",
    );
    config.backend = {
      modulesDir: profile.paths.modulesDir,
      testFramework: backendRule?.framework ?? "jest",
      testFileExtension: ".test.ts",
    };
  }

  // ── Frontend : composants + hooks (clean-arch ou feature-based) ──────────────
  if (
    profile.paths.featuresDir &&
    (profile.type === "clean-architecture" ||
      profile.type === "feature-based") &&
    (ws === "all" || ws === "frontend")
  ) {
    const frontendRule = profile.testStrategy.rules.find(
      (r) => r.workspace === "frontend",
    );
    config.frontend = {
      featuresDir: profile.paths.featuresDir,
      testFramework: frontendRule?.framework ?? "vitest",
      testFileExtension: ".test.tsx",
      hookTestFileExtension: ".test.ts",
    };
  }

  return config;
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Détermine si le workspace backend doit être traité.
 *
 * @param {GeneratorConfig} config
 * @returns {boolean}
 */
function shouldRunBackend(config) {
  const ws = config.workspace ?? "all";
  return !!config.backend && (ws === "all" || ws === "backend");
}

/**
 * Détermine si le workspace frontend doit être traité.
 *
 * @param {GeneratorConfig} config
 * @returns {boolean}
 */
function shouldRunFrontend(config) {
  const ws = config.workspace ?? "all";
  return !!config.frontend && (ws === "all" || ws === "frontend");
}

/**
 * Construit le résumé agrégé à partir de la liste des résultats.
 *
 * @param {GenerationResult[]} results
 * @returns {GenerationSummary}
 */
function buildSummary(results) {
  return {
    results,
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    dryRun: results.filter((r) => r.status === "dry-run").length,
    synced: results.filter((r) => r.status === "synced").length,
    total: results.length,
  };
}

/**
 * Traite un fichier généré : vérifie les conditions d'écriture, écrit (ou simule),
 * logue le résultat et retourne le GenerationResult.
 *
 * @param {{ content: string, testFilePath: string }} generated
 * @param {string}           sourceFilePath
 * @param {GeneratorConfig}  config
 * @returns {Promise<GenerationResult>}
 */
async function processGenerated(generated, sourceFilePath, config) {
  const { content, testFilePath } = generated;

  // Vérifier si le fichier existe déjà (info nécessaire pour le statut final)
  const exists = await fileExists(testFilePath);
  const skipExisting = config.force ? false : (config.skipExisting ?? true);

  // Suivi de la désynchronisation (pour la fusion chirurgicale)
  let isDesync = false;

  // ── Décision de skip ──────────────────────────────────────────────────────────────────────────────────────
  if (skipExisting && exists) {
    if (config.sync) {
      // Mode --sync : comparer le hash source stocké avec le hash actuel
      const storedHash = await extractStoredHash(testFilePath);

      if (storedHash === null) {
        // Pas de hash → fichier manuel ou stub pré-v0.4.0 → ne pas toucher
        const result = {
          status: "skipped",
          testFilePath,
          sourceFilePath,
          reason: "no hash (fichier manuel)",
        };
        logger.file(testFilePath, "skipped", "no hash");
        return result;
      }

      const currentHash = await computeFileHash(sourceFilePath);
      if (storedHash === currentHash) {
        // Source inchangée → à jour, pas besoin de regénérer
        const result = {
          status: "skipped",
          testFilePath,
          sourceFilePath,
          reason: "à jour",
        };
        logger.file(testFilePath, "skipped", "à jour");
        return result;
      }

      // Hash différent → source modifiée, on régénère
      isDesync = true;
      logger.debug(`Désync détecté : ${testFilePath}`, config.verbose);
    } else {
      // Mode normal : skip systématique si le fichier existe
      const result = {
        status: "skipped",
        testFilePath,
        sourceFilePath,
        reason: "already exists",
      };
      logger.file(testFilePath, "skipped", "already exists");
      return result;
    }
  }

  // ── Dry-run ───────────────────────────────────────────────────────────────────────────────
  if (config.dryRun) {
    const result = { status: "dry-run", testFilePath, sourceFilePath };
    logger.file(testFilePath, "dry-run");
    return result;
  }

  // ── Fusion chirurgicale (sync + marqueurs présents) ────────────────────────────────────────────
  // Préserve les tests manuels ajoutés après // @unitix:end
  let finalContent = content;
  if (isDesync) {
    const existingRaw = await readFile(testFilePath, "utf-8");
    if (hasSyncMarkers(existingRaw)) {
      const manualTail = extractManualTail(existingRaw);
      if (manualTail !== null) {
        finalContent = mergeSyncContent(content, manualTail);
        logger.debug(
          `${countNonEmptyLines(manualTail)} ligne(s) manuelle(s) préservée(s) dans ${testFilePath}`,
          config.verbose,
        );
      }
    }
    // Fichier sans marqueurs (pré-v0.4.1) → régénération complète (finalContent = content)
  }

  // ── Écriture ──────────────────────────────────────────────────────────────────────────────────────────────
  await ensureDir(dirname(testFilePath));
  // Force l'écriture si config.force OU si on est en mode sync sur un fichier désync
  const forceWrite = config.force || (config.sync && exists);
  const { written, reason } = await writeFileSafe(
    testFilePath,
    finalContent,
    forceWrite,
  );

  if (written) {
    const status = config.sync && exists ? "synced" : "created";
    logger.file(testFilePath, status);
    return { status, testFilePath, sourceFilePath };
  }

  // writeFileSafe a refusé (cas rare)
  const result = { status: "skipped", testFilePath, sourceFilePath, reason };
  logger.file(testFilePath, "skipped", reason);
  return result;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Point d'entrée principal du générateur.
 *
 * Exécute les étapes suivantes pour chaque workspace activé :
 *  1. Scanner les fichiers sources (use-cases / composants / hooks)
 *  2. Pour chaque fichier, appeler le generator approprié
 *  3. Écrire (ou simuler) le fichier de test résultant
 *  4. Collecter les résultats et retourner un résumé
 *
 * @param {GeneratorConfig} config - Configuration complète (fusionnée avec les options CLI)
 * @returns {Promise<GenerationSummary>}
 */
export async function generateTests(config) {
  /** @type {GenerationResult[]} */
  const results = [];

  // ════════════════════════════════════════════════════════════════════════════
  // BACKEND — Sprint 1 : Use-Cases
  // ════════════════════════════════════════════════════════════════════════════
  if (shouldRunBackend(config)) {
    logger.section("Backend — Use-Cases (Sprint 1)");

    let useCaseFiles;
    try {
      useCaseFiles = await scanBackendUseCases(config.backend, config);
    } catch (err) {
      logger.error(`Erreur lors du scan backend : ${err.message}`);
      useCaseFiles = [];
    }

    logger.info(`${useCaseFiles.length} use-case(s) trouvé(s)`);

    for (const file of useCaseFiles) {
      logger.debug(`Traitement : ${file.filePath}`, config.verbose);

      try {
        const generated = await generateBackendTest(
          file.filePath,
          config.backend,
        );

        if (!generated) {
          results.push({
            status: "error",
            testFilePath: file.testFilePath,
            sourceFilePath: file.filePath,
            reason: "parsing failed",
          });
          logger.file(file.testFilePath, "error", "parsing failed");
          continue;
        }

        const result = await processGenerated(generated, file.filePath, config);
        results.push(result);
      } catch (err) {
        logger.error(`${file.filePath} — ${err.message}`);
        results.push({
          status: "error",
          testFilePath: file.testFilePath,
          sourceFilePath: file.filePath,
          reason: err.message,
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FRONTEND — Sprint 2 : Composants + Hooks
  // ════════════════════════════════════════════════════════════════════════════
  if (shouldRunFrontend(config)) {
    logger.section("Frontend — Composants & Hooks (Sprint 2)");

    let frontendFiles;
    try {
      frontendFiles = await scanFrontendFiles(config.frontend, config);
    } catch (err) {
      logger.error(`Erreur lors du scan frontend : ${err.message}`);
      frontendFiles = [];
    }

    const components = frontendFiles.filter((f) => f.type === "component");
    const hooks = frontendFiles.filter((f) => f.type === "hook");
    logger.info(
      `${components.length} composant(s) + ${hooks.length} hook(s) trouvés`,
    );

    for (const file of frontendFiles) {
      logger.debug(`Traitement : ${file.filePath}`, config.verbose);

      try {
        const generated = await generateFrontendTest(
          file.filePath,
          file.type,
          config.frontend,
        );

        if (!generated) {
          results.push({
            status: "error",
            testFilePath: file.testFilePath,
            sourceFilePath: file.filePath,
            reason: "parsing failed",
          });
          logger.file(file.testFilePath, "error", "parsing failed");
          continue;
        }

        const result = await processGenerated(generated, file.filePath, config);
        results.push(result);
      } catch (err) {
        logger.error(`${file.filePath} — ${err.message}`);
        results.push({
          status: "error",
          testFilePath: file.testFilePath,
          sourceFilePath: file.filePath,
          reason: err.message,
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ════════════════════════════════════════════════════════════════════════════
  const summary = buildSummary(results);
  logger.summary(summary);

  return summary;
}

/**
 * Variante auto-détectée de generateTests.
 *
 * Analyse l'architecture du projet à partir de `projectRoot`, construit
 * automatiquement le GeneratorConfig adapté, puis exécute la génération.
 *
 * Utilisé par la CLI avec le flag `--auto`.
 *
 * @param {string}                  projectRoot - Chemin absolu de la racine du projet
 * @param {Partial<GeneratorConfig>} [options]  - Options CLI optionnelles
 * @returns {Promise<{ profile: ArchitectureProfile, summary: GenerationSummary }>}
 */
export async function generateTestsAuto(projectRoot, options = {}) {
  // 1. Détecter l'architecture
  const profile = await detectArchitecture(projectRoot);

  // 2. Construire la config depuis le profil (+ fusionner les options)
  const config = buildConfigFromProfile(profile, options);

  if (options.verbose) {
    logger.info(
      `Config auto-générée depuis le profil :\n${JSON.stringify(config, null, 2)}`,
    );
  }

  // 3. Générer les tests avec la config résolue
  const summary = await generateTests(config);

  return { profile, summary };
}
