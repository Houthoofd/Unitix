/**
 * @file template-resolver.test.mjs
 * @description Tests unitaires du module utils/template-resolver.mjs
 *
 * Couverture :
 *  - loadUserTemplate : fichier absent, render absent, render valide, erreur d'import, cache
 *  - hasUserTemplate  : fichier présent / absent
 *  - clearTemplateCache : vide le cache entre deux appels
 *  - TEMPLATE_NAMES   : contient les 4 noms attendus
 *
 * @module tests/unit/utils/template-resolver.test
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadUserTemplate,
  hasUserTemplate,
  clearTemplateCache,
  TEMPLATE_NAMES,
} from '../../../utils/template-resolver.mjs';

// ─── Setup ────────────────────────────────────────────────────────────────────

/** Crée un répertoire temporaire avec la structure unitix/templates/ */
async function makeTmpProject() {
  const root = await mkdtemp(join(tmpdir(), 'unitix-resolver-test-'));
  await mkdir(join(root, 'unitix', 'templates'), { recursive: true });
  return root;
}

// Vider le cache avant chaque test pour des tests isolés
beforeEach(() => clearTemplateCache());

// ─── TEMPLATE_NAMES ───────────────────────────────────────────────────────────

describe('TEMPLATE_NAMES', () => {
  test('contient les 4 noms de templates reconnus', () => {
    assert.ok(Array.isArray(TEMPLATE_NAMES));
    assert.ok(TEMPLATE_NAMES.includes('backend-use-case'));
    assert.ok(TEMPLATE_NAMES.includes('frontend-component'));
    assert.ok(TEMPLATE_NAMES.includes('frontend-hook'));
    assert.ok(TEMPLATE_NAMES.includes('generic-unit'));
    assert.equal(TEMPLATE_NAMES.length, 4);
  });
});

// ─── loadUserTemplate ─────────────────────────────────────────────────────────

describe('loadUserTemplate', () => {
  test('retourne null si le fichier template est absent', async () => {
    const root = await makeTmpProject();
    try {
      const result = await loadUserTemplate('backend-use-case', root);
      assert.equal(result, null);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('retourne null si le template n\'exporte pas de fonction render', async () => {
    const root = await makeTmpProject();
    const tplPath = join(root, 'unitix', 'templates', 'backend-use-case.mjs');
    await writeFile(tplPath, 'export const notRender = "oops";', 'utf-8');
    try {
      const result = await loadUserTemplate('backend-use-case', root);
      assert.equal(result, null);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('retourne la fonction render si le template est valide', async () => {
    const root = await makeTmpProject();
    const tplPath = join(root, 'unitix', 'templates', 'backend-use-case.mjs');
    await writeFile(
      tplPath,
      'export function render(ctx) { return "custom:" + ctx.name; }',
      'utf-8',
    );
    try {
      const renderFn = await loadUserTemplate('backend-use-case', root);
      assert.ok(typeof renderFn === 'function', 'Doit retourner une fonction');
      assert.equal(renderFn({ name: 'Test' }), 'custom:Test');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('met en cache le résultat : second appel ne relit pas le disque', async () => {
    const root = await makeTmpProject();
    // Premier appel → miss → null mis en cache
    const r1 = await loadUserTemplate('frontend-component', root);
    assert.equal(r1, null);

    // Écrire un template APRÈS le premier appel — le cache doit encore retourner null
    const tplPath = join(root, 'unitix', 'templates', 'frontend-component.mjs');
    await writeFile(tplPath, 'export function render(ctx) { return "late"; }', 'utf-8');

    const r2 = await loadUserTemplate('frontend-component', root);
    assert.equal(r2, null, 'Le cache doit retourner null sans re-lire le disque');

    await rm(root, { recursive: true, force: true });
  });

  test('clearTemplateCache invalide le cache et force une re-lecture', async () => {
    const root = await makeTmpProject();
    // Premier appel → null mis en cache
    await loadUserTemplate('frontend-hook', root);

    // Écrire le template + vider le cache
    const tplPath = join(root, 'unitix', 'templates', 'frontend-hook.mjs');
    await writeFile(tplPath, 'export function render(ctx) { return "after-clear"; }', 'utf-8');
    clearTemplateCache();

    // Maintenant doit charger le template
    const result = await loadUserTemplate('frontend-hook', root);
    assert.ok(typeof result === 'function', 'Après clearTemplateCache, doit charger le fichier');
    assert.equal(result({}), 'after-clear');

    await rm(root, { recursive: true, force: true });
  });

  test('deux templates différents sont isolés dans le cache', async () => {
    const root = await makeTmpProject();

    // backend-use-case → existe
    const backendPath = join(root, 'unitix', 'templates', 'backend-use-case.mjs');
    await writeFile(backendPath, 'export function render(ctx) { return "backend"; }', 'utf-8');

    const backendFn = await loadUserTemplate('backend-use-case', root);
    const frontendFn = await loadUserTemplate('frontend-component', root);

    assert.ok(typeof backendFn === 'function');
    assert.equal(frontendFn, null);

    await rm(root, { recursive: true, force: true });
  });
});

// ─── hasUserTemplate ──────────────────────────────────────────────────────────

describe('hasUserTemplate', () => {
  test('retourne false si le template n\'existe pas', async () => {
    const root = await makeTmpProject();
    try {
      const result = await hasUserTemplate('backend-use-case', root);
      assert.equal(result, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('retourne true si le template existe', async () => {
    const root = await makeTmpProject();
    const tplPath = join(root, 'unitix', 'templates', 'generic-unit.mjs');
    await writeFile(tplPath, '// placeholder', 'utf-8');
    try {
      const result = await hasUserTemplate('generic-unit', root);
      assert.equal(result, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('ne met PAS en cache (toujours re-vérifie le disque)', async () => {
    const root = await makeTmpProject();
    const tplPath = join(root, 'unitix', 'templates', 'generic-unit.mjs');

    const before = await hasUserTemplate('generic-unit', root);
    assert.equal(before, false);

    await writeFile(tplPath, '// now exists', 'utf-8');

    const after = await hasUserTemplate('generic-unit', root);
    assert.equal(after, true, 'hasUserTemplate doit toujours vérifier le disque');

    await rm(root, { recursive: true, force: true });
  });
});
