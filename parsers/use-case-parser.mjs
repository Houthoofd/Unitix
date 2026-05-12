/**
 * @file use-case-parser.mjs
 * @description Analyse un fichier use-case TypeScript via AST et extrait les
 * métadonnées nécessaires à la génération des tests (classe, constructeur,
 * méthode execute, imports externes).
 *
 * @module parsers/use-case-parser
 */

import { parse } from "@typescript-eslint/typescript-estree";
import { readFile } from "fs/promises";
import path from "path";

/** @import { UseCaseInfo, ConstructorParam, ExecuteParam } from '../types.mjs' */

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Extrait un nom de type lisible depuis un nœud AST TypeScript.
 * Utilise `code.slice(range)` comme fallback pour les types complexes.
 *
 * @param {Object|null|undefined} typeNode - Nœud AST de type TS
 * @param {string}                code     - Code source brut (pour le fallback)
 * @returns {string}
 */
function extractTypeName(typeNode, code) {
  if (!typeNode) return "unknown";

  switch (typeNode.type) {
    case "TSTypeReference":
      // Gère les types qualifiés (ex: A.B) → on prend juste le dernier segment
      if (typeNode.typeName?.type === "TSQualifiedName") {
        return typeNode.typeName.right?.name ?? "unknown";
      }
      return typeNode.typeName?.name ?? "unknown";

    case "TSNumberKeyword":
      return "number";
    case "TSStringKeyword":
      return "string";
    case "TSBooleanKeyword":
      return "boolean";
    case "TSVoidKeyword":
      return "void";
    case "TSAnyKeyword":
      return "any";
    case "TSUnknownKeyword":
      return "unknown";
    case "TSNullKeyword":
      return "null";
    case "TSUndefinedKeyword":
      return "undefined";
    case "TSNeverKeyword":
      return "never";

    default:
      // Fallback : extraire le texte brut depuis le code source
      if (typeNode.range) {
        return code.slice(typeNode.range[0], typeNode.range[1]);
      }
      return "unknown";
  }
}

/**
 * Extrait le nom du module depuis le chemin de fichier.
 * Gère les patterns NestJS clean-arch, feature-based, MVC et fallback.
 *
 * @param {string} filePath
 * @returns {string} Nom du module (ex: 'alerts') ou 'unknown'
 */
function extractModule(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  // Pattern 1: NestJS clean-architecture
  const cleanMatch = normalized.match(/modules\/([^/]+)\//);
  if (cleanMatch) return cleanMatch[1];
  // Pattern 2: feature-based
  const featureMatch = normalized.match(/features\/([^/]+)\//);
  if (featureMatch) return featureMatch[1];
  // Pattern 3: MVC / flat — prendre le dossier parent direct
  const parts = normalized.split("/");
  const idx = parts.indexOf("application");
  if (idx > 0) return parts[idx - 1];
  // Fallback: dossier parent immédiat du fichier
  return parts[parts.length - 2] ?? "unknown";
}

/**
 * Extrait les paramètres du constructeur d'un use-case.
 * Gère les TSParameterProperty (private/protected/public) et les Identifiers simples.
 *
 * @param {Object|undefined} ctorMethod - Nœud MethodDefinition kind='constructor'
 * @param {string}           code
 * @returns {ConstructorParam[]}
 */
function extractConstructorParams(ctorMethod, code) {
  const params = ctorMethod?.value?.params ?? [];

  return params.map((param) => {
    let name, type, modifier;

    if (param.type === "TSParameterProperty") {
      // Paramètre avec modificateur d'accès (private repo: IAlertRepository)
      modifier = param.accessibility ?? "";
      const inner = param.parameter;
      name = inner?.name ?? "unknown";
      const annotation = inner?.typeAnnotation?.typeAnnotation;
      type = annotation ? extractTypeName(annotation, code) : "unknown";
    } else {
      // Identifier sans modificateur (repo: IAlertRepository)
      modifier = "";
      name = param.name ?? param.left?.name ?? "unknown";
      const annotation = param.typeAnnotation?.typeAnnotation;
      type = annotation ? extractTypeName(annotation, code) : "unknown";
    }

    const isRepository = type.startsWith("I") && type.endsWith("Repository");
    // isService = vrai si ce n'est pas une interface (ex: JwtService, PasswordService)
    const isService = !isRepository && !type.startsWith("I");

    return { name, type, modifier, isRepository, isService };
  });
}

/**
 * Extrait les paramètres de la méthode `execute()` d'un use-case.
 *
 * @param {Object|undefined} executeMethod - Nœud MethodDefinition key.name='execute'
 * @param {string}           code
 * @returns {ExecuteParam[]}
 */
function extractExecuteParams(executeMethod, code) {
  const params = executeMethod?.value?.params ?? [];

  return params.map((param) => {
    let name, optional, typeAnnotation;

    if (param.type === "AssignmentPattern") {
      // Paramètre avec valeur par défaut (ex: onlyActive = false)
      name = param.left?.name ?? "unknown";
      optional = false;
      typeAnnotation = param.left?.typeAnnotation?.typeAnnotation;
    } else if (param.type === "RestElement") {
      // Paramètre rest (ex: ...args)
      name = `...${param.argument?.name ?? "args"}`;
      optional = false;
      typeAnnotation = param.typeAnnotation?.typeAnnotation;
    } else {
      // Identifier classique, potentiellement optionnel (param?: Type)
      name = param.name ?? "unknown";
      optional = param.optional === true;
      typeAnnotation = param.typeAnnotation?.typeAnnotation;
    }

    const type = typeAnnotation
      ? extractTypeName(typeAnnotation, code)
      : "unknown";
    return { name, type, optional };
  });
}

/**
 * Extrait le type de retour de la méthode `execute()`.
 * Dépaquette les Promise<T> pour retourner T directement.
 * Détecte aussi si le type inner est un tableau ou un booléen.
 *
 * @param {Object|undefined} executeMethod
 * @param {string}           code
 * @returns {{ returnType: string, isVoid: boolean, returnsArray: boolean, returnsBool: boolean }}
 */
function extractReturnType(executeMethod, code) {
  const returnAnnotation = executeMethod?.value?.returnType?.typeAnnotation;

  if (!returnAnnotation) {
    return {
      returnType: "void",
      isVoid: true,
      returnsArray: false,
      returnsBool: false,
    };
  }

  // La méthode execute() est async → on s'attend à Promise<X>
  if (returnAnnotation.type === "TSTypeReference") {
    const typeName = returnAnnotation.typeName?.name;

    if (typeName === "Promise") {
      // Support @typescript-eslint/typescript-estree v8 (typeArguments) et v7 (typeParameters)
      const innerParam = (
        returnAnnotation.typeArguments ?? returnAnnotation.typeParameters
      )?.params?.[0];

      if (!innerParam) {
        return {
          returnType: "void",
          isVoid: true,
          returnsArray: false,
          returnsBool: false,
        };
      }

      if (innerParam.type === "TSVoidKeyword") {
        return {
          returnType: "void",
          isVoid: true,
          returnsArray: false,
          returnsBool: false,
        };
      }

      // Détecter les tableaux
      let returnsArray = false;
      if (innerParam.type === "TSArrayType") {
        returnsArray = true;
      } else if (
        innerParam.type === "TSTypeReference" &&
        innerParam.typeName?.name === "Array"
      ) {
        returnsArray = true;
      }

      // Détecter les booléens
      let returnsBool = false;
      if (innerParam.type === "TSBooleanKeyword") {
        returnsBool = true;
      }

      // Extraire le nom du type inner (peut être un array, union, etc.)
      const innerTypeName = extractTypeName(innerParam, code);

      // Fallback texte brut pour les cas non couverts ci-dessus
      if (!returnsArray && innerTypeName.endsWith("[]")) {
        returnsArray = true;
      }
      if (!returnsBool && innerTypeName === "boolean") {
        returnsBool = true;
      }

      return {
        returnType: innerTypeName,
        isVoid: false,
        returnsArray,
        returnsBool,
      };
    }

    // Retour direct non-wrappé dans Promise
    return {
      returnType: typeName ?? "unknown",
      isVoid: false,
      returnsArray: false,
      returnsBool: false,
    };
  }

  // TSVoidKeyword en retour direct (rare)
  if (returnAnnotation.type === "TSVoidKeyword") {
    return {
      returnType: "void",
      isVoid: true,
      returnsArray: false,
      returnsBool: false,
    };
  }

  // Fallback : extraire le texte brut
  if (returnAnnotation.range) {
    const raw = code.slice(
      returnAnnotation.range[0],
      returnAnnotation.range[1],
    );
    return {
      returnType: raw,
      isVoid: raw === "void",
      returnsArray: raw.endsWith("[]"),
      returnsBool: raw === "boolean",
    };
  }

  return {
    returnType: "void",
    isVoid: true,
    returnsArray: false,
    returnsBool: false,
  };
}

/**
 * Parcourt le corps de `execute()` à la recherche de `throw new X()`
 * et retourne les noms des exceptions lancées.
 *
 * @param {Object|undefined} executeMethod - Nœud MethodDefinition key.name='execute'
 * @returns {string[]}
 */
function extractThrownExceptions(executeMethod) {
  const body = executeMethod?.value?.body;
  if (!body) return [];

  const exceptions = new Set();

  function traverse(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "ThrowStatement") {
      const arg = node.argument;
      if (arg?.type === "NewExpression") {
        const name = arg.callee?.name;
        if (name && /Exception|Error$/.test(name)) {
          exceptions.add(name);
        }
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(traverse);
      else if (child && typeof child === "object" && child.type)
        traverse(child);
    }
  }

  traverse(body);
  return [...exceptions];
}

/**
 * Extrait les chemins d'import des services externes à mocker dans les tests.
 *
 * Stratégie :
 * - Ignorer les imports de type (`importKind === 'type'`)
 * - Ignorer les packages npm (chemins sans `/` initial ou sans `@/`)
 * - Garder les imports locaux/aliasés (`@/`, `./`, `../`)
 *   dont au moins un specifier est un service (PascalCase, non-interface, non-repository)
 *
 * @param {Object[]} astBody - Corps du fichier AST
 * @returns {string[]} Chemins d'import dédupliqués
 */
function extractExternalServiceImports(astBody) {
  const result = [];

  for (const node of astBody) {
    if (node.type !== "ImportDeclaration") continue;

    // Ignorer les imports de type purs (import type { ... })
    if (node.importKind === "type") continue;

    const src = node.source?.value ?? "";

    // Garder uniquement les imports internes au projet (alias @/ ou chemins relatifs)
    const isProjectLocal =
      src.startsWith("@/") || src.startsWith("./") || src.startsWith("../");

    if (!isProjectLocal) continue;

    // Vérifier si au moins un specifier ressemble à un service/classe à mocker
    const hasServiceSpecifier = (node.specifiers ?? []).some((spec) => {
      const name = spec.imported?.name ?? spec.local?.name ?? "";
      return (
        name.length > 0 &&
        /^[A-Z]/.test(name) && // PascalCase → classe
        !name.startsWith("I") && // Exclure les interfaces (IAlertRepository)
        !name.endsWith("Repository") // Exclure les repositories
      );
    });

    if (hasServiceSpecifier && !result.includes(src)) {
      result.push(src);
    }
  }

  return result;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Analyse un fichier use-case TypeScript et retourne ses métadonnées structurées.
 *
 * Extrait :
 * - Le nom de la classe (doit se terminer par `UseCase`)
 * - Le module parent (segment entre `modules/` et `/application` dans le chemin)
 * - Les paramètres du constructeur (repositories et services injectés)
 * - Les paramètres de la méthode `execute()`
 * - Le type de retour de `execute()` (dépaquetage des `Promise<T>`)
 * - Les imports de services externes à mocker (ex: `@/shared/services/JwtService.js`)
 *
 * @param {string} filePath - Chemin absolu vers le fichier use-case `.ts`
 * @returns {Promise<UseCaseInfo | null>} Métadonnées ou `null` si fichier invalide
 */
export async function parseUseCase(filePath) {
  // ── Lecture du fichier ─────────────────────────────────────────────────────
  let code;
  try {
    code = await readFile(filePath, "utf-8");
  } catch (err) {
    console.warn(
      `[use-case-parser] Impossible de lire le fichier : ${filePath} — ${err.message}`,
    );
    return null;
  }

  // ── Parsing AST ────────────────────────────────────────────────────────────
  let ast;
  try {
    ast = parse(code, { jsx: false, loc: true, range: true });
  } catch (err) {
    console.warn(
      `[use-case-parser] Erreur de parsing AST : ${filePath} — ${err.message}`,
    );
    return null;
  }

  // ── Recherche de la classe UseCase ────────────────────────────────────────
  let classNode = null;

  for (const node of ast.body) {
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "ClassDeclaration"
    ) {
      const name = node.declaration.id?.name ?? "";
      if (name.endsWith("UseCase")) {
        classNode = node.declaration;
        break;
      }
    }
  }

  if (!classNode) {
    console.warn(
      `[use-case-parser] Aucune classe UseCase exportée trouvée dans : ${filePath}`,
    );
    return null;
  }

  const className = classNode.id.name;
  const module = extractModule(filePath);

  // ── Recherche des méthodes dans le corps de la classe ─────────────────────
  const classBody = classNode.body?.body ?? [];

  const ctorMethod = classBody.find(
    (m) => m.type === "MethodDefinition" && m.kind === "constructor",
  );

  const executeMethod = classBody.find(
    (m) =>
      m.type === "MethodDefinition" &&
      m.key?.type === "Identifier" &&
      m.key?.name === "execute",
  );

  // ── Extraction des données ─────────────────────────────────────────────────
  const constructorParams = extractConstructorParams(ctorMethod, code);
  const executeParams = extractExecuteParams(executeMethod, code);
  const { returnType, isVoid, returnsArray, returnsBool } = extractReturnType(
    executeMethod,
    code,
  );
  const externalServiceImports = extractExternalServiceImports(ast.body);
  const thrownExceptions = extractThrownExceptions(executeMethod);

  return {
    filePath,
    className,
    module,
    constructorParams,
    executeParams,
    returnType,
    isVoid,
    returnsArray,
    returnsBool,
    thrownExceptions,
    externalServiceImports,
  };
}
