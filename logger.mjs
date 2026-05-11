/**
 * @file logger.mjs
 * @description Logger avec output coloré ANSI. Zéro dépendances externes.
 * Fait partie du générateur de tests @clubmanager/test-generator.
 */

// ─── Codes ANSI ──────────────────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

const FG_RED     = '\x1b[31m';
const FG_GREEN   = '\x1b[32m';
const FG_YELLOW  = '\x1b[33m';
const FG_BLUE    = '\x1b[34m';
const FG_CYAN    = '\x1b[36m';
const FG_GRAY    = '\x1b[90m';

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Applique un ou plusieurs codes ANSI autour d'un message, puis reset.
 *
 * @param {string}   msg   - Texte à colorier
 * @param {...string} codes - Codes ANSI à préfixer
 * @returns {string}
 */
function colorize(msg, ...codes) {
  return `${codes.join('')}${msg}${RESET}`;
}

/**
 * Retourne une ligne de séparation composée du caractère donné.
 *
 * @param {number} [length=45] - Longueur de la ligne
 * @param {string} [char='─']  - Caractère utilisé
 * @returns {string}
 */
function separator(length = 45, char = '─') {
  return char.repeat(length);
}

// ─── Statuts fichier ──────────────────────────────────────────────────────────

/** @type {Record<string, { icon: string, label: string, color: string }>} */
const FILE_STATUS = {
  created: { icon: '✅', label: 'CRÉÉ   ', color: FG_GREEN  },
  skipped: { icon: '⏭ ', label: 'IGNORÉ ', color: FG_YELLOW },
  'dry-run':{ icon: '🔍', label: 'DRY-RUN', color: FG_CYAN  },
  error:   { icon: '❌', label: 'ERREUR ', color: FG_RED    },
};

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} GenerationSummary
 * @property {Array}  results  - Liste des résultats individuels
 * @property {number} created  - Nombre de fichiers créés
 * @property {number} skipped  - Nombre de fichiers ignorés
 * @property {number} errors   - Nombre d'erreurs
 * @property {number} dryRun   - Nombre de fichiers en mode dry-run
 * @property {number} total    - Total des fichiers traités
 */

export const logger = {
  /**
   * Affiche un message informatif (cyan).
   *
   * @param {string} msg
   * @returns {void}
   */
  info(msg) {
    console.log(`${colorize('ℹ ', FG_CYAN)}  ${msg}`);
  },

  /**
   * Affiche un message de succès (vert).
   *
   * @param {string} msg
   * @returns {void}
   */
  success(msg) {
    console.log(`✅ ${colorize(msg, FG_GREEN)}`);
  },

  /**
   * Affiche un avertissement (jaune).
   *
   * @param {string} msg
   * @returns {void}
   */
  warn(msg) {
    console.warn(`${colorize('⚠ ', FG_YELLOW)}  ${colorize(msg, FG_YELLOW)}`);
  },

  /**
   * Affiche une erreur (rouge).
   *
   * @param {string} msg
   * @returns {void}
   */
  error(msg) {
    console.error(`❌ ${colorize(msg, FG_RED)}`);
  },

  /**
   * Affiche un message de debug (gris) — uniquement si verbose est actif.
   *
   * @param {string}  msg     - Message à afficher
   * @param {boolean} verbose - N'affiche le message que si true
   * @returns {void}
   */
  debug(msg, verbose) {
    if (!verbose) return;
    console.log(`${colorize('🔍', FG_GRAY)} ${colorize(msg, FG_GRAY, DIM)}`);
  },

  /**
   * Affiche un titre de section encadré de séparateurs (bleu gras).
   *
   * @param {string} title - Titre de la section
   * @returns {void}
   */
  section(title) {
    const sep = separator(45);
    const titleUpper = title.toUpperCase();
    console.log('');
    console.log(colorize(sep, FG_BLUE, BOLD));
    console.log(colorize(`  ${titleUpper}`, FG_BLUE, BOLD));
    console.log(colorize(sep, FG_BLUE, BOLD));
  },

  /**
   * Affiche le résultat de traitement d'un fichier avec son statut coloré.
   *
   * Statuts disponibles :
   *   - 'created'  → ✅ CRÉÉ    path/to/file.test.ts
   *   - 'skipped'  → ⏭  IGNORÉ  path/to/file.test.ts  (déjà existant)
   *   - 'dry-run'  → 🔍 DRY-RUN path/to/file.test.ts
   *   - 'error'    → ❌ ERREUR  path/to/file.test.ts  (message)
   *
   * @param {string} filePath - Chemin du fichier concerné
   * @param {'created'|'skipped'|'dry-run'|'error'} status - Statut du fichier
   * @param {string} [reason] - Raison complémentaire (affiché entre parenthèses)
   * @returns {void}
   */
  file(filePath, status, reason) {
    const def = FILE_STATUS[status] ?? FILE_STATUS.error;
    const icon  = def.icon;
    const label = colorize(def.label, def.color, BOLD);
    const path  = colorize(filePath, DIM);
    const tail  = reason ? colorize(`  (${reason})`, FG_GRAY, DIM) : '';

    console.log(`  ${icon} ${label}  ${path}${tail}`);
  },

  /**
   * Affiche le résumé final de génération dans un bloc formaté.
   *
   * @param {GenerationSummary} generationSummary
   * @returns {void}
   */
  summary(generationSummary) {
    const { created = 0, skipped = 0, errors = 0, dryRun = 0, total = 0 } = generationSummary;
    const sep      = separator(45);
    const shortSep = separator(13);

    console.log('');
    console.log(colorize(sep, FG_BLUE, BOLD));
    console.log(colorize('📊 Résumé de génération', BOLD));
    console.log(colorize(sep, FG_BLUE, BOLD));
    console.log(`  ${colorize('✅ Créés   ', FG_GREEN,  BOLD)} : ${colorize(String(created), FG_GREEN)}`);
    console.log(`  ${colorize('⏭  Ignorés ', FG_YELLOW, BOLD)} : ${colorize(String(skipped), FG_YELLOW)}`);
    console.log(`  ${colorize('🔍 Dry-run ', FG_CYAN,   BOLD)} : ${colorize(String(dryRun),  FG_CYAN)}`);
    console.log(`  ${colorize('❌ Erreurs ', FG_RED,    BOLD)} : ${colorize(String(errors),  FG_RED)}`);
    console.log(`  ${colorize(shortSep, FG_GRAY, DIM)}`);
    console.log(`  ${colorize('📁 Total   ', BOLD)} : ${colorize(String(total), BOLD)}`);
    console.log(colorize(sep, FG_BLUE, BOLD));
    console.log('');
  },
};
