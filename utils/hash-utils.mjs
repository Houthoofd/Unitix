/**
 * @file hash-utils.mjs
 * @description Utilitaires de hachage pour la détection de désynchronisation des stubs.
 *
 * Flux :
 *  1. À la génération : computeFileHash(sourceFile) → injecté dans l'en-tête du stub
 *  2. À la détection  : extractStoredHash(testFile) + computeFileHash(sourceFile) → comparaison
 *
 * @module hash-utils
 */

import { createHash } from 'crypto';
import { readFile }   from 'fs/promises';

/** Préfixe de la ligne de commentaire de hash dans les stubs générés */
export const HASH_COMMENT_PREFIX = '// @unitix-source-hash: ';

/**
 * Calcule un hash SHA-256 court (16 premiers caractères hexadécimaux) du contenu
 * d'un fichier source. Utilisé pour détecter les modifications après génération.
 *
 * @param {string} filePath - Chemin absolu du fichier source
 * @returns {Promise<string>} Hash de 16 caractères hex (ex: 'a3f2c1d9e8b7f6a5')
 */
export async function computeFileHash(filePath) {
  const content = await readFile(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Extrait le hash source stocké dans l'en-tête d'un fichier de test généré par Unitix.
 * Scanne uniquement les 15 premières lignes pour éviter de lire tout le fichier.
 *
 * Le format attendu (ligne standalone après le bloc JSDoc) :
 *   // @unitix-source-hash: a3f2c1d9e8b7f6a5
 *
 * @param {string} testFilePath - Chemin absolu du fichier de test existant
 * @returns {Promise<string|null>} Hash stocké ou null si absent (test manuel ou ancien stub)
 */
export async function extractStoredHash(testFilePath) {
  try {
    const content = await readFile(testFilePath, 'utf-8');
    const lines   = content.split('\n').slice(0, 15);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(HASH_COMMENT_PREFIX)) {
        return trimmed.slice(HASH_COMMENT_PREFIX.length).trim() || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}
