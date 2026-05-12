/**
 * @file ast-cache.mjs
 * @description Cache de génération pour éviter de re-parser les fichiers inchangés.
 *
 * Flux :
 *  1. Avant génération : getCachedGeneration() → retourne le résultat précédent si hash inchangé
 *  2. Après génération : setCachedGeneration() → stocke le résultat dans le cache en mémoire
 *  3. En fin de run    : saveCache() → persiste le cache sur disque (.unitix-cache.json)
 *
 * Format du fichier .unitix-cache.json :
 * ```json
 * {
 *   "/abs/path/to/CreateAlertUseCase.ts": {
 *     "sourceHash": "a3f2c1d9e8b7f6a5",
 *     "coverageLevel": "standard",
 *     "content": "// @unitix-source-hash: a3f2c...\n...",
 *     "testFilePath": "/abs/path/to/__tests__/CreateAlertUseCase.test.ts",
 *     "cachedAt": 1720000000000
 *   }
 * }
 * ```
 *
 * @module utils/ast-cache
 */

import { readFile, writeFile } from 'node:fs/promises';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CacheEntry
 * @property {string} sourceHash    - Hash SHA-256 court du fichier source (16 car. hex)
 * @property {string} coverageLevel - Niveau de couverture utilisé lors de la génération
 * @property {string} content       - Contenu du fichier de test généré
 * @property {string} testFilePath  - Chemin absolu du fichier de test cible
 * @property {number} cachedAt      - Timestamp Unix (ms) de la mise en cache
 */

/**
 * @typedef {Record<string, CacheEntry>} AstCache
 */

// ─── I/O ──────────────────────────────────────────────────────────────────────

/**
 * Charge le cache depuis le disque.
 * Retourne un objet vide si le fichier est absent ou invalide.
 *
 * @param {string} cacheFilePath - Chemin absolu vers le fichier .unitix-cache.json
 * @returns {Promise<AstCache>}
 */
export async function loadCache(cacheFilePath) {
  try {
    const raw = await readFile(cacheFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Validation minimale : doit être un objet plain
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    // Fichier absent, JSON invalide ou erreur FS → cache vide
    return {};
  }
}

/**
 * Persiste le cache sur le disque (écrasement atomique via writeFile).
 * Silencieux en cas d'erreur FS (le cache est non critique).
 *
 * @param {string}   cacheFilePath - Chemin absolu vers le fichier .unitix-cache.json
 * @param {AstCache} cache         - Cache en mémoire à sauvegarder
 * @returns {Promise<void>}
 */
export async function saveCache(cacheFilePath, cache) {
  try {
    await writeFile(cacheFilePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Erreur non critique : ne pas bloquer la génération
  }
}

// ─── Lecture / écriture ───────────────────────────────────────────────────────

/**
 * Retourne le résultat de génération mis en cache si le hash source
 * et le niveau de couverture correspondent à l'entrée stockée.
 *
 * @param {AstCache} cache         - Cache en mémoire
 * @param {string}   filePath      - Chemin absolu du fichier source
 * @param {string}   sourceHash    - Hash actuel du fichier source
 * @param {string}   coverageLevel - Niveau de couverture actuel
 * @returns {{ content: string, testFilePath: string } | null}
 *   Résultat caché ou `null` si absent / invalidé
 */
export function getCachedGeneration(cache, filePath, sourceHash, coverageLevel) {
  const entry = cache[filePath];
  if (!entry) return null;
  if (entry.sourceHash !== sourceHash) return null;
  if (entry.coverageLevel !== coverageLevel) return null;
  return { content: entry.content, testFilePath: entry.testFilePath };
}

/**
 * Stocke le résultat de génération dans le cache en mémoire.
 *
 * @param {AstCache} cache         - Cache en mémoire (muté en place)
 * @param {string}   filePath      - Chemin absolu du fichier source
 * @param {string}   sourceHash    - Hash du fichier source
 * @param {string}   coverageLevel - Niveau de couverture utilisé
 * @param {{ content: string, testFilePath: string }} generated - Résultat à cacher
 * @returns {void}
 */
export function setCachedGeneration(cache, filePath, sourceHash, coverageLevel, generated) {
  cache[filePath] = {
    sourceHash,
    coverageLevel,
    content: generated.content,
    testFilePath: generated.testFilePath,
    cachedAt: Date.now(),
  };
}

// ─── Statistiques ─────────────────────────────────────────────────────────────

/**
 * Retourne des statistiques sommaires sur le cache en mémoire.
 *
 * @param {AstCache} cache
 * @returns {{ total: number, entries: string[] }}
 */
export function getCacheStats(cache) {
  const entries = Object.keys(cache);
  return { total: entries.length, entries };
}
