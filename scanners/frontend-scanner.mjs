/**
 * @file frontend-scanner.mjs
 * @description Scanner de fichiers frontend (composants React et hooks).
 *
 * Parcourt les features et les composants partagés pour trouver les fichiers
 * sources à tester. Ne fait **pas** de parsing AST — retourne uniquement des
 * chemins de fichiers enrichis du chemin de test attendu.
 *
 * Fait partie du générateur de tests @clubmanager/test-generator.
 */

import { readdir } from 'fs/promises';
import { join, dirname, basename } from 'path';

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Lit les noms des sous-dossiers directs d'un dossier.
 * Retourne `[]` si le dossier n'existe pas (ENOENT), sans lever d'exception.
 *
 * @param {string} dirPath - Chemin absolu du dossier à lire
 * @returns {Promise<string[]>} Noms des sous-dossiers trouvés
 */
async function readSubDirNames(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {
    return [];
  }
}

/**
 * Lit les fichiers d'un dossier (1 niveau, **non récursif**) correspondant
 * au filtre donné sur le nom de fichier.
 * Retourne `[]` si le dossier n'existe pas (ENOENT), sans lever d'exception.
 *
 * @param {string}                     dirPath  - Chemin absolu du dossier
 * @param {(name: string) => boolean}  filterFn - Filtre appliqué sur le nom de fichier seul
 * @returns {Promise<string[]>} Chemins absolus des fichiers correspondants
 */
async function readDirFiles(dirPath, filterFn) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && filterFn(e.name))
      .map(e => join(dirPath, e.name));
  } catch {
    return [];
  }
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Scanne le dossier des features frontend pour trouver tous les composants et
 * hooks à tester, ainsi que les composants partagés si `sharedComponentsDir`
 * est configuré.
 *
 * ### 1 — Composants de feature (1 niveau)
 * Dossier : `{featuresDir}/{feature}/{componentsPattern}/`
 * - ✅ Extension `.tsx`
 * - ❌ Ignoré si le nom commence par `_`
 * - ❌ Ignoré si `index.ts` ou `index.tsx`
 *
 * ### 2 — Hooks de feature (1 niveau)
 * Dossier : `{featuresDir}/{feature}/{hooksPattern}/`
 * - ✅ Extension `.ts`
 * - ✅ Le nom doit commencer par `use` (ex: `useAlerts.ts`)
 * - ❌ Ignoré si `index.ts`
 *
 * ### 3 — Composants partagés (1 niveau par sous-dossier)
 * Dossier : `{sharedComponentsDir}/{subDir}/`
 * - ✅ Extension `.tsx`
 * - ❌ Ignoré si `index.ts` ou `index.tsx`
 * - ❌ Ignoré si `*.examples.tsx` ou `*.demo.tsx`
 *
 * ### Calcul de `testFilePath`
 * Le fichier de test est co-localisé dans `__tests__/` au même niveau que la source :
 * ```
 * source → components/AlertTypeBadge.tsx
 * test   → components/__tests__/AlertTypeBadge.test.tsx
 * ```
 *
 * @param {import('../types.mjs').FrontendConfig} frontendConfig
 *   Configuration du workspace frontend (featuresDir requis).
 *
 * @param {Object}  [options={}]          - Options de scan
 * @param {string}  [options.module]      - Filtre sur une feature spécifique (ex: `'alerts'`)
 * @param {string}  [options.sprint]      - Filtre sprint (`'1'` | `'2'` | `'all'`) — réservé
 * @param {boolean} [options.verbose]     - Afficher le compte par feature
 *
 * @returns {Promise<Array<{
 *   filePath:     string,
 *   type:         'component' | 'hook',
 *   feature:      string,
 *   testFilePath: string
 * }>>} Liste triée par feature puis par nom de fichier
 */
export async function scanFrontendFiles(frontendConfig, options = {}) {
  const {
    featuresDir,
    sharedComponentsDir,
    hooksPattern          = 'hooks',
    componentsPattern     = 'components',
    testFileExtension     = '.test.tsx',
    hookTestFileExtension = '.test.ts',
  } = frontendConfig;

  const { module: filterModule, verbose = false } = options;

  /** @type {Array<{ filePath: string, type: 'component'|'hook', feature: string, testFilePath: string }>} */
  const results = [];

  // ── 1 & 2. Features : composants + hooks ─────────────────────────────────────

  const featureNames = await readSubDirNames(featuresDir);

  for (const featureName of featureNames) {
    // Filtre optionnel : sauter les features non ciblées
    if (filterModule && filterModule !== featureName) continue;

    const featureDir = join(featuresDir, featureName);
    let componentCount = 0;
    let hookCount = 0;

    // ── 1. Composants de feature ────────────────────────────────────────────────

    const componentsDir = join(featureDir, componentsPattern);
    const componentFiles = await readDirFiles(componentsDir, (name) => {
      if (!name.endsWith('.tsx')) return false;
      if (name.startsWith('_')) return false;
      if (name === 'index.ts' || name === 'index.tsx') return false;
      return true;
    });

    for (const filePath of componentFiles) {
      const testFilePath = join(
        dirname(filePath),
        '__tests__',
        basename(filePath, '.tsx') + testFileExtension,
      );
      results.push({ filePath, type: 'component', feature: featureName, testFilePath });
      componentCount++;
    }

    // ── 2. Hooks de feature ─────────────────────────────────────────────────────

    const hooksDir = join(featureDir, hooksPattern);
    const hookFiles = await readDirFiles(hooksDir, (name) => {
      if (!name.endsWith('.ts')) return false;
      if (name === 'index.ts') return false;
      if (!name.startsWith('use')) return false;
      return true;
    });

    for (const filePath of hookFiles) {
      const testFilePath = join(
        dirname(filePath),
        '__tests__',
        basename(filePath, '.ts') + hookTestFileExtension,
      );
      results.push({ filePath, type: 'hook', feature: featureName, testFilePath });
      hookCount++;
    }

    if (verbose) {
      console.log(
        `[frontend-scanner] ${featureName}: ` +
        `${componentCount} composant(s), ${hookCount} hook(s) trouvé(s)`,
      );
    }
  }

  // ── 3. Composants partagés ────────────────────────────────────────────────────

  if (sharedComponentsDir) {
    const sharedSubDirNames = await readSubDirNames(sharedComponentsDir);
    let sharedCount = 0;

    for (const subDirName of sharedSubDirNames) {
      const subDirPath = join(sharedComponentsDir, subDirName);

      const sharedFiles = await readDirFiles(subDirPath, (name) => {
        if (!name.endsWith('.tsx')) return false;
        if (name === 'index.ts' || name === 'index.tsx') return false;
        if (name.endsWith('.examples.tsx')) return false;
        if (name.endsWith('.demo.tsx')) return false;
        return true;
      });

      for (const filePath of sharedFiles) {
        const testFilePath = join(
          dirname(filePath),
          '__tests__',
          basename(filePath, '.tsx') + testFileExtension,
        );
        results.push({ filePath, type: 'component', feature: 'shared', testFilePath });
        sharedCount++;
      }
    }

    if (verbose) {
      console.log(`[frontend-scanner] shared: ${sharedCount} composant(s) partagé(s) trouvé(s)`);
    }
  }

  // ── 4. Tri final : par feature puis par nom de fichier ────────────────────────

  results.sort((a, b) => {
    const byFeature = a.feature.localeCompare(b.feature);
    if (byFeature !== 0) return byFeature;
    return basename(a.filePath).localeCompare(basename(b.filePath));
  });

  return results;
}
