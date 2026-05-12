/**
 * @file cli.test.mjs
 * @description Tests unitaires du module core/cli.mjs (parseArgs + nouveaux flags v0.6.0)
 *
 * @module tests/unit/core/cli.test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../../../core/cli.mjs';

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe('parseArgs — valeurs par défaut', () => {
  test('retourne les valeurs par défaut avec argv vide', () => {
    const opts = parseArgs([]);
    assert.equal(opts.workspace,    'all');
    assert.equal(opts.module,       null);
    assert.equal(opts.sprint,       'all');
    assert.equal(opts.dryRun,       false);
    assert.equal(opts.force,        false);
    assert.equal(opts.verbose,      false);
    assert.equal(opts.detect,       false);
    assert.equal(opts.auto,         false);
    assert.equal(opts.help,         false);
    assert.equal(opts.ci,           false);
    assert.equal(opts.json,         false);
    assert.equal(opts.noColor,      false);
    assert.equal(opts.sync,         false);
    assert.equal(opts.init,         false);
    assert.equal(opts.root,         null);
    assert.equal(opts.watch,        false);
    assert.equal(opts.noCache,      false);
  });
});

// ─── Flags booléens existants ─────────────────────────────────────────────────

describe('parseArgs — flags booléens existants', () => {
  test('--dry-run', () => assert.equal(parseArgs(['--dry-run']).dryRun, true));
  test('--force',   () => assert.equal(parseArgs(['--force']).force, true));
  test('--verbose', () => assert.equal(parseArgs(['--verbose']).verbose, true));
  test('--detect',  () => assert.equal(parseArgs(['--detect']).detect, true));
  test('--auto',    () => assert.equal(parseArgs(['--auto']).auto, true));
  test('--help',    () => assert.equal(parseArgs(['--help']).help, true));
  test('-h',        () => assert.equal(parseArgs(['-h']).help, true));
  test('--ci',      () => assert.equal(parseArgs(['--ci']).ci, true));
  test('--json',    () => assert.equal(parseArgs(['--json']).json, true));
  test('--no-color',() => assert.equal(parseArgs(['--no-color']).noColor, true));
  test('--sync',    () => assert.equal(parseArgs(['--sync']).sync, true));
  test('init subcommand', () => assert.equal(parseArgs(['init']).init, true));
});

// ─── Nouveaux flags v0.6.0 ────────────────────────────────────────────────────

describe('parseArgs — nouveaux flags v0.6.0', () => {
  test('--watch active options.watch', () => {
    const opts = parseArgs(['--watch']);
    assert.equal(opts.watch, true);
  });

  test('--no-cache active options.noCache', () => {
    const opts = parseArgs(['--no-cache']);
    assert.equal(opts.noCache, true);
  });

  test('--root=./packages/api set options.root', () => {
    const opts = parseArgs(['--root=./packages/api']);
    assert.equal(opts.root, './packages/api');
  });

  test('--root= vide → options.root === null', () => {
    const opts = parseArgs(['--root=']);
    assert.equal(opts.root, null);
  });

  test('--auto --watch --root=./src combinés', () => {
    const opts = parseArgs(['--auto', '--watch', '--root=./src']);
    assert.equal(opts.auto,  true);
    assert.equal(opts.watch, true);
    assert.equal(opts.root,  './src');
  });

  test('--no-cache --no-color combinés', () => {
    const opts = parseArgs(['--no-cache', '--no-color']);
    assert.equal(opts.noCache,  true);
    assert.equal(opts.noColor,  true);
  });
});

// ─── Flags avec valeur ────────────────────────────────────────────────────────

describe('parseArgs — flags avec valeur', () => {
  test('--workspace=backend', () => {
    assert.equal(parseArgs(['--workspace=backend']).workspace, 'backend');
  });

  test('--workspace=frontend', () => {
    assert.equal(parseArgs(['--workspace=frontend']).workspace, 'frontend');
  });

  test('--workspace=invalid → garde la valeur par défaut "all"', () => {
    assert.equal(parseArgs(['--workspace=invalid']).workspace, 'all');
  });

  test('--module=alerts', () => {
    assert.equal(parseArgs(['--module=alerts']).module, 'alerts');
  });

  test('--sprint=2', () => {
    assert.equal(parseArgs(['--sprint=2']).sprint, '2');
  });
});

// ─── Force override ───────────────────────────────────────────────────────────

describe('parseArgs — --force override skipExisting', () => {
  test('--force met skipExisting à false', () => {
    const opts = parseArgs(['--force']);
    assert.equal(opts.force,        true);
    assert.equal(opts.skipExisting, false);
  });
});

// ─── Flags inconnus ───────────────────────────────────────────────────────────

describe('parseArgs — flags inconnus ignorés silencieusement', () => {
  test('flag booléen inconnu ne throw pas', () => {
    assert.doesNotThrow(() => parseArgs(['--unknownflag']));
  });

  test('flag clé=valeur inconnu ne throw pas', () => {
    assert.doesNotThrow(() => parseArgs(['--unknown=value']));
  });
});
