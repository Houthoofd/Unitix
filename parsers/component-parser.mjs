/**
 * @file component-parser.mjs
 * @description Analyse un fichier de composant React (TSX) via AST et extrait les
 * métadonnées nécessaires à la génération des tests (nom, feature, props, hooks utilisés).
 *
 * @module parsers/component-parser
 */

import { parse }    from '@typescript-eslint/typescript-estree';
import { readFile } from 'fs/promises';
import path         from 'path';

/** @import { ComponentInfo } from '../types.mjs' */

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Extrait le nom de la feature depuis le chemin de fichier.
 *
 * - `frontend/src/features/alerts/components/Foo.tsx` → `'alerts'`
 * - `frontend/src/shared/components/Foo.tsx`          → `'shared'`
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
 * Extrait les noms des champs d'une interface ou d'un type Props depuis l'AST.
 *
 * @param {Object[]} astBody - Corps du fichier AST
 * @returns {string[]} Noms des propriétés
 */
function extractPropsFields(astBody) {
  for (const node of astBody) {
    let membersBody = null;

    // Cas 1 : interface XxxProps { ... }  (exportée ou non)
    if (node.type === 'TSInterfaceDeclaration') {
      const name = node.id?.name ?? '';
      if (name.includes('Props')) {
        membersBody = node.body?.body ?? [];
      }
    }

    // Cas 2 : export interface XxxProps { ... }
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration?.type === 'TSInterfaceDeclaration'
    ) {
      const name = node.declaration.id?.name ?? '';
      if (name.includes('Props')) {
        membersBody = node.declaration.body?.body ?? [];
      }
    }

    // Cas 3 : type XxxProps = { ... }
    if (node.type === 'TSTypeAliasDeclaration') {
      const name = node.id?.name ?? '';
      if (name.includes('Props') && node.typeAnnotation?.type === 'TSTypeLiteral') {
        membersBody = node.typeAnnotation.members ?? [];
      }
    }

    // Cas 4 : export type XxxProps = { ... }
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration?.type === 'TSTypeAliasDeclaration'
    ) {
      const name = node.declaration.id?.name ?? '';
      if (
        name.includes('Props') &&
        node.declaration.typeAnnotation?.type === 'TSTypeLiteral'
      ) {
        membersBody = node.declaration.typeAnnotation.members ?? [];
      }
    }

    if (membersBody) {
      return membersBody
        .filter((m) => m.type === 'TSPropertySignature')
        .map((m) => m.key?.name ?? m.key?.value ?? '')
        .filter(Boolean);
    }
  }

  return [];
}

/**
 * Tente de trouver le nom d'un composant exporté par défaut via un Identifier.
 * Ex: `export default LoginPage;` → cherche la FunctionDeclaration 'LoginPage' dans le body.
 *
 * @param {string}   identifierName - Nom de l'identifier référencé dans `export default`
 * @param {Object[]} astBody        - Corps du fichier AST
 * @returns {string|null}
 */
function resolveDefaultExportIdentifier(identifierName, astBody) {
  if (!identifierName) return null;

  for (const node of astBody) {
    // function ComponentName() { ... }
    if (
      node.type === 'FunctionDeclaration' &&
      node.id?.name === identifierName &&
      /^[A-Z]/.test(identifierName)
    ) {
      return identifierName;
    }

    // const ComponentName = () => { ... }  ou  const ComponentName = function() { ... }
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations ?? []) {
        if (
          decl.id?.name === identifierName &&
          /^[A-Z]/.test(identifierName) &&
          (
            decl.init?.type === 'ArrowFunctionExpression' ||
            decl.init?.type === 'FunctionExpression'
          )
        ) {
          return identifierName;
        }
      }
    }
  }

  return null;
}

/**
 * Recherche et retourne le nom du composant exporté depuis le fichier.
 * Gère les patterns suivants :
 *
 * 1. `export function ComponentName(...) { ... }`
 * 2. `export default function ComponentName() { ... }`
 * 3. `export const ComponentName = (...) => { ... }`
 * 4. `export default ComponentName;`  (référence à une function déclarée plus haut)
 * 5. `export default () => { ... }`   (arrow function anonyme)
 *
 * @param {Object[]} astBody        - Corps du fichier AST
 * @param {string}   fileBaseName   - Nom de base du fichier (fallback)
 * @returns {string|null} Nom du composant ou null si introuvable
 */
function findComponentName(astBody, fileBaseName) {
  for (const node of astBody) {
    // ── Export nommé ──────────────────────────────────────────────────────
    if (node.type === 'ExportNamedDeclaration') {
      // export function ComponentName(...)
      if (node.declaration?.type === 'FunctionDeclaration') {
        const name = node.declaration.id?.name ?? '';
        if (/^[A-Z]/.test(name)) return name;
      }

      // export const ComponentName = (...) => ...
      if (node.declaration?.type === 'VariableDeclaration') {
        for (const decl of node.declaration.declarations ?? []) {
          const name = decl.id?.name ?? '';
          if (
            /^[A-Z]/.test(name) &&
            (
              decl.init?.type === 'ArrowFunctionExpression' ||
              decl.init?.type === 'FunctionExpression'
            )
          ) {
            return name;
          }
        }
      }
    }

    // ── Export par défaut ──────────────────────────────────────────────────
    if (node.type === 'ExportDefaultDeclaration') {
      // export default function ComponentName() { ... }
      if (node.declaration?.type === 'FunctionDeclaration') {
        const name = node.declaration.id?.name ?? '';
        // La fonction peut être anonyme → utiliser le nom du fichier comme fallback
        return name || fileBaseName;
      }

      // export default () => { ... }
      if (node.declaration?.type === 'ArrowFunctionExpression') {
        return fileBaseName;
      }

      // export default ComponentName;  (Identifier référençant une déclaration plus haut)
      if (node.declaration?.type === 'Identifier') {
        const refName = node.declaration.name ?? '';
        if (/^[A-Z]/.test(refName)) {
          // On confirme qu'il existe bien une déclaration avec ce nom
          return resolveDefaultExportIdentifier(refName, astBody) ?? refName;
        }
      }
    }
  }

  return null;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Analyse un fichier de composant React TSX et retourne ses métadonnées structurées.
 *
 * Extrait :
 * - `componentName`   : nom de la fonction composant exportée
 * - `feature`         : feature parente (`'alerts'`, `'shared'`, etc.)
 * - `propsFields`     : noms des props depuis l'interface/type `XxxProps`
 * - `usesTranslation` : utilise `useTranslation` (react-i18next)
 * - `usesRouter`      : utilise `useNavigate`, `useParams` ou `useLocation`
 * - `usesQuery`       : utilise `useQuery` ou `useMutation` (React Query)
 *
 * @param {string} filePath - Chemin absolu vers le fichier composant `.tsx`
 * @returns {Promise<ComponentInfo | null>} Métadonnées ou `null` si fichier invalide
 */
export async function parseComponent(filePath) {
  // ── Lecture du fichier ─────────────────────────────────────────────────────
  let code;
  try {
    code = await readFile(filePath, 'utf-8');
  } catch (err) {
    console.warn(`[component-parser] Impossible de lire le fichier : ${filePath} — ${err.message}`);
    return null;
  }

  // ── Parsing AST (JSX activé) ───────────────────────────────────────────────
  let ast;
  try {
    ast = parse(code, { jsx: true, loc: true, range: true });
  } catch (err) {
    console.warn(`[component-parser] Erreur de parsing AST : ${filePath} — ${err.message}`);
    return null;
  }

  // ── Nom du fichier sans extension (fallback si pas de nom de fonction) ─────
  const fileBaseName = path.basename(filePath, path.extname(filePath));

  // ── Recherche du composant exporté ────────────────────────────────────────
  const componentName = findComponentName(ast.body, fileBaseName);

  if (!componentName) {
    console.warn(`[component-parser] Aucun composant exporté trouvé dans : ${filePath}`);
    return null;
  }

  // ── Extraction des métadonnées ─────────────────────────────────────────────
  const feature     = extractFeature(filePath);
  const propsFields = extractPropsFields(ast.body);

  // Détection des hooks utilisés via analyse du texte brut (plus simple et robuste)
  const usesTranslation = code.includes('useTranslation');
  const usesRouter      = (
    code.includes('useNavigate') ||
    code.includes('useParams')   ||
    code.includes('useLocation')
  );
  const usesQuery       = (
    code.includes('useQuery')    ||
    code.includes('useMutation')
  );

  return {
    filePath,
    componentName,
    feature,
    propsFields,
    usesTranslation,
    usesRouter,
    usesQuery,
  };
}
