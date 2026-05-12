/**
 * @file init.mjs
 * @description Wizard interactif `unitix init` — génère unitix.config.mjs.
 *
 * Flux :
 *  1. Détecter l'architecture du projet (detectArchitecture)
 *  2. Afficher le profil détecté
 *  3. Demander confirmations / overrides de chemins (readline/promises)
 *  4. Écrire unitix.config.mjs dans la racine du projet
 *  5. (Optionnel) Créer renderWithProviders.tsx boilerplate
 *  6. (Optionnel) Créer mocks/server.ts + handlers.ts + setup.ts (MSW)
 *
 * @module core/init
 */

import { createInterface } from "node:readline/promises";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { detectArchitecture } from "../detectors/architecture-detector.mjs";
import { readFileSafe } from "../utils/fs-utils.mjs";

// ─── Color helpers ────────────────────────────────────────────────────────────

/**
 * Retourne un jeu de fonctions de colorisation ANSI.
 * Si `noColor` est vrai, toutes les fonctions sont des identités.
 *
 * @param {boolean} noColor
 * @returns {{ bold: (s:string)=>string, cyan: (s:string)=>string, green: (s:string)=>string, yellow: (s:string)=>string, gray: (s:string)=>string }}
 */
function makeColors(noColor) {
  if (noColor) {
    const id = (/** @type {string} */ s) => s;
    return { bold: id, cyan: id, green: id, yellow: id, gray: id };
  }
  return {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    gray: (s) => `\x1b[2m${s}\x1b[0m`,
  };
}

// ─── Readline helpers ─────────────────────────────────────────────────────────

/**
 * Prompt textuel — si la réponse est vide, retourne `defaultValue`.
 *
 * @param {import('node:readline/promises').Interface} rl
 * @param {string} question
 * @param {string} [defaultValue]
 * @returns {Promise<string>}
 */
async function ask(rl, question, defaultValue = "") {
  const suffix = defaultValue ? ` \x1b[2m[${defaultValue}]\x1b[0m` : "";
  const raw = await rl.question(`  ${question}${suffix}: `);
  return raw.trim() || defaultValue;
}

/**
 * Prompt oui/non.
 *
 * @param {import('node:readline/promises').Interface} rl
 * @param {string} question
 * @param {boolean} [defaultYes=true]
 * @returns {Promise<boolean>}
 */
async function confirm(rl, question, defaultYes = true) {
  const hint = defaultYes ? "\x1b[2m[Y/n]\x1b[0m" : "\x1b[2m[y/N]\x1b[0m";
  const raw = await rl.question(`  ${question} ${hint}: `);
  const answer = raw.trim().toLowerCase();
  if (!answer) return defaultYes;
  return (
    answer === "y" || answer === "yes" || answer === "o" || answer === "oui"
  );
}

/**
 * Prompt choix numéroté dans une liste.
 *
 * @param {import('node:readline/promises').Interface} rl
 * @param {string} question
 * @param {string[]} choices
 * @param {string} [defaultChoice]
 * @returns {Promise<string>}
 */
async function choose(rl, question, choices, defaultChoice) {
  const defaultIdx = defaultChoice ? choices.indexOf(defaultChoice) + 1 : 1;
  const opts = choices.map((c, i) => `${i + 1}) ${c}`).join("   ");
  process.stdout.write(`  ${question}\n  ${opts}\n`);
  const raw = await rl.question(`  Choix \x1b[2m[${defaultIdx}]\x1b[0m: `);
  const n = parseInt(raw.trim(), 10);
  if (n >= 1 && n <= choices.length) return choices[n - 1];
  return defaultChoice ?? choices[0];
}

// ─── Helpers de chemin ────────────────────────────────────────────────────────

/**
 * Retourne un chemin relatif à `root`, préfixé par `./`.
 *
 * @param {string} root
 * @param {string} absPath
 * @returns {string}
 */
function toRelative(root, absPath) {
  const rel = relative(root, absPath).replace(/\\/g, "/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

// ─── Détection react-query ────────────────────────────────────────────────────

/**
 * Vérifie si `@tanstack/react-query` ou `react-query` est déclaré
 * dans le package.json (racine ou sous-packages courants).
 *
 * @param {string} projectRoot
 * @returns {Promise<boolean>}
 */
async function hasReactQuery(projectRoot) {
  const paths = [
    join(projectRoot, "package.json"),
    join(projectRoot, "frontend", "package.json"),
    join(projectRoot, "client", "package.json"),
    join(projectRoot, "web", "package.json"),
  ];
  for (const p of paths) {
    const content = await readFileSafe(p);
    if (!content) continue;
    try {
      const pkg = JSON.parse(content);
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      if ("@tanstack/react-query" in deps || "react-query" in deps) return true;
    } catch {
      // JSON malformé → ignorer
    }
  }
  return false;
}

// ─── Génération du config file ────────────────────────────────────────────────

/**
 * @typedef {Object} WizardAnswers
 * @property {string}           projectRoot
 * @property {boolean}          hasBackend
 * @property {string|null}      modulesDir
 * @property {string}           useCasesGlob
 * @property {'jest'|'vitest'}  backendFramework
 * @property {boolean}          hasFrontend
 * @property {string|null}      featuresDir
 * @property {'jest'|'vitest'}  frontendFramework
 * @property {string|null}      renderWithProvidersPath
 * @property {string[]}         mutationPrefixes
 * @property {'minimal'|'standard'|'exhaustive'} coverageLevel
 * @property {boolean}          createRenderHelper
 * @property {boolean}          setupMsw
 */

/**
 * Génère le contenu textuel de `unitix.config.mjs` à partir des réponses.
 *
 * @param {WizardAnswers} answers
 * @returns {string}
 */
function renderConfigFile(answers) {
  const lines = [
    `// unitix.config.mjs`,
    `// Généré par \`unitix init\` — v0.5.0`,
    `// https://github.com/Houthoofd/Unitix`,
    ``,
    `/** @type {import('@houthoofd/unitix').GeneratorConfig} */`,
    `export const config = {`,
    `  projectRoot: '.',`,
    `  coverageLevel: '${answers.coverageLevel}',`,
  ];

  if (answers.hasBackend && answers.modulesDir) {
    const rel = toRelative(answers.projectRoot, answers.modulesDir);
    lines.push(``);
    lines.push(`  backend: {`);
    lines.push(`    modulesDir:        '${rel}',`);
    lines.push(`    useCasesGlob:      '${answers.useCasesGlob}',`);
    lines.push(`    testFramework:     '${answers.backendFramework}',`);
    lines.push(`    testFileExtension: '.test.ts',`);
    lines.push(`  },`);
  }

  if (answers.hasFrontend && answers.featuresDir) {
    const rel = toRelative(answers.projectRoot, answers.featuresDir);
    lines.push(``);
    lines.push(`  frontend: {`);
    lines.push(`    featuresDir:           '${rel}',`);
    lines.push(`    testFramework:         '${answers.frontendFramework}',`);
    lines.push(`    testFileExtension:     '.test.tsx',`);
    lines.push(`    hookTestFileExtension: '.test.ts',`);
    if (answers.renderWithProvidersPath) {
      lines.push(`    renderHelper: {`);
      lines.push(`      name:       'renderWithProviders',`);
      lines.push(`      importPath: '${answers.renderWithProvidersPath}',`);
      lines.push(`    },`);
    }
    if (answers.mutationPrefixes.length > 0) {
      const list = answers.mutationPrefixes.map((p) => `'${p}'`).join(", ");
      lines.push(`    mutationPrefixes: [${list}],`);
    }
    lines.push(`  },`);
  }

  lines.push(`};`);
  lines.push(``);

  return lines.join("\n");
}

// ─── Boilerplates ─────────────────────────────────────────────────────────────

/**
 * Génère le contenu de `renderWithProviders.tsx`.
 *
 * @param {'jest'|'vitest'} testRunner
 * @returns {string}
 */
function renderWithProvidersBoilerplate(testRunner) {
  const cleanupSetup =
    testRunner === "vitest"
      ? `import { afterEach } from 'vitest'\n\nafterEach(() => cleanup())`
      : `afterEach(() => cleanup())`;

  return `/**
 * renderWithProviders.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Wrapper de rendu pour les tests de composants React.
 * Généré par \`unitix init\` — personnalisez ce fichier selon vos providers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react'
import { render, cleanup, type RenderOptions } from '@testing-library/react'
${cleanupSetup}

// ─── Providers ────────────────────────────────────────────────────────────────

interface WrapperProps {
  children: React.ReactNode
}

/**
 * Wrappeur global — ajoutez ici vos providers applicatifs.
 *
 * Exemples courants :
 *   <QueryClientProvider client={queryClient}>
 *   <ThemeProvider theme={theme}>
 *   <MemoryRouter>
 */
function AllTheProviders({ children }: WrapperProps) {
  return (
    <>
      {/* TODO: ajoutez vos providers ici */}
      {children}
    </>
  )
}

// ─── Export ────────────────────────────────────────────────────────────────────

/**
 * Remplace \`render()\` dans vos tests — wrap automatiquement avec les providers.
 *
 * @example
 *   import { renderWithProviders } from '@/shared/test/renderWithProviders'
 *   const { getByText } = renderWithProviders(<MyComponent />)
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllTheProviders, ...options })
}
`;
}

/**
 * Génère le contenu de `mocks/server.ts`.
 * @returns {string}
 */
function renderMswServer() {
  return `/**
 * mocks/server.ts
 * Serveur MSW pour les tests unitaires — généré par \`unitix init\`.
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
`;
}

/**
 * Génère le contenu de `mocks/handlers.ts`.
 * @returns {string}
 */
function renderMswHandlers() {
  return `/**
 * mocks/handlers.ts
 * Handlers MSW — ajoutez ici vos mocks d'API REST.
 * Généré par \`unitix init\`.
 */

import { http, HttpResponse } from 'msw'

export const handlers = [
  // Exemple :
  // http.get('/api/users', () => HttpResponse.json([])),
  // http.post('/api/users', () => HttpResponse.json({ id: 1 }, { status: 201 })),
]
`;
}

/**
 * Génère le contenu de `setup.ts` (MSW + lifecycle hooks).
 *
 * @param {'jest'|'vitest'} testRunner
 * @returns {string}
 */
function renderMswSetup(testRunner) {
  const imports =
    testRunner === "vitest"
      ? `import { beforeAll, afterAll, afterEach } from 'vitest'`
      : `// Les globals Jest (beforeAll, afterEach, afterAll) sont disponibles sans import`;

  const configNote =
    testRunner === "vitest"
      ? `// Ajoutez dans vitest.config.ts :\n//   setupFiles: ['./src/shared/test/setup.ts']`
      : `// Ajoutez dans jest.config.ts :\n//   setupFilesAfterFramework: ['./src/shared/test/setup.ts']`;

  return `/**
 * setup.ts
 * Fichier de setup ${testRunner === "vitest" ? "Vitest" : "Jest"} — configure MSW avant les tests.
 * Généré par \`unitix init\`.
 *
 ${configNote}
 */

${imports}
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
`;
}

// ─── Wizard principal ─────────────────────────────────────────────────────────

/**
 * Lance le wizard interactif `unitix init`.
 *
 * @param {string} projectRoot - Chemin absolu de la racine du projet
 * @param {{ noColor?: boolean, verbose?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function runInit(projectRoot, options = {}) {
  const { noColor = false, verbose = false } = options;
  const C = makeColors(noColor);

  // ── Vérifier TTY ────────────────────────────────────────────────────────────
  if (!process.stdin.isTTY) {
    console.error(
      "❌  `unitix init` nécessite un terminal interactif (stdin TTY).\n" +
        "    En mode CI, créez unitix.config.mjs manuellement.\n" +
        "    Consultez : https://github.com/Houthoofd/Unitix#configuration",
    );
    process.exit(1);
  }

  // ── Banner ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log(
    `  ${C.bold(C.cyan("Unitix"))} — Wizard de configuration  ${C.gray("v0.5.0")}`,
  );
  console.log(`  ${"─".repeat(50)}`);
  console.log(
    `  Ce wizard génère ${C.cyan("unitix.config.mjs")} dans votre projet.`,
  );
  console.log(`  Répondez aux questions ou appuyez sur Entrée pour accepter`);
  console.log(`  la valeur détectée automatiquement.`);
  console.log("");

  // ── Vérifier si config existe déjà ──────────────────────────────────────────
  const configDest = join(projectRoot, "unitix.config.mjs");
  if (existsSync(configDest)) {
    const rl0 = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const overwrite = await confirm(
      rl0,
      `${C.yellow("⚠")}  unitix.config.mjs existe déjà. Écraser ?`,
      false,
    );
    rl0.close();
    if (!overwrite) {
      console.log(`\n  ${C.gray("Annulé — fichier non modifié.")}\n`);
      return;
    }
    console.log("");
  }

  // ── Étape 1 : détection d'architecture ──────────────────────────────────────
  process.stdout.write(
    `  ${C.gray("⟳")}  Analyse de l'architecture du projet...\r`,
  );

  let profile;
  try {
    profile = await detectArchitecture(projectRoot);
  } catch (err) {
    process.stdout.write(
      "                                                      \r",
    );
    console.error(
      `  ❌  Erreur lors de la détection : ${/** @type {Error} */ (err).message}`,
    );
    if (verbose) console.error(/** @type {Error} */ (err).stack);
    process.exit(1);
  }

  // Effacer la ligne de progression
  process.stdout.write(
    "                                                      \r",
  );

  const fw = profile.frameworks;
  const confLabel =
    {
      high: C.green("haute"),
      medium: C.yellow("moyenne"),
      low: C.yellow("faible"),
    }[profile.confidence] ?? profile.confidence;

  console.log(
    `  ${C.green("✓")}  Architecture : ${C.bold(C.cyan(profile.type))} — confiance ${confLabel}  ${C.gray(`(score: ${profile.score})`)}`,
  );

  const detectedFw = [
    fw.language,
    fw.backend,
    fw.frontend,
    fw.testRunner && `test:${fw.testRunner}`,
    fw.bundler && `bundler:${fw.bundler}`,
    fw.isNextJs && "next.js",
    fw.isMonorepo && "monorepo",
  ]
    .filter(Boolean)
    .join(", ");

  if (detectedFw) {
    console.log(`  ${C.gray("→")}  Stack : ${detectedFw}`);
  }
  console.log("");

  // ── Étape 2 : wizard ─────────────────────────────────────────────────────────
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  /** @type {WizardAnswers} */
  const answers = {
    projectRoot,
    hasBackend: false,
    modulesDir: null,
    useCasesGlob: "application/use-cases",
    backendFramework: /** @type {'jest'|'vitest'} */ (
      fw.testRunner === "jest" || fw.testRunner === "vitest"
        ? fw.testRunner
        : "jest"
    ),
    hasFrontend: false,
    featuresDir: null,
    frontendFramework: /** @type {'jest'|'vitest'} */ (
      fw.testRunner === "vitest" ? "vitest" : (fw.testRunner ?? "vitest")
    ),
    renderWithProvidersPath: null,
    mutationPrefixes: ["useCreate", "useUpdate", "useDelete", "usePatch"],
    coverageLevel: /** @type {'minimal'|'standard'|'exhaustive'} */ (
      "standard"
    ),
    createRenderHelper: false,
    setupMsw: false,
  };

  // ── Backend ──────────────────────────────────────────────────────────────────
  const backendDetected =
    profile.paths.modulesDir != null ||
    profile.paths.backend != null ||
    profile.type === "clean-architecture";

  if (backendDetected) {
    console.log(`  ${C.bold("Backend")}`);
    answers.hasBackend = await confirm(
      rl,
      "Configurer le workspace backend ?",
      true,
    );

    if (answers.hasBackend) {
      const defaultModulesDir = profile.paths.modulesDir
        ? toRelative(projectRoot, profile.paths.modulesDir)
        : profile.paths.backend
          ? toRelative(projectRoot, profile.paths.backend) + "/src/modules"
          : "./backend/src/modules";

      const rawModules = await ask(
        rl,
        "Chemin vers le dossier modules/",
        defaultModulesDir,
      );
      answers.modulesDir = resolve(projectRoot, rawModules);

      const rawUseCases = await ask(
        rl,
        "Sous-chemin use-cases (relatif à chaque module)",
        answers.useCasesGlob,
      );
      answers.useCasesGlob = rawUseCases;

      // Framework de test
      if (fw.testRunner === "jest" || fw.testRunner === "vitest") {
        console.log(`  ${C.gray("→")}  Test runner détecté : ${fw.testRunner}`);
        answers.backendFramework = /** @type {'jest'|'vitest'} */ (
          fw.testRunner
        );
      } else {
        answers.backendFramework = /** @type {'jest'|'vitest'} */ (
          await choose(
            rl,
            "Framework de test pour le backend ?",
            ["jest", "vitest"],
            "jest",
          )
        );
      }
    }
    console.log("");
  }

  // ── Frontend ─────────────────────────────────────────────────────────────────
  const frontendDetected =
    profile.paths.featuresDir != null ||
    profile.paths.frontend != null ||
    fw.frontend != null;

  if (frontendDetected) {
    console.log(`  ${C.bold("Frontend")}`);
    answers.hasFrontend = await confirm(
      rl,
      "Configurer le workspace frontend ?",
      true,
    );

    if (answers.hasFrontend) {
      const defaultFeaturesDir = profile.paths.featuresDir
        ? toRelative(projectRoot, profile.paths.featuresDir)
        : profile.paths.frontend
          ? toRelative(projectRoot, profile.paths.frontend) + "/src/features"
          : "./frontend/src/features";

      const rawFeatures = await ask(
        rl,
        "Chemin vers le dossier features/",
        defaultFeaturesDir,
      );
      answers.featuresDir = resolve(projectRoot, rawFeatures);

      // Framework de test
      if (fw.testRunner === "jest" || fw.testRunner === "vitest") {
        console.log(`  ${C.gray("→")}  Test runner détecté : ${fw.testRunner}`);
        answers.frontendFramework = /** @type {'jest'|'vitest'} */ (
          fw.testRunner
        );
      } else {
        answers.frontendFramework = /** @type {'jest'|'vitest'} */ (
          await choose(
            rl,
            "Framework de test pour le frontend ?",
            ["jest", "vitest"],
            "vitest",
          )
        );
      }

      // renderWithProviders (React uniquement)
      if (fw.frontend === "react" || fw.isNextJs) {
        const useRender = await confirm(
          rl,
          "Utiliser un helper renderWithProviders dans les tests ?",
          true,
        );
        if (useRender) {
          answers.renderWithProvidersPath = await ask(
            rl,
            "Import path du helper",
            "@/shared/test/renderWithProviders",
          );
        }
      }
    }
    console.log("");
  }

  // ── Niveau de couverture ──────────────────────────────────────────────────
  console.log(`  ${C.bold("Niveau de couverture")}`);
  process.stdout.write(
    `  Contrôle la densité des tests générés dans chaque stub.\n`,
  );
  process.stdout.write(
    `  ${C.gray("minimal")}     — 1 it par élément (cas nominal uniquement)\n`,
  );
  process.stdout.write(
    `  ${C.gray("standard")}    — nominal + cas d'erreur détectés ${C.gray("(recommandé)")}\n`,
  );
  process.stdout.write(
    `  ${C.gray("exhaustive")}  — standard + appels repo, a11y, interactions, cache\n`,
  );
  console.log("");
  const rawLevel = await choose(
    rl,
    "Niveau de couverture ?",
    ["minimal", "standard", "exhaustive"],
    "standard",
  );
  answers.coverageLevel = /** @type {'minimal'|'standard'|'exhaustive'} */ (
    rawLevel
  );
  console.log("");

  // ── Récapitulatif ─────────────────────────────────────────────────────────────
  console.log(`  ${C.bold("Récapitulatif")}`);

  if (!answers.hasBackend && !answers.hasFrontend) {
    console.log(
      `  ${C.yellow("⚠")}  Aucun workspace configuré — unitix.config.mjs sera minimal.`,
    );
  }

  if (answers.hasBackend && answers.modulesDir) {
    const rel = toRelative(projectRoot, answers.modulesDir);
    console.log(
      `  ${C.green("→")}  Backend  : ${C.cyan(rel)}  ${C.gray("[" + answers.backendFramework + "]")}`,
    );
    console.log(`              use-cases : ${C.gray(answers.useCasesGlob)}`);
  }

  if (answers.hasFrontend && answers.featuresDir) {
    const rel = toRelative(projectRoot, answers.featuresDir);
    console.log(
      `  ${C.green("→")}  Frontend : ${C.cyan(rel)}  ${C.gray("[" + answers.frontendFramework + "]")}`,
    );
    if (answers.renderWithProvidersPath) {
      console.log(
        `              renderWithProviders : ${C.gray(answers.renderWithProvidersPath)}`,
      );
    }
  }

  console.log(
    `  ${C.green("→")}  Couverture : ${C.cyan(answers.coverageLevel)}`,
  );
  console.log("");

  const doWrite = await confirm(
    rl,
    `Générer ${C.cyan("unitix.config.mjs")} ?`,
    true,
  );

  if (!doWrite) {
    rl.close();
    console.log(`\n  ${C.gray("Annulé.")}\n`);
    return;
  }

  // ── Boilerplates optionnels ───────────────────────────────────────────────────
  if (answers.hasFrontend && (fw.frontend === "react" || fw.isNextJs)) {
    const helperExists = existsSync(
      join(projectRoot, "src", "shared", "test", "renderWithProviders.tsx"),
    );
    answers.createRenderHelper = await confirm(
      rl,
      `Créer le boilerplate ${C.cyan("renderWithProviders.tsx")} dans src/shared/test/ ?`,
      !helperExists,
    );

    if (await hasReactQuery(projectRoot)) {
      answers.setupMsw = await confirm(
        rl,
        `React Query détecté — générer ${C.cyan("mocks/server.ts")} + ${C.cyan("handlers.ts")} (MSW) ?`,
        true,
      );
    }
  }

  rl.close();

  // ── Écriture des fichiers ─────────────────────────────────────────────────────
  console.log("");

  // 1. unitix.config.mjs
  const configContent = renderConfigFile(answers);
  await writeFile(configDest, configContent, "utf8");
  console.log(`  ${C.green("✓")}  ${C.cyan("unitix.config.mjs")} écrit`);

  // 2. renderWithProviders.tsx
  if (answers.createRenderHelper) {
    const helperDir = join(projectRoot, "src", "shared", "test");
    await mkdir(helperDir, { recursive: true });
    await writeFile(
      join(helperDir, "renderWithProviders.tsx"),
      renderWithProvidersBoilerplate(answers.frontendFramework),
      "utf8",
    );
    console.log(
      `  ${C.green("✓")}  ${C.cyan("src/shared/test/renderWithProviders.tsx")} créé`,
    );
  }

  // 3. MSW : server.ts + handlers.ts + setup.ts
  if (answers.setupMsw) {
    const mocksDir = join(projectRoot, "src", "shared", "test", "mocks");
    await mkdir(mocksDir, { recursive: true });

    await writeFile(join(mocksDir, "server.ts"), renderMswServer(), "utf8");
    console.log(
      `  ${C.green("✓")}  ${C.cyan("src/shared/test/mocks/server.ts")} créé`,
    );

    await writeFile(join(mocksDir, "handlers.ts"), renderMswHandlers(), "utf8");
    console.log(
      `  ${C.green("✓")}  ${C.cyan("src/shared/test/mocks/handlers.ts")} créé`,
    );

    const setupDest = join(projectRoot, "src", "shared", "test", "setup.ts");
    if (!existsSync(setupDest)) {
      await writeFile(
        setupDest,
        renderMswSetup(answers.frontendFramework),
        "utf8",
      );
      console.log(
        `  ${C.green("✓")}  ${C.cyan("src/shared/test/setup.ts")} créé`,
      );
    } else {
      console.log(
        `  ${C.gray("–")}  ${C.gray("src/shared/test/setup.ts")} déjà présent — ignoré`,
      );
    }
  }

  // ── Message final ─────────────────────────────────────────────────────────────
  console.log("");
  console.log(`  ${C.bold(C.green("✓  Configuration terminée !"))}`);
  console.log("");
  console.log(`  Prochaines étapes :`);
  console.log(
    `    ${C.cyan("npx unitix --detect")}   — Vérifier la cartographie sources ↔ tests`,
  );
  console.log(
    `    ${C.cyan("npx unitix --auto")}     — Générer tous les stubs manquants`,
  );
  console.log(
    `    ${C.cyan("npx unitix --sync")}     — Resynchroniser les stubs existants`,
  );
  console.log("");
}
