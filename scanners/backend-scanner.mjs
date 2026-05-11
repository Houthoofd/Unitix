/**
 * @file backend-scanner.mjs
 * @description Scanner de fichiers use-cases backend.
 *
 * Parcourt récursivement les modules pour trouver les fichiers `*UseCase.ts`
 * à couvrir par des tests. Ne fait **pas** de parsing AST — retourne uniquement
 * des chemins de fichiers enrichis du chemin de test attendu.
 *
 * Fait partie du générateur de tests @clubmanager/test-generator.
 */

import { readdir } from 'fs/promises';
import { join, dirname, basename } from 'path';

// ─── Helper interne ───────────────────────────────────────────────────────────

/**
 * Parcourt récursivement un dossier et retourne tous les chemins de fichiers
 * passant le filtre donné. Retourne `[]` si le dossier n'existe pas (ENOENT).
 *
 * Utilise `readdir({ withFileTypes: true })` pour éviter des appels `stat`
 * supplémentaires.
 *
 * @param {string}                       dirPath   - Chemin absolu du dossier à parcourir
 * @param {(filePath: string) => boolean} [filterFn] - Filtre appliqué sur le chemin absolu
 *                                                     de chaque fichier (retourner `true` = inclure)
 * @returns {Promise<string[]>} Tableau de chemins absolus triés dans l'ordre de découverte
 */
async function walkDir(dirPath, filterFn) {
  /** @type {string[]} */
  const results = [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    // Dossier inexistant ou non lisible → résultat vide, pas d'erreur levée
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkDir(fullPath, filterFn);
      results.push(...nested);
    } else if (entry.isFile()) {
      if (!filterFn || filterFn(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Scanne le dossier des modules backend pour trouver tous les fichiers
 * use-case sources à tester.
 *
 * ### Critères de sélection
 * - ✅ Le nom se termine par `UseCase.ts`
 * - ❌ Ignoré si le fichier se trouve dans un sous-dossier `__tests__`
 * - ❌ Ignoré si le nom commence par `index`
 *
 * ### Calcul de `testFilePath`
 * Le fichier de test est co-localisé dans `__tests__/` au même niveau que la source :
 * ```
 * source → use-cases/[sub/]CreateFooUseCase.ts
 * test   → use-cases/[sub/]__tests__/CreateFooUseCase.test.ts
 * ```
 *
 * ### Support des sous-dossiers (ex: module `payments`)
 * Le scan est **récursif** : les use-cases dans `use-cases/payments/`,
 * `use-cases/plans/`, `use-cases/schedules/` etc. sont tous trouvés.
 * Le `testFilePath` respecte la même hiérarchie.
 *
 * @param {import('../types.mjs').BackendConfig} backendConfig
 *   Configuration du workspace backend (modulesDir requis).
 *
 * @param {Object}  [options={}]         - Options de scan
 * @param {string}  [options.module]     - Filtre sur un module spécifique (ex: `'alerts'`)
 * @param {string}  [options.sprint]     - Filtre sprint (`'1'` | `'2'` | `'all'`) — réservé
 * @param {boolean} [options.verbose]    - Afficher le compte de use-cases par module
 *
 * @returns {Promise<Array<{
 *   filePath:     string,
 *   module:       string,
 *   testFilePath: string
 * }>>} Liste triée par module puis par nom de fichier
 */
export async function scanBackendUseCases(backendConfig, options = {}) {
  const {
    modulesDir,
    useCasesGlob      = 'application/use-cases',
    testFileExtension = '.test.ts',
  } = backendConfig;

  const { module: filterModule, verbose = false } = options;

  /** @type {Array<{ filePath: string, module: string, testFilePath: string }>} */
  const results = [];

  // ── 1. Lire la liste des modules (sous-dossiers directs de modulesDir) ──────

  let moduleDirNames;
  try {
    const entries = await readdir(modulesDir, { withFileTypes: true });
    moduleDirNames = entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {
    // modulesDir inexistant → liste vide sans erreur
    return [];
  }

  // ── 2. Pour chaque module ────────────────────────────────────────────────────

  for (const moduleName of moduleDirNames) {
    // Filtre optionnel : sauter les modules non ciblés
    if (filterModule && filterModule !== moduleName) continue;

    const useCasesDir = join(modulesDir, moduleName, useCasesGlob);

    // Scan récursif avec filtre intégré
    const useCaseFiles = await walkDir(useCasesDir, (filePath) => {
      const name = basename(filePath);

      // Rejeter les fichiers situés dans un dossier __tests__
      // (split sur / et \ pour portabilité Windows ↔ Unix)
      const segments = filePath.split(/[\\/]/);
      if (segments.includes('__tests__')) return false;

      // Rejeter les fichiers index*
      if (name.startsWith('index')) return false;

      // Garder uniquement les fichiers se terminant par UseCase.ts
      return name.endsWith('UseCase.ts');
    });

    // Construire les objets de résultat
    /** @type {Array<{ filePath: string, module: string, testFilePath: string }>} */
    const moduleFiles = useCaseFiles.map((filePath) => {
      const testFilePath = join(
        dirname(filePath),
        '__tests__',
        basename(filePath, '.ts') + testFileExtension,
      );
      return { filePath, module: moduleName, testFilePath };
    });

    if (verbose) {
      console.log(
        `[backend-scanner] ${moduleName}: ${moduleFiles.length} use-case(s) trouvé(s)`,
      );
    }

    results.push(...moduleFiles);
  }

  // ── 3. Tri final : par module puis par nom de fichier ────────────────────────

  results.sort((a, b) => {
    const byModule = a.module.localeCompare(b.module);
    if (byModule !== 0) return byModule;
    return basename(a.filePath).localeCompare(basename(b.filePath));
  });

  return results;
}
