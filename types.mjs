/**
 * types.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Définitions de types JSDoc pour @houthoofd/unitix
 *
 * Ce fichier constitue l'API publique du futur package npm.
 * Tous les modules du core importent uniquement ces types — jamais les
 * implémentations des autres modules (sauf via les generators/engine).
 *
 * Convention de nommage :
 *   - *Config  → configuration injectée par le projet consommateur
 *   - *Info    → résultat d'un parser (données extraites d'un fichier source)
 *   - *Context → données passées à un template (fn(ctx) → string)
 *   - *Result  → résultat d'une opération d'écriture de fichier
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Niveaux de couverture ─────────────────────────────────────────────────────

/**
 * Niveau de couverture des tests générés.
 *
 * - `minimal`     — Cas nominal uniquement (1 `it` par élément)
 * - `standard`    — Cas nominal + cas d'erreur détectés (comportement par défaut)
 * - `exhaustive`  — Standard + vérification des appels repo, cas limites,
 *                   accessibilité a11y, interactions, invalidation de cache
 *
 * @typedef {'minimal'|'standard'|'exhaustive'} CoverageLevel
 */

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Configuration pour le workspace backend
 *
 * @typedef {Object} BackendConfig
 * @property {string}              modulesDir         - Chemin absolu vers backend/src/modules
 * @property {string}             [useCasesGlob]      - Sous-chemin relatif use-cases   (défaut: 'application/use-cases')
 * @property {string}             [repositoriesDir]   - Sous-chemin relatif repositories (défaut: 'domain/repositories')
 * @property {'jest'|'vitest'}    [testFramework]     - Framework de test (défaut: 'jest')
 * @property {string}             [testFileExtension] - Extension test (défaut: '.test.ts')
 * @property {Record<string,string>} [importAliases]  - Alias d'imports (ex: {'@/': '/abs/src/'})
 * @property {CoverageLevel}         [coverageLevel]  - Niveau de couverture (défaut: 'standard')
 */

/**
 * Configuration pour le workspace frontend
 *
 * @typedef {Object} FrontendConfig
 * @property {string}          featuresDir            - Chemin absolu vers frontend/src/features
 * @property {string}         [sharedComponentsDir]   - Chemin vers les composants partagés
 * @property {string}         [hooksPattern]          - Nom du dossier hooks      (défaut: 'hooks')
 * @property {string}         [componentsPattern]     - Nom du dossier components (défaut: 'components')
 * @property {'jest'|'vitest'} [testFramework]        - Framework de test (défaut: 'vitest')
 * @property {string}         [testFileExtension]     - Extension composant (défaut: '.test.tsx')
 * @property {string}         [hookTestFileExtension] - Extension hook      (défaut: '.test.ts')
 * @property {{ name: string, importPath: string }} [renderHelper] - Wrapper de rendu custom
 * @property {string}         [setupFile]             - Chemin du fichier de setup Vitest
 * @property {string[]}        [mutationPrefixes]      - Préfixes de hooks de mutation (ex: ['useCreate', 'useDelete'])
 * @property {CoverageLevel}   [coverageLevel]         - Niveau de couverture (défaut: 'standard')
 */

/**
 * Configuration principale du générateur.
 * C'est l'objet reçu par `generateTests(config)` — la seule API publique.
 *
 * @typedef {Object} GeneratorConfig
 * @property {string}                     projectRoot   - Chemin absolu de la racine du projet
 * @property {BackendConfig}             [backend]      - Config backend  (omis = backend ignoré)
 * @property {FrontendConfig}            [frontend]     - Config frontend (omis = frontend ignoré)
 * @property {'backend'|'frontend'|'all'} [workspace]  - Workspace cible   (défaut: 'all')
 * @property {'1'|'2'|'all'}             [sprint]      - Sprint à générer  (défaut: 'all')
 * @property {string}                    [module]       - Filtre sur un module spécifique
 * @property {boolean}                   [skipExisting] - Ignorer les tests existants (défaut: true)
 * @property {boolean}                   [dryRun]       - Prévisualiser sans écrire  (défaut: false)
 * @property {boolean}                   [force]        - Écraser les fichiers       (défaut: false)
 * @property {boolean}                   [verbose]      - Détails de parsing         (défaut: false)
 * @property {CoverageLevel}             [coverageLevel] - Niveau de couverture global (défaut: 'standard')
 * @property {boolean}                   [sync]         - Resynchroniser les stubs désynchronisés (défaut: false)
 * @property {boolean}                   [noCache]      - Désactiver le cache AST (défaut: false)
 * @property {boolean}                   [watch]        - Mode watch (géré dans bin/unitix)
 * @property {string}                    [root]         - Racine projet CLI (géré dans bin/unitix)
 */

// ─── Parsers — données extraites ──────────────────────────────────────────────

/**
 * Paramètre du constructeur d'un use-case (injecté via DI)
 *
 * @typedef {Object} ConstructorParam
 * @property {string}                           name          - Nom du param  (ex: 'repo')
 * @property {string}                           type          - Type TS        (ex: 'IAlertRepository')
 * @property {'private'|'protected'|'public'|''} modifier     - Modificateur d'accès
 * @property {boolean}                          isRepository  - true si type commence par 'I' + finit par 'Repository'
 * @property {boolean}                          isService     - true si c'est un service (ex: JwtService)
 */

/**
 * Paramètre de la méthode execute() d'un use-case
 *
 * @typedef {Object} ExecuteParam
 * @property {string}  name     - Nom du paramètre
 * @property {string}  type     - Type TypeScript brut (ex: 'number', 'CreateAlertTypeDto')
 * @property {boolean} optional - true si paramètre optionnel (?)
 */

/**
 * Résultat du parsing d'un fichier use-case
 *
 * @typedef {Object} UseCaseInfo
 * @property {string}             filePath               - Chemin absolu vers le fichier source
 * @property {string}             className              - Nom de la classe (ex: 'CreateAlertTypeUseCase')
 * @property {string}             module                 - Module parent    (ex: 'alerts')
 * @property {ConstructorParam[]} constructorParams      - Paramètres injectés dans le constructeur
 * @property {ExecuteParam[]}     executeParams          - Paramètres de execute()
 * @property {string}             returnType             - Type de retour (ex: 'AlertTypeDto', 'void')
 * @property {boolean}            isVoid                 - true si execute retourne Promise<void>
 * @property {boolean}            returnsArray           - true si execute retourne un tableau (ex: Promise<AlertTypeDto[]>)
 * @property {boolean}            returnsBool            - true si execute retourne un booléen (ex: Promise<boolean>)
 * @property {string[]}           thrownExceptions       - Noms des exceptions lancées dans execute() (ex: ['NotFoundException', 'ForbiddenException'])
 * @property {string[]}           externalServiceImports - Chemins d'import des services externes
 *                                                         à mocker (ex: '@/shared/services/JwtService.js')
 */

/**
 * Méthode d'une interface repository
 *
 * @typedef {Object} InterfaceMethod
 * @property {string}  name       - Nom de la méthode
 * @property {string}  mockReturn - Valeur par défaut pour mockResolvedValue (ex: 'undefined', 'null', '[]')
 * @property {boolean} isAsync    - true si la méthode retourne Promise<>
 * @property {boolean} returnsVoid - true si retourne Promise<void>
 * @property {boolean} returnsBool - true si retourne Promise<boolean>
 * @property {boolean} returnsArray - true si retourne Promise<Array>
 * @property {boolean} returnsNullable - true si retourne Promise<X | null>
 */

/**
 * Résultat du parsing d'un fichier d'interface repository
 *
 * @typedef {Object} InterfaceInfo
 * @property {string}            filePath       - Chemin absolu vers le fichier interface
 * @property {string}            interfaceName  - Nom de l'interface (ex: 'IAlertRepository')
 * @property {InterfaceMethod[]} methods        - Méthodes du contrat
 */

/**
 * Résultat du parsing d'un composant React
 *
 * @typedef {Object} ComponentInfo
 * @property {string}   filePath        - Chemin absolu vers le fichier composant
 * @property {string}   componentName   - Nom du composant (ex: 'AlertTypeBadge')
 * @property {string}   feature         - Feature parente (ex: 'alerts') ou 'shared'
 * @property {string[]} propsFields     - Noms des props extraits de l'interface Props
 * @property {boolean}  usesTranslation - Utilise useTranslation (react-i18next)
 * @property {boolean}  usesRouter      - Utilise useNavigate / useParams / useLocation
 * @property {boolean}  usesQuery       - Utilise useQuery ou useMutation (React Query)
 */

/**
 * Résultat du parsing d'un fichier de hooks
 *
 * @typedef {Object} HookInfo
 * @property {string}   filePath       - Chemin absolu vers le fichier hook
 * @property {string[]} hookNames      - Noms de tous les hooks exportés (ex: ['useAlertTypes', 'useCreateAlertType'])
 * @property {string}   feature        - Feature parente (ex: 'alerts')
 * @property {boolean}  usesQuery      - Contient des useQuery
 * @property {boolean}  usesMutation   - Contient des useMutation
 * @property {string[]} queryKeyNames  - Noms des query key exports (ex: ['alertKeys'])
 */

// ─── Templates — contextes de rendu ───────────────────────────────────────────

/**
 * Informations sur un repository mockée dans le contexte de template backend
 *
 * @typedef {Object} MockedRepository
 * @property {string}            paramName      - Nom du param constructeur (ex: 'repo')
 * @property {string}            interfaceName  - Nom de l'interface (ex: 'IAlertRepository')
 * @property {string}            importPath     - Import relatif depuis __tests__/ (ex: '../../../domain/repositories/IAlertRepository')
 * @property {InterfaceMethod[]} methods        - Méthodes à inclure dans le mock
 */

/**
 * Contexte passé au template backend-use-case
 *
 * @typedef {Object} BackendUseCaseTemplateContext
 * @property {string}             className            - Nom de la classe use-case
 * @property {string}             module               - Module parent
 * @property {string}             sourceImportPath     - Import relatif vers le source (ex: '../CreateAlertTypeUseCase')
 * @property {MockedRepository[]} repositories         - Repositories à mocker
 * @property {string[]}           externalServiceMocks - Services à jest.mock() (ex: ['@/shared/services/PasswordService.js'])
 * @property {ExecuteParam[]}     executeParams        - Params de execute()
 * @property {string}             returnType           - Type de retour
 * @property {boolean}            isVoid               - true si execute retourne void
 * @property {boolean}           [returnsArray]        - true si execute retourne un tableau
 * @property {boolean}           [returnsBool]         - true si execute retourne un booléen
 * @property {string[]}          [thrownExceptions]    - Exceptions détectées dans execute() (ex: ['NotFoundException'])
 * @property {string}            [sourceHash]          - Hash SHA-256 court du fichier source (pour @unitix-source-hash)
 * @property {CoverageLevel}     [coverageLevel]       - Niveau de couverture (défaut: 'standard')
 */

/**
 * Contexte passé au template frontend-component
 *
 * @typedef {Object} FrontendComponentTemplateContext
 * @property {string}   componentName    - Nom du composant
 * @property {string}   feature          - Feature parente
 * @property {string}   importPath       - Import relatif vers le composant
 * @property {string[]} propsFields      - Noms des props
 * @property {boolean}  usesTranslation  - Composant utilise useTranslation
 * @property {boolean}  usesRouter       - Composant utilise le router
 * @property {boolean}  usesQuery        - Composant utilise React Query
 * @property {string}   testFramework    - 'vitest'
 * @property {{ name: string, importPath: string }|null} renderHelper - Wrapper de rendu
 * @property {string}  [sourceHash]     - Hash SHA-256 court du fichier source
 * @property {CoverageLevel} [coverageLevel] - Niveau de couverture (défaut: 'standard')
 */

/**
 * Contexte passé au template frontend-hook
 *
 * @typedef {Object} FrontendHookTemplateContext
 * @property {string[]} hookNames          - Noms des hooks exportés
 * @property {string}   feature            - Feature parente
 * @property {string}   importPath         - Import relatif vers le fichier hook
 * @property {boolean}  usesQuery          - Contient des useQuery
 * @property {boolean}  usesMutation       - Contient des useMutation
 * @property {string[]} queryKeyNames      - Noms des query key exports
 * @property {string}   testFramework      - 'vitest'
 * @property {string|null} mswHandlerImportPath - Chemin import du handler MSW si applicable
 * @property {{ name: string, importPath: string }|null} renderHelper - Wrapper de rendu custom (comme FrontendComponentTemplateContext)
 * @property {string[]} [mutationPrefixes]  - Préfixes de hooks de mutation (configurable)
 * @property {string}   [sourceHash]        - Hash SHA-256 court du fichier source
 * @property {CoverageLevel} [coverageLevel] - Niveau de couverture (défaut: 'standard')
 */

/**
 * Contexte passé au template generic-unit
 *
 * @typedef {Object} GenericUnitTemplateContext
 * @property {string}  fileName      - Nom du fichier sans extension (ex: 'UserService')
 * @property {string}  importPath    - Import relatif depuis __tests__/ (ex: '../UserService')
 * @property {string}  testFramework - Framework de test : 'jest' | 'vitest'
 * @property {string} [module]       - Nom du module inféré si possible
 * @property {string} [sourceHash]   - Hash SHA-256 court pour @unitix-source-hash
 * @property {CoverageLevel} [coverageLevel] - Niveau de couverture (défaut: 'standard')
 */

// ─── Résultats & Résumé ───────────────────────────────────────────────────────

/**
 * Résultat de la génération d'un fichier de test
 *
 * @typedef {Object} GenerationResult
 * @property {'created'|'skipped'|'dry-run'|'error'|'synced'} status - Statut de l'opération
 * @property {string}  testFilePath   - Chemin du fichier de test (cible)
 * @property {string}  sourceFilePath - Chemin du fichier source
 * @property {string} [reason]        - Raison du skip ou du message d'erreur
 */

/**
 * Résumé complet d'une exécution du générateur
 *
 * @typedef {Object} GenerationSummary
 * @property {GenerationResult[]} results - Détail de chaque fichier traité
 * @property {number}             created - Fichiers créés
 * @property {number}             skipped - Fichiers ignorés (déjà existants)
 * @property {number}             errors  - Fichiers en erreur
 * @property {number}             dryRun  - Fichiers qui auraient été créés (dry-run)
 * @property {number}             synced  - Fichiers resynchronisés (hash changé → régénérés)
 * @property {number}             total   - Total traité
 */

// ─── Détection d'architecture ───────────────────────────────────────────────

/**
 * Types d'architectures détectables par Unitix.
 *
 * @typedef {'clean-architecture'|'feature-based'|'mvc-layered'|'nextjs'|'monorepo'|'unknown'} ArchitectureType
 */

/**
 * Frameworks et outils détectés dans le projet.
 *
 * @typedef {Object} FrameworkInfo
 * @property {'typescript'|'javascript'} language          - Langage principal du projet
 * @property {'nestjs'|'express'|'fastify'|'koa'|null} backend  - Framework backend détecté
 * @property {'react'|'vue'|'angular'|'svelte'|null}   frontend - Framework frontend détecté
 * @property {'jest'|'vitest'|null}                    testRunner - Runner de tests détecté
 * @property {'vite'|'webpack'|'esbuild'|null}         bundler    - Bundler détecté
 * @property {boolean}                                 isMonorepo - Projet monorepo
 * @property {boolean}                                 isNextJs   - Projet Next.js
 */

/**
 * Chemins bruts relevés lors du scan de dossiers.
 * Usage interne au détecteur — ne pas exposer à l'API publique.
 *
 * @typedef {Object} RawDetectedPaths
 * @property {string|null} srcDir
 * @property {string|null} backendDir
 * @property {string|null} frontendDir
 * @property {string|null} modulesDir
 * @property {string|null} featuresDir
 * @property {string|null} controllersDir
 * @property {string|null} servicesDir
 * @property {string|null} pagesDir
 * @property {string|null} appRouterDir
 * @property {string|null} packagesDir
 * @property {string|null} appsDir
 * @property {string|null} testsDir
 * @property {boolean}     hasUseCasesDir
 * @property {boolean}     hasDomainDir
 * @property {boolean}     hasNestCliJson
 * @property {boolean}     hasNextConfig
 * @property {boolean}     hasViteConfig
 * @property {boolean}     hasAngularJson
 * @property {boolean}     hasJestConfig
 * @property {boolean}     hasVitestConfig
 */

/**
 * Chemins résolus (absolus) par le détecteur d'architecture.
 *
 * @typedef {Object} DetectedPaths
 * @property {string}      root           - Racine du projet
 * @property {string|null} src            - Dossier src/ s'il existe
 * @property {string|null} backend        - Dossier backend/ (ou server/, api/)
 * @property {string|null} frontend       - Dossier frontend/ (ou client/, web/)
 * @property {string|null} modulesDir     - Racine des modules (clean-arch)
 * @property {string|null} featuresDir    - Racine des features (feature-based)
 * @property {string|null} controllersDir - Dossier controllers/ (mvc)
 * @property {string|null} servicesDir    - Dossier services/ (mvc)
 * @property {string|null} pagesDir       - Dossier pages/ ou app/ (nextjs)
 * @property {string|null} testsDir       - Dossier tests/ racine (s'il existe déjà)
 */

/**
 * Règle de génération de tests pour un type de source donné.
 *
 * @typedef {Object} TestRule
 * @property {string}            name          - Identifiant de la règle (ex: 'use-cases')
 * @property {string}            description   - Description lisible
 * @property {string}            sourcePattern - Glob relatif pour trouver les sources
 * @property {'colocated'|'root-tests-dir'|'mirror'} testPlacement - Emplacement des tests
 * @property {string}            testDirName   - Nom du dossier de tests ('__tests__' ou 'tests')
 * @property {string}           [testSubDir]   - Sous-dossier dans testDirName (ex: 'controllers')
 * @property {string}            testNaming    - Convention de nommage (ex: '{name}.test.ts')
 * @property {'jest'|'vitest'}   framework     - Framework de test à utiliser
 * @property {string}            template      - Nom du template à utiliser
 * @property {'backend'|'frontend'|'all'} workspace - Workspace ciblé
 */

/**
 * Stratégie de tests adaptée à l'architecture du projet.
 *
 * @typedef {Object} TestStrategy
 * @property {'colocated'|'root-tests-dir'|'mirror'} placement - Stratégie d'emplacement par défaut
 * @property {string}    testDirName  - Nom du dossier de tests ('__tests__' ou 'tests')
 * @property {'test'|'spec'} fileNaming - Convention de nommage (*.test.ts ou *.spec.ts)
 * @property {TestRule[]} rules        - Règles de génération par type de source
 */

/**
 * Entrée de la cartographie source↔test pour un répertoire source donné.
 *
 * @typedef {Object} SourceDirEntry
 * @property {string}   sourceDir           - Chemin absolu du répertoire source
 * @property {string}   sourceDirRelative   - Chemin relatif à la racine (affichage)
 * @property {string}   module              - Nom du module/feature parent
 * @property {string}   ruleName            - Règle applicable ('use-cases'|'components'|'hooks'|...)
 * @property {'backend'|'frontend'|'all'} workspace - Workspace concerné
 * @property {string}   testDir             - Chemin absolu du répertoire de tests cible
 * @property {string}   testDirRelative     - Chemin relatif du répertoire de tests (affichage)
 * @property {boolean}  testDirExists       - true si le répertoire de tests existe déjà
 * @property {string[]} sourceFiles         - Noms des fichiers sources dans ce répertoire
 * @property {number}   existingTestCount   - Nombre de fichiers de test déjà présents
 * @property {number}   missingTestCount    - Nombre de tests manquants (à créer)
 * @property {number}   desyncCount         - Nombre de fichiers source désynchronisés (stub modifié)
 * @property {string[]} desyncFiles         - Noms des fichiers source dont le stub est désynchronisé
 */

/**
 * Statistiques agrégées de la SourceMap.
 *
 * @typedef {Object} SourceMapStats
 * @property {number} totalDirs          - Nombre total de répertoires sources trouvés
 * @property {number} totalSourceFiles   - Nombre total de fichiers sources
 * @property {number} totalTestsExisting - Nombre de tests déjà créés
 * @property {number} totalTestsMissing  - Nombre de tests à créer
 * @property {number} totalDesync        - Nombre total de stubs désynchronisés dans le projet
 * @property {number} coveragePercent    - % de couverture actuelle (0–100)
 */

/**
 * Profil complet d'architecture d'un projet, retourné par detectArchitecture().
 *
 * @typedef {Object} ArchitectureProfile
 * @property {ArchitectureType}  type        - Type d'architecture détecté
 * @property {'high'|'medium'|'low'} confidence - Niveau de confiance de la détection
 * @property {FrameworkInfo}     frameworks  - Frameworks et outils détectés
 * @property {DetectedPaths}     paths       - Chemins clés résolus
 * @property {TestStrategy}      testStrategy - Stratégie de tests adaptée
 * @property {SourceDirEntry[]}  sourceMap   - Cartographie complète sources↔tests
 * @property {SourceMapStats}    sourceMapStats - Statistiques agrégées
 * @property {number}            score       - Score brut de détection (debug)
 * @property {Record<string,number>} allScores - Scores de tous les types (debug)
 */

// Ce fichier est purement documentaire — pas d'implémentation.
export {};
