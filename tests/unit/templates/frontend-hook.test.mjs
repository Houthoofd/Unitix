/**
 * @file frontend-hook.test.mjs
 * @description Tests unitaires pour templates/frontend-hook.mjs
 * Exécution : node --test tests/unit/templates/frontend-hook.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderFrontendHookTest } from "../../../templates/frontend-hook.mjs";

// ─── Contexte minimal réutilisable ────────────────────────────────────────────

const minimalCtx = {
  hookNames: ["useAlertTypes"],
  feature: "alerts",
  importPath: "../useAlerts",
  testFramework: "vitest",
  queryKeyNames: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compte le nombre d'occurrences d'une sous-chaîne dans un texte.
 *
 * @param {string} text
 * @param {string} sub
 * @returns {number}
 */
function countOccurrences(text, sub) {
  let count = 0;
  let start = 0;
  while ((start = text.indexOf(sub, start)) !== -1) {
    count++;
    start += sub.length;
  }
  return count;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("renderFrontendHookTest", () => {
  it("1. retourne une string non vide", () => {
    const result = renderFrontendHookTest(minimalCtx);
    assert.equal(typeof result, "string");
    assert.ok(result.length > 0, "le résultat ne doit pas être vide");
  });

  it("2. contient les marqueurs @unitix:begin et @unitix:end", () => {
    const result = renderFrontendHookTest(minimalCtx);
    assert.ok(
      result.includes("// @unitix:begin"),
      "doit contenir @unitix:begin",
    );
    assert.ok(result.includes("// @unitix:end"), "doit contenir @unitix:end");
  });

  it("3. contient describe('useAlertTypes'", () => {
    const result = renderFrontendHookTest(minimalCtx);
    assert.ok(
      result.includes("describe('useAlertTypes'"),
      "doit contenir un bloc describe nommé d'après le premier hook",
    );
  });

  it("4. mutation hook (useCreateAlertType) → contient exactement 2 blocs it(", () => {
    const ctxMutation = {
      ...minimalCtx,
      hookNames: ["useCreateAlertType"],
    };
    const result = renderFrontendHookTest(ctxMutation);

    // Un hook mutation génère 2 it() : succès + erreur API
    const itCount = countOccurrences(result, "  it(");
    assert.equal(
      itCount,
      2,
      `un hook mutation doit générer 2 blocs it(), trouvé : ${itCount}`,
    );
  });

  it("4b. query hook (useAlertTypes) → contient exactement 1 bloc it(", () => {
    const result = renderFrontendHookTest(minimalCtx);
    const itCount = countOccurrences(result, "  it(");
    assert.equal(
      itCount,
      1,
      `un hook query doit générer 1 bloc it(), trouvé : ${itCount}`,
    );
  });

  it("5a. lève TypeError si hookNames est un tableau vide", () => {
    const ctxEmpty = { ...minimalCtx, hookNames: [] };
    assert.throws(() => renderFrontendHookTest(ctxEmpty), TypeError);
  });

  it("5b. lève TypeError si hookNames est absent (undefined)", () => {
    const { hookNames, ...ctxNoHooks } = minimalCtx;
    assert.throws(() => renderFrontendHookTest(ctxNoHooks), TypeError);
  });

  it("5c. lève TypeError si ctx est null", () => {
    assert.throws(() => renderFrontendHookTest(null), TypeError);
  });

  it("5d. lève TypeError si importPath est manquant", () => {
    const { importPath, ...ctxNoPath } = minimalCtx;
    assert.throws(() => renderFrontendHookTest(ctxNoPath), TypeError);
  });

  it("avec sourceHash → contient @unitix-source-hash", () => {
    const ctxWithHash = { ...minimalCtx, sourceHash: "cafebabe" };
    const result = renderFrontendHookTest(ctxWithHash);
    assert.ok(
      result.includes("// @unitix-source-hash: cafebabe"),
      "doit contenir la ligne de hash quand sourceHash est fourni",
    );
  });

  it("sans sourceHash → ne contient pas @unitix-source-hash", () => {
    const result = renderFrontendHookTest(minimalCtx);
    assert.ok(
      !result.includes("@unitix-source-hash"),
      "ne doit pas contenir la ligne de hash si sourceHash est absent",
    );
  });

  it("plusieurs hooks → génère un describe par hook", () => {
    const ctxMulti = {
      ...minimalCtx,
      hookNames: ["useAlertTypes", "useCreateAlertType"],
    };
    const result = renderFrontendHookTest(ctxMulti);
    assert.ok(
      result.includes("describe('useAlertTypes'"),
      "doit contenir le describe du premier hook",
    );
    assert.ok(
      result.includes("describe('useCreateAlertType'"),
      "doit contenir le describe du second hook",
    );
  });

  it("contient la section Tests personnalisés", () => {
    const result = renderFrontendHookTest(minimalCtx);
    assert.ok(
      result.includes("Tests personnalisés"),
      "doit contenir la section des tests personnalisés",
    );
  });

  // ─── coverageLevel ────────────────────────────────────────────────────────

  it("minimal query hook — contient exactement 1 bloc it(", () => {
    const ctx = {
      hookNames: ["useAlertTypes"],
      feature: "alerts",
      importPath: "../useAlerts",
      usesQuery: true,
      usesMutation: false,
      queryKeyNames: [],
      testFramework: "vitest",
      coverageLevel: "minimal",
    };
    const result = renderFrontendHookTest(ctx);
    const itCount = (result.match(/\n  it\(/g) ?? []).length;
    assert.equal(
      itCount,
      1,
      `minimal query doit générer 1 bloc it(), trouvé : ${itCount}`,
    );
    assert.ok(
      !result.includes("isSuccess"),
      "minimal query ne doit pas contenir isSuccess",
    );
  });

  it("minimal mutation hook — contient exactement 1 bloc it(", () => {
    const ctx = {
      hookNames: ["useCreateAlertType"],
      feature: "alerts",
      importPath: "../useAlerts",
      usesQuery: false,
      usesMutation: true,
      queryKeyNames: [],
      testFramework: "vitest",
      coverageLevel: "minimal",
    };
    const result = renderFrontendHookTest(ctx);
    const itCount = (result.match(/\n  it\(/g) ?? []).length;
    assert.equal(
      itCount,
      1,
      `minimal mutation doit générer 1 bloc it(), trouvé : ${itCount}`,
    );
  });

  it("exhaustive query hook — contient 2 blocs it( dont isLoading", () => {
    const ctx = {
      hookNames: ["useAlertTypes"],
      feature: "alerts",
      importPath: "../useAlerts",
      usesQuery: true,
      usesMutation: false,
      queryKeyNames: [],
      testFramework: "vitest",
      coverageLevel: "exhaustive",
    };
    const result = renderFrontendHookTest(ctx);
    const itCount = (result.match(/\n  it\(/g) ?? []).length;
    assert.equal(
      itCount,
      2,
      `exhaustive query doit générer 2 blocs it(), trouvé : ${itCount}`,
    );
    assert.ok(
      result.includes("isLoading"),
      "exhaustive query doit contenir isLoading",
    );
  });

  it("exhaustive mutation hook — contient 3 blocs it( dont invalidateQueries", () => {
    const ctx = {
      hookNames: ["useCreateAlertType"],
      feature: "alerts",
      importPath: "../useAlerts",
      usesQuery: false,
      usesMutation: true,
      queryKeyNames: [],
      testFramework: "vitest",
      coverageLevel: "exhaustive",
    };
    const result = renderFrontendHookTest(ctx);
    const itCount = (result.match(/\n  it\(/g) ?? []).length;
    assert.equal(
      itCount,
      3,
      `exhaustive mutation doit générer 3 blocs it(), trouvé : ${itCount}`,
    );
    assert.ok(
      result.includes("invalidateQueries"),
      "exhaustive mutation doit contenir invalidateQueries",
    );
  });
});
