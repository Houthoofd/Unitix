/**
 * @file sync-merger.test.mjs
 * @description Tests unitaires pour utils/sync-merger.mjs
 * Exécution : node --test tests/unit/utils/sync-merger.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hasSyncMarkers,
  extractManualTail,
  mergeSyncContent,
  countNonEmptyLines,
} from '../../../utils/sync-merger.mjs';

// ─── hasSyncMarkers ───────────────────────────────────────────────────────────

describe('hasSyncMarkers', () => {
  it('retourne true quand les deux marqueurs sont présents', () => {
    const content = [
      '// @unitix:begin',
      "import { Foo } from './Foo';",
      '// @unitix:end',
    ].join('\n');

    assert.equal(hasSyncMarkers(content), true);
  });

  it('retourne false quand seul @unitix:begin est présent', () => {
    const content = '// @unitix:begin\nimport { Foo } from "./Foo";';
    assert.equal(hasSyncMarkers(content), false);
  });

  it('retourne false quand seul @unitix:end est présent', () => {
    const content = "import { Foo } from './Foo';\n// @unitix:end";
    assert.equal(hasSyncMarkers(content), false);
  });

  it('retourne false quand aucun marqueur n\'est présent', () => {
    const content = "import { Foo } from './Foo';\ndescribe('Foo', () => {});";
    assert.equal(hasSyncMarkers(content), false);
  });

  it('retourne false pour une chaîne vide', () => {
    assert.equal(hasSyncMarkers(''), false);
  });
});

// ─── extractManualTail ────────────────────────────────────────────────────────

describe('extractManualTail', () => {
  it('extrait le tail non vide situé après @unitix:end', () => {
    const content = [
      '// @unitix:begin',
      "describe('Foo', () => {});",
      '// @unitix:end',
      '',
      "it('mon test custom', () => { expect(1).toBe(1); });",
    ].join('\n');

    const tail = extractManualTail(content);
    assert.ok(tail !== null, 'tail ne doit pas être null');
    assert.ok(
      tail.includes("it('mon test custom'"),
      'tail doit contenir le test custom',
    );
  });

  it('retourne null quand le tail ne contient que des whitespace', () => {
    const content = [
      '// @unitix:begin',
      "describe('Foo', () => {});",
      '// @unitix:end',
      '   ',
      '\t',
      '',
    ].join('\n');

    assert.equal(extractManualTail(content), null);
  });

  it('retourne null quand il n\'y a rien après @unitix:end', () => {
    const content = '// @unitix:begin\n// @unitix:end';
    assert.equal(extractManualTail(content), null);
  });

  it('retourne null quand le marqueur @unitix:end est absent', () => {
    const content = "// @unitix:begin\ndescribe('Foo', () => {});";
    assert.equal(extractManualTail(content), null);
  });

  it('préserve exactement le contenu du tail (trim de fin uniquement)', () => {
    const custom = "\nit('custom', () => {});\n\nit('autre', () => {});\n\n\n";
    const content = '// @unitix:begin\n// @unitix:end' + custom;
    const tail = extractManualTail(content);

    assert.ok(tail !== null);
    assert.ok(tail.includes("it('custom'"));
    assert.ok(tail.includes("it('autre'"));
    // la fin doit être trimmée (pas de trailing whitespace excessif)
    assert.equal(tail, tail.trimEnd());
  });
});

// ─── mergeSyncContent ─────────────────────────────────────────────────────────

describe('mergeSyncContent', () => {
  it('retourne newContent tel quel quand tail est null', () => {
    const newContent = '// @unitix:begin\ndescribe("X", () => {});\n// @unitix:end\n';
    assert.equal(mergeSyncContent(newContent, null), newContent);
  });

  it('retourne newContent tel quel quand tail est undefined', () => {
    const newContent = '// @unitix:begin\ndescribe("X", () => {});\n// @unitix:end\n';
    assert.equal(mergeSyncContent(newContent, undefined), newContent);
  });

  it('concatène newContent et tail avec une ligne vide de séparation', () => {
    const newContent = '// @unitix:begin\ndescribe("X", () => {});\n// @unitix:end';
    const tail = "it('custom', () => { expect(1).toBe(1); });";

    const result = mergeSyncContent(newContent, tail);

    assert.ok(result.includes('// @unitix:begin'), 'doit contenir begin');
    assert.ok(result.includes('// @unitix:end'), 'doit contenir end');
    assert.ok(result.includes("it('custom'"), 'doit contenir le tail');
    // La séparation doit être au moins une ligne vide entre end et tail
    assert.ok(
      result.includes('// @unitix:end\n\n'),
      'doit avoir une ligne vide entre end et le tail',
    );
  });

  it('se termine par un retour à la ligne', () => {
    const newContent = '// @unitix:begin\n// @unitix:end';
    const tail = "it('custom', () => {});";
    const result = mergeSyncContent(newContent, tail);
    assert.equal(result.at(-1), '\n', 'le résultat doit se terminer par \\n');
  });
});

// ─── countNonEmptyLines ───────────────────────────────────────────────────────

describe('countNonEmptyLines', () => {
  it('retourne 0 pour une chaîne vide', () => {
    assert.equal(countNonEmptyLines(''), 0);
  });

  it('retourne 0 pour une chaîne ne contenant que des lignes vides', () => {
    assert.equal(countNonEmptyLines('\n\n\n'), 0);
  });

  it('retourne 0 pour une chaîne ne contenant que des whitespace', () => {
    assert.equal(countNonEmptyLines('   \n\t\n  '), 0);
  });

  it('compte uniquement les lignes non vides dans un texte mixte', () => {
    const text = [
      'ligne 1',
      '',
      '  ',
      'ligne 2',
      '\t',
      'ligne 3',
      '',
    ].join('\n');

    assert.equal(countNonEmptyLines(text), 3);
  });

  it('retourne 1 pour une seule ligne non vide sans retour à la ligne', () => {
    assert.equal(countNonEmptyLines('une ligne'), 1);
  });

  it('compte correctement les lignes contenant uniquement des espaces comme vides', () => {
    const text = '  \n  ligne utile  \n  ';
    assert.equal(countNonEmptyLines(text), 1);
  });
});
