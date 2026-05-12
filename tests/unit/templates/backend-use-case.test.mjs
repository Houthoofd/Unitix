/**
 * @file backend-use-case.test.mjs
 * @description Tests unitaires pour templates/backend-use-case.mjs
 * Exécution : node --test tests/unit/templates/backend-use-case.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderBackendUseCaseTest } from "../../../templates/backend-use-case.mjs";

// ─── Contexte minimal réutilisable ────────────────────────────────────────────

const minimalCtx = {
  className: "GetAlertTypesUseCase",
  module: "alerts",
  sourceImportPath: "../GetAlertTypesUseCase",
  sourceHash: "abc12345",
  repositories: [
    {
      paramName: "repo",
      interfaceName: "IAlertTypeRepository",
      importPath: "../../../domain/repositories/IAlertTypeRepository",
      methods: [
        {
          name: "findAll",
          mockReturn: "[]",
          returnsVoid: false,
          returnsBool: false,
          returnsArray: true,
          returnsNullable: false,
        },
      ],
    },
  ],
  executeParams: [],
  returnType: "AlertTypeDto[]",
  isVoid: false,
  returnsArray: true,
  returnsBool: false,
  thrownExceptions: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("renderBackendUseCaseTest", () => {
  it("1. retourne une string non vide", () => {
    const result = renderBackendUseCaseTest(minimalCtx);
    assert.equal(typeof result, "string");
    assert.ok(result.length > 0, "le résultat ne doit pas être vide");
  });

  it("2. contient les marqueurs @unitix:begin et @unitix:end", () => {
    const result = renderBackendUseCaseTest(minimalCtx);
    assert.ok(
      result.includes("// @unitix:begin"),
      "doit contenir @unitix:begin",
    );
    assert.ok(result.includes("// @unitix:end"), "doit contenir @unitix:end");
  });

  it("3. contient le hash source fourni", () => {
    const result = renderBackendUseCaseTest(minimalCtx);
    assert.ok(
      result.includes("// @unitix-source-hash: abc12345"),
      "doit contenir la ligne de hash",
    );
  });

  it("4. contient l'import du className", () => {
    const result = renderBackendUseCaseTest(minimalCtx);
    assert.ok(
      result.includes("import { GetAlertTypesUseCase }"),
      "doit contenir l'import du use-case",
    );
  });

  it('5. contient la mention "Généré par : Unitix v0.4.1"', () => {
    const result = renderBackendUseCaseTest(minimalCtx);
    assert.ok(
      result.includes("Généré par : Unitix v0.4.1"),
      "doit contenir la signature du générateur",
    );
  });

  it('6. contient la section "Tests personnalisés"', () => {
    const result = renderBackendUseCaseTest(minimalCtx);
    assert.ok(
      result.includes("Tests personnalisés"),
      "doit contenir la section des tests personnalisés",
    );
  });

  it("7. sans sourceHash → ne contient pas @unitix-source-hash", () => {
    const ctxNoHash = { ...minimalCtx, sourceHash: undefined };
    const result = renderBackendUseCaseTest(ctxNoHash);
    assert.ok(
      !result.includes("@unitix-source-hash"),
      "ne doit pas contenir la ligne de hash si sourceHash est absent",
    );
  });

  it("8. avec thrownExceptions → contient NotFoundException", () => {
    const ctxWithException = {
      ...minimalCtx,
      thrownExceptions: ["NotFoundException"],
    };
    const result = renderBackendUseCaseTest(ctxWithException);
    assert.ok(
      result.includes("NotFoundException"),
      "doit contenir le nom de l'exception dans les tests générés",
    );
  });

  it("9. isVoid: true → contient toHaveBeenCalledTimes", () => {
    const ctxVoid = { ...minimalCtx, isVoid: true, returnsArray: false };
    const result = renderBackendUseCaseTest(ctxVoid);
    assert.ok(
      result.includes("toHaveBeenCalledTimes"),
      "un use-case void doit générer un assert toHaveBeenCalledTimes",
    );
  });

  it("10a. lève TypeError si ctx est null", () => {
    assert.throws(() => renderBackendUseCaseTest(null), TypeError);
  });

  it("10b. lève TypeError si ctx est une chaîne vide", () => {
    assert.throws(() => renderBackendUseCaseTest(""), TypeError);
  });

  it("10c. lève TypeError si className est manquant", () => {
    const { className, ...ctxNoClass } = minimalCtx;
    assert.throws(() => renderBackendUseCaseTest(ctxNoClass), TypeError);
  });

  // ─── Tests coverageLevel ──────────────────────────────────────────────────

  it("minimal — contient exactement 1 bloc it(", () => {
    const ctx = { ...minimalCtx, coverageLevel: "minimal" };
    const result = renderBackendUseCaseTest(ctx);
    // Les blocs it() sont indentés à 4 espaces dans le code généré (inside describe('execute'))
    const itBlocks = result.match(/\n    it\(/g);
    assert.equal(
      itBlocks?.length ?? 0,
      1,
      "doit contenir exactement 1 bloc it( (le cas nominal)",
    );
    assert.ok(
      !result.includes("Cas d'erreur"),
      "ne doit pas contenir la section Cas d'erreur",
    );
  });

  it("standard — contient cas nominal ET cas d'erreur", () => {
    const ctx = {
      ...minimalCtx,
      coverageLevel: "standard",
      thrownExceptions: ["NotFoundException"],
    };
    const result = renderBackendUseCaseTest(ctx);
    assert.ok(
      result.includes("NotFoundException"),
      "doit contenir NotFoundException",
    );
    assert.ok(
      result.includes("Cas d'erreur"),
      "doit contenir la section Cas d'erreur",
    );
  });

  it("exhaustive — contient toHaveBeenCalledWith", () => {
    const ctx = { ...minimalCtx, coverageLevel: "exhaustive" };
    const result = renderBackendUseCaseTest(ctx);
    assert.ok(
      result.includes("toHaveBeenCalledWith"),
      "doit contenir toHaveBeenCalledWith pour les méthodes repo",
    );
  });

  it("exhaustive — contient le cas retour nullable", () => {
    const ctx = {
      ...minimalCtx,
      coverageLevel: "exhaustive",
      returnType: "AlertTypeDto | null",
    };
    const result = renderBackendUseCaseTest(ctx);
    assert.ok(
      result.includes("toBeNull"),
      "doit contenir toBeNull pour le cas retour nullable",
    );
  });

  it("exhaustive — contient le test de params invalides", () => {
    const ctx = {
      ...minimalCtx,
      coverageLevel: "exhaustive",
      executeParams: [{ name: "id", type: "number", optional: false }],
    };
    const result = renderBackendUseCaseTest(ctx);
    assert.ok(
      result.includes("undefined as any"),
      'doit contenir "undefined as any" pour le test de params invalides',
    );
  });
});
