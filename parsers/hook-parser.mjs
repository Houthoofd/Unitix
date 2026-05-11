/**
 * @file hook-parser.mjs
 * @description Analyse un fichier de hooks React (TS) via AST et extrait les
 * métadonnées nécessaires à la génération des tests (noms des hooks, query keys,
 * feature parente, utilisation de React Query).
 *
 * @module parsers/hook-parser
 */

import { parse }    from '@typescript-eslint/typescript-estree';
import { readFile } from 'fs/promises';
import path         from 'path';

/** @import { HookInfo } from '../types.mjs' */

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Extrait le nom de la feature depuis le chemin de fichier.
 *
 * - `frontend/src/features/alerts/hooks/useAlerts.ts` → `'alerts'`
 * - `frontend/src/shared/hooks/useXxx.ts`             → `'shared'`
 *
 * @param {string} filePath
 * @returns {string}
 */
function extractFeature(filePath) {
  const normalized = filePath.replace(/\\/g, '/');

  const featuresMatch = normalized.match(/features\/([^/]+)\//);
  if (featuresMatch) return featuresMatch[1];

  if (normalized.includes('/shared/')) return 'shared';

  return 'unknown';
}

/**
 * Détermine si un nom est un hook React (commence par `use`).
 *
 * @param {string} name
 * @returns {boolean}
 */
function isHookName(name) {
  return typeof name === 'string' && name.startsWith('use') && name.length > 3;
}

/**
 * Extrait le nom d'un export nommé depuis un nœud ExportNamedDeclaration.
 * Retourne le nom et une indication si c'est un hook ou un autre export.
 *
 * Gère les patterns :
 * - `export function useFoo() { ... }`
 * - `export const useFoo = () => { ... }`
 * - `export const queryKeys = { ... }`
 *
 * @param {Object} node - Nœud ExportNamedDeclaration
 * @returns {{ hooks: string[], keys: string[] }}
 */
function extractNamesFromExportNode(node) {
  const hooks = [];
  const keys  = [];

  if (!node.declaration) {
    // Re-exports : export { useFoo } from '...'
    for (const spec of node.specifiers ?? []) {
      const name = spec.exported?.name ?? '';
      if (isHookName(name)) hooks.push(name);
    }
    return { hooks, keys };
  }

  // export function useFoo() { ... }
  if (node.declaration.type === 'FunctionDeclaration') {
    const name = node.declaration.id?.name ?? '';
    if (name) {
      if (isHookName(name)) {
        hooks.push(name);
      }
      // Une FunctionDeclaration exportée qui ne commence pas par 'use' n'est pas
      // une query key (c'est un utilitaire/helper) → on l'ignore.
    }
    return { hooks, keys };
  }

  // export const useFoo = () => ...  /  export const alertKeys = { ... }
  if (node.declaration.type === 'VariableDeclaration') {
    for (const decl of node.declaration.declarations ?? []) {
      const name = decl.id?.name ?? '';
      if (!name) continue;

      if (isHookName(name)) {
        // Vérifier que l'init est bien une fonction
        if (
          decl.init?.type === 'ArrowFunctionExpression' ||
          decl.init?.type === 'FunctionExpression'
        ) {
          hooks.push(name);
        }
      } else {
        // Variable exportée non-hook → potentiellement une query key (alertKeys, courseKeys, etc.)
        keys.push(name);
      }
    }
  }

  return { hooks, keys };
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Analyse un fichier de hooks React TypeScript et retourne ses métadonnées structurées.
 *
 * Extrait :
 * - `hookNames`      : noms de tous les hooks exportés (fonctions commençant par `use`)
 * - `feature`        : feature parente (`'alerts'`, `'shared'`, etc.)
 * - `usesQuery`      : le fichier contient `useQuery`
 * - `usesMutation`   : le fichier contient `useMutation`
 * - `queryKeyNames`  : noms des exports de query keys (ex: `alertKeys`, `courseKeys`)
 *
 * @param {string} filePath - Chemin absolu vers le fichier hook `.ts`
 * @returns {Promise<HookInfo | null>} Métadonnées ou `null` si le fichier ne contient aucun hook
 */
export async function parseHook(filePath) {
  // ── Lecture du fichier ─────────────────────────────────────────────────────
  let code;
  try {
    code = await readFile(filePath, 'utf-8');
  } catch (err) {
    console.warn(`[hook-parser] Impossible de lire le fichier : ${filePath} — ${err.message}`);
    return null;
  }

  // ── Parsing AST ────────────────────────────────────────────────────────────
  let ast;
  try {
    ast = parse(code, { jsx: false, loc: true, range: true });
  } catch (err) {
    console.warn(`[hook-parser] Erreur de parsing AST : ${filePath} — ${err.message}`);
    return null;
  }

  // ── Collecte des hooks exportés et des query keys ─────────────────────────
  const hookNames     = [];
  const queryKeyNames = [];

  for (const node of ast.body) {
    if (node.type !== 'ExportNamedDeclaration') continue;

    const { hooks, keys } = extractNamesFromExportNode(node);

    for (const h of hooks) {
      if (!hookNames.includes(h)) hookNames.push(h);
    }

    for (const k of keys) {
      if (!queryKeyNames.includes(k)) queryKeyNames.push(k);
    }
  }

  // ── Validation : au moins un hook trouvé ──────────────────────────────────
  if (hookNames.length === 0) {
    console.warn(`[hook-parser] Aucun hook exporté trouvé dans : ${filePath}`);
    return null;
  }

  // ── Extraction des métadonnées ─────────────────────────────────────────────
  const feature      = extractFeature(filePath);
  const usesQuery    = code.includes('useQuery');
  const usesMutation = code.includes('useMutation');

  return {
    filePath,
    hookNames,
    feature,
    usesQuery,
    usesMutation,
    queryKeyNames,
  };
}
