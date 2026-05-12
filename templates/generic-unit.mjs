/**
 * @file generic-unit.mjs
 * @description Template de génération pour les tests unitaires génériques.
 * Fonction pure : renderGenericUnitTest(ctx) → string
 *
 * Utilisé lorsque l'architecture du fichier source n'est pas reconnue par Unitix
 * (ni Use-Case backend, ni composant React, ni hook React Query).
 * Génère un squelette de test minimal syntaxiquement valide.
 *
 * Fait partie du générateur de tests @houthoofd/unitix.
 * Aucune dépendance externe — ES Module pur.
 *
 * @module templates/generic-unit
 */

// ─── Sections du template ─────────────────────────────────────────────────────

/**
 * Génère le bloc d'en-tête du fichier de test.
 * Format : ligne `// Généré par` + hash optionnel (même convention que les autres templates).
 *
 * @param {GenericUnitTemplateContext} ctx
 * @returns {string}
 */
function renderHeader(ctx) {
  const lines = [`// Généré par : Unitix v0.7.0`];
  if (ctx.sourceHash) {
    lines.push(`// @unitix-source-hash: ${ctx.sourceHash}`);
  }
  return lines.join('\n');
}

/**
 * Génère le bloc describe/it selon le niveau de couverture demandé.
 * Utilise systématiquement `describe` + `it` (compatible jest et vitest).
 *
 * @param {GenericUnitTemplateContext} ctx
 * @returns {string}
 */
function renderTests(ctx) {
  const level = ctx.coverageLevel ?? 'standard';

  const lines = [
    `describe('${ctx.fileName}', () => {`,
    `  it('devrait fonctionner comme attendu', () => {`,
    `    // TODO : implémenter le test`,
    `    expect(true).toBe(true);`,
    `  });`,
  ];

  // Cas exhaustif : second test pour les cas limites
  if (level === 'exhaustive') {
    lines.push(
      ``,
      `  it('devrait gérer les cas limites', () => {`,
      `    // TODO : tester les cas limites et les erreurs`,
      `    expect(true).toBe(true);`,
      `  });`,
    );
  }

  lines.push(`});`);
  return lines.join('\n');
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} GenericUnitTemplateContext
 * @property {string}  fileName      - Nom du fichier sans extension (ex: 'UserService')
 * @property {string}  importPath    - Import relatif depuis __tests__/ (ex: '../UserService')
 * @property {string}  testFramework - 'jest' | 'vitest'
 * @property {string} [module]       - Nom du module inféré si possible
 * @property {string} [sourceHash]   - Hash SHA-256 court pour @unitix-source-hash
 * @property {'minimal'|'standard'|'exhaustive'} [coverageLevel] - Niveau de couverture
 */

/**
 * Génère le contenu complet d'un fichier de test générique (architecture non reconnue).
 *
 * Le fichier généré est syntaxiquement valide TypeScript (Jest ou Vitest).
 * Tous les cas de test contiennent un `expect(true).toBe(true)` pour passer
 * en vert immédiatement, accompagné de commentaires TODO détaillés.
 *
 * @param {GenericUnitTemplateContext} ctx
 * @returns {string} Contenu du fichier .test.ts
 *
 * @throws {TypeError} Si ctx n'est pas un objet non-null, ou si ctx.fileName est absent.
 *
 * @example
 * const content = renderGenericUnitTest({
 *   fileName:      'UserService',
 *   importPath:    '../UserService',
 *   testFramework: 'jest',
 *   sourceHash:    'a3f2c1d9',
 *   coverageLevel: 'standard',
 * });
 */
export function renderGenericUnitTest(ctx) {
  // Validation défensive du contexte
  if (!ctx || typeof ctx !== 'object') {
    throw new TypeError(
      '[renderGenericUnitTest] ctx doit être un objet non-null'
    );
  }
  if (!ctx.fileName) {
    throw new TypeError(
      '[renderGenericUnitTest] ctx.fileName est requis'
    );
  }

  const sections = [
    renderHeader(ctx),
    '',
    '// @unitix:begin',
    `// NOTE : Template générique — architecture non reconnue par Unitix.`,
    `// Personnalisez ce test selon la logique de ${ctx.fileName}.`,
    `// Référence des variables disponibles : https://github.com/Houthoofd/Unitix#templates`,
    '',
    `import {  } from '${ctx.importPath}';`,
    '',
    renderTests(ctx),
    '// @unitix:end',
    '',
    `// ${'─'.repeat(3)} Tests personnalisés ${'─'.repeat(44)}`,
    `// Les blocs ci-dessous sont préservés lors d'un \`unitix --sync\`.`,
    `// Ajoutez ici vos tests supplémentaires.`,
    '',
  ];

  return sections.join('\n');
}
