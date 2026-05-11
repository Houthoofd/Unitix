/**
 * @file engine.mjs
 * @description Orchestrateur principal du générateur de tests.
 *
 * Reçoit une GeneratorConfig complète, orchestre les scanners, generators
 * et fs-utils pour produire les fichiers de tests, et retourne un résumé.
 *
 * C'est le seul fichier du core qui connaît tous les autres modules.
 * Les consommateurs externes n'interagissent qu'avec index.mjs (API publique).
 *
 * @module core/engine
 */

import { dirname } from 'path';

import { scanBackendUseCases }  from './scanners/backend-scanner.mjs';
import { scanFrontendFiles }    from './scanners/frontend-scanner.mjs';
import { generateBackendTest }  from './generators/backend-generator.mjs';
import { generateFrontendTest } from './generators/frontend-generator.mjs';
import { ensureDir, writeFileSafe, fileExists } from './fs-utils.mjs';
import { logger } from './logger.mjs';

/** @import { GeneratorConfig, GenerationResult, GenerationSummary } from './types.mjs' */

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Détermine si le workspace backend doit être traité.
 *
 * @param {GeneratorConfig} config
 * @returns {boolean}
 */
function shouldRunBackend(config) {
  const ws = config.workspace ?? 'all';
  return !!config.backend && (ws === 'all' || ws === 'backend');
}

/**
 * Détermine si le workspace frontend doit être traité.
 *
 * @param {GeneratorConfig} config
 * @returns {boolean}
 */
function shouldRunFrontend(config) {
  const ws = config.workspace ?? 'all';
  return !!config.frontend && (ws === 'all' || ws === 'frontend');
}

/**
 * Construit le résumé agrégé à partir de la liste des résultats.
 *
 * @param {GenerationResult[]} results
 * @returns {GenerationSummary}
 */
function buildSummary(results) {
  return {
    results,
    created: results.filter(r => r.status === 'created').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors:  results.filter(r => r.status === 'error').length,
    dryRun:  results.filter(r => r.status === 'dry-run').length,
    total:   results.length,
  };
}

/**
 * Traite un fichier généré : vérifie les conditions d'écriture, écrit (ou simule),
 * logue le résultat et retourne le GenerationResult.
 *
 * @param {{ content: string, testFilePath: string }} generated
 * @param {string}           sourceFilePath
 * @param {GeneratorConfig}  config
 * @returns {Promise<GenerationResult>}
 */
async function processGenerated(generated, sourceFilePath, config) {
  const { content, testFilePath } = generated;

  // ── Dry-run : ne rien écrire ───────────────────────────────────────────────
  if (config.dryRun) {
    const result = { status: 'dry-run', testFilePath, sourceFilePath };
    logger.file(testFilePath, 'dry-run');
    return result;
  }

  // ── Skip si le fichier existe déjà et force=false ──────────────────────────
  const skipExisting = config.force ? false : (config.skipExisting ?? true);
  if (skipExisting && await fileExists(testFilePath)) {
    const result = { status: 'skipped', testFilePath, sourceFilePath, reason: 'already exists' };
    logger.file(testFilePath, 'skipped', 'already exists');
    return result;
  }

  // ── Écriture ───────────────────────────────────────────────────────────────
  await ensureDir(dirname(testFilePath));
  const { written, reason } = await writeFileSafe(testFilePath, content, config.force ?? false);

  if (written) {
    const result = { status: 'created', testFilePath, sourceFilePath };
    logger.file(testFilePath, 'created');
    return result;
  }

  // writeFileSafe a refusé (ne devrait pas arriver ici, mais par sécurité)
  const result = { status: 'skipped', testFilePath, sourceFilePath, reason };
  logger.file(testFilePath, 'skipped', reason);
  return result;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Point d'entrée principal du générateur.
 *
 * Exécute les étapes suivantes pour chaque workspace activé :
 *  1. Scanner les fichiers sources (use-cases / composants / hooks)
 *  2. Pour chaque fichier, appeler le generator approprié
 *  3. Écrire (ou simuler) le fichier de test résultant
 *  4. Collecter les résultats et retourner un résumé
 *
 * @param {GeneratorConfig} config - Configuration complète (fusionnée avec les options CLI)
 * @returns {Promise<GenerationSummary>}
 */
export async function generateTests(config) {
  /** @type {GenerationResult[]} */
  const results = [];

  // ════════════════════════════════════════════════════════════════════════════
  // BACKEND — Sprint 1 : Use-Cases
  // ════════════════════════════════════════════════════════════════════════════
  if (shouldRunBackend(config)) {
    logger.section('Backend — Use-Cases (Sprint 1)');

    let useCaseFiles;
    try {
      useCaseFiles = await scanBackendUseCases(config.backend, config);
    } catch (err) {
      logger.error(`Erreur lors du scan backend : ${err.message}`);
      useCaseFiles = [];
    }

    logger.info(`${useCaseFiles.length} use-case(s) trouvé(s)`);

    for (const file of useCaseFiles) {
      logger.debug(`Traitement : ${file.filePath}`, config.verbose);

      try {
        const generated = await generateBackendTest(file.filePath, config.backend);

        if (!generated) {
          results.push({
            status: 'error',
            testFilePath: file.testFilePath,
            sourceFilePath: file.filePath,
            reason: 'parsing failed',
          });
          logger.file(file.testFilePath, 'error', 'parsing failed');
          continue;
        }

        const result = await processGenerated(generated, file.filePath, config);
        results.push(result);

      } catch (err) {
        logger.error(`${file.filePath} — ${err.message}`);
        results.push({
          status: 'error',
          testFilePath: file.testFilePath,
          sourceFilePath: file.filePath,
          reason: err.message,
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FRONTEND — Sprint 2 : Composants + Hooks
  // ════════════════════════════════════════════════════════════════════════════
  if (shouldRunFrontend(config)) {
    logger.section('Frontend — Composants & Hooks (Sprint 2)');

    let frontendFiles;
    try {
      frontendFiles = await scanFrontendFiles(config.frontend, config);
    } catch (err) {
      logger.error(`Erreur lors du scan frontend : ${err.message}`);
      frontendFiles = [];
    }

    const components = frontendFiles.filter(f => f.type === 'component');
    const hooks      = frontendFiles.filter(f => f.type === 'hook');
    logger.info(`${components.length} composant(s) + ${hooks.length} hook(s) trouvés`);

    for (const file of frontendFiles) {
      logger.debug(`Traitement : ${file.filePath}`, config.verbose);

      try {
        const generated = await generateFrontendTest(file.filePath, file.type, config.frontend);

        if (!generated) {
          results.push({
            status: 'error',
            testFilePath: file.testFilePath,
            sourceFilePath: file.filePath,
            reason: 'parsing failed',
          });
          logger.file(file.testFilePath, 'error', 'parsing failed');
          continue;
        }

        const result = await processGenerated(generated, file.filePath, config);
        results.push(result);

      } catch (err) {
        logger.error(`${file.filePath} — ${err.message}`);
        results.push({
          status: 'error',
          testFilePath: file.testFilePath,
          sourceFilePath: file.filePath,
          reason: err.message,
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ════════════════════════════════════════════════════════════════════════════
  const summary = buildSummary(results);
  logger.summary(summary);

  return summary;
}
