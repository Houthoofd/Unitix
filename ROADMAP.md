# Unitix — Roadmap

Historique des versions livrées et plan détaillé des développements à venir.

---

## ✅ v0.1.0 — Générateur de stubs (base)

> _Premier release fonctionnel, ciblé Clean Architecture._

- Parsing AST (`@typescript-eslint/typescript-estree`) : use-cases, interfaces, composants React, hooks
- Scanners récursifs backend + frontend
- Templates Jest (use-case) et Vitest (composant, hook)
- CLI : `--workspace`, `--module`, `--sprint`, `--dry-run`, `--force`, `--verbose`
- Config via `unitix.config.mjs`
- Publication GitHub Packages (`@houthoofd/unitix`)

**Limitation** : config 100% manuelle, chemins hardcodés ClubManager.

---

## ✅ v0.2.0 — Détection d'architecture + Source Map

> _Unitix devient adaptatif : il comprend le projet avant de générer._

- Module `detectors/` : `framework-detector`, `path-detector`, `architecture-detector`, `test-strategy-builder`, `source-mapper`
- Détection de 6 types : `clean-architecture`, `feature-based`, `mvc-layered`, `nextjs`, `monorepo`, `unknown`
- Commandes `--detect` (profil + source map) et `--auto` (génération sans config)
- Cartographie récursive complète `sourceDir ↔ __tests__/` avec statuts (`✓`, `○`, `□`)
- Barre de couverture, stats agrégées (`SourceMapStats`)
- API publique : `detectArchitecture()`, `generateTestsAuto()`

**Validation ClubManager V3** : 40 dossiers, 215 sources → 204 stubs générés, couverture 100%.

---

## ✅ v0.3.0 — Corrections & améliorations immédiates

> _Corriger les imperfections identifiées dans les templates et l'outillage._

### Corrections bugs connus

- [x] **Header des templates obsolète** — les templates générés affichent encore
  `Généré par : scripts/generate-tests.mjs` au lieu de `Généré par : Unitix v0.x`
- [x] **`renderWithProviders` hardcodé** dans `frontend-hook.mjs` — le chemin
  `@/shared/test/renderWithProviders` est en dur ; doit être lu depuis la config
  ou la `TestStrategy` détectée
- [x] **`extractModule` fragile** — fonctionne uniquement pour le pattern
  `modules/{name}/application`. Doit gérer les autres architectures (MVC, feature-based)
- [x] **Score feature-based trop haut** — ClubManager obtient `feature-based=9`
  alors qu'il s'agit de `clean-architecture=13`. Revoir les poids pour éviter l'ambiguïté

### Améliorations qualité des stubs

- [x] **Assertions typées** — inférer la valeur de retour depuis le type TS :
  - `Promise<AlertTypeDto[]>` → `expect(result).toEqual(expect.arrayContaining([]))`
  - `Promise<boolean>` → `expect(result).toBe(true)`
  - `Promise<void>` → `expect(mockRepo.x).toHaveBeenCalledTimes(1)`
- [x] **Cas d'erreur automatiques** — détecter les `throw new NotFoundException()`,
  `ForbiddenException`, etc. dans le code source et générer les `rejects.toThrow()`
  correspondants
- [x] **Heuristique `isMutationHook` configurable** — la liste des préfixes
  (`useCreate`, `useDelete`…) doit être extensible via la config du projet

---

## ✅ v0.3.1 — Peaufinage stubs & outillage CI

> _Amélioration directe de la qualité des stubs générés et intégration CI._

- [x] **Mocks pré-remplis** — `renderSingleMock` utilise `method.mockReturn` pour générer
  `.mockResolvedValue([])`, `.mockResolvedValue(null)`, `.mockResolvedValue(false)`, etc.
  au lieu d'un `jest.fn()` vide. Les méthodes retournant un objet inconnu (`{}`) restent
  en `jest.fn()` pour ne pas générer de code TypeScript invalide
- [x] **Noms de tests d'exception descriptifs** — `deriveExceptionContext()` remplace
  la dérivation fragile par regex. `NotFoundException` → `"si l'entité n'est pas trouvée"`,
  `ForbiddenException` → `"si l'accès est refusé"`, etc. Table de 13 correspondances
  exactes + patterns par sous-chaîne + fallback générique
- [x] **Flag `--ci`** — Exit code 1 si des stubs sont manquants (`--detect --ci`)
  ou si des erreurs de génération surviennent (`--auto --ci`). Idéal pour les pipelines CI/CD
- [x] **Flag `--json`** — Sortie JSON machine-readable sur stdout (`--detect --json`,
  `--auto --json`). Les logs ANSI sont redirigés sur stderr via `setQuiet()` dans le logger.
  Parseable par des scripts externes, dashboards ou GitHub Actions
- [x] **Flag `--no-color`** — Désactiver la colorisation ANSI (parsing dans cli.mjs)

---

## ✅ v0.4.0 — Mode `--sync` : détection de désynchronisation

> _Détecter les stubs obsolètes et les signaler._

- [x] **Détection de désynchronisation** — comparer le hash du fichier source avec
  un hash stocké dans un commentaire en en-tête du test généré :
  ```ts
  // @unitix-source-hash: a3f2c1d9
  ```
- [x] **Flag `--sync`** — reparse les sources, détecte les écarts avec les stubs
  existants et régénère les stubs dont le hash source a changé
- [x] **Rapport de désynchronisation** — dans `--detect`, une nouvelle colonne
  `⚠ désynchronisé` si le hash a changé

---

## ✅ v0.4.1 — `--sync` chirurgical : préservation des tests manuels

> _Complète la promesse de v0.4.0 : `--sync` ne détruit plus les tests
> ajoutés manuellement dans un stub généré._

### Problème résolu

En v0.4.0, `--sync` régénérait **l’intégralité** du fichier `.test.ts` lors
d’une désynchronisation, écrasant silencieusement les blocs `it()` ajoutés
manuellement par le développeur.

### Fonctionnalités

- [x] **Zones délimitées par marqueurs** — les stubs générés délimitent
  précisément la zone gérée par Unitix :
  ```ts
  // @unitix:begin
  import { ... }           // ← géré par Unitix
  const mockRepo = { ... } // ← géré par Unitix
  describe('...') { ... }  // ← géré par Unitix
  // @unitix:end

  // ─── Tests personnalisés ─────────────────────
  // Ajoutez ici vos tests           // ← préservé lors d'un --sync
  it('mon test custom', ...) { }    // ← préservé lors d'un --sync
  ```
- [x] **`sync-merger.mjs`** — module dédié avec `hasSyncMarkers()`,
  `extractManualTail()`, `mergeSyncContent()`, `countNonEmptyLines()`
- [x] **Fusion chirurgicale dans l’engine** — lors d’un `--sync` sur un fichier
  désync, seule la zone `@unitix:begin ↔ @unitix:end` est remplacée ;
  tout ce qui se trouve après `@unitix:end` est rintact
- [x] **Rétro-compatibilité** — les stubs sans marqueurs (pré-v0.4.1 ou manuels)
  continuent de se comporter comme en v0.4.0 (régénération complète)
- [x] **3 templates mis à jour** — `backend-use-case`, `frontend-component`,
  `frontend-hook` incluent tous les marqueurs + section `Tests personnalisés`

---

## ✅ v0.5.0 — `unitix init` : assistant de configuration

> _Zéro friction pour les nouveaux projets._

### Problème résolu

Pour utiliser Unitix en mode config manuelle, il fallait écrire `unitix.config.mjs`
à la main. Pour les projets dont l'architecture n'est pas encore supportée en
mode `--auto`, c'était un frein.

### Fonctionnalités

- [x] **Commande `npx unitix init`** — wizard interactif dans le terminal :
  1. Lance `detectArchitecture()` et affiche le profil détecté
  2. Propose des chemins auto-complétés pour `modulesDir`, `featuresDir`, etc.
  3. Demande le framework de test à utiliser (Jest / Vitest)
  4. Génère `unitix.config.mjs` prêt à l'emploi
- [x] **Génération des helpers de test** — si le projet n'a pas de `renderWithProviders`,
  propose de créer le fichier boilerplate dans `src/shared/test/`
- [x] **Setup MSW** — si hooks React Query détectés, propose d'installer MSW
  et génère `src/shared/test/mocks/server.ts` + `handlers.ts` + `setup.ts`
- [x] **Guard TTY** — détecte l'absence de terminal interactif (CI) et propose
  une marche à suivre claire
- [x] **Confirmation écrasement** — si `unitix.config.mjs` existe déjà,
  demande confirmation avant d'écraser

---

## ✅ v0.5.1 — Niveaux de couverture configurable

> _Adapter la densité des stubs générés au contexte du projet._

### Problème résolu

Unitix générait toujours le même nombre de tests peu importe la maturité du projet.
Bootstrapper rapidement 200 stubs = `minimal`. Travailler en TDD strict = `exhaustive`.

### Fonctionnalités

- [x] **`CoverageLevel : 'minimal' | 'standard' | 'exhaustive'`** — nouveau type dans `types.mjs`
- [x] **Config globale + override par workspace** — `config.coverageLevel` ET
  `config.backend.coverageLevel` / `config.frontend.coverageLevel`
- [x] **Backend — `minimal`** — 1 `it` : cas nominal uniquement
- [x] **Backend — `standard`** _(défaut, comportement v0.4.x)_ — cas nominal + exceptions détectées
- [x] **Backend — `exhaustive`** — standard + `toHaveBeenCalledWith` pour chaque méthode repo
  + cas retour nullable + cas paramètres invalides/manquants
- [x] **Frontend composant — `minimal`** — 1 `it` : rendu sans erreur
- [x] **Frontend composant — `standard`** _(défaut)_ — rendu + contenu selon props
- [x] **Frontend composant — `exhaustive`** — standard + accessibilité a11y + interaction
  (`fireEvent`) + snapshot
- [x] **Frontend hook — `minimal`** — 1 `it` par hook : appel sans erreur
- [x] **Frontend hook — `standard`** _(défaut)_ — query: chargement+succès ; mutation: succès+erreur
- [x] **Frontend hook — `exhaustive`** — standard + état de chargement explicite (query)
  + invalidation de cache (mutation)
- [x] **Wizard `unitix init`** — prompt interactif pour choisir le niveau

---

## 📋 v0.6.0 — Performance & expérience développeur _(planifié)_

> _Rendre Unitix rapide sur les grands projets et agréable à déboguer._

### Optimisations

- [ ] **Parsing AST parallèle** — remplacer la boucle séquentielle `for (const file of files)`
  par `Promise.all(files.map(...))` dans l'engine. Gain estimé : 3-5× sur >100 fichiers
- [ ] **Cache de l'AST** — stocker les résultats parsés dans un fichier
  `.unitix-cache.json` (keyed par hash du fichier source). Évite de re-parser
  les fichiers inchangés entre deux runs
- [ ] **Mode `--watch`** — surveiller les fichiers sources avec `fs.watch()` et
  régénérer automatiquement les stubs quand un fichier est modifié

### Expérience développeur

- [ ] **Meilleurs messages d'erreur** — en cas d'échec de parsing AST, afficher
  la ligne et le fichier exact avec un extrait de code contextuel
- [ ] **Flag `--root=<chemin>`** — permettre d'analyser un projet depuis un
  répertoire différent du CWD (utile en CI ou en monorepo)
- [ ] **Flag `--json`** — sortie JSON machine-readable de `--detect` et du résumé
  de génération (pour intégrations CI/scripts)
- [ ] **Colorisation configurable** — `--no-color` pour les environnements CI
  qui ne supportent pas ANSI

---

## 📋 v0.7.0 — Templates personnalisables _(planifié)_

> _Permettre à chaque projet d'adapter les stubs à ses conventions._

### Problème actuel

Les templates sont figés dans le code de Unitix. Un projet utilisant
`describe.each`, `@faker-js/faker`, ou une convention de nommage spécifique
ne peut pas personnaliser les stubs sans forker le package.

### Fonctionnalités

- [ ] **Dossier `unitix/templates/` dans le projet** — si un fichier
  `unitix/templates/backend-use-case.mjs` existe, il prend la priorité
  sur le template interne de Unitix (même interface de fonction `render(ctx)`)
- [ ] **Variables de templates exposées** — documenter clairement le contexte
  passé à chaque template (`BackendUseCaseTemplateContext`, etc.)
- [ ] **Template `generic-unit`** — un template minimaliste pour les architectures
  non reconnues, générant un squelette de test vide mais valide

---

## 📋 v0.8.0 — Intégration Git _(planifié)_

> _Générer des tests uniquement pour le code qui vient de changer._

### Fonctionnalités

- [ ] **Flag `--changed`** — lire `git diff --name-only HEAD` et ne générer des
  tests que pour les fichiers modifiés ou ajoutés depuis le dernier commit
- [ ] **Flag `--since=<ref>`** — cibler un commit, tag ou branche spécifique
  (ex: `--since=main`, `--since=v1.2.0`)
- [ ] **Hook `pre-commit`** — générer automatiquement les stubs manquants avant
  chaque commit (optionnel, configurable dans `unitix.config.mjs`)

---

## 📋 v0.9.0 — Intégration CI/CD _(planifié)_

> _Faire de Unitix un garde-fou dans le pipeline de delivery._

### Fonctionnalités

- [ ] **Flag `--ci`** — exit code non-zéro si des fichiers de tests sont manquants.
  Bloque le pipeline si un use-case ou composant n'a pas de stub correspondant
- [ ] **GitHub Actions Step Summary** — poster un résumé Markdown dans
  `$GITHUB_STEP_SUMMARY` avec le tableau source map et les stats de couverture
- [ ] **Badge de couverture des stubs** — générer un badge SVG
  `![stubs](https://img.shields.io/badge/stubs-100%25-brightgreen)` mis à jour
  automatiquement après chaque run

---

## 📋 v0.10.0 — Support MVC / Layered _(planifié)_

> _Étendre la génération aux architectures Express / Fastify / Koa._

- [ ] Templates `mvc-controller` (supertest) et `mvc-service` (jest.fn mocks)
- [ ] Scanner MVC récursif (`controllers/`, `services/`)
- [ ] Placement `root-tests-dir` : `tests/controllers/`, `tests/services/`
- [ ] Détection des patterns d'injection de dépendances (constructeur, paramètre)

---

## 📋 v0.11.0 — Support Next.js _(planifié)_

> _Pages, API Routes et Server Components._

- [ ] Détection App Router vs Pages Router
- [ ] Templates : `nextjs-page`, `nextjs-app-page`, `nextjs-api-route`
- [ ] Intégration `next/jest` et `@testing-library/react`
- [ ] Support des Server Actions (Next.js 14+)

---

## 📋 v0.12.0 — Support Monorepo _(planifié)_

> _Workspaces pnpm / turborepo / lerna._

- [ ] Détection et génération per-package (chaque package peut avoir son propre framework)
- [ ] Config héritée + override par package
- [ ] Support `turbo run test` pour la validation globale

---

## 📋 v1.0.0 — Release publique npm _(objectif long terme)_

> _Unitix prêt pour la communauté open-source._

- [ ] Publication registre npm public (token d'automation)
- [ ] Tests unitaires pour Unitix lui-même (parsers, détecteurs, templates)
- [ ] CI GitHub Actions : lint + tests sur chaque PR
- [ ] Documentation site (VitePress)
- [ ] Plugin VS Code : bouton "Generate tests" dans l'explorateur

---

## 💡 Idées & Backlog non priorisées

> Fonctionnalités envisagées, à évaluer selon les besoins.

| Idée | Description |
|---|---|
| **Factories de données** | Générer des `createMockEntity()` depuis les DTOs et entités du domaine |
| **Support Vue 3** | Détecter `defineComponent`, `setup()`, Composition API |
| **Support Angular** | Détecter `@Injectable`, `@Component`, `TestBed` |
| **Support Svelte** | Détecter `.svelte` + `svelte-testing-library` |
| **Export JSON du profil** | `--detect --json > unitix-profile.json` pour scripts externes |
| **Tests de snapshot** | Générer des stubs `toMatchSnapshot()` pour les composants UI |
| **Tests E2E Playwright** | Générer des stubs pour les flows critiques (login, paiement…) |
| **`--coverage-report`** | Lire le rapport Istanbul/V8 et mettre à jour la source map |
| **Property-based tests** | Générer des stubs fast-check pour les fonctions pures |
| **Détection automatique en CI** | GitHub Action dédiée `unitix-check` |

---

_Dernière mise à jour : v0.5.1_
