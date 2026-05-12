/**
 * @file parse-error.mjs
 * @description Formateur d'erreurs de parsing AST avec contexte de code.
 *
 * Transforme une exception brute de @typescript-eslint/typescript-estree en un
 * message d'erreur humainement lisible incluant :
 *  - Le chemin du fichier
 *  - La ligne et la colonne de l'erreur
 *  - Un extrait du code source avec marqueur de ligne
 *
 * @module utils/parse-error
 */

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Formate une erreur de parsing AST en message lisible avec contexte de code.
 *
 * Gère les propriétés d'erreur des deux versions de typescript-estree :
 *  - v7 : `err.lineNumber` + `err.column`
 *  - v8 : `err.location.line` + `err.location.column`
 *
 * @param {Error & {
 *   lineNumber?: number,
 *   column?: number,
 *   location?: { line: number, column: number }
 * }} err           - Erreur levée par `parse()`
 * @param {string}  code     - Code source brut (pour l'extrait contextuel)
 * @param {string}  filePath - Chemin absolu du fichier (affiché dans le message)
 * @returns {string} Message formaté multi-lignes
 */
export function formatParseError(err, code, filePath) {
  const lines = code.split('\n');

  // Extraire la position selon la version de typescript-estree
  const line   = err.location?.line   ?? err.lineNumber;
  const column = err.location?.column ?? err.column;

  const parts = [`  Fichier : ${filePath}`];

  if (line !== undefined && line !== null) {
    const colStr = column !== undefined ? `:${column}` : '';
    parts.push(`  Ligne   : ${line}${colStr}`);

    // Extrait de code : 2 lignes avant + la ligne erronée + 2 lignes après
    const ctxStart = Math.max(0, line - 3);       // lignes indexées à 1
    const ctxEnd   = Math.min(lines.length, line + 2);

    parts.push('  Extrait :');
    for (let i = ctxStart; i < ctxEnd; i++) {
      const lineNum    = (i + 1).toString().padStart(4);
      const marker     = i + 1 === line ? '>' : ' ';
      const codeLine   = lines[i] ?? '';
      parts.push(`    ${marker} ${lineNum} │ ${codeLine}`);

      // Curseur sous la ligne erronée si on a la colonne
      if (i + 1 === line && column !== undefined) {
        const cursor = ' '.repeat(10 + column) + '^';
        parts.push(`    ${cursor}`);
      }
    }
  }

  // Nettoyer le message brut (peut contenir des infos de ligne redondantes)
  const rawMsg = err.message ?? String(err);
  parts.push(`  Erreur  : ${rawMsg}`);

  return parts.join('\n');
}
