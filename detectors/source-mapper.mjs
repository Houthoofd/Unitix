/**
 * @file source-mapper.mjs
 * @description Cartographie complète des répertoires sources d'un projet :
 *              pour chaque dossier contenant des fichiers testables, calcule
 *              le dossier de tests correspondant et son état (existant / manquant).
 *
 * Contrairement au détecteur d'architecture (qui ne trouve que les racines),
 * le source mapper descend récursivement dans TOUS les sous-dossiers pour
 * produire une liste exhaustive des emplacements où des `__tests__/` doivent
 * être créés.
 *
 * Résultat inclus dans `ArchitectureProfile.sourceMap`.
 *
 * @module detectors/source-mapper
 */

import { readdir } from 'fs/promises';
import { join, relative, basename } from 'path';
import { fileExists } from '../fs-utils.mjs';
import { computeFileHash, extractStoredHash } from '../hash-utils.mjs';

/** @import { ArchitectureProfile, SourceDirEntry } from '../types.mjs' */

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Dossiers à ignorer pendant le scan récursif */
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next',
  'coverage', '.turbo', '.cache', 'out', '.svelte-kit',
]);

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Liste les entrées d'un dossier. Retourne `[]` si absent ou illisible.
 *
 * @param {string} dir
 * @returns {Promise<import('fs').Dirent[]>}
 */
async function readDirSafe(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Liste les fichiers de test existants dans un dossier `__tests__/`.
 * Retourne `[]` si le dossier est absent.
 *
 * @param {string} testDir - Chemin absolu du dossier __tests__
 * @returns {Promise<string[]>} Noms des fichiers de test
 */
async function listExistingTests(testDir) {
  const entries = await readDirSafe(testDir);
  return entries
    .filter(e => e.isFile() && (e.name.endsWith('.test.ts') || e.name.endsWith('.test.tsx')))
    .map(e => e.name);
}

/**
 * Marche récursivement un dossier et collecte les répertoires qui contiennent
 * DIRECTEMENT des fichiers correspondant au filtre donné.
 *
 * Les dossiers `__tests__` et les entrées dans `IGNORED_DIRS` sont ignorés.
 *
 * @param {string}                       rootDir    - Dossier de départ
 * @param {(name: string) => boolean}    fileFilter - Filtre sur le nom de fichier
 * @param {string}                       testDirName - Nom du dossier de tests ('__tests__')
 * @param {number}                       [maxDepth=8]
 * @returns {Promise<Array<{ dir: string, files: string[] }>>}
 */
async function walkSourceDirs(rootDir, fileFilter, testDirName = '__tests__', maxDepth = 8) {
  /** @type {Array<{ dir: string, files: string[] }>} */
  const result = [];

  /**
   * @param {string} dir
   * @param {number} depth
   */
  async function walk(dir, depth) {
    if (depth > maxDepth) return;

    const entries = await readDirSafe(dir);
    if (entries.length === 0) return;

    // Fichiers sources directement dans ce dossier
    const matchingFiles = entries
      .filter(e => e.isFile() && fileFilter(e.name))
      .map(e => e.name);

    if (matchingFiles.length > 0) {
      result.push({ dir, files: matchingFiles });
    }

    // Récursion dans les sous-dossiers (pas __tests__, pas node_modules…)
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        entry.name !== testDirName &&
        !IGNORED_DIRS.has(entry.name) &&
        !entry.name.startsWith('.')
      ) {
        await walk(join(dir, entry.name), depth + 1);
      }
    }
  }

  await walk(rootDir, 0);
  return result;
}

/**
 * Construit un `SourceDirEntry` à partir des informations collectées.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.sourceDir
 * @param {string[]} params.sourceFiles
 * @param {string} params.testDir
 * @param {string} params.ruleName
 * @param {string} params.module
 * @param {'backend'|'frontend'|'all'} params.workspace
 * @returns {Promise<SourceDirEntry>}
 */
async function buildEntry({ projectRoot, sourceDir, sourceFiles, testDir, ruleName, module: moduleName, workspace }) {
  const testDirExists   = await fileExists(testDir);
  const existingTests   = testDirExists ? await listExistingTests(testDir) : [];
  const missingCount    = sourceFiles.length - existingTests.length;

  // ── Détection de désynchronisation (stubs dont la source a changé) ────────────────────
  const desyncFiles = [];
  if (testDirExists) {
    for (const sourceFile of sourceFiles) {
      // Chercher le fichier de test correspondant (même nom, extension .test.ts/.test.tsx)
      const baseName     = sourceFile.replace(/\.(ts|tsx)$/, '');
      const testExt      = sourceFile.endsWith('.tsx') ? '.test.tsx' : '.test.ts';
      const testFilePath = join(testDir, baseName + testExt);

      if (await fileExists(testFilePath)) {
        const storedHash = await extractStoredHash(testFilePath);
        if (storedHash !== null) {
          // Hash présent → comparer avec le hash actuel du source
          try {
            const currentHash = await computeFileHash(join(sourceDir, sourceFile));
            if (storedHash !== currentHash) {
              desyncFiles.push(sourceFile);
            }
          } catch {
            // Erreur de lecture → ignorer
          }
        }
        // Si storedHash === null → stub sans hash (manuel ou ancien) → on ne considère pas désync
      }
    }
  }

  return {
    sourceDir,
    sourceDirRelative: relative(projectRoot, sourceDir).replace(/\\/g, '/'),
    module:            moduleName,
    ruleName,
    workspace,
    testDir,
    testDirRelative:   relative(projectRoot, testDir).replace(/\\/g, '/'),
    testDirExists,
    sourceFiles,
    existingTestCount: existingTests.length,
    missingTestCount:  Math.max(0, missingCount),
    desyncCount:       desyncFiles.length,
    desyncFiles,
  };
}

// ─── Mappers par architecture ─────────────────────────────────────────────────

/**
 * Cartographie les sources d'une architecture Clean / DDD.
 *
 * @param {string} projectRoot
 * @param {import('../types.mjs').DetectedPaths} paths
 * @returns {Promise<SourceDirEntry[]>}
 */
async function mapCleanArchSources(projectRoot, paths) {
  /** @type {SourceDirEntry[]} */
  const entries = [];

  // ── Backend : use-cases ──────────────────────────────────────────────────────
  if (paths.modulesDir) {
    const moduleEntries = await readDirSafe(paths.modulesDir);
    const moduleNames   = moduleEntries.filter(e => e.isDirectory()).map(e => e.name);

    for (const moduleName of moduleNames) {
      const useCasesRoot = join(paths.modulesDir, moduleName, 'application', 'use-cases');

      if (!await fileExists(useCasesRoot)) continue;

      // Trouver TOUS les sous-dossiers (y compris imbriqués) ayant des *UseCase.ts
      const sourceDirs = await walkSourceDirs(
        useCasesRoot,
        name => name.endsWith('UseCase.ts') && !name.startsWith('index'),
      );

      for (const { dir, files } of sourceDirs) {
        const testDir = join(dir, '__tests__');
        entries.push(await buildEntry({
          projectRoot,
          sourceDir:   dir,
          sourceFiles: files,
          testDir,
          ruleName:    'use-cases',
          module:      moduleName,
          workspace:   'backend',
        }));
      }
    }
  }

  // ── Frontend : composants + hooks ────────────────────────────────────────────
  if (paths.featuresDir) {
    const featureEntries = await readDirSafe(paths.featuresDir);
    const featureNames   = featureEntries.filter(e => e.isDirectory()).map(e => e.name);

    for (const featureName of featureNames) {
      const featureDir = join(paths.featuresDir, featureName);

      // Composants : un seul niveau (pas de récursion dans components/)
      const componentsDir = join(featureDir, 'components');
      if (await fileExists(componentsDir)) {
        const componentFiles = (await readDirSafe(componentsDir))
          .filter(e => e.isFile() && e.name.endsWith('.tsx') && !e.name.startsWith('_') && e.name !== 'index.tsx')
          .map(e => e.name);

        if (componentFiles.length > 0) {
          const testDir = join(componentsDir, '__tests__');
          entries.push(await buildEntry({
            projectRoot,
            sourceDir:   componentsDir,
            sourceFiles: componentFiles,
            testDir,
            ruleName:    'components',
            module:      featureName,
            workspace:   'frontend',
          }));
        }
      }

      // Hooks : un seul niveau
      const hooksDir = join(featureDir, 'hooks');
      if (await fileExists(hooksDir)) {
        const hookFiles = (await readDirSafe(hooksDir))
          .filter(e => e.isFile() && e.name.endsWith('.ts') && e.name.startsWith('use') && e.name !== 'index.ts')
          .map(e => e.name);

        if (hookFiles.length > 0) {
          const testDir = join(hooksDir, '__tests__');
          entries.push(await buildEntry({
            projectRoot,
            sourceDir:   hooksDir,
            sourceFiles: hookFiles,
            testDir,
            ruleName:    'hooks',
            module:      featureName,
            workspace:   'frontend',
          }));
        }
      }
    }
  }

  return entries;
}

/**
 * Cartographie les sources d'une architecture Feature-Based (SPA).
 *
 * @param {string} projectRoot
 * @param {import('../types.mjs').DetectedPaths} paths
 * @returns {Promise<SourceDirEntry[]>}
 */
async function mapFeatureBasedSources(projectRoot, paths) {
  // La partie frontend de clean-arch est identique à feature-based
  return mapCleanArchSources(projectRoot, { ...paths, modulesDir: null });
}

/**
 * Cartographie les sources d'une architecture MVC / Layered.
 *
 * @param {string} projectRoot
 * @param {import('../types.mjs').DetectedPaths} paths
 * @returns {Promise<SourceDirEntry[]>}
 */
async function mapMvcSources(projectRoot, paths) {
  /** @type {SourceDirEntry[]} */
  const entries = [];
  const testsRoot = join(projectRoot, 'tests');

  // Controllers
  if (paths.controllersDir) {
    const sourceDirs = await walkSourceDirs(
      paths.controllersDir,
      name => name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.startsWith('index'),
    );

    for (const { dir, files } of sourceDirs) {
      // Pour MVC, les tests sont dans tests/controllers/ (pas colocalisés)
      const relFromControllersRoot = relative(paths.controllersDir, dir).replace(/\\/g, '/');
      const testDir = join(testsRoot, 'controllers', relFromControllersRoot);
      entries.push(await buildEntry({
        projectRoot,
        sourceDir:   dir,
        sourceFiles: files,
        testDir,
        ruleName:    'controllers',
        module:      basename(dir),
        workspace:   'backend',
      }));
    }
  }

  // Services
  if (paths.servicesDir) {
    const sourceDirs = await walkSourceDirs(
      paths.servicesDir,
      name => name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.startsWith('index'),
    );

    for (const { dir, files } of sourceDirs) {
      const relFromServicesRoot = relative(paths.servicesDir, dir).replace(/\\/g, '/');
      const testDir = join(testsRoot, 'services', relFromServicesRoot);
      entries.push(await buildEntry({
        projectRoot,
        sourceDir:   dir,
        sourceFiles: files,
        testDir,
        ruleName:    'services',
        module:      basename(dir),
        workspace:   'backend',
      }));
    }
  }

  return entries;
}

/**
 * Cartographie les sources d'un projet Next.js.
 *
 * @param {string} projectRoot
 * @param {import('../types.mjs').DetectedPaths} paths
 * @returns {Promise<SourceDirEntry[]>}
 */
async function mapNextjsSources(projectRoot, paths) {
  /** @type {SourceDirEntry[]} */
  const entries = [];

  if (paths.pagesDir) {
    const sourceDirs = await walkSourceDirs(
      paths.pagesDir,
      name => (name.endsWith('.tsx') || name.endsWith('.ts')) && !name.startsWith('_') && name !== 'index.tsx',
    );

    for (const { dir, files } of sourceDirs) {
      const testDir = join(dir, '__tests__');
      entries.push(await buildEntry({
        projectRoot,
        sourceDir:   dir,
        sourceFiles: files,
        testDir,
        ruleName:    'pages',
        module:      relative(paths.pagesDir, dir).replace(/\\/g, '/') || 'root',
        workspace:   'frontend',
      }));
    }
  }

  return entries;
}

/**
 * Cartographie les sources d'un monorepo.
 *
 * @param {string} projectRoot
 * @param {import('../types.mjs').DetectedPaths} paths
 * @returns {Promise<SourceDirEntry[]>}
 */
async function mapMonorepoSources(projectRoot, paths) {
  /** @type {SourceDirEntry[]} */
  const entries = [];

  const rootsToScan = [paths.modulesDir /* packages/ */, paths.featuresDir /* apps/ */].filter(Boolean);

  for (const root of rootsToScan) {
    const packageEntries = await readDirSafe(root);
    const packageNames   = packageEntries.filter(e => e.isDirectory()).map(e => e.name);

    for (const pkgName of packageNames) {
      const srcDir = join(root, pkgName, 'src');
      if (!await fileExists(srcDir)) continue;

      const sourceDirs = await walkSourceDirs(
        srcDir,
        name => name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.startsWith('index'),
      );

      for (const { dir, files } of sourceDirs) {
        const testDir = join(dir, '__tests__');
        entries.push(await buildEntry({
          projectRoot,
          sourceDir:   dir,
          sourceFiles: files,
          testDir,
          ruleName:    'packages',
          module:      pkgName,
          workspace:   'all',
        }));
      }
    }
  }

  return entries;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Construit la cartographie complète des sources d'un projet.
 *
 * Parcourt récursivement les répertoires sources adaptés à l'architecture
 * détectée et retourne la liste exhaustive des `SourceDirEntry` :
 * chaque entrée représente un dossier source avec ses fichiers testables,
 * le dossier de test correspondant et l'état des tests existants.
 *
 * @param {ArchitectureProfile} profile - Profil d'architecture détecté
 * @returns {Promise<SourceDirEntry[]>}
 */
export async function buildSourceMap(profile) {
  const { type, paths } = profile;

  /** @type {SourceDirEntry[]} */
  let entries = [];

  switch (type) {
    case 'clean-architecture':
      entries = await mapCleanArchSources(paths.root, paths);
      break;
    case 'feature-based':
      entries = await mapFeatureBasedSources(paths.root, paths);
      break;
    case 'mvc-layered':
      entries = await mapMvcSources(paths.root, paths);
      break;
    case 'nextjs':
      entries = await mapNextjsSources(paths.root, paths);
      break;
    case 'monorepo':
      entries = await mapMonorepoSources(paths.root, paths);
      break;
    default:
      // Architecture inconnue : pas de cartographie automatique
      break;
  }

  // Tri : workspace → module → ruleName → sourceDirRelative
  entries.sort((a, b) => {
    const byWs = a.workspace.localeCompare(b.workspace);
    if (byWs !== 0) return byWs;
    const byMod = a.module.localeCompare(b.module);
    if (byMod !== 0) return byMod;
    const byRule = a.ruleName.localeCompare(b.ruleName);
    if (byRule !== 0) return byRule;
    return a.sourceDirRelative.localeCompare(b.sourceDirRelative);
  });

  return entries;
}
