/**
 * @file frontend-hook.mjs
 * @description Template de génération pour les tests de hooks React Query (frontend).
 * Fonction pure : renderFrontendHookTest(ctx) → string
 *
 * Fait partie du générateur de tests @clubmanager/test-generator.
 * Aucune dépendance externe — ES Module pur.
 *
 * Stratégie de génération par hook :
 *   - hooks `useQuery`    → 1 test : chargement puis succès
 *   - hooks `useMutation` → 2 tests : succès + erreur API
 *   - query key exports   → inclus dans la ligne d'import du fichier hook
 *
 * @module templates/frontend-hook
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
  const pad = " ".repeat(n);
  return str
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

/**
 * Détermine si un nom de hook correspond à une mutation (useMutation).
 * Convention : les hooks de mutation contiennent un verbe d'action.
 *
 * Heuristique :
 *   - Commence par 'useCreate', 'useUpdate', 'useDelete', 'useAdd',
 *     'useRemove', 'useResolve', 'useIgnore', 'useSend', 'useSet'
 *
 * Si `prefixes` est fourni et non vide, il remplace la liste par défaut.
 *
 * @param {string}   hookName - Nom du hook (ex: 'useCreateAlertType')
 * @param {string[]?} prefixes - Préfixes de mutation (depuis config, optionnel)
 * @returns {boolean}
 */
function isMutationHook(hookName, prefixes) {
  const MUTATION_PREFIXES =
    prefixes && prefixes.length > 0
      ? prefixes
      : [
          "useCreate",
          "useUpdate",
          "useDelete",
          "useAdd",
          "useRemove",
          "useResolve",
          "useIgnore",
          "useSend",
          "useSet",
          "useToggle",
          "useUpload",
          "useSubmit",
          "useReset",
          "useCancel",
          "useConfirm",
          "useAssign",
          "useUnassign",
        ];
  return MUTATION_PREFIXES.some((prefix) => hookName.startsWith(prefix));
}

/**
 * Dérive le nom de l'endpoint REST approximatif depuis le hookName.
 * Utilisé pour les commentaires TODO dans les tests MSW.
 *
 * Exemples :
 *   'useAlertTypes'      → 'GET /api/<feature>/types'
 *   'useCreateAlertType' → 'POST /api/<feature>/types'
 *   'useDeleteAlertType' → 'DELETE /api/<feature>/types/:id'
 *
 * @param {string} hookName - Nom du hook
 * @param {string} feature  - Feature parente (ex: 'alerts')
 * @returns {string}
 */
function deriveEndpointHint(hookName, feature) {
  const lower = hookName.toLowerCase();
  if (lower.startsWith("usecreate") || lower.startsWith("useadd")) {
    return `POST /api/${feature}/...`;
  }
  if (lower.startsWith("useupdate")) {
    return `PUT /api/${feature}/.../:id`;
  }
  if (lower.startsWith("usedelete") || lower.startsWith("useremove")) {
    return `DELETE /api/${feature}/.../:id`;
  }
  // Cas useQuery par défaut
  return `GET /api/${feature}/...`;
}

// ─── Sections du template ─────────────────────────────────────────────────────

/**
 * Génère le bloc de commentaire d'en-tête du fichier.
 *
 * @param {import('../types.mjs').FrontendHookTemplateContext} ctx
 * @param {string} primaryHookName - Nom du premier hook (pour le titre du fichier)
 * @returns {string}
 */
function renderHeader(ctx, primaryHookName) {
  const lines = [
    `/**`,
    ` * ${primaryHookName}.test.ts`,
    ` * Tests hooks — ${ctx.feature} / ${primaryHookName}`,
    ` * ${"─".repeat(77)}`,
    ` * G\u00e9n\u00e9r\u00e9 par : Unitix v0.4.1`,
    ` * Feature    : ${ctx.feature}`,
    ` */`,
  ];
  if (ctx.sourceHash) {
    lines.push(`// @unitix-source-hash: ${ctx.sourceHash}`);
  }
  return lines.join("\n");
}

/**
 * G\u00e9n\u00e8re les imports du fichier de test de hooks.
 *
 * Imports Vitest :
 *   - Toujours : describe, it, expect, beforeAll, afterAll, afterEach
 * Imports RTL :
 *   - renderHook, waitFor
 *   - wrapper (renderWithProviders)
 * Import du fichier hook :
 *   - Tous les hookNames + queryKeyNames sur une seule ligne
 *
 * @param {import('../types.mjs').FrontendHookTemplateContext} ctx
 * @returns {string}
 */
function renderImports(ctx) {
  const lines = [];

  // ── Imports Vitest ────────────────────────────────────────────────────────
  lines.push(
    `import { describe, it, expect, beforeAll, afterAll, afterEach } from '${ctx.testFramework}';`,
  );

  // ── Imports React Testing Library ──────────────────────────────────────────
  lines.push(`import { renderHook, waitFor } from '@testing-library/react';`);

  // ── Import du wrapper de rendu ─────────────────────────────────────────────
  // Import du wrapper de rendu (depuis config ou fallback hardcodé)
  if (ctx.renderHelper) {
    lines.push(
      `import { ${ctx.renderHelper.name} } from '${ctx.renderHelper.importPath}';`,
    );
  } else {
    lines.push(
      `import { renderWithProviders } from '@/shared/test/renderWithProviders';`,
    );
  }

  // ── Import des hooks et query keys depuis le fichier source ───────────────
  const namedImports = [...ctx.hookNames, ...ctx.queryKeyNames];
  lines.push(`import { ${namedImports.join(", ")} } from '${ctx.importPath}';`);

  return lines.join("\n");
}

/**
 * Génère le bloc MSW commenté (prêt à décommenter).
 *
 * @param {import('../types.mjs').FrontendHookTemplateContext} ctx
 * @returns {string}
 */
function renderMswBlock(ctx) {
  const lines = [
    `// ${"─".repeat(3)} MSW Server ${"─".repeat(49)}`,
    `// TODO: Décommenter quand le serveur MSW est configuré (Sprint Tests 2a)`,
  ];

  // Import conditionnel du handler MSW si le chemin est connu
  if (ctx.mswHandlerImportPath) {
    lines.push(`// import { handlers } from '${ctx.mswHandlerImportPath}';`);
  }

  lines.push(
    `// import { server } from '../../shared/test/mocks/server';`,
    `// beforeAll(() => server.listen());`,
    `// afterEach(() => server.resetHandlers());`,
    `// afterAll(() => server.close());`,
  );

  return lines.join("\n");
}

/**
 * Génère le bloc `describe` pour un hook de type useQuery.
 * Contient 1 cas de test : chargement/succès.
 *
 * @param {string} hookName         - Nom du hook (ex: 'useAlertTypes')
 * @param {string} feature          - Feature parente
 * @param {string} [renderHelperName='renderWithProviders'] - Nom du helper de rendu
 * @returns {string}
 */
function renderQueryDescribe(
  hookName,
  feature,
  renderHelperName = "renderWithProviders",
  coverageLevel = "standard",
) {
  const endpoint = deriveEndpointHint(hookName, feature);
  const level = coverageLevel ?? "standard";

  if (level === "minimal") {
    return [
      `describe('${hookName}', () => {`,
      `  it("l'appel initial se déroule sans erreur", async () => {`,
      `    // TODO: configurer MSW pour intercepter ${endpoint}`,
      `    // const { result } = renderHook(() => ${hookName}(), {`,
      `    //   wrapper: ${renderHelperName},`,
      `    // });`,
      `    // expect(result.current).toBeDefined();`,
      `    expect(true).toBe(true); // placeholder — à remplacer`,
      `  });`,
      `});`,
    ].join("\n");
  }

  const lines = [
    `describe('${hookName}', () => {`,
    `  it('devrait retourner les données en état de chargement puis succès', async () => {`,
    `    // TODO: configurer MSW pour intercepter ${endpoint}`,
    `    // const { result } = renderHook(() => ${hookName}(), {`,
    `    //   wrapper: ${renderHelperName},`,
    `    // });`,
    `    // await waitFor(() => expect(result.current.isSuccess).toBe(true));`,
    `    // expect(result.current.data).toBeDefined();`,
    `    expect(true).toBe(true); // placeholder — à remplacer`,
    `  });`,
  ];

  if (level === "exhaustive") {
    lines.push(
      ``,
      `  it('devrait exposer l\'état de chargement (isLoading)', async () => {`,
      `    // TODO: configurer MSW pour intercepter ${endpoint} avec un délai`,
      `    // const { result } = renderHook(() => ${hookName}(), {`,
      `    //   wrapper: ${renderHelperName},`,
      `    // });`,
      `    // expect(result.current.isLoading).toBe(true); // avant résolution`,
      `    // await waitFor(() => expect(result.current.isLoading).toBe(false));`,
      `    expect(true).toBe(true); // placeholder — à remplacer`,
      `  });`,
    );
  }

  lines.push(`});`);
  return lines.join("\n");
}

/**
 * Génère le bloc `describe` pour un hook de type useMutation.
 * Contient 2 cas de test : succès + erreur API.
 *
 * @param {string} hookName         - Nom du hook (ex: 'useCreateAlertType')
 * @param {string} feature          - Feature parente
 * @param {string} [renderHelperName='renderWithProviders'] - Nom du helper de rendu
 * @returns {string}
 */
function renderMutationDescribe(
  hookName,
  feature,
  renderHelperName = "renderWithProviders",
  coverageLevel = "standard",
) {
  const endpoint = deriveEndpointHint(hookName, feature);
  const level = coverageLevel ?? "standard";

  if (level === "minimal") {
    return [
      `describe('${hookName}', () => {`,
      `  it('devrait exécuter la mutation sans erreur', async () => {`,
      `    // TODO: configurer MSW pour intercepter ${endpoint}`,
      `    // const { result } = renderHook(() => ${hookName}(), {`,
      `    //   wrapper: ${renderHelperName},`,
      `    // });`,
      `    // await act(async () => { result.current.mutate({ /* payload */ }); });`,
      `    expect(true).toBe(true); // placeholder — à remplacer`,
      `  });`,
      `});`,
    ].join("\n");
  }

  const lines = [
    `describe('${hookName}', () => {`,
    `  it('devrait appeler la mutation et invalider le cache en cas de succès', async () => {`,
    `    // TODO: configurer MSW pour intercepter ${endpoint}`,
    `    // const { result } = renderHook(() => ${hookName}(), {`,
    `    //   wrapper: ${renderHelperName},`,
    `    // });`,
    `    // await act(async () => { result.current.mutate({ /* TODO: payload */ }); });`,
    `    // await waitFor(() => expect(result.current.isSuccess).toBe(true));`,
    `    expect(true).toBe(true); // placeholder — à remplacer`,
    `  });`,
    ``,
    `  it("devrait exposer l'erreur en cas d'échec API", async () => {`,
    `    // TODO: server.use(`,
    `    //   http.${endpoint.split(" ")[0].toLowerCase()}('${endpoint.split(" ")[1]}',`,
    `    //     () => HttpResponse.error()`,
    `    //   )`,
    `    // )`,
    `    // const { result } = renderHook(() => ${hookName}(), {`,
    `    //   wrapper: ${renderHelperName},`,
    `    // });`,
    `    // await act(async () => { result.current.mutate({ /* TODO: payload */ }); });`,
    `    // await waitFor(() => expect(result.current.isError).toBe(true));`,
    `    expect(true).toBe(true); // placeholder — à remplacer`,
    `  });`,
  ];

  if (level === "exhaustive") {
    lines.push(
      ``,
      `  it('devrait invalider les queries associées après mutation réussie', async () => {`,
      `    // TODO: vérifier queryClient.invalidateQueries() est appelé`,
      `    // const queryClient = new QueryClient()`,
      `    // const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')`,
      `    // ... render hook avec queryClient ...`,
      `    // await act(async () => { result.current.mutate({ /* payload */ }); });`,
      `    // await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());`,
      `    expect(true).toBe(true); // placeholder — à remplacer`,
      `  });`,
    );
  }

  lines.push(`});`);
  return lines.join("\n");
}

/**
 * Génère le bloc `describe` adapté pour un hook (query ou mutation).
 *
 * @param {string}   hookName         - Nom du hook
 * @param {string}   feature          - Feature parente
 * @param {string}   [renderHelperName='renderWithProviders'] - Nom du helper de rendu
 * @param {string[]?} prefixes        - Préfixes de mutation (depuis config, optionnel)
 * @returns {string}
 */
function renderHookDescribe(
  hookName,
  feature,
  renderHelperName = "renderWithProviders",
  prefixes,
  coverageLevel = "standard",
) {
  if (isMutationHook(hookName, prefixes)) {
    return renderMutationDescribe(
      hookName,
      feature,
      renderHelperName,
      coverageLevel,
    );
  }
  return renderQueryDescribe(
    hookName,
    feature,
    renderHelperName,
    coverageLevel,
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Génère le contenu complet d'un fichier de test pour des hooks React Query.
 *
 * Le fichier généré est syntaxiquement valide TypeScript (Vitest + RTL).
 * Tous les cas de test contiennent un `expect(true).toBe(true)` pour passer
 * en vert immédiatement, accompagné de commentaires TODO détaillés.
 *
 * Un `describe` est généré par hook dans ctx.hookNames :
 *   - useQuery  → 1 test (chargement/succès)
 *   - useMutation → 2 tests (succès + erreur)
 *
 * @param {import('../types.mjs').FrontendHookTemplateContext} ctx
 * @returns {string} Contenu du fichier .test.ts
 *
 * @example
 * const content = renderFrontendHookTest({
 *   hookNames:           ['useAlertTypes', 'useCreateAlertType'],
 *   feature:             'alerts',
 *   importPath:          '../useAlerts',
 *   usesQuery:           true,
 *   usesMutation:        true,
 *   queryKeyNames:       ['alertKeys'],
 *   testFramework:       'vitest',
 *   mswHandlerImportPath: null,
 * });
 */
export function renderFrontendHookTest(ctx) {
  // Validation défensive du contexte
  if (!ctx || typeof ctx !== "object") {
    throw new TypeError(
      "[renderFrontendHookTest] ctx doit être un objet non-null",
    );
  }
  if (!Array.isArray(ctx.hookNames) || ctx.hookNames.length === 0) {
    throw new TypeError(
      "[renderFrontendHookTest] ctx.hookNames doit être un tableau non vide",
    );
  }
  if (!ctx.importPath) {
    throw new TypeError("[renderFrontendHookTest] ctx.importPath est requis");
  }

  // Normalisation des champs optionnels
  const safeCtx = {
    ...ctx,
    feature: ctx.feature ?? "shared",
    usesQuery: ctx.usesQuery ?? false,
    usesMutation: ctx.usesMutation ?? false,
    queryKeyNames: ctx.queryKeyNames ?? [],
    testFramework: ctx.testFramework ?? "vitest",
    mswHandlerImportPath: ctx.mswHandlerImportPath ?? null,
    renderHelper: ctx.renderHelper ?? null,
    mutationPrefixes: ctx.mutationPrefixes ?? [],
  };

  // Le nom du "fichier de test" est basé sur le premier hook de la liste
  const primaryHookName = safeCtx.hookNames[0];

  // ── Construction des sections ─────────────────────────────────────────────
  const sections = [
    renderHeader(safeCtx, primaryHookName),
    "",
    "// @unitix:begin",
    "",
    renderImports(safeCtx),
    "",
    renderMswBlock(safeCtx),
    "",
    `// ${"─".repeat(3)} Tests ${"─".repeat(52)}`,
    "",
  ];

  // Détermine le nom du helper de rendu à utiliser dans les commentaires
  const renderHelperName = safeCtx.renderHelper?.name ?? "renderWithProviders";

  // Un describe par hook dans l'ordre déclaré
  for (let i = 0; i < safeCtx.hookNames.length; i++) {
    const hookName = safeCtx.hookNames[i];
    sections.push(
      renderHookDescribe(
        hookName,
        safeCtx.feature,
        renderHelperName,
        safeCtx.mutationPrefixes,
        safeCtx.coverageLevel ?? "standard",
      ),
    );

    // Ligne vide entre les describes (sauf après le dernier)
    if (i < safeCtx.hookNames.length - 1) {
      sections.push("");
    }
  }

  sections.push("// @unitix:end");
  sections.push("");
  sections.push(`// ${"─".repeat(3)} Tests personnalisés ${"─".repeat(39)}`);
  sections.push(
    `// Les blocs ci-dessous sont préservés lors d'un \`unitix --sync\`.`,
  );
  sections.push(`// Ajoutez ici vos tests supplémentaires pour ces hooks.`);
  sections.push("");

  return sections.join("\n");
}
