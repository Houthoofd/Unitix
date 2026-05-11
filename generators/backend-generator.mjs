/**
 * @file backend-generator.mjs
 * @description Génère le contenu d'un fichier de test unitaire pour un use-case backend.
 * Fait le lien entre le parser (use-case-parser, interface-parser) et le template
 * (backend-use-case). Calcule tous les chemins relatifs d'imports.
 *
 * @module generators/backend-generator
 */

import { dirname, basename, join, relative } from 'path';

import { parseUseCase }                      from '../parsers/use-case-parser.mjs';
import { parseInterface, findInterfaceFile } from '../parsers/interface-parser.mjs';
import { renderBackendUseCaseTest }          from '../templates/backend-use-case.mjs';

/** @import { BackendConfig, GeneratedTest } from '../types.mjs' */

// ─── Helper interne ───────────────────────────────────────────────────────────

/**
 * Calcule le chemin relatif depuis le fichier test (fromFile)
 * vers un autre fichier (toFile), sans extension .ts/.tsx.
 *
 * @param {string} fromFile - Chemin absolu du fichier de test
 * @param {string} toFile   - Chemin absolu du fichier cible
 * @returns {string}         - Chemin relatif (ex: '../IAlertRepository')
 */
function computeRelativePath(fromFile, toFile) {
  const fromDir = dirname(fromFile);
  let rel = relative(fromDir, toFile).replace(/\\/g, '/');
  rel = rel.replace(/\.(ts|tsx)$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Génère le contenu d'un test unitaire pour un use-case backend.
 *
 * Étapes :
 *  1. Parse le fichier use-case source (classe, constructeur, execute, imports)
 *  2. Calcule le chemin cible du fichier de test ({dir}/__tests__/{name}.test.ts)
 *  3. Pour chaque paramètre de type repository, recherche et parse l'interface
 *     correspondante afin d'en extraire les méthodes à mocker
 *  4. Construit le contexte complet et appelle le template
 *
 * @param {string}        filePath - Chemin absolu du fichier use-case source (.ts)
 * @param {BackendConfig} config   - Configuration backend
 * @returns {Promise<GeneratedTest|null>} Contenu du test + chemin cible, ou null en cas d'échec
 */
export async function generateBackendTest(filePath, config) {
  // ── Étape 1 — Parser le use-case ──────────────────────────────────────────
  let useCaseInfo;
  try {
    useCaseInfo = await parseUseCase(filePath);
  } catch (err) {
    console.warn(`[backend-generator] Erreur lors du parsing du use-case : ${filePath} — ${err.message}`);
    return null;
  }
  if (!useCaseInfo) return null;

  // ── Étape 2 — Calculer le testFilePath ────────────────────────────────────
  const ext          = config.testFileExtension ?? '.test.ts';
  const testDir      = join(dirname(filePath), '__tests__');
  const testFilePath = join(testDir, basename(filePath, '.ts') + ext);

  // ── Étape 3 — Trouver et parser les interfaces repository ─────────────────
  const repositories = [];

  for (const param of useCaseInfo.constructorParams.filter(p => p.isRepository)) {
    // Recherche du fichier d'interface dans l'arborescence modulesDir
    let interfaceFilePath = null;
    try {
      interfaceFilePath = await findInterfaceFile(param.type, config.modulesDir, filePath);
    } catch (err) {
      console.warn(
        `[backend-generator] Erreur lors de la recherche de l'interface "${param.type}" — ${err.message}`,
      );
    }

    if (interfaceFilePath) {
      // Interface trouvée : parser ses méthodes
      let interfaceInfo = null;
      try {
        interfaceInfo = await parseInterface(interfaceFilePath);
      } catch (err) {
        console.warn(
          `[backend-generator] Erreur lors du parsing de l'interface : ${interfaceFilePath} — ${err.message}`,
        );
      }

      if (interfaceInfo) {
        repositories.push({
          paramName:     param.name,
          interfaceName: interfaceInfo.interfaceName,
          importPath:    computeRelativePath(testFilePath, interfaceFilePath),
          methods:       interfaceInfo.methods,
        });
      } else {
        // Interface trouvée mais non parsable → mock vide avec chemin calculé
        repositories.push({
          paramName:     param.name,
          interfaceName: param.type,
          importPath:    computeRelativePath(testFilePath, interfaceFilePath),
          methods:       [],
        });
      }
    } else {
      // Interface introuvable → fallback avec chemin conventionnel
      repositories.push({
        paramName:     param.name,
        interfaceName: param.type,
        importPath:    '../../../domain/repositories/' + param.type,
        methods:       [],
      });
    }
  }

  // ── Étapes 4-6 — Construire le contexte et appeler le template ────────────

  /** @type {import('../types.mjs').BackendUseCaseTemplateContext} */
  const ctx = {
    className:            useCaseInfo.className,
    module:               useCaseInfo.module,
    sourceImportPath:     computeRelativePath(testFilePath, filePath),
    repositories,
    // Les chemins de services externes sont passés tels quels (ex: '@/shared/services/JwtService.js')
    externalServiceMocks: useCaseInfo.externalServiceImports,
    executeParams:        useCaseInfo.executeParams,
    returnType:           useCaseInfo.returnType,
    isVoid:               useCaseInfo.isVoid,
  };

  let content;
  try {
    content = renderBackendUseCaseTest(ctx);
  } catch (err) {
    console.warn(
      `[backend-generator] Erreur lors du rendu du template pour : ${filePath} — ${err.message}`,
    );
    return null;
  }

  return { content, testFilePath };
}
