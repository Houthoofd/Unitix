/**
 * @file parse-error.test.mjs
 * @description Tests unitaires du module utils/parse-error.mjs
 *
 * Couverture :
 *  - Erreur sans position → message sans extrait de code
 *  - Erreur avec lineNumber/column (v7) → message avec extrait
 *  - Erreur avec location.line/column (v8) → message avec extrait
 *  - Curseur positionnel sous la ligne erronée
 *  - Extrait borné (début/fin de fichier)
 *
 * @module tests/unit/utils/parse-error.test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { formatParseError } from '../../../utils/parse-error.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_CODE = [
  'const a = 1;',      // ligne 1
  'const b = 2;',      // ligne 2
  'const FAIL HERE',   // ligne 3 — erreur ici
  'const d = 4;',      // ligne 4
  'const e = 5;',      // ligne 5
].join('\n');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('formatParseError', () => {
  test('affiche toujours le chemin du fichier', () => {
    const err = new Error('Unexpected token');
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    assert.ok(msg.includes('/src/Foo.ts'), 'Le chemin doit apparaître dans le message');
  });

  test('affiche le message brut de l\'erreur', () => {
    const err = new Error('Unexpected token at position X');
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    assert.ok(msg.includes('Unexpected token at position X'), 'Le message brut doit être inclus');
  });

  test('sans position : pas de section Extrait', () => {
    const err = new Error('some parse error');
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    assert.ok(!msg.includes('Extrait'), 'Sans position, pas d\'extrait de code');
    assert.ok(!msg.includes('Ligne'), 'Sans position, pas de ligne');
  });

  test('avec lineNumber (v7) : affiche la ligne', () => {
    const err = Object.assign(new Error('Unexpected token'), { lineNumber: 3 });
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    assert.ok(msg.includes('Ligne   : 3'), 'La ligne 3 doit être mentionnée');
    assert.ok(msg.includes('Extrait'), 'Un extrait doit être affiché');
    assert.ok(msg.includes('const FAIL HERE'), 'La ligne erronée doit figurer dans l\'extrait');
  });

  test('avec lineNumber + column (v7) : affiche ligne:col', () => {
    const err = Object.assign(new Error('Unexpected token'), { lineNumber: 3, column: 6 });
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    assert.ok(msg.includes('Ligne   : 3:6'), 'La position colonne doit être affichée');
    assert.ok(msg.includes('^'), 'Un curseur ^ doit pointer la colonne');
  });

  test('avec location.line/column (v8) : affiche ligne:col', () => {
    const err = Object.assign(new Error('Unexpected token'), {
      location: { line: 3, column: 6 },
    });
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    assert.ok(msg.includes('Ligne   : 3:6'), 'La position v8 doit être reconnue');
  });

  test('priorité à location.line sur lineNumber', () => {
    const err = Object.assign(new Error('err'), {
      lineNumber: 99,             // v7 (ignoré si location présent)
      location: { line: 3 },     // v8 (prioritaire)
    });
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    assert.ok(msg.includes('Ligne   : 3'), 'location.line doit avoir la priorité sur lineNumber');
    assert.ok(!msg.includes('99'), 'lineNumber ne doit pas apparaître si location est présent');
  });

  test('extrait borné au début du fichier (ligne 1)', () => {
    const err = Object.assign(new Error('err'), { lineNumber: 1 });
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    // Ne doit pas lever d'exception (pas de lignes négatives)
    assert.ok(msg.includes('   1 │'), 'La ligne 1 doit être dans l\'extrait');
  });

  test('extrait borné à la fin du fichier (dernière ligne)', () => {
    const err = Object.assign(new Error('err'), { lineNumber: 5 });
    const msg = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts');
    assert.ok(msg.includes('   5 │'), 'La ligne 5 doit être dans l\'extrait');
    // Pas d'erreur pour une ligne au-delà de la fin
  });

  test('marqueur > sur la ligne erronée uniquement', () => {
    const err = Object.assign(new Error('err'), { lineNumber: 3 });
    const lines = formatParseError(err, SAMPLE_CODE, '/src/Foo.ts').split('\n');
    const markedLines = lines.filter(l => l.includes('>'));
    const unmarkedLines = lines.filter(l => l.match(/\s \d+ │/));
    assert.equal(markedLines.length, 1, 'Une seule ligne doit avoir le marqueur >');
    assert.ok(unmarkedLines.length >= 1, 'Les autres lignes de l\'extrait doivent avoir un espace');
  });
});
