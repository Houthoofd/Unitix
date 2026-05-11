/**
 * @file frontend-component.mjs
 * @description Template de génération pour les tests de composants React (frontend).
 * Fonction pure : renderFrontendComponentTest(ctx) → string
 *
 * Fait partie du générateur de tests @clubmanager/test-generator.
 * Aucune dépendance externe — ES Module pur.
 *
 * @module templates/frontend-component
 */

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Indente chaque ligne d'un bloc de texte multiligne.
 *
 * @param {string} str - Texte à indenter (peut contenir des sauts de ligne)
 * @param {number} n   - Nombre d'espaces d'indentation
 * @returns {string}
 */
function indent(str, n) {
  const pad = ' '.repeat(n);
  return str
    .split('\n')
    .map(line => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}

// ─── Sections du template ─────────────────────────────────────────────────────

/**
 * Génère le bloc de commentaire d'en-tête du fichier.
 *
 * @param {import('../types.mjs').FrontendComponentTemplateContext} ctx
 * @returns {string}
 */
function renderHeader(ctx) {
  const lines = [
    `/**`,
    ` * ${ctx.componentName}.test.tsx`,
    ` * Tests composant — ${ctx.feature} / ${ctx.componentName}`,
    ` * ${'─'.repeat(77)}`,
    ` * Généré par : scripts/generate-tests.mjs`,
    ` * Sprint     : Tests 2 — Composants Frontend`,
    ` * Feature    : ${ctx.feature}`,
    ` */`,
  ];
  return lines.join('\n');
}

/**
 * Génère les imports du fichier de test de composant.
 *
 * Stratégie d'import du rendu :
 *   - ctx.renderHelper != null  → import nommé depuis renderHelper.importPath
 *   - ctx.renderHelper == null  → import { render } depuis @testing-library/react
 *
 * @param {import('../types.mjs').FrontendComponentTemplateContext} ctx
 * @returns {string}
 */
function renderImports(ctx) {
  const lines = [];

  // ── Imports Vitest ────────────────────────────────────────────────────────
  lines.push(`import { describe, it, expect } from '${ctx.testFramework}';`);

  // ── Import screen (toujours présent) ──────────────────────────────────────
  lines.push(`import { screen } from '@testing-library/react';`);

  // ── Import du helper de rendu ─────────────────────────────────────────────
  if (ctx.renderHelper) {
    lines.push(`import { ${ctx.renderHelper.name} } from '${ctx.renderHelper.importPath}';`);
  } else {
    // Pas de wrapper custom → render direct depuis RTL
    lines.push(`import { render } from '@testing-library/react';`);
  }

  // ── Import du composant testé ──────────────────────────────────────────────
  lines.push(`import { ${ctx.componentName} } from '${ctx.importPath}';`);

  // ── Commentaire props types ────────────────────────────────────────────────
  lines.push('');
  lines.push(`// TODO: Importer les types de props si nécessaire`);

  return lines.join('\n');
}

/**
 * Génère un bloc de commentaires en en-tête du describe :
 * - Note useTranslation si applicable
 * - Note router si applicable
 * - Note React Query si applicable
 * - Listing des props détectées
 *
 * @param {import('../types.mjs').FrontendComponentTemplateContext} ctx
 * @returns {string} Bloc de notes (vide si aucune remarque)
 */
function renderContextNotes(ctx) {
  const notes = [];

  if (ctx.usesTranslation) {
    notes.push(`// Note: useTranslation est mocké via ${ctx.renderHelper ? ctx.renderHelper.name : 'le wrapper de rendu'}`);
  }

  if (ctx.usesRouter) {
    notes.push(`// Note: useNavigate / useParams sont fournis via le wrapper de rendu`);
  }

  if (ctx.usesQuery) {
    notes.push(`// Note: React Query (useQuery / useMutation) est configuré via le wrapper de rendu`);
  }

  if (ctx.propsFields && ctx.propsFields.length > 0) {
    notes.push(`// Props détectées : ${ctx.propsFields.join(', ')}`);
  }

  return notes.join('\n');
}

/**
 * Génère le nom de la fonction de rendu à utiliser dans les tests.
 * - Avec helper  → ctx.renderHelper.name  (ex: 'renderWithProviders')
 * - Sans helper  → 'render'
 *
 * @param {import('../types.mjs').FrontendComponentTemplateContext} ctx
 * @returns {string}
 */
function renderFnName(ctx) {
  return ctx.renderHelper ? ctx.renderHelper.name : 'render';
}

/**
 * Génère le commentaire d'exemple de props minimal selon les props détectées.
 * Si propsFields non vide → génère un commentaire avec les premiers champs.
 *
 * @param {import('../types.mjs').FrontendComponentTemplateContext} ctx
 * @returns {string}
 */
function renderPropsHint(ctx) {
  if (!ctx.propsFields || ctx.propsFields.length === 0) {
    return `    // const props = { /* TODO: renseigner les props requises */ };`;
  }

  // Génère un exemple avec les noms de props détectées
  const propEntries = ctx.propsFields
    .slice(0, 3) // limiter à 3 pour ne pas surcharger
    .map(f => `${f}: /* valeur */`)
    .join(', ');

  const suffix = ctx.propsFields.length > 3
    ? ` /* ... + ${ctx.propsFields.length - 3} autres */`
    : '';

  return `    // const props = { ${propEntries}${suffix} };`;
}

/**
 * Génère les 2 cas de test du composant.
 *
 * @param {import('../types.mjs').FrontendComponentTemplateContext} ctx
 * @returns {string}
 */
function renderTests(ctx) {
  const renderFn   = renderFnName(ctx);
  const propsHint  = renderPropsHint(ctx);

  // Exemple de JSX dans le commentaire — utilise le nom du composant
  const jsxExample = `<${ctx.componentName} {...props} />`;

  const lines = [
    `describe('${ctx.componentName}', () => {`,
    ``,
    `  it('devrait se rendre sans erreur avec les props minimales', () => {`,
    `    // Arrange`,
    `    // TODO: définir les props requises`,
    propsHint,
    ``,
    `    // Act`,
    `    // ${renderFn}(${jsxExample});`,
    ``,
    `    // Assert`,
    `    // expect(screen.getByRole(...)).toBeInTheDocument();`,
    `    expect(true).toBe(true); // placeholder — à remplacer`,
    `  });`,
    ``,
    `  it('devrait afficher le contenu correct selon les props', () => {`,
    `    // TODO: tester les différentes valeurs possibles des props`,
  ];

  // Hint spécifique si on a des props connues
  if (ctx.propsFields && ctx.propsFields.length > 0) {
    const firstProp = ctx.propsFields[0];
    lines.push(`    // ex: ${firstProp} = '<valeur_a>' → résultat attendu A`);
    lines.push(`    // ex: ${firstProp} = '<valeur_b>' → résultat attendu B`);
  } else {
    lines.push(`    // ex: prop = 'valeur_a' → classe CSS X, texte "Libellé A"`);
  }

  lines.push(
    `    expect(true).toBe(true); // placeholder — à remplacer`,
    `  });`,
    ``,
    `  // TODO: Ajouter un test par prop optionnelle importante`,
    `  // TODO: Tester les états disabled/loading si applicable`,
    ``,
    `});`,
  );

  return lines.join('\n');
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Génère le contenu complet d'un fichier de test pour un composant React frontend.
 *
 * Le fichier généré est syntaxiquement valide TypeScript (Vitest + React Testing Library).
 * Tous les cas de test contiennent un `expect(true).toBe(true)` pour passer
 * en vert immédiatement, accompagné de commentaires TODO détaillés.
 *
 * @param {import('../types.mjs').FrontendComponentTemplateContext} ctx
 * @returns {string} Contenu du fichier .test.tsx
 *
 * @example
 * const content = renderFrontendComponentTest({
 *   componentName:   'AlertTypeBadge',
 *   feature:         'alerts',
 *   importPath:      '../AlertTypeBadge',
 *   propsFields:     ['priorite', 'size'],
 *   usesTranslation: true,
 *   usesRouter:      false,
 *   usesQuery:       false,
 *   testFramework:   'vitest',
 *   renderHelper:    { name: 'renderWithProviders', importPath: '@/shared/test/renderWithProviders' },
 * });
 */
export function renderFrontendComponentTest(ctx) {
  // Validation défensive du contexte
  if (!ctx || typeof ctx !== 'object') {
    throw new TypeError('[renderFrontendComponentTest] ctx doit être un objet non-null');
  }
  if (!ctx.componentName) {
    throw new TypeError('[renderFrontendComponentTest] ctx.componentName est requis');
  }
  if (!ctx.importPath) {
    throw new TypeError('[renderFrontendComponentTest] ctx.importPath est requis');
  }

  // Normalisation des champs optionnels
  const safeCtx = {
    ...ctx,
    feature:         ctx.feature         ?? 'shared',
    propsFields:     ctx.propsFields      ?? [],
    usesTranslation: ctx.usesTranslation  ?? false,
    usesRouter:      ctx.usesRouter       ?? false,
    usesQuery:       ctx.usesQuery        ?? false,
    testFramework:   ctx.testFramework    ?? 'vitest',
    renderHelper:    ctx.renderHelper     ?? null,
  };

  // Génération des notes contextuelles (potentiellement vide)
  const contextNotes = renderContextNotes(safeCtx);

  const sections = [
    renderHeader(safeCtx),
    '',
    renderImports(safeCtx),
  ];

  // Insertion des notes contextuelles si présentes
  if (contextNotes) {
    sections.push('');
    sections.push(contextNotes);
  }

  sections.push('');
  sections.push(renderTests(safeCtx));
  sections.push(''); // newline final

  return sections.join('\n');
}
