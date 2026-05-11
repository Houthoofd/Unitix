/**
 * @file fs-utils.mjs
 * @description Utilitaires filesystem basés sur fs/promises. Zéro dépendances externes.
 * Fait partie du générateur de tests @clubmanager/test-generator.
 */

import fs   from 'fs/promises';
import path from 'path';

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Crée un dossier et tous ses parents si nécessaire (équivalent `mkdir -p`).
 * Idempotent : ne lève pas d'erreur si le dossier existe déjà.
 *
 * @param {string} dirPath - Chemin absolu ou relatif du dossier à créer
 * @returns {Promise<void>}
 */
export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * @typedef {Object} WriteResult
 * @property {boolean}         written - true si le fichier a été écrit, false sinon
 * @property {string}          [reason] - Raison du non-écriture (ex: 'already exists')
 */

/**
 * Écrit un fichier de manière sûre en respectant les règles suivantes :
 *   - Fichier existe ET force=false → ne pas écrire, retourner `{ written: false, reason: 'already exists' }`
 *   - Fichier existe ET force=true  → écraser, retourner `{ written: true }`
 *   - Fichier absent                → créer (+ dossiers parents si nécessaire), retourner `{ written: true }`
 *
 * @param {string}  filePath - Chemin absolu ou relatif du fichier à écrire
 * @param {string}  content  - Contenu texte à écrire (UTF-8)
 * @param {boolean} [force=false] - Si true, écrase le fichier s'il existe déjà
 * @returns {Promise<WriteResult>}
 */
export async function writeFileSafe(filePath, content, force = false) {
  const exists = await fileExists(filePath);

  if (exists && !force) {
    return { written: false, reason: 'already exists' };
  }

  // Garantit que le dossier parent existe avant d'écrire
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');

  return { written: true };
}

/**
 * Vérifie si un fichier (ou dossier) existe à l'emplacement donné.
 *
 * @param {string} filePath - Chemin absolu ou relatif à tester
 * @returns {Promise<boolean>} true si le chemin existe, false sinon
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lit le contenu texte d'un fichier (UTF-8).
 * Retourne `null` si le fichier n'existe pas, sans lever d'exception.
 *
 * @param {string} filePath - Chemin absolu ou relatif du fichier à lire
 * @returns {Promise<string|null>} Contenu du fichier, ou null s'il est absent
 */
export async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err) {
    // ENOENT = fichier absent → retour null attendu
    if (err.code === 'ENOENT') return null;
    // Toute autre erreur (permissions, etc.) est remontée normalement
    throw err;
  }
}
