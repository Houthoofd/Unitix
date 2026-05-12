/**
 * @file framework-detector.mjs
 * @description Détecte les frameworks et outils installés dans un projet
 *              en lisant les package.json (racine + sous-packages).
 *
 * @module detectors/framework-detector
 */

import { join } from 'path';
import { readFileSafe, fileExists } from '../fs-utils.mjs';

/** @import { FrameworkInfo } from '../types.mjs' */

// ─── Tables de signaux ────────────────────────────────────────────────────────

/** @type {Record<string, string[]>} */
const BACKEND_SIGNALS = {
  nestjs:  ['@nestjs/core', '@nestjs/common', '@nestjs/platform-express'],
  express: ['express'],
  fastify: ['fastify'],
  koa:     ['koa'],
};

/** @type {Record<string, string[]>} */
const FRONTEND_SIGNALS = {
  react:   ['react', 'react-dom'],
  vue:     ['vue', '@vue/core', '@vue/runtime-dom'],
  angular: ['@angular/core'],
  svelte:  ['svelte'],
  // 'next' est traité séparément via isNextJs
};

/** @type {Record<string, string[]>} */
const TEST_RUNNER_SIGNALS = {
  jest:   ['jest', '@jest/core', 'ts-jest', 'babel-jest', '@jest/globals'],
  vitest: ['vitest'],
};

/** @type {Record<string, string[]>} */
const BUNDLER_SIGNALS = {
  vite:    ['vite', '@vitejs/plugin-react', '@vitejs/plugin-vue'],
  webpack: ['webpack', 'webpack-cli'],
  esbuild: ['esbuild'],
};

/** Fichiers signalant un monorepo à la racine */
const MONOREPO_FILES = [
  'pnpm-workspace.yaml',
  'lerna.json',
  'turbo.json',
  'nx.json',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lit et parse un package.json depuis un dossier.
 * Retourne `null` si absent ou invalide (JSON malformé, permissions…).
 *
 * @param {string} dirPath - Chemin absolu du dossier contenant package.json
 * @returns {Promise<Record<string,any>|null>}
 */
async function readPackageJson(dirPath) {
  const content = await readFileSafe(join(dirPath, 'package.json'));
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Collecte l'ensemble des packages déclarés dans un package.json
 * (dependencies + devDependencies + peerDependencies).
 *
 * @param {Record<string,any>} pkg - Objet package.json parsé
 * @returns {Set<string>}
 */
function getAllDeps(pkg) {
  return new Set([
    ...Object.keys(pkg.dependencies     ?? {}),
    ...Object.keys(pkg.devDependencies  ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
}

/**
 * Retourne la première clé de `signals` dont au moins un package est présent
 * dans `deps`. Retourne `null` si aucun signal ne correspond.
 *
 * @param {Record<string, string[]>} signals
 * @param {Set<string>}              deps
 * @returns {string|null}
 */
function detectFirst(signals, deps) {
  for (const [name, packages] of Object.entries(signals)) {
    if (packages.some(p => deps.has(p))) return name;
  }
  return null;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Détecte les frameworks, outils de test et métadonnées d'un projet
 * en agrégeant les dépendances de tous les package.json trouvés.
 *
 * Chemin de recherche :
 *  1. `{projectRoot}/package.json`
 *  2. `{projectRoot}/{backend,frontend,apps,packages}/package.json`
 *
 * @param {string} projectRoot - Chemin absolu de la racine du projet
 * @returns {Promise<FrameworkInfo>}
 */
export async function detectFrameworks(projectRoot) {
  /** @type {Set<string>} Ensemble agrégé de tous les packages déclarés */
  const allDeps = new Set();

  // 1. Root package.json
  const rootPkg = await readPackageJson(projectRoot);
  if (rootPkg) {
    for (const dep of getAllDeps(rootPkg)) allDeps.add(dep);
  }

  // 2. Sub-packages courants dans les projets full-stack ou monorepos
  const subDirs = ['backend', 'frontend', 'server', 'client', 'web', 'apps', 'packages'];
  for (const subDir of subDirs) {
    const subPkg = await readPackageJson(join(projectRoot, subDir));
    if (subPkg) {
      for (const dep of getAllDeps(subPkg)) allDeps.add(dep);
    }
  }

  // 3. Détection monorepo : fichiers de workspace à la racine
  let isMonorepo = rootPkg?.workspaces != null; // champ "workspaces" dans package.json
  if (!isMonorepo) {
    for (const monoFile of MONOREPO_FILES) {
      if (await fileExists(join(projectRoot, monoFile))) {
        isMonorepo = true;
        break;
      }
    }
  }

  // 4. TypeScript : tsconfig.json ou dépendance 'typescript'
  const hasTypeScript =
    allDeps.has('typescript') ||
    await fileExists(join(projectRoot, 'tsconfig.json'));
  const language = /** @type {'typescript'|'javascript'} */ (
    hasTypeScript ? 'typescript' : 'javascript'
  );

  // 5. Next.js (traité séparément car React + SSR)
  const isNextJs = allDeps.has('next');

  // 6. Frameworks, runners, bundlers
  const backend    = /** @type {'nestjs'|'express'|'fastify'|'koa'|null} */  (detectFirst(BACKEND_SIGNALS,      allDeps));
  const frontendRaw = detectFirst(FRONTEND_SIGNALS, allDeps);
  // Si Next.js est détecté, on le range dans frontend=react (Next est React-based)
  const frontend   = /** @type {'react'|'vue'|'angular'|'svelte'|null} */ (
    isNextJs ? 'react' : /** @type {any} */ (frontendRaw)
  );
  const testRunner = /** @type {'jest'|'vitest'|null} */ (detectFirst(TEST_RUNNER_SIGNALS, allDeps));
  const bundler    = /** @type {'vite'|'webpack'|'esbuild'|null} */        (detectFirst(BUNDLER_SIGNALS,      allDeps));

  return { language, backend, frontend, testRunner, bundler, isMonorepo, isNextJs };
}
