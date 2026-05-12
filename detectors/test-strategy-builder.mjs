/**
 * @file test-strategy-builder.mjs
 * @description Construit la TestStrategy adaptée à l'architecture détectée.
 *
 * Chaque stratégie définit :
 *  - L'emplacement des fichiers de test (colocated, root-tests-dir, mirror)
 *  - Les règles (TestRule) par type de source
 *  - Le framework à utiliser pour chaque règle
 *
 * @module detectors/test-strategy-builder
 */

/** @import { ArchitectureType, FrameworkInfo, DetectedPaths, TestStrategy, TestRule } from '../types.mjs' */

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Résout le framework de test à utiliser pour une règle donnée.
 * Priorité : runner explicitement détecté > `defaultRunner`.
 *
 * @param {FrameworkInfo} frameworks
 * @param {'jest'|'vitest'} defaultRunner
 * @returns {'jest'|'vitest'}
 */
function resolveRunner(frameworks, defaultRunner) {
  return frameworks.testRunner ?? defaultRunner;
}

// ─── Stratégies par architecture ──────────────────────────────────────────────

/**
 * Clean Architecture — NestJS + DDD avec backend et (optionnellement) frontend React.
 *
 * Backend :  __tests__/ colocalisés dans use-cases/
 * Frontend : __tests__/ colocalisés dans features/{feature}/components|hooks/
 *
 * @param {FrameworkInfo} fw
 * @param {DetectedPaths} paths
 * @returns {TestStrategy}
 */
function buildCleanArchStrategy(fw, paths) {
  const backendRunner  = resolveRunner(fw, 'jest');
  const frontendRunner = resolveRunner(fw, 'vitest');

  /** @type {TestRule[]} */
  const rules = [
    {
      name:         'use-cases',
      description:  'Use-cases backend (couche application)',
      sourcePattern: '**/application/use-cases/**/*UseCase.ts',
      testPlacement: 'colocated',
      testDirName:  '__tests__',
      testNaming:   '{name}.test.ts',
      framework:    backendRunner,
      template:     'backend-use-case',
      workspace:    'backend',
    },
  ];

  // Ajouter les règles frontend uniquement si le projet en a un
  if (paths.featuresDir) {
    rules.push(
      {
        name:         'components',
        description:  'Composants React (feature-based)',
        sourcePattern: '**/features/**/components/**/*.tsx',
        testPlacement: 'colocated',
        testDirName:  '__tests__',
        testNaming:   '{name}.test.tsx',
        framework:    frontendRunner,
        template:     'frontend-component',
        workspace:    'frontend',
      },
      {
        name:         'hooks',
        description:  'React Hooks (feature-based)',
        sourcePattern: '**/features/**/hooks/use*.ts',
        testPlacement: 'colocated',
        testDirName:  '__tests__',
        testNaming:   '{name}.test.ts',
        framework:    frontendRunner,
        template:     'frontend-hook',
        workspace:    'frontend',
      },
    );
  }

  return { placement: 'colocated', testDirName: '__tests__', fileNaming: 'test', rules };
}

/**
 * Feature-Based — SPA React/Vue organisée en features verticales.
 *
 * @param {FrameworkInfo} fw
 * @returns {TestStrategy}
 */
function buildFeatureBasedStrategy(fw) {
  const runner = resolveRunner(fw, 'vitest');

  return {
    placement:   'colocated',
    testDirName: '__tests__',
    fileNaming:  'test',
    rules: [
      {
        name:         'components',
        description:  'Composants React/Vue',
        sourcePattern: '**/features/**/components/**/*.tsx',
        testPlacement: 'colocated',
        testDirName:  '__tests__',
        testNaming:   '{name}.test.tsx',
        framework:    runner,
        template:     'frontend-component',
        workspace:    'frontend',
      },
      {
        name:         'hooks',
        description:  'React Hooks',
        sourcePattern: '**/features/**/hooks/use*.ts',
        testPlacement: 'colocated',
        testDirName:  '__tests__',
        testNaming:   '{name}.test.ts',
        framework:    runner,
        template:     'frontend-hook',
        workspace:    'frontend',
      },
    ],
  };
}

/**
 * MVC / Layered — Express, Fastify, Koa avec controllers/services.
 *
 * Les tests sont centralisés dans un dossier `tests/` à la racine,
 * miroir de la structure src/ (tests/controllers/, tests/services/, …).
 *
 * @param {FrameworkInfo} fw
 * @returns {TestStrategy}
 */
function buildMvcStrategy(fw) {
  const runner = resolveRunner(fw, 'jest');

  return {
    placement:   'root-tests-dir',
    testDirName: 'tests',
    fileNaming:  'test',
    rules: [
      {
        name:         'controllers',
        description:  'Contrôleurs HTTP',
        sourcePattern: '**/controllers/**/*.ts',
        testPlacement: 'root-tests-dir',
        testDirName:  'tests',
        testSubDir:   'controllers',
        testNaming:   '{name}.test.ts',
        framework:    runner,
        template:     'mvc-controller',
        workspace:    'backend',
      },
      {
        name:         'services',
        description:  'Services métier',
        sourcePattern: '**/services/**/*.ts',
        testPlacement: 'root-tests-dir',
        testDirName:  'tests',
        testSubDir:   'services',
        testNaming:   '{name}.test.ts',
        framework:    runner,
        template:     'mvc-service',
        workspace:    'backend',
      },
    ],
  };
}

/**
 * Next.js — Pages Router ou App Router.
 *
 * @param {FrameworkInfo} fw
 * @returns {TestStrategy}
 */
function buildNextjsStrategy(fw) {
  const runner = resolveRunner(fw, 'jest');

  return {
    placement:   'colocated',
    testDirName: '__tests__',
    fileNaming:  'test',
    rules: [
      {
        name:         'pages',
        description:  'Pages / Route handlers Next.js',
        sourcePattern: '{pages,app}/**/*.tsx',
        testPlacement: 'colocated',
        testDirName:  '__tests__',
        testNaming:   '{name}.test.tsx',
        framework:    runner,
        template:     'nextjs-page',
        workspace:    'frontend',
      },
      {
        name:         'components',
        description:  'Composants React',
        sourcePattern: 'components/**/*.tsx',
        testPlacement: 'colocated',
        testDirName:  '__tests__',
        testNaming:   '{name}.test.tsx',
        framework:    runner,
        template:     'frontend-component',
        workspace:    'frontend',
      },
    ],
  };
}

/**
 * Monorepo — pnpm/turborepo/lerna avec packages/ et apps/.
 *
 * Chaque package a ses propres tests colocalisés.
 *
 * @param {FrameworkInfo} fw
 * @returns {TestStrategy}
 */
function buildMonorepoStrategy(fw) {
  const runner = resolveRunner(fw, 'jest');

  return {
    placement:   'colocated',
    testDirName: '__tests__',
    fileNaming:  'test',
    rules: [
      {
        name:         'packages',
        description:  'Sources des packages du monorepo',
        sourcePattern: '{packages,apps}/*/src/**/*.ts',
        testPlacement: 'colocated',
        testDirName:  '__tests__',
        testNaming:   '{name}.test.ts',
        framework:    runner,
        template:     'generic-unit',
        workspace:    'all',
      },
    ],
  };
}

/**
 * Stratégie par défaut pour les architectures inconnues ou non détectées.
 *
 * @param {FrameworkInfo} fw
 * @returns {TestStrategy}
 */
function buildDefaultStrategy(fw) {
  const runner = resolveRunner(fw, 'jest');

  return {
    placement:   'colocated',
    testDirName: '__tests__',
    fileNaming:  'test',
    rules: [
      {
        name:         'sources',
        description:  'Fichiers TypeScript sources',
        sourcePattern: 'src/**/*.ts',
        testPlacement: 'colocated',
        testDirName:  '__tests__',
        testNaming:   '{name}.test.ts',
        framework:    runner,
        template:     'generic-unit',
        workspace:    'all',
      },
    ],
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Construit la TestStrategy adaptée au type d'architecture et aux frameworks détectés.
 *
 * @param {ArchitectureType} archType
 * @param {FrameworkInfo}    frameworks
 * @param {DetectedPaths}    paths
 * @returns {TestStrategy}
 */
export function buildTestStrategy(archType, frameworks, paths) {
  switch (archType) {
    case 'clean-architecture': return buildCleanArchStrategy(frameworks, paths);
    case 'feature-based':      return buildFeatureBasedStrategy(frameworks);
    case 'mvc-layered':        return buildMvcStrategy(frameworks);
    case 'nextjs':             return buildNextjsStrategy(frameworks);
    case 'monorepo':           return buildMonorepoStrategy(frameworks);
    default:                   return buildDefaultStrategy(frameworks);
  }
}
