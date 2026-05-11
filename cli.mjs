/**
 * @file cli.mjs
 * @description Parse process.argv et retourne un objet Options typé.
 * Fait partie du générateur de tests @clubmanager/test-generator.
 */

/**
 * @typedef {Object} Options
 * @property {'backend'|'frontend'|'all'} workspace  - Workspace cible (défaut: 'all')
 * @property {string|null}                module      - Nom du module ciblé (ex: 'alerts')
 * @property {string|'all'}               sprint      - Numéro de sprint ou 'all' (défaut: 'all')
 * @property {boolean}                    dryRun      - Simulation sans écriture fichier
 * @property {boolean}                    force       - Écrase les fichiers existants
 * @property {boolean}                    skipExisting - Ignore les fichiers déjà présents
 * @property {boolean}                    verbose     - Active les logs de debug
 * @property {boolean}                    help        - Affiche l'aide et quitte
 */

/** @type {Options} */
const DEFAULTS = {
  workspace: 'all',
  module: null,
  sprint: 'all',
  dryRun: false,
  force: false,
  skipExisting: true,
  verbose: false,
  help: false,
};

/**
 * Parse un tableau d'arguments CLI (format process.argv.slice(2)) et retourne
 * un objet Options avec les valeurs par défaut appliquées.
 *
 * Flags supportés :
 *   --workspace=backend|frontend|all   (défaut: 'all')
 *   --module=<nom>                     (optionnel)
 *   --sprint=1|2|all                   (défaut: 'all')
 *   --dry-run                          (boolean)
 *   --force                            (boolean)
 *   --verbose                          (boolean)
 *   --help                             (boolean)
 *
 * @param {string[]} argv - Tableau d'arguments, typiquement process.argv.slice(2)
 * @returns {Options}
 */
export function parseArgs(argv) {
  /** @type {Options} */
  const options = { ...DEFAULTS };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--force') {
      options.force = true;
      continue;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    // Flags avec valeur : --key=value
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex === -1) {
        // Flag booléen inconnu → ignorer silencieusement
        continue;
      }

      const key = arg.slice(2, eqIndex);
      const value = arg.slice(eqIndex + 1);

      switch (key) {
        case 'workspace':
          if (['backend', 'frontend', 'all'].includes(value)) {
            options.workspace = /** @type {'backend'|'frontend'|'all'} */ (value);
          }
          break;

        case 'module':
          options.module = value || null;
          break;

        case 'sprint':
          options.sprint = value;
          break;

        default:
          // Option inconnue → ignorer silencieusement
          break;
      }
    }
  }

  // --force override skipExisting : si on force, on n'ignore plus les fichiers existants
  if (options.force) {
    options.skipExisting = false;
  }

  return options;
}

/**
 * Affiche l'aide dans le terminal (stdout).
 * Décrit tous les flags disponibles avec leur valeur par défaut.
 *
 * @returns {void}
 */
export function printHelp() {
  const lines = [
    '',
    '  \x1b[1m\x1b[34m@clubmanager/test-generator\x1b[0m — Générateur de fichiers de tests',
    '',
    '  \x1b[1mUsage :\x1b[0m',
    '    node scripts/generate-tests.mjs [options]',
    '',
    '  \x1b[1mOptions :\x1b[0m',
    '    --workspace=<backend|frontend|all>   Workspace cible          \x1b[2m(défaut: all)\x1b[0m',
    '    --module=<nom>                       Module ciblé             \x1b[2m(ex: alerts)\x1b[0m',
    '    --sprint=<1|2|all>                   Sprint ciblé             \x1b[2m(défaut: all)\x1b[0m',
    '    --dry-run                            Simulation, sans écriture',
    '    --force                              Écrase les fichiers existants',
    '    --verbose                            Logs détaillés',
    '    --help, -h                           Affiche cette aide',
    '',
    '  \x1b[1mExemples :\x1b[0m',
    '    node scripts/generate-tests.mjs --workspace=backend --sprint=1',
    '    node scripts/generate-tests.mjs --module=alerts --dry-run',
    '    node scripts/generate-tests.mjs --force --verbose',
    '',
  ];

  console.log(lines.join('\n'));
}
