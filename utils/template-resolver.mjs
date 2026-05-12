/**
 * @file template-resolver.mjs
 * @description Résolution et chargement des templates utilisateur.
 * Permet de surcharger les templates internes d'Unitix par des templates projet
 * placés dans {projectRoot}/unitix/templates/{templateName}.mjs.
 *
 * Convention d'export attendue dans un template utilisateur :
 *   export function render(ctx) { return '...'; }
 *
 * Fait partie du générateur de tests @houthoofd/unitix.
 * Aucune dépendance externe — ES Module pur.
 *
 * @module utils/template-resolver
 */

import { access }      from 'node:fs/promises';
import { join }        from 'node:path';
import { pathToFileURL } from 'node:url';

// ─── Cache mémoire ────────────────────────────────────────────────────────────

/**
 * Cache des templates chargés (ou de leur absence).
 * Clé   : `${projectRoot}::${templateName}`
 * Valeur: fonction render(ctx) si chargée, null si absente/invalide
 *
 * @type {Map<string, ((ctx: any) => string)|null>}
 */
const templateCache = new Map();

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Noms de templates reconnus par Unitix */
export const TEMPLATE_NAMES = [
  'backend-use-case',
  'frontend-component',
  'frontend-hook',
  'generic-unit',
];

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Cherche et charge un template utilisateur depuis
 * {projectRoot}/unitix/templates/{templateName}.mjs.
 *
 * Si le fichier existe et exporte une fonction `render(ctx)`, retourne cette
 * fonction. Sinon retourne null (le générateur utilisera son template interne).
 * Le résultat est mis en cache en mémoire (cacheKey = projectRoot + '::' + templateName).
 *
 * @param {string} templateName  - ex: 'backend-use-case', 'frontend-component',
 *                                     'frontend-hook', 'generic-unit'
 * @param {string} projectRoot   - chemin absolu racine du projet consommateur
 * @returns {Promise<((ctx: any) => string)|null>}
 */
export async function loadUserTemplate(templateName, projectRoot) {
  const cacheKey = `${projectRoot}::${templateName}`;

  // 1. Vérifier le cache mémoire — valeur peut être null (absence confirmée)
  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey);
  }

  // 2. Construire le chemin vers le template utilisateur
  const templatePath = join(projectRoot, 'unitix', 'templates', templateName + '.mjs');

  // 3. Vérifier l'existence du fichier (ENOENT → cache null + return null)
  try {
    await access(templatePath);
  } catch {
    templateCache.set(cacheKey, null);
    return null;
  }

  // 4. Charger dynamiquement via pathToFileURL pour compatibilité Windows
  try {
    const mod = await import(pathToFileURL(templatePath).href);

    // 5. Vérifier que le module exporte bien une fonction `render`
    if (typeof mod.render === 'function') {
      templateCache.set(cacheKey, mod.render);
      return mod.render;
    }

    // 6. Export `render` absent ou non-fonction → avertissement + cache null
    console.warn(
      `[Unitix] template-resolver: Le fichier "${templatePath}" n'exporte pas` +
      ` de fonction \`render(ctx)\`. Template interne utilisé.`
    );
    templateCache.set(cacheKey, null);
    return null;

  } catch (err) {
    // 7. Erreur d'import inattendue (parse error, mauvais module, etc.)
    console.warn(
      `[Unitix] template-resolver: Impossible de charger le template` +
      ` "${templatePath}" : ${err.message}. Template interne utilisé.`
    );
    templateCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Vérifie si un fichier de template utilisateur existe (sans le charger).
 *
 * @param {string} templateName
 * @param {string} projectRoot
 * @returns {Promise<boolean>}
 */
export async function hasUserTemplate(templateName, projectRoot) {
  const templatePath = join(projectRoot, 'unitix', 'templates', templateName + '.mjs');
  try {
    await access(templatePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Vide le cache mémoire des templates chargés (utile pour les tests).
 */
export function clearTemplateCache() {
  templateCache.clear();
}
