#!/usr/bin/env node
/**
 * bin/unitix.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * CLI binary de Unitix.
 *
 * Cherche la config dans cet ordre :
 *   1. --config=./chemin/vers/config.mjs
 *   2. unitix.config.mjs dans le CWD
 *   3. generate-tests.config.mjs dans le CWD
 *
 * Usage :
 *   npx unitix [options]
 *   npx unitix --help
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { parseArgs, printHelp } from '../cli.mjs';
import { generateTests }        from '../engine.mjs';
import { resolve }              from 'path';

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

// ─── Résolution de la config ──────────────────────────────────────────────────

// Support du flag --config=./path/to/config.mjs
const configFlagArg = process.argv.find(a => a.startsWith('--config='));
const configFlagPath = configFlagArg ? resolve(process.cwd(), configFlagArg.slice(9)) : null;

const candidatePaths = [
  configFlagPath,
  resolve(process.cwd(), 'unitix.config.mjs'),
  resolve(process.cwd(), 'generate-tests.config.mjs'),
].filter(Boolean);

let baseConfig = { projectRoot: process.cwd() };

for (const configPath of candidatePaths) {
  try {
    const mod = await import(configPath);
    baseConfig = mod.config ?? mod.default ?? baseConfig;
    if (options.verbose) {
      console.log(`[unitix] Config chargée depuis : ${configPath}`);
    }
    break;
  } catch {
    // Pas de config à cet emplacement → on essaie le suivant
  }
}

// ─── Fusion config + options CLI ──────────────────────────────────────────────

const config = {
  ...baseConfig,
  workspace:    options.workspace,
  module:       options.module,
  sprint:       options.sprint,
  dryRun:       options.dryRun,
  force:        options.force,
  skipExisting: options.skipExisting,
  verbose:      options.verbose,
};

// ─── Exécution ────────────────────────────────────────────────────────────────

try {
  await generateTests(config);
} catch (err) {
  console.error('\n❌ Fatal error:', err.message);
  if (options.verbose) console.error(err.stack);
  process.exit(1);
}
