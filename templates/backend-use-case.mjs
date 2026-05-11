/**
 * @file backend-use-case.mjs
 * @description Template de génération pour les tests unitaires de Use-Cases backend.
 * Fonction pure : renderBackendUseCaseTest(ctx) → string
 *
 * Fait partie du générateur de tests @clubmanager/test-generator.
 * Aucune dépendance externe — ES Module pur.
 *
 * @module templates/backend-use-case
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

/**
 * Dérive le nom de la variable mock à partir du paramName du repository.
 * - 1 seul repo → 'mockRepo'
 * - Plusieurs repos → 'mock' + PascalCase(paramName) ex: 'mockAlertRepo'
 *
 * @param {string} paramName    - Nom du paramètre constructeur (ex: 'alertRepo')
 * @param {number} repoCount    - Nombre total de repositories
 * @returns {string}
 */
function mockVarName(paramName, repoCount) {
  if (repoCount === 1) return 'mockRepo';
  // Capitalise la première lettre du paramName pour l'assembler
  const capitalized = paramName.charAt(0).toUpperCase() + paramName.slice(1);
  return `mock${capitalized}`;
}

/**
 * Calcule la longueur maximale d'un nom de méthode dans un tableau de méthodes.
 * Sert à l'alignement des `jest.fn()` dans l'objet mock.
 *
 * @param {import('../types.mjs').InterfaceMethod[]} methods
 * @returns {number}
 */
function maxMethodNameLength(methods) {
  return methods.reduce((max, m) => Math.max(max, m.name.length), 0);
}

// ─── Sections du template ─────────────────────────────────────────────────────

/**
 * Génère le bloc de commentaire d'en-tête du fichier.
 *
 * @param {import('../types.mjs').BackendUseCaseTemplateContext} ctx
 * @returns {string}
 */
function renderHeader(ctx) {
  const lines = [
    `/**`,
    ` * ${ctx.className}.test.ts`,
    ` * Tests unitaires — ${ctx.module} / ${ctx.className}`,
    ` * ${'─'.repeat(77)}`,
    ` * Généré par : scripts/generate-tests.mjs`,
    ` * Sprint     : Tests 1 — Use-Cases Backend`,
    ` * Module     : ${ctx.module}`,
    ` */`,
  ];
  return lines.join('\n');
}

/**
 * Génère les lignes d'import du fichier de test.
 * - Import du use-case (valeur)
 * - Import des interfaces repository (type)
 * - jest.mock() pour les services externes
 *
 * @param {import('../types.mjs').BackendUseCaseTemplateContext} ctx
 * @returns {string}
 */
function renderImports(ctx) {
  const lines = [];

  // ── jest.mock() pour les services externes (avant les imports) ────────────
  if (ctx.externalServiceMocks && ctx.externalServiceMocks.length > 0) {
    for (const servicePath of ctx.externalServiceMocks) {
      lines.push(`jest.mock('${servicePath}');`);
    }
    lines.push('');
  }

  // ── Import du use-case ────────────────────────────────────────────────────
  lines.push(`import { ${ctx.className} } from '${ctx.sourceImportPath}';`);

  // ── Imports des interfaces repository (type-only) ─────────────────────────
  for (const repo of ctx.repositories) {
    lines.push(`import type { ${repo.interfaceName} } from '${repo.importPath}';`);
  }

  return lines.join('\n');
}

/**
 * Génère le bloc mock d'un seul repository.
 * Les méthodes sont alignées verticalement pour la lisibilité.
 *
 * @param {import('../types.mjs').MockedRepository} repo
 * @param {string}  varName   - Nom de la variable mock (ex: 'mockRepo')
 * @returns {string}
 */
function renderSingleMock(repo, varName) {
  const maxLen = maxMethodNameLength(repo.methods);
  const lines  = [];

  lines.push(`const ${varName}: jest.Mocked<${repo.interfaceName}> = {`);

  for (const method of repo.methods) {
    // Padding pour aligner les jest.fn() sur la même colonne
    const padding = ' '.repeat(maxLen - method.name.length);
    lines.push(`  ${method.name}:${padding}   jest.fn(),`);
  }

  lines.push(`} as jest.Mocked<${repo.interfaceName}>;`);

  return lines.join('\n');
}

/**
 * Génère tous les blocs mock (un par repository dans ctx.repositories).
 *
 * @param {import('../types.mjs').BackendUseCaseTemplateContext} ctx
 * @returns {string}
 */
function renderMocks(ctx) {
  const lines = [];
  lines.push(`// ${'─'.repeat(3)} Mock ${ctx.repositories.length > 1 ? 'Repositories' : 'Repository'} ${'─'.repeat(44)}`);
  lines.push('');

  const repoCount = ctx.repositories.length;

  for (const repo of ctx.repositories) {
    const varName = mockVarName(repo.paramName, repoCount);
    lines.push(renderSingleMock(repo, varName));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Génère le bloc de setup (déclaration useCase + beforeEach).
 *
 * @param {import('../types.mjs').BackendUseCaseTemplateContext} ctx
 * @returns {string}
 */
function renderSetup(ctx) {
  const repoCount = ctx.repositories.length;
  // Arguments passés au constructeur dans le même ordre que ctx.repositories
  const ctorArgs  = ctx.repositories
    .map(r => mockVarName(r.paramName, repoCount))
    .join(', ');

  const lines = [
    `// ${'─'.repeat(3)} Setup ${'─'.repeat(52)}`,
    '',
    `let useCase: ${ctx.className};`,
    '',
    `beforeEach(() => {`,
    `  useCase = new ${ctx.className}(${ctorArgs});`,
    `});`,
  ];

  // Ajout d'un afterEach pour réinitialiser les mocks si plusieurs repos
  if (repoCount > 0) {
    lines.push('');
    lines.push(`afterEach(() => {`);
    lines.push(`  jest.clearAllMocks();`);
    lines.push(`});`);
  }

  return lines.join('\n');
}

/**
 * Génère les commentaires hint sur les paramètres de execute().
 * Utilisé dans le corps des tests pour guider le développeur.
 *
 * @param {import('../types.mjs').ExecuteParam[]} params
 * @returns {string[]} Lignes de commentaires TODO
 */
function renderExecuteParamHints(params) {
  if (!params || params.length === 0) {
    return [`      // TODO: configurer le mock → mockRepo.<méthode>.mockResolvedValue(...)`];
  }

  const paramList = params
    .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
    .join(', ');

  return [
    `      // TODO: configurer le mock → mockRepo.<méthode>.mockResolvedValue(...)`,
    `      // const input: { ${paramList} } = { /* TODO: renseigner les paramètres */ };`,
  ];
}

/**
 * Génère la ligne d'appel à `useCase.execute(...)` selon les params.
 *
 * @param {import('../types.mjs').ExecuteParam[]} params
 * @param {boolean} isVoid
 * @returns {string}
 */
function renderExecuteCall(params, isVoid) {
  const hasParams = params && params.length > 0;
  const args      = hasParams ? 'input' : '';
  const assign    = isVoid ? '' : 'const result = ';
  return `      // ${assign}await useCase.execute(${args});`;
}

/**
 * Génère les assertions commentées selon le type de retour.
 *
 * @param {boolean} isVoid
 * @param {string}  returnType
 * @returns {string[]}
 */
function renderAssertHints(isVoid, returnType) {
  if (isVoid) {
    return [
      `      // expect(mockRepo.<méthode>).toHaveBeenCalledWith(...);`,
    ];
  }
  return [
    `      // expect(result).toBeDefined();`,
    `      // expect(mockRepo.<méthode>).toHaveBeenCalledWith(...);`,
  ];
}

/**
 * Génère le bloc `describe('execute', ...)` avec les 2 cas de test.
 *
 * @param {import('../types.mjs').BackendUseCaseTemplateContext} ctx
 * @returns {string}
 */
function renderTests(ctx) {
  const paramHints   = renderExecuteParamHints(ctx.executeParams);
  const executeCall  = renderExecuteCall(ctx.executeParams, ctx.isVoid);
  const assertHints  = renderAssertHints(ctx.isVoid, ctx.returnType);

  // Hint sur les args pour le cas d'erreur
  const hasParams = ctx.executeParams && ctx.executeParams.length > 0;
  const errorArgs = hasParams ? 'input' : '';

  const lines = [
    `// ${'─'.repeat(3)} Tests ${'─'.repeat(52)}`,
    '',
    `describe('${ctx.className}', () => {`,
    `  describe('execute', () => {`,
    '',
    `    // ${'─'.repeat(2)} Cas nominaux ${'─'.repeat(53)}`,
    '',
    `    it('devrait retourner le résultat quand les données sont valides', async () => {`,
    `      // Arrange`,
    ...paramHints,
    ``,
    `      // Act`,
    executeCall,
    ``,
    `      // Assert`,
    ...assertHints,
    `      expect(true).toBe(true); // placeholder — à remplacer`,
    `    });`,
    ``,
    `    // ${'─'.repeat(2)} Cas d'erreur ${'─'.repeat(53)}`,
    ``,
    `    it('devrait lancer une erreur si le repository échoue', async () => {`,
    `      // Arrange`,
    `      // mockRepo.<méthode>.mockRejectedValue(new Error('DB error'));`,
    ``,
    `      // Act & Assert`,
    `      // await expect(useCase.execute(${errorArgs})).rejects.toThrow('DB error');`,
    `      expect(true).toBe(true); // placeholder — à remplacer`,
    `    });`,
    ``,
    `    // TODO: Ajouter les cas de validation des paramètres (valeurs manquantes, invalides)`,
    `    // TODO: Ajouter les cas de données inexistantes (ex: entité non trouvée → 404)`,
    ``,
    `  });`,
    `});`,
  ];

  return lines.join('\n');
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Génère le contenu complet d'un fichier de test unitaire pour un use-case backend.
 *
 * Le fichier généré est syntaxiquement valide TypeScript (Jest + ts-jest).
 * Tous les cas de test contiennent un `expect(true).toBe(true)` pour passer
 * en vert immédiatement, accompagné de commentaires TODO détaillés.
 *
 * @param {import('../types.mjs').BackendUseCaseTemplateContext} ctx
 * @returns {string} Contenu du fichier .test.ts
 *
 * @example
 * const content = renderBackendUseCaseTest({
 *   className:            'CreateAlertTypeUseCase',
 *   module:               'alerts',
 *   sourceImportPath:     '../CreateAlertTypeUseCase',
 *   repositories: [{
 *     paramName:     'repo',
 *     interfaceName: 'IAlertRepository',
 *     importPath:    '../../../domain/repositories/IAlertRepository',
 *     methods:       [{ name: 'createAlertType', mockReturn: 'undefined', returnsVoid: false, returnsBool: false, returnsArray: false, returnsNullable: false }],
 *   }],
 *   externalServiceMocks: [],
 *   executeParams:        [{ name: 'data', type: 'CreateAlertTypeDto', optional: false }],
 *   returnType:           'AlertTypeDto',
 *   isVoid:               false,
 * });
 */
export function renderBackendUseCaseTest(ctx) {
  // Validation défensive du contexte
  if (!ctx || typeof ctx !== 'object') {
    throw new TypeError('[renderBackendUseCaseTest] ctx doit être un objet non-null');
  }
  if (!ctx.className) {
    throw new TypeError('[renderBackendUseCaseTest] ctx.className est requis');
  }
  if (!Array.isArray(ctx.repositories)) {
    throw new TypeError('[renderBackendUseCaseTest] ctx.repositories doit être un tableau');
  }

  // Normalisation des champs optionnels
  const safeCtx = {
    ...ctx,
    externalServiceMocks: ctx.externalServiceMocks ?? [],
    executeParams:        ctx.executeParams        ?? [],
    isVoid:               ctx.isVoid               ?? false,
    returnType:           ctx.returnType           ?? 'unknown',
  };

  const sections = [
    renderHeader(safeCtx),
    '',
    renderImports(safeCtx),
    '',
    renderMocks(safeCtx),
    '',
    '',
    renderSetup(safeCtx),
    '',
    '',
    renderTests(safeCtx),
    '', // newline final
  ];

  return sections.join('\n');
}
