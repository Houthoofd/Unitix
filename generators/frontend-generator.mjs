/**
 * @file frontend-generator.mjs
 * @description Génère le contenu d'un fichier de test pour un composant React ou un hook.
 * Fait le lien entre les parsers (component-parser, hook-parser) et les templates
 * (frontend-component, frontend-hook). Calcule tous les chemins relatifs d'imports.
 *
 * @module generators/frontend-generator
 */

import { dirname, basename, join, relative } from 'path';

import { parseComponent } from '../parsers/component-parser.mjs';
import { parseHook }      from '../parsers/hook-parser.mjs';
import { renderFrontendComponentTest } from '../templates/frontend-component.mjs';
import { renderFrontendHookTest }      from '../templates/frontend-hook.mjs';

/** @import { FrontendConfig, GeneratedTest } from '../types.mjs' */

// ─── Helper interne ───────────────────────────────────────────────────────────

/**
 * Calcule le chemin relatif depuis le fichier test (fromFile)
 * vers un autre fichier (toFile), sans extension .ts/.tsx.
 *
 * @param {string} fromFile - Chemin absolu du fichier de test
 * @param {string} toFile   - Chemin absolu du fichier cible
 * @returns {string}         - Chemin relatif (ex: '../AlertTypeBadge')
 */
function computeRelativePath(fromFile, toFile) {
  const fromDir = dirname(fromFile);
  let rel = relative(fromDir, toFile).replace(/\\/g, '/');
  rel = rel.replace(/\.(ts|tsx)$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

/**
 * Déduit un chemin d'import MSW handler relatif depuis le dossier __tests__
 * d'une feature vers le dossier shared/test/mocks/handlers/.
 *
 * Ex: depuis  .../features/alerts/hooks/__tests__/
 *     vers    .../shared/test/mocks/handlers/alertsHandlers
 *     résultat: '../../../shared/test/mocks/handlers/alertsHandlers'
 *
 * @param {string} testFilePath - Chemin absolu du fichier de test (cible)
 * @param {string} feature      - Nom de la feature (ex: 'alerts')
 * @param {string} featuresDir  - Chemin absolu de frontend/src/features
 * @returns {string|null}
 */
function buildMswHandlerPath(testFilePath, feature, featuresDir) {
  try {
    const testDir     = dirname(testFilePath);
    // shared/ est au même niveau que features/
    const sharedDir   = join(dirname(featuresDir), 'shared');
    const handlerFile = join(sharedDir, 'test', 'mocks', 'handlers', `${feature}Handlers`);
    let rel = relative(testDir, handlerFile).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
  } catch {
    return null;
  }
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Génère le contenu d'un test pour un composant React ou un hook frontend.
 *
 * Dispatche vers la bonne stratégie selon `type` :
 *  - 'component' → parseComponent  + renderFrontendComponentTest
 *  - 'hook'      → parseHook       + renderFrontendHookTest
 *
 * @param {string}               filePath - Chemin absolu du fichier source
 * @param {'component'|'hook'}   type     - Type de fichier à tester
 * @param {FrontendConfig}       config   - Configuration frontend
 * @returns {Promise<GeneratedTest|null>} Contenu du test + chemin cible, ou null en cas d'échec
 */
export async function generateFrontendTest(filePath, type, config) {
  return type === 'component'
    ? generateComponentTest(filePath, config)
    : generateHookTest(filePath, config);
}

// ─── Stratégie composant ──────────────────────────────────────────────────────

/**
 * @param {string}        filePath
 * @param {FrontendConfig} config
 * @returns {Promise<GeneratedTest|null>}
 */
async function generateComponentTest(filePath, config) {
  // Étape 1 — Parser le composant
  let componentInfo;
  try {
    componentInfo = await parseComponent(filePath);
  } catch (err) {
    console.warn(`[frontend-generator] Erreur parsing composant : ${filePath} — ${err.message}`);
    return null;
  }
  if (!componentInfo) return null;

  // Étape 2 — Chemins
  const ext          = config.testFileExtension ?? '.test.tsx';
  const testDir      = join(dirname(filePath), '__tests__');
  const testFilePath = join(testDir, basename(filePath, '.tsx') + ext);
  const importPath   = computeRelativePath(testFilePath, filePath);

  // Étape 3 — Contexte template
  /** @type {import('../types.mjs').FrontendComponentTemplateContext} */
  const ctx = {
    componentName:   componentInfo.componentName,
    feature:         componentInfo.feature,
    importPath,
    propsFields:     componentInfo.propsFields,
    usesTranslation: componentInfo.usesTranslation,
    usesRouter:      componentInfo.usesRouter,
    usesQuery:       componentInfo.usesQuery,
    testFramework:   config.testFramework ?? 'vitest',
    renderHelper:    config.renderHelper ?? null,
  };

  // Étape 4 — Rendu
  let content;
  try {
    content = renderFrontendComponentTest(ctx);
  } catch (err) {
    console.warn(`[frontend-generator] Erreur rendu template composant : ${filePath} — ${err.message}`);
    return null;
  }

  return { content, testFilePath };
}

// ─── Stratégie hook ───────────────────────────────────────────────────────────

/**
 * @param {string}        filePath
 * @param {FrontendConfig} config
 * @returns {Promise<GeneratedTest|null>}
 */
async function generateHookTest(filePath, config) {
  // Étape 1 — Parser le hook
  let hookInfo;
  try {
    hookInfo = await parseHook(filePath);
  } catch (err) {
    console.warn(`[frontend-generator] Erreur parsing hook : ${filePath} — ${err.message}`);
    return null;
  }
  if (!hookInfo) return null;

  // Étape 2 — Chemins
  const ext          = config.hookTestFileExtension ?? '.test.ts';
  const testDir      = join(dirname(filePath), '__tests__');
  const testFilePath = join(testDir, basename(filePath, '.ts') + ext);
  const importPath   = computeRelativePath(testFilePath, filePath);

  // Étape 3 — Chemin MSW handlers (calculé uniquement si le hook utilise React Query)
  const mswHandlerImportPath =
    (hookInfo.usesQuery || hookInfo.usesMutation) && config.featuresDir
      ? buildMswHandlerPath(testFilePath, hookInfo.feature, config.featuresDir)
      : null;

  // Étape 4 — Contexte template
  /** @type {import('../types.mjs').FrontendHookTemplateContext} */
  const ctx = {
    hookNames:            hookInfo.hookNames,
    feature:              hookInfo.feature,
    importPath,
    usesQuery:            hookInfo.usesQuery,
    usesMutation:         hookInfo.usesMutation,
    queryKeyNames:        hookInfo.queryKeyNames,
    testFramework:        config.testFramework ?? 'vitest',
    mswHandlerImportPath,
  };

  // Étape 5 — Rendu
  let content;
  try {
    content = renderFrontendHookTest(ctx);
  } catch (err) {
    console.warn(`[frontend-generator] Erreur rendu template hook : ${filePath} — ${err.message}`);
    return null;
  }

  return { content, testFilePath };
}
