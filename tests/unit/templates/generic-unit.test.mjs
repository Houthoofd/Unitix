/**
 * @file generic-unit.test.mjs
 * @description Tests unitaires du template templates/generic-unit.mjs
 *
 * Couverture :
 *  - Validation du contexte (TypeError si null, fileName absent)
 *  - Header : ligne "Généré par", hash optionnel
 *  - Marqueurs @unitix:begin / @unitix:end
 *  - Section "Tests personnalisés"
 *  - Import placeholder avec fileName
 *  - describe avec le bon nom
 *  - coverageLevel minimal / standard / exhaustive
 *
 * @module tests/unit/templates/generic-unit.test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { renderGenericUnitTest } from '../../../templates/generic-unit.mjs';

// ─── Contexte de base réutilisable ────────────────────────────────────────────

const BASE_CTX = {
  fileName: 'UserService',
  importPath: '../UserService',
  testFramework: 'jest',
};

// ─── Validation ───────────────────────────────────────────────────────────────

describe('renderGenericUnitTest — validation', () => {
  test('lève TypeError si ctx est null', () => {
    assert.throws(() => renderGenericUnitTest(null), TypeError);
  });

  test('lève TypeError si ctx est une string', () => {
    assert.throws(() => renderGenericUnitTest('bad'), TypeError);
  });

  test('lève TypeError si ctx.fileName est absent', () => {
    assert.throws(
      () => renderGenericUnitTest({ importPath: '../Foo', testFramework: 'jest' }),
      TypeError,
    );
  });

  test('lève TypeError si ctx.fileName est une chaîne vide', () => {
    assert.throws(
      () => renderGenericUnitTest({ fileName: '', importPath: '../Foo', testFramework: 'jest' }),
      TypeError,
    );
  });
});

// ─── Contenu de base ──────────────────────────────────────────────────────────

describe('renderGenericUnitTest — contenu de base', () => {
  test('retourne une string non vide', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    assert.ok(typeof result === 'string' && result.length > 0);
  });

  test('contient la ligne Généré par : Unitix', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    assert.ok(result.includes('Généré par : Unitix'), 'Header Généré par manquant');
  });

  test('ne contient PAS @unitix-source-hash si sourceHash absent', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    assert.ok(!result.includes('@unitix-source-hash'));
  });

  test('contient @unitix-source-hash si sourceHash fourni', () => {
    const result = renderGenericUnitTest({ ...BASE_CTX, sourceHash: 'abc123ef' });
    assert.ok(result.includes('// @unitix-source-hash: abc123ef'));
  });

  test('contient les marqueurs @unitix:begin et @unitix:end', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    assert.ok(result.includes('// @unitix:begin'), 'Marqueur begin manquant');
    assert.ok(result.includes('// @unitix:end'),   'Marqueur end manquant');
  });

  test('@unitix:begin apparaît avant @unitix:end', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    const beginIdx = result.indexOf('// @unitix:begin');
    const endIdx   = result.indexOf('// @unitix:end');
    assert.ok(beginIdx < endIdx, 'begin doit précéder end');
  });

  test('contient la section "Tests personnalisés"', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    assert.ok(result.includes('Tests personnalisés'), 'Section Tests personnalisés manquante');
  });

  test('contient le describe avec le fileName', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    assert.ok(result.includes("describe('UserService'"), 'describe avec UserService manquant');
  });

  test('contient l\'import avec importPath', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    assert.ok(result.includes("from '../UserService'"), 'import avec importPath manquant');
  });

  test('contient un bloc it()', () => {
    const result = renderGenericUnitTest(BASE_CTX);
    assert.ok(result.includes("it('"), 'Au moins un bloc it() doit être présent');
  });

  test('fonctionne avec vitest comme testFramework', () => {
    const result = renderGenericUnitTest({ ...BASE_CTX, testFramework: 'vitest' });
    assert.ok(typeof result === 'string' && result.length > 0);
  });
});

// ─── coverageLevel ────────────────────────────────────────────────────────────

describe('renderGenericUnitTest — coverageLevel', () => {
  test('minimal : contient exactement 1 bloc it(', () => {
    const result = renderGenericUnitTest({ ...BASE_CTX, coverageLevel: 'minimal' });
    const itCount = (result.match(/\bit\(/g) ?? []).length;
    assert.equal(itCount, 1, `minimal devrait contenir 1 bloc it(), trouvé : ${itCount}`);
  });

  test('standard : contient exactement 1 bloc it(', () => {
    const result = renderGenericUnitTest({ ...BASE_CTX, coverageLevel: 'standard' });
    const itCount = (result.match(/\bit\(/g) ?? []).length;
    assert.equal(itCount, 1, `standard devrait contenir 1 bloc it(), trouvé : ${itCount}`);
  });

  test('exhaustive : contient exactement 2 blocs it(', () => {
    const result = renderGenericUnitTest({ ...BASE_CTX, coverageLevel: 'exhaustive' });
    const itCount = (result.match(/\bit\(/g) ?? []).length;
    assert.equal(itCount, 2, `exhaustive devrait contenir 2 blocs it(), trouvé : ${itCount}`);
  });

  test('exhaustive : contient le texte "cas limites"', () => {
    const result = renderGenericUnitTest({ ...BASE_CTX, coverageLevel: 'exhaustive' });
    assert.ok(result.includes('cas limites'), 'Le second it() doit mentionner les cas limites');
  });

  test('sans coverageLevel → se comporte comme standard', () => {
    const withStd  = renderGenericUnitTest({ ...BASE_CTX, coverageLevel: 'standard' });
    const withNone = renderGenericUnitTest({ ...BASE_CTX });
    assert.equal(withNone, withStd, 'Sans coverageLevel, le comportement doit être identique à standard');
  });
});
