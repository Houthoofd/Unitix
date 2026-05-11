/**
 * types.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Définitions de types JSDoc pour @clubmanager/test-generator
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
 */

// ─── Résultats & Résumé ───────────────────────────────────────────────────────

/**
 * Résultat de la génération d'un fichier de test
 *
 * @typedef {Object} GenerationResult
 * @property {'created'|'skipped'|'dry-run'|'error'} status - Statut de l'opération
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
 * @property {number}             total   - Total traité
 */

// Ce fichier est purement documentaire — pas d'implémentation.
export {};
