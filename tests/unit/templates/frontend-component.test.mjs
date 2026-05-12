/**
 * @file frontend-component.test.mjs
 * @description Tests unitaires pour templates/frontend-component.mjs
 * Exécution : node --test tests/unit/templates/frontend-component.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderFrontendComponentTest } from "../../../templates/frontend-component.mjs";

// ─── Contexte minimal réutilisable ────────────────────────────────────────────

const minimalCtx = {
  componentName: "AlertTypeBadge",
  feature: "alerts",
  importPath: "../AlertTypeBadge",
  testFramework: "vitest",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("renderFrontendComponentTest", () => {
  it("1. retourne une string non vide", () => {
    const result = renderFrontendComponentTest(minimalCtx);
    assert.equal(typeof result, "string");
    assert.ok(result.length > 0, "le résultat ne doit pas être vide");
  });

  it("2. contient les marqueurs @unitix:begin et @unitix:end", () => {
    const result = renderFrontendComponentTest(minimalCtx);
    assert.ok(
      result.includes("// @unitix:begin"),
      "doit contenir @unitix:begin",
    );
    assert.ok(result.includes("// @unitix:end"), "doit contenir @unitix:end");
  });

  it("3. contient le nom du composant dans le corps du template", () => {
    const result = renderFrontendComponentTest(minimalCtx);
    assert.ok(
      result.includes("AlertTypeBadge"),
      "doit mentionner le nom du composant",
    );
  });

  it("4. contient describe('AlertTypeBadge'", () => {
    const result = renderFrontendComponentTest(minimalCtx);
    assert.ok(
      result.includes("describe('AlertTypeBadge'"),
      "doit contenir le bloc describe nommé d'après le composant",
    );
  });

  it("5. avec sourceHash → contient @unitix-source-hash", () => {
    const ctxWithHash = { ...minimalCtx, sourceHash: "deadbeef" };
    const result = renderFrontendComponentTest(ctxWithHash);
    assert.ok(
      result.includes("// @unitix-source-hash: deadbeef"),
      "doit contenir la ligne de hash quand sourceHash est fourni",
    );
  });

  it("6. avec renderHelper → contient l'import du helper", () => {
    const ctxWithHelper = {
      ...minimalCtx,
      renderHelper: {
        name: "renderWithProviders",
        importPath: "@/shared/test/renderWithProviders",
      },
    };
    const result = renderFrontendComponentTest(ctxWithHelper);
    assert.ok(
      result.includes("renderWithProviders"),
      "doit contenir le nom du helper de rendu",
    );
    assert.ok(
      result.includes("@/shared/test/renderWithProviders"),
      "doit contenir le chemin d'import du helper",
    );
  });

  it("7a. lève TypeError si ctx est null", () => {
    assert.throws(() => renderFrontendComponentTest(null), TypeError);
  });

  it("7b. lève TypeError si ctx est un nombre", () => {
    assert.throws(() => renderFrontendComponentTest(42), TypeError);
  });

  it("7c. lève TypeError si componentName est manquant", () => {
    const { componentName, ...ctxNoName } = minimalCtx;
    assert.throws(() => renderFrontendComponentTest(ctxNoName), TypeError);
  });

  it("7d. lève TypeError si importPath est manquant", () => {
    const { importPath, ...ctxNoPath } = minimalCtx;
    assert.throws(() => renderFrontendComponentTest(ctxNoPath), TypeError);
  });

  it("sans sourceHash → ne contient pas @unitix-source-hash", () => {
    const result = renderFrontendComponentTest(minimalCtx); // pas de sourceHash
    assert.ok(
      !result.includes("@unitix-source-hash"),
      "ne doit pas contenir la ligne de hash si sourceHash est absent",
    );
  });

  it("contient la section Tests personnalisés", () => {
    const result = renderFrontendComponentTest(minimalCtx);
    assert.ok(
      result.includes("Tests personnalisés"),
      "doit contenir la section des tests personnalisés",
    );
  });

  it("minimal — contient exactement 1 bloc it(", () => {
    const result = renderFrontendComponentTest({
      ...minimalCtx,
      coverageLevel: "minimal",
    });
    const count = (result.match(/\n  it\(/g) ?? []).length;
    assert.equal(
      count,
      1,
      `doit contenir exactement 1 bloc it( (trouvé : ${count})`,
    );
    assert.ok(
      !result.includes("afficher le contenu correct"),
      'ne doit pas contenir "afficher le contenu correct" en mode minimal',
    );
  });

  it("standard — contient exactement 2 blocs it(", () => {
    const result = renderFrontendComponentTest({
      ...minimalCtx,
      coverageLevel: "standard",
    });
    const count = (result.match(/\n  it\(/g) ?? []).length;
    assert.equal(
      count,
      2,
      `doit contenir exactement 2 blocs it( (trouvé : ${count})`,
    );
    assert.ok(
      result.includes("afficher le contenu correct"),
      'doit contenir "afficher le contenu correct" en mode standard',
    );
  });

  it("exhaustive — contient 5 blocs it(", () => {
    const result = renderFrontendComponentTest({
      ...minimalCtx,
      coverageLevel: "exhaustive",
    });
    const count = (result.match(/\n  it\(/g) ?? []).length;
    assert.equal(
      count,
      5,
      `doit contenir exactement 5 blocs it( (trouvé : ${count})`,
    );
    assert.ok(
      result.includes("accessible"),
      'doit contenir "accessible" en mode exhaustive',
    );
    assert.ok(
      result.includes("snapshot"),
      'doit contenir "snapshot" en mode exhaustive',
    );
  });
});
