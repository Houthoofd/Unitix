/**
 * @file sync-merger.mjs
 * @description Fusion chirurgicale lors d'un --sync : préserve les tests
 * manuels ajoutés après la zone auto-générée.
 *
 * Architecture de zones dans un stub généré :
 *
 *   ┌─ Header (hash, @file comment) ─────────────────────── toujours regénéré ─┐
 *   │  // @unitix-source-hash: <hash>                                           │
 *   └───────────────────────────────────────────────────────────────────────────┘
 *   ┌─ Zone auto-générée ────────────────────────── gérée par Unitix (--sync) ─┐
 *   │  // @unitix:begin                                                         │
 *   │  import { ... }                                                           │
 *   │  const mockRepo = { ... }                                                 │
 *   │  describe('...', () => { it('...') {...} });                              │
 *   │  // @unitix:end                                                           │
 *   └───────────────────────────────────────────────────────────────────────────┘
 *   ┌─ Zone manuelle ─────────────────────────────────── préservée lors --sync ─┐
 *   │  // ─── Tests personnalisés ────────────────────────────────────────      │
 *   │  // Les blocs ci-dessous sont préservés lors d'un `unitix --sync`.        │
 *   │  it('mon test custom', ...) { ... }                                       │
 *   └───────────────────────────────────────────────────────────────────────────┘
 *
 * Règle pour les développeurs :
 *   - Ne JAMAIS modifier manuellement le contenu entre @unitix:begin et @unitix:end.
 *   - Ajouter ses propres tests APRÈS le marqueur @unitix:end.
 *
 * @module sync-merger
 */

/** Marqueur de début de zone auto-générée */
export const UNITIX_BEGIN = '// @unitix:begin';

/** Marqueur de fin de zone auto-générée */
export const UNITIX_END   = '// @unitix:end';

/**
 * Vérifie si un stub possède les marqueurs de zone gérée par Unitix.
 * Les stubs sans marqueurs ont été générés avant v0.4.1.
 *
 * @param {string} content - Contenu du fichier .test.ts
 * @returns {boolean}
 */
export function hasSyncMarkers(content) {
  return content.includes(UNITIX_BEGIN) && content.includes(UNITIX_END);
}

/**
 * Extrait le "tail" manuel : tout ce qui se trouve après `// @unitix:end`
 * dans un stub existant.
 *
 * Retourne `null` si :
 *   - Le marqueur `// @unitix:end` est absent (stub pré-v0.4.1 ou fichier manuel)
 *   - Il n'y a rien d'utile après le marqueur (uniquement du whitespace)
 *
 * @param {string} existingContent - Contenu du fichier .test.ts existant
 * @returns {string|null}
 */
export function extractManualTail(existingContent) {
  const endIdx = existingContent.lastIndexOf(UNITIX_END);
  if (endIdx === -1) return null;

  const after   = existingContent.slice(endIdx + UNITIX_END.length);
  const trimmed = after.trimEnd();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Fusionne le nouveau contenu auto-généré avec le tail manuel préservé.
 *
 * Le tail est réappendé après le marqueur @unitix:end du nouveau contenu,
 * séparé par une ligne vide pour la lisibilité.
 *
 * @param {string}      newContent  - Nouveau contenu généré (inclut begin/end)
 * @param {string|null} manualTail  - Tail extrait du fichier existant (ou null)
 * @returns {string}
 */
export function mergeSyncContent(newContent, manualTail) {
  if (!manualTail) return newContent;
  const base = newContent.trimEnd();
  return base + '\n\n' + manualTail.trimStart() + '\n';
}

/**
 * Compte le nombre de lignes non vides dans une chaîne.
 * Utilisé pour les messages de log lors du merge.
 *
 * @param {string} text
 * @returns {number}
 */
export function countNonEmptyLines(text) {
  return text.split('\n').filter(l => l.trim().length > 0).length;
}
