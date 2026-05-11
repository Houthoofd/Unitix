/**
 * @file interface-parser.mjs
 * @description Analyse un fichier d'interface repository TypeScript via AST et extrait
 * les signatures de méthodes avec les valeurs mock suggérées pour la génération de tests.
 *
 * @module parsers/interface-parser
 */

import { parse }              from '@typescript-eslint/typescript-estree';
import { readFile, access, readdir } from 'fs/promises';
import path                   from 'path';

/** @import { InterfaceInfo, InterfaceMethod } from '../types.mjs' */

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Vérifie si un nœud de type est TSNullKeyword (dans une union par ex).
 *
 * @param {Object} typeNode
 * @returns {boolean}
 */
function isNullKeyword(typeNode) {
  return typeNode?.type === 'TSNullKeyword';
}

/**
 * Vérifie si un nœud représente un tableau (T[] ou Array<T>).
 *
 * @param {Object} typeNode
 * @returns {boolean}
 */
function isArrayType(typeNode) {
  if (!typeNode) return false;
  if (typeNode.type === 'TSArrayType') return true;
  if (
    typeNode.type === 'TSTypeReference' &&
    typeNode.typeName?.name === 'Array'
  ) return true;
  return false;
}

/**
 * Détermine les flags sémantiques d'un type de retour de méthode de repository.
 * Analyse le type interne d'un `Promise<T>`.
 *
 * @param {Object|null|undefined} returnTypeAnnotation - typeAnnotation du TSMethodSignature
 * @returns {{ isAsync: boolean, returnsVoid: boolean, returnsBool: boolean, returnsArray: boolean, returnsNullable: boolean, mockReturn: string }}
 */
function analyzeReturnType(returnTypeAnnotation) {
  // Toutes les méthodes de repository retournent Promise → isAsync = true par convention
  const defaults = {
    isAsync:         true,
    returnsVoid:     false,
    returnsBool:     false,
    returnsArray:    false,
    returnsNullable: false,
    mockReturn:      '{}',
  };

  if (!returnTypeAnnotation) return defaults;

  // Le type de retour doit être TSTypeReference "Promise<T>"
  const annotation = returnTypeAnnotation.typeAnnotation ?? returnTypeAnnotation;

  if (annotation?.type !== 'TSTypeReference' || annotation.typeName?.name !== 'Promise') {
    return defaults;
  }

  const innerType = annotation.typeParameters?.params?.[0];
  if (!innerType) return defaults;

  // ── void ──────────────────────────────────────────────────────────────────
  if (innerType.type === 'TSVoidKeyword') {
    return { ...defaults, returnsVoid: true, mockReturn: 'undefined' };
  }

  // ── boolean ───────────────────────────────────────────────────────────────
  if (innerType.type === 'TSBooleanKeyword') {
    return { ...defaults, returnsBool: true, mockReturn: 'false' };
  }

  // ── array (T[] ou Array<T>) ───────────────────────────────────────────────
  if (isArrayType(innerType)) {
    return { ...defaults, returnsArray: true, mockReturn: '[]' };
  }

  // ── union type (ex: T | null) ─────────────────────────────────────────────
  if (innerType.type === 'TSUnionType') {
    const hasNull  = innerType.types?.some(isNullKeyword) ?? false;
    const hasArray = innerType.types?.some(isArrayType)   ?? false;
    const hasBool  = innerType.types?.some((t) => t.type === 'TSBooleanKeyword') ?? false;

    if (hasArray) {
      return {
        ...defaults,
        returnsArray:    true,
        returnsNullable: hasNull,
        mockReturn:      hasNull ? 'null' : '[]',
      };
    }

    if (hasBool) {
      return {
        ...defaults,
        returnsBool:     true,
        returnsNullable: hasNull,
        mockReturn:      'false',
      };
    }

    if (hasNull) {
      return { ...defaults, returnsNullable: true, mockReturn: 'null' };
    }
  }

  // ── Objet non-nul par défaut → '{}' ──────────────────────────────────────
  return defaults;
}

/**
 * Extrait toutes les méthodes d'une TSInterfaceDeclaration de repository.
 *
 * @param {Object} ifaceNode - Nœud TSInterfaceDeclaration
 * @returns {InterfaceMethod[]}
 */
function extractInterfaceMethods(ifaceNode) {
  const members = ifaceNode?.body?.body ?? [];
  const methods = [];

  for (const member of members) {
    // On ne traite que les signatures de méthodes
    if (member.type !== 'TSMethodSignature') continue;

    const name = member.key?.name ?? member.key?.value ?? 'unknown';

    const {
      isAsync,
      returnsVoid,
      returnsBool,
      returnsArray,
      returnsNullable,
      mockReturn,
    } = analyzeReturnType(member.returnType);

    methods.push({
      name,
      mockReturn,
      isAsync,
      returnsVoid,
      returnsBool,
      returnsArray,
      returnsNullable,
    });
  }

  return methods;
}

/**
 * Cherche un nœud TSInterfaceDeclaration dont le nom commence par 'I'
 * et se termine par 'Repository' dans une liste de nœuds AST.
 *
 * @param {Object[]} astBody
 * @returns {Object|null} Nœud TSInterfaceDeclaration ou null
 */
function findRepositoryInterfaceNode(astBody) {
  for (const node of astBody) {
    // Cas 1 : interface directement dans le body (non exportée)
    if (node.type === 'TSInterfaceDeclaration') {
      const name = node.id?.name ?? '';
      if (name.startsWith('I') && name.endsWith('Repository')) {
        return node;
      }
    }

    // Cas 2 : export interface IXxxRepository { ... }
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration?.type === 'TSInterfaceDeclaration'
    ) {
      const name = node.declaration.id?.name ?? '';
      if (name.startsWith('I') && name.endsWith('Repository')) {
        return node.declaration;
      }
    }
  }

  return null;
}

// ─── Exports principaux ───────────────────────────────────────────────────────

/**
 * Analyse un fichier d'interface repository TypeScript et retourne ses méthodes.
 *
 * Le fichier doit contenir une interface dont le nom commence par `I`
 * et se termine par `Repository` (ex: `IAlertRepository`).
 *
 * Pour chaque méthode `TSMethodSignature`, extrait :
 * - `name`            : nom de la méthode
 * - `isAsync`         : toujours `true` (toutes les méthodes retournent Promise)
 * - `returnsVoid`     : `Promise<void>`
 * - `returnsBool`     : `Promise<boolean>`
 * - `returnsArray`    : `Promise<T[]>` ou `Promise<Array<T>>`
 * - `returnsNullable` : `Promise<T | null>`
 * - `mockReturn`      : valeur suggérée pour `mockResolvedValue()`
 *
 * @param {string} filePath - Chemin absolu vers le fichier interface `.ts`
 * @returns {Promise<InterfaceInfo | null>} Métadonnées ou `null` si fichier invalide
 */
export async function parseInterface(filePath) {
  // ── Lecture du fichier ─────────────────────────────────────────────────────
  let code;
  try {
    code = await readFile(filePath, 'utf-8');
  } catch (err) {
    console.warn(`[interface-parser] Impossible de lire le fichier : ${filePath} — ${err.message}`);
    return null;
  }

  // ── Parsing AST ────────────────────────────────────────────────────────────
  let ast;
  try {
    ast = parse(code, { jsx: false, loc: true, range: true });
  } catch (err) {
    console.warn(`[interface-parser] Erreur de parsing AST : ${filePath} — ${err.message}`);
    return null;
  }

  // ── Recherche de l'interface repository ───────────────────────────────────
  const ifaceNode = findRepositoryInterfaceNode(ast.body);

  if (!ifaceNode) {
    console.warn(`[interface-parser] Aucune interface IXxxRepository trouvée dans : ${filePath}`);
    return null;
  }

  const interfaceName = ifaceNode.id?.name ?? path.basename(filePath, '.ts');
  const methods       = extractInterfaceMethods(ifaceNode);

  return {
    filePath,
    interfaceName,
    methods,
  };
}

/**
 * Recherche le fichier d'interface d'un repository dans l'arborescence des modules.
 *
 * Stratégie de recherche :
 * 1. Extraire le module depuis `useCaseFilePath` (segment après `modules/`)
 * 2. Chercher dans `{modulesDir}/{module}/domain/repositories/{interfaceName}.ts`
 * 3. Si non trouvé, parcourir tous les sous-dossiers de `modulesDir`
 *    et chercher `{modulesDir}/<module>/domain/repositories/{interfaceName}.ts`
 *
 * @param {string} interfaceName   - Nom de l'interface (ex: `IAlertRepository`)
 * @param {string} modulesDir      - Chemin absolu vers le dossier `modules/`
 * @param {string} useCaseFilePath - Chemin du fichier use-case (pour inférer le module)
 * @returns {Promise<string | null>} Chemin absolu du fichier ou `null` si introuvable
 */
export async function findInterfaceFile(interfaceName, modulesDir, useCaseFilePath) {
  const fileName = `${interfaceName}.ts`;

  /**
   * Vérifie si un fichier existe sans lever d'exception.
   *
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async function fileExists(filePath) {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ── Étape 1 : essai dans le module du use-case ────────────────────────────
  const normalized   = useCaseFilePath.replace(/\\/g, '/');
  const moduleMatch  = normalized.match(/modules\/([^/]+)\//);

  if (moduleMatch) {
    const moduleName = moduleMatch[1];
    const candidate  = path.join(modulesDir, moduleName, 'domain', 'repositories', fileName);

    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  // ── Étape 2 : recherche dans tous les modules ─────────────────────────────
  let entries;
  try {
    entries = await readdir(modulesDir, { withFileTypes: true });
  } catch (err) {
    console.warn(`[interface-parser] Impossible de lire le dossier modules : ${modulesDir} — ${err.message}`);
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const candidate = path.join(modulesDir, entry.name, 'domain', 'repositories', fileName);

    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  console.warn(`[interface-parser] Interface "${interfaceName}" introuvable dans ${modulesDir}`);
  return null;
}
