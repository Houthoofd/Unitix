/**
 * @file ast-cache.test.mjs
 * @description Tests unitaires du module utils/ast-cache.mjs
 *
 * Couverture :
 *  - loadCache : fichier absent, JSON invalide, JSON valide
 *  - saveCache : écriture et re-lecture
 *  - getCachedGeneration : hit, miss (absent), miss (hash différent), miss (coverageLevel différent)
 *  - setCachedGeneration : insertion, remplacement
 *  - getCacheStats : cache vide, cache peuplé
 *
 * @module tests/unit/utils/ast-cache.test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadCache,
  saveCache,
  getCachedGeneration,
  setCachedGeneration,
  getCacheStats,
} from '../../../utils/ast-cache.mjs';

// ─── loadCache ────────────────────────────────────────────────────────────────

describe('loadCache', () => {
  test('retourne {} si le fichier est absent', async () => {
    const result = await loadCache('/chemin/inexistant/.unitix-cache.json');
    assert.deepEqual(result, {});
  });

  test('retourne {} si le fichier contient du JSON invalide', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'unitix-cache-test-'));
    const cacheFile = join(tmpDir, 'cache.json');
    await writeFile(cacheFile, '{ broken json', 'utf-8');

    const result = await loadCache(cacheFile);
    assert.deepEqual(result, {});

    await unlink(cacheFile);
  });

  test('retourne {} si le JSON est un tableau', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'unitix-cache-test-'));
    const cacheFile = join(tmpDir, 'cache.json');
    await writeFile(cacheFile, '[]', 'utf-8');

    const result = await loadCache(cacheFile);
    assert.deepEqual(result, {});

    await unlink(cacheFile);
  });

  test('charge correctement un cache JSON valide', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'unitix-cache-test-'));
    const cacheFile = join(tmpDir, 'cache.json');
    const data = {
      '/foo/bar.ts': {
        sourceHash: 'abc123',
        coverageLevel: 'standard',
        content: '// test',
        testFilePath: '/foo/__tests__/bar.test.ts',
        cachedAt: 1000,
      },
    };
    await writeFile(cacheFile, JSON.stringify(data), 'utf-8');

    const result = await loadCache(cacheFile);
    assert.deepEqual(result, data);

    await unlink(cacheFile);
  });
});

// ─── saveCache ────────────────────────────────────────────────────────────────

describe('saveCache', () => {
  test('persiste le cache et peut être rechargé', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'unitix-cache-test-'));
    const cacheFile = join(tmpDir, 'cache.json');

    const cache = {};
    setCachedGeneration(cache, '/src/Foo.ts', 'hash1', 'standard', {
      content: '// generated',
      testFilePath: '/src/__tests__/Foo.test.ts',
    });

    await saveCache(cacheFile, cache);

    const reloaded = await loadCache(cacheFile);
    assert.equal(reloaded['/src/Foo.ts'].sourceHash, 'hash1');
    assert.equal(reloaded['/src/Foo.ts'].coverageLevel, 'standard');
    assert.equal(reloaded['/src/Foo.ts'].content, '// generated');

    await unlink(cacheFile);
  });

  test('ne throw pas si le chemin est invalide', async () => {
    // saveCache est silencieux en cas d'erreur FS
    await assert.doesNotReject(() =>
      saveCache('/chemin/inexistant/impossible/cache.json', {}),
    );
  });
});

// ─── getCachedGeneration ──────────────────────────────────────────────────────

describe('getCachedGeneration', () => {
  const makeCache = () => {
    /** @type {import('../../../utils/ast-cache.mjs').AstCache} */
    const cache = {};
    setCachedGeneration(cache, '/src/Foo.ts', 'hashXYZ', 'standard', {
      content: '// stub content',
      testFilePath: '/src/__tests__/Foo.test.ts',
    });
    return cache;
  };

  test('retourne le résultat caché si hash + coverageLevel correspondent', () => {
    const cache = makeCache();
    const result = getCachedGeneration(cache, '/src/Foo.ts', 'hashXYZ', 'standard');
    assert.ok(result !== null);
    assert.equal(result.content, '// stub content');
    assert.equal(result.testFilePath, '/src/__tests__/Foo.test.ts');
  });

  test('retourne null si le fichier est absent du cache', () => {
    const cache = makeCache();
    const result = getCachedGeneration(cache, '/src/Bar.ts', 'hashXYZ', 'standard');
    assert.equal(result, null);
  });

  test('retourne null si le hash diffère (source modifiée)', () => {
    const cache = makeCache();
    const result = getCachedGeneration(cache, '/src/Foo.ts', 'hashAUTRE', 'standard');
    assert.equal(result, null);
  });

  test('retourne null si le coverageLevel diffère', () => {
    const cache = makeCache();
    const result = getCachedGeneration(cache, '/src/Foo.ts', 'hashXYZ', 'exhaustive');
    assert.equal(result, null);
  });
});

// ─── setCachedGeneration ──────────────────────────────────────────────────────

describe('setCachedGeneration', () => {
  test('insère une nouvelle entrée dans le cache', () => {
    const cache = {};
    setCachedGeneration(cache, '/src/A.ts', 'h1', 'minimal', {
      content: '// A',
      testFilePath: '/src/__tests__/A.test.ts',
    });
    assert.ok(cache['/src/A.ts']);
    assert.equal(cache['/src/A.ts'].sourceHash, 'h1');
    assert.equal(cache['/src/A.ts'].coverageLevel, 'minimal');
  });

  test('remplace une entrée existante', () => {
    const cache = {};
    setCachedGeneration(cache, '/src/A.ts', 'h1', 'standard', {
      content: '// v1',
      testFilePath: '/src/__tests__/A.test.ts',
    });
    setCachedGeneration(cache, '/src/A.ts', 'h2', 'standard', {
      content: '// v2',
      testFilePath: '/src/__tests__/A.test.ts',
    });
    assert.equal(cache['/src/A.ts'].sourceHash, 'h2');
    assert.equal(cache['/src/A.ts'].content, '// v2');
  });

  test('stocke un timestamp cachedAt', () => {
    const before = Date.now();
    const cache = {};
    setCachedGeneration(cache, '/src/B.ts', 'h1', 'standard', {
      content: '// B',
      testFilePath: '/src/__tests__/B.test.ts',
    });
    const after = Date.now();
    assert.ok(cache['/src/B.ts'].cachedAt >= before);
    assert.ok(cache['/src/B.ts'].cachedAt <= after);
  });
});

// ─── getCacheStats ────────────────────────────────────────────────────────────

describe('getCacheStats', () => {
  test('retourne total=0 pour un cache vide', () => {
    const stats = getCacheStats({});
    assert.equal(stats.total, 0);
    assert.deepEqual(stats.entries, []);
  });

  test('retourne le bon total et les clés', () => {
    const cache = {};
    setCachedGeneration(cache, '/src/A.ts', 'h', 'standard', { content: '', testFilePath: '' });
    setCachedGeneration(cache, '/src/B.ts', 'h', 'standard', { content: '', testFilePath: '' });

    const stats = getCacheStats(cache);
    assert.equal(stats.total, 2);
    assert.ok(stats.entries.includes('/src/A.ts'));
    assert.ok(stats.entries.includes('/src/B.ts'));
  });
});
