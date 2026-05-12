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
 * @property {boolean}                    detect      - Analyse et affiche l'architecture uniquement
 * @property {boolean}                    auto        - Détecte l'architecture et génère les tests
 * @property {boolean}                    help        - Affiche l'aide et quitte
 * @property {boolean}                    ci          - Mode CI : exit code 1 si des stubs manquent
 * @property {boolean}                    json        - Sortie JSON machine-readable (stdout propre)
 * @property {boolean}                    noColor     - Désactiver les codes ANSI
 * @property {boolean}                    sync        - Resynchroniser les stubs désynchronisés (source modifiée depuis génération)
 * @property {boolean}                    init        - Lancer le wizard de configuration interactif
 * @property {string|null}                root        - Répertoire racine du projet (défaut: CWD)
 * @property {boolean}                    watch       - Surveiller les sources et régénérer à la volée
 * @property {boolean}                    noCache     - Désactiver le cache AST (.unitix-cache.json)
 */

/** @type {Options} */
const DEFAULTS = {
  workspace: "all",
  module: null,
  sprint: "all",
  dryRun: false,
  force: false,
  skipExisting: true,
  verbose: false,
  detect: false,
  auto: false,
  help: false,
  ci: false,
  json: false,
  noColor: false,
  sync: false,
  init: false,
  root: null,
  watch: false,
  noCache: false,
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

  // Sous-commande positionnelle : `unitix init`
  if (argv[0] === "init") {
    options.init = true;
    return options;
  }

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    if (arg === "--detect") {
      options.detect = true;
      continue;
    }

    if (arg === "--auto") {
      options.auto = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--ci") {
      options.ci = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--no-color") {
      options.noColor = true;
      continue;
    }

    if (arg === "--sync") {
      options.sync = true;
      continue;
    }

    if (arg === "--watch") {
      options.watch = true;
      continue;
    }

    if (arg === "--no-cache") {
      options.noCache = true;
      continue;
    }

    if (arg === "init") {
      options.init = true;
      continue;
    }

    // Flags avec valeur : --key=value
    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=");
      if (eqIndex === -1) {
        // Flag booléen inconnu → ignorer silencieusement
        continue;
      }

      const key = arg.slice(2, eqIndex);
      const value = arg.slice(eqIndex + 1);

      switch (key) {
        case "workspace":
          if (["backend", "frontend", "all"].includes(value)) {
            options.workspace = /** @type {'backend'|'frontend'|'all'} */ (
              value
            );
          }
          break;

        case "module":
          options.module = value || null;
          break;

        case "sprint":
          options.sprint = value;
          break;

        case "root":
          options.root = value || null;
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
    "",
    "  \x1b[1m\x1b[34mUnitix\x1b[0m — Générateur de fichiers de tests adaptatif",
    "",
    "  \x1b[1mUsage :\x1b[0m",
    "    npx unitix [commande] [options]",
    "",
    "  \x1b[1mCommandes :\x1b[0m",
    "    init                                 Wizard interactif — génère unitix.config.mjs",
    "    --detect                             Analyse l'architecture du projet     \x1b[2m(aucune génération)\x1b[0m",
    "    --auto                               Détecte + génère automatiquement",
    "    --sync                               Resynchroniser les stubs désynchronisés (source modifiée)",
    "",
    "  \x1b[1mOptions :\x1b[0m",
    "    --workspace=<backend|frontend|all>   Workspace cible                      \x1b[2m(défaut: all)\x1b[0m",
    "    --module=<nom>                       Module ciblé                         \x1b[2m(ex: alerts)\x1b[0m",
    "    --sprint=<1|2|all>                   Sprint ciblé                         \x1b[2m(défaut: all)\x1b[0m",
    "    --dry-run                            Simulation, sans écriture",
    "    --force                              Écrase les fichiers existants",
    "    --verbose                            Logs détaillés",
    "    --ci                                 Mode CI : exit 1 si des stubs manquent",
    "    --json                               Sortie JSON sur stdout (logs sur stderr)",
    "    --no-color                           Désactiver la colorisation ANSI",
    "    --root=<chemin>                      Racine du projet (défaut: CWD)",
    "    --watch                              Surveiller les sources, régénérer à chaque changement",
    "    --no-cache                           Désactiver le cache AST (.unitix-cache.json)",
    "    --help, -h                           Affiche cette aide",
    "",
    "  \x1b[1mExemples :\x1b[0m",
    "    npx unitix init                                       # wizard de configuration",
    "    npx unitix --detect                                   # détecter l'architecture",
    "    npx unitix --auto                                     # détecter + générer",
    "    npx unitix --auto --workspace=backend --dry-run       # prévisualiser backend uniquement",
    "    npx unitix --auto --watch                             # surveiller et régénérer en continu",
    "    npx unitix --auto --root=./packages/api               # analyser un sous-dossier",
    "    npx unitix --workspace=backend --sprint=1             # avec config manuelle",
    "    npx unitix --module=alerts --dry-run                  # cibler un module",
    "",
  ];

  console.log(lines.join("\n"));
}
