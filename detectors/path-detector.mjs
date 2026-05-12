/**
 * @file path-detector.mjs
 * @description Analyse la structure de dossiers d'un projet pour détecter
 *              les chemins clés et les signaux d'architecture.
 *
 * Utilise une profondeur de scan limitée (2-3 niveaux) pour rester rapide,
 * même sur de grands projets.
 *
 * @module detectors/path-detector
 */

import { readdir } from 'fs/promises';
import { join }    from 'path';
import { fileExists } from '../fs-utils.mjs';

/** @import { RawDetectedPaths } from '../types.mjs' */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Liste les noms des sous-dossiers directs d'un dossier.
 * Retourne `[]` si le dossier est absent ou illisible.
 *
 * @param {string} dirPath
 * @returns {Promise<string[]>}
 */
async function listSubDirs(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

/**
 * Retourne le premier chemin absolu (parmi `candidates`) qui existe sur le FS.
 * Retourne `null` si aucun n'existe.
 *
 * @param {Array<string|null|undefined>} candidates
 * @returns {Promise<string|null>}
 */
async function firstExisting(candidates) {
  for (const p of candidates) {
    if (p && await fileExists(p)) return p;
  }
  return null;
}

/**
 * Vérifie si un sous-dossier donné existe dans au moins l'un des modules trouvés.
 * Arrête au premier match (max `limit` modules pour rester rapide).
 *
 * @param {string} modulesDir   - Chemin absolu vers le dossier parent des modules
 * @param {string} subPath      - Chemin relatif à vérifier dans chaque module (ex: 'application/use-cases')
 * @param {number} [limit=6]    - Nombre max de modules à inspecter
 * @returns {Promise<boolean>}
 */
async function hasSubPathInModules(modulesDir, subPath, limit = 6) {
  const moduleNames = await listSubDirs(modulesDir);
  for (const name of moduleNames.slice(0, limit)) {
    if (await fileExists(join(modulesDir, name, subPath))) return true;
  }
  return false;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Scanne la structure du projet et retourne les chemins bruts détectés.
 *
 * @param {string} projectRoot - Chemin absolu de la racine du projet
 * @returns {Promise<RawDetectedPaths>}
 */
export async function detectPaths(projectRoot) {
  const r = projectRoot;

  // ── Répertoires racines courants ─────────────────────────────────────────────

  const srcDir      = await firstExisting([join(r, 'src')]);
  const backendDir  = await firstExisting([join(r, 'backend'), join(r, 'server'), join(r, 'api')]);
  const frontendDir = await firstExisting([join(r, 'frontend'), join(r, 'client'), join(r, 'web')]);

  // ── Clean Architecture — modules/ ────────────────────────────────────────────

  const modulesDir = await firstExisting([
    join(r, 'src', 'modules'),
    backendDir  ? join(backendDir,  'src', 'modules') : null,
    frontendDir ? null : null, // frontend n'a pas de modules backend
  ]);

  // ── Feature-Based — features/ ────────────────────────────────────────────────

  const featuresDir = await firstExisting([
    join(r, 'src', 'features'),
    frontendDir ? join(frontendDir, 'src', 'features') : null,
    join(r, 'frontend', 'src', 'features'),
  ]);

  // ── MVC — controllers/ et services/ ─────────────────────────────────────────

  const controllersDir = await firstExisting([
    join(r, 'src', 'controllers'),
    srcDir      ? join(srcDir,      'controllers') : null,
    backendDir  ? join(backendDir,  'src', 'controllers') : null,
  ]);

  const servicesDir = await firstExisting([
    join(r, 'src', 'services'),
    srcDir      ? join(srcDir,      'services') : null,
    backendDir  ? join(backendDir,  'src', 'services') : null,
  ]);

  // ── Next.js — pages/ et app/ ─────────────────────────────────────────────────

  const pagesDir      = await firstExisting([join(r, 'pages'),     join(r, 'src', 'pages')]);
  const appRouterDir  = await firstExisting([join(r, 'app'),       join(r, 'src', 'app')]);

  // ── Monorepo — packages/ et apps/ ────────────────────────────────────────────

  const packagesDir = await firstExisting([join(r, 'packages')]);
  const appsDir     = await firstExisting([join(r, 'apps')]);

  // ── Tests existants ───────────────────────────────────────────────────────────

  const testsDir = await firstExisting([join(r, 'tests'), join(r, 'test'), join(r, '__tests__')]);

  // ── Signaux DDD (use-cases + domain) ─────────────────────────────────────────

  let hasUseCasesDir = false;
  let hasDomainDir   = false;

  if (modulesDir) {
    // Cherche application/use-cases dans les premiers modules
    hasUseCasesDir = await hasSubPathInModules(modulesDir, join('application', 'use-cases'));
    // Cherche domain/ dans les premiers modules
    hasDomainDir   = await hasSubPathInModules(modulesDir, 'domain');
  }

  // Fallback : src/domain ou backend/src/domain
  if (!hasDomainDir) {
    hasDomainDir = !!(
      await firstExisting([
        join(r, 'src', 'domain'),
        backendDir ? join(backendDir, 'src', 'domain') : null,
      ])
    );
  }

  // ── Fichiers de configuration ─────────────────────────────────────────────────

  const hasNestCliJson = await fileExists(join(r, 'nest-cli.json'));

  const hasNextConfig = !!(await firstExisting([
    join(r, 'next.config.js'),
    join(r, 'next.config.mjs'),
    join(r, 'next.config.ts'),
  ]));

  const hasViteConfig = !!(await firstExisting([
    join(r, 'vite.config.ts'),
    join(r, 'vite.config.js'),
    frontendDir ? join(frontendDir, 'vite.config.ts') : null,
    frontendDir ? join(frontendDir, 'vite.config.js') : null,
  ]));

  const hasAngularJson = await fileExists(join(r, 'angular.json'));

  const hasJestConfig = !!(await firstExisting([
    join(r, 'jest.config.js'),
    join(r, 'jest.config.ts'),
    join(r, 'jest.config.mjs'),
    join(r, 'jest.config.cjs'),
    backendDir ? join(backendDir, 'jest.config.js') : null,
    backendDir ? join(backendDir, 'jest.config.ts') : null,
  ]));

  const hasVitestConfig = !!(await firstExisting([
    join(r, 'vitest.config.ts'),
    join(r, 'vitest.config.js'),
    frontendDir ? join(frontendDir, 'vitest.config.ts') : null,
    frontendDir ? join(frontendDir, 'vitest.config.js') : null,
  ]));

  return {
    // Répertoires
    srcDir,
    backendDir,
    frontendDir,
    modulesDir,
    featuresDir,
    controllersDir,
    servicesDir,
    pagesDir,
    appRouterDir,
    packagesDir,
    appsDir,
    testsDir,
    // Signaux booléens
    hasUseCasesDir,
    hasDomainDir,
    hasNestCliJson,
    hasNextConfig,
    hasViteConfig,
    hasAngularJson,
    hasJestConfig,
    hasVitestConfig,
  };
}
