# Unitix

> Générateur de stubs de tests adaptatif pour projets TypeScript.
> Détecte l'architecture de ton projet et scaffolde les bons tests au bon endroit — sans configuration.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![GitHub Packages](https://img.shields.io/badge/published-GitHub%20Packages-blue)](https://github.com/Houthoofd/Unitix/packages)

---

## Pourquoi Unitix ?

Écrire les fichiers de tests from scratch est chronophage et répétitif.
Unitix scanne ton projet, **détecte son architecture**, et génère automatiquement les squelettes de tests adaptés : mocks de repositories, wrappers RTL pour les composants, `renderHook` pour les hooks — il ne reste plus qu'à écrire les assertions.

```/dev/null/quickstart.sh#L1
npx unitix --auto
```

C'est tout. Unitix fait le reste.

---

## Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| **Détection d'architecture** | Identifie Clean Architecture, Feature-Based, MVC, Next.js, Monorepo |
| **Source map complète** | Cartographie TOUS les dossiers sources → dossiers de tests, avec état de couverture |
| **Parsing AST** | Extrait classes, constructeurs, interfaces, props React et signatures de hooks |
| **Stubs prêts à l'emploi** | Chaque test généré passe immédiatement avec des `// TODO:` pour guider |
| **Dry-run** | Prévisualise sans toucher le filesystem |
| **Incremental** | Ignore les fichiers déjà existants (`skipExisting` par défaut) |
| **Résynchronisation incrémentale** | `--sync` : détecte les stubs dont la source a changé et les met à jour |
| **Préservation des tests manuels** | Zones `@unitix:begin`/`@unitix:end` — les tests ajoutés après `@unitix:end` sont préservés lors d'un `--sync` |
| **Intégration CI** | `--ci` (exit 1 si stubs manquants), `--json` (sortie machine-readable), `--no-color` |
| **Mode manuel** | Config explicite via `unitix.config.mjs` pour les cas non standards |

---

## Installation

```/dev/null/install.sh#L1-3
npm install -D @houthoofd/unitix
# ou
pnpm add -D @houthoofd/unitix
```

> **GitHub Packages** — ajouter `.npmrc` à la racine :
> ```/dev/null/.npmrc#L1
> @houthoofd:registry=https://npm.pkg.github.com
> ```

---

## Démarrage rapide

### Mode automatique (recommandé)

```/dev/null/quickstart-auto.sh#L1-8
# 1. Analyser l'architecture sans rien générer
npx unitix --detect

# 2. Générer tous les stubs de tests
npx unitix --auto

# 3. Cibler un workspace
npx unitix --auto --workspace=backend
npx unitix --auto --workspace=frontend

# 4. Prévisualiser d'abord
npx unitix --auto --dry-run

# 5. Resynchroniser les stubs dont la source a changé
npx unitix --sync
```

### Mode manuel (avec config)

```/dev/null/unitix.config.mjs#L1-24
// unitix.config.mjs
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

export const config = {
  projectRoot: ROOT,

  backend: {
    modulesDir:        resolve(ROOT, 'backend/src/modules'),
    testFramework:     'jest',
    testFileExtension: '.test.ts',
  },

  frontend: {
    featuresDir:           resolve(ROOT, 'frontend/src/features'),
    sharedComponentsDir:   resolve(ROOT, 'frontend/src/shared/components'),
    testFramework:         'vitest',
    testFileExtension:     '.test.tsx',
    hookTestFileExtension: '.test.ts',
  },
};
```

```/dev/null/quickstart-manual.sh#L1
npx unitix --workspace=backend --module=alerts
```

---

## CLI — Référence complète

### Commandes

| Commande | Description |
|---|---|
| `--detect` | Analyse l'architecture et affiche le profil complet (sans génération) |
| `--auto` | Détecte l'architecture et génère les tests automatiquement |
| `--sync` | Resynchronise les stubs dont la source a changé (préserve les tests manuels) |
| `--help` | Affiche l'aide |

### Options

| Option | Valeurs | Défaut | Description |
|---|---|---|---|
| `--workspace` | `backend` \| `frontend` \| `all` | `all` | Workspace ciblé |
| `--module` | nom du module | — | Filtre sur un module (ex : `alerts`) |
| `--sprint` | `1` \| `2` \| `all` | `all` | Sprint ciblé (1=use-cases, 2=composants) |
| `--config` | chemin | auto-détecté | Chemin vers le fichier de config |
| `--dry-run` | — | `false` | Prévisualise sans écrire |
| `--force` | — | `false` | Écrase les fichiers existants |
| `--verbose` | — | `false` | Logs détaillés (parsing AST, config) |
| `--ci` | — | `false` | Mode CI — exit code 1 si stubs manquants (`--detect`) ou erreurs (`--auto`) |
| `--json` | — | `false` | Sortie JSON machine-readable sur stdout (logs sur stderr) |
| `--no-color` | — | `false` | Désactiver la colorisation ANSI |

---

## Zones gérées et tests manuels

Depuis la v0.4.1, chaque stub généré par Unitix est découpé en deux zones distinctes :

```/dev/null/example.test.ts#L1-20
// @unitix:begin          ← géré par Unitix, mis à jour lors d'un --sync
import { CreateAlertTypeUseCase } from '../CreateAlertTypeUseCase';
import type { IAlertRepository }  from '../../../domain/repositories/IAlertRepository';

const mockRepo: jest.Mocked<IAlertRepository> = {
  findAllAlertTypes: jest.fn(),
  createAlertType:   jest.fn(),
} as jest.Mocked<IAlertRepository>;

describe('CreateAlertTypeUseCase', () => {
  describe('execute', () => {
    it('devrait retourner le résultat quand les données sont valides', async () => {
      expect(true).toBe(true); // placeholder
    });
  });
});
// @unitix:end            ← fin de la zone gérée

// ─── Tests personnalisés ────────────────────────────────────────────────────
// Les blocs ci-dessous sont préservés lors d'un `unitix --sync`.
// Ajoutez ici vos tests supplémentaires.

it('mon test custom', () => {
  // ... ← préservé lors d'un --sync
});
```

### Comportement lors d'un `--sync`

- **Zone `@unitix:begin` → `@unitix:end`** : régénérée à partir de la source actuelle (imports, mocks, describe de base).
- **Tout ce qui suit `@unitix:end`** : conservé tel quel, tes tests manuels ne sont jamais écrasés.
- Si le fichier stub **ne contient pas** les marqueurs (stub créé avant la v0.4.1), il est ignoré lors du sync — tu peux le régénérer avec `--force`.

---

## Sortie de `--detect`

```/dev/null/detect-output.txt#L1-30
  Unitix — Analyse d'architecture
  ──────────────────────────────────────────────────
  Type        : clean-architecture
  Confiance   : high (score: 13)

  Frameworks  :
    Langage      : typescript
    Backend      : nestjs
    Frontend     : react
    Test runner  : jest
    Bundler      : vite

  Chemins détectés :
    modulesDir      : backend/src/modules
    featuresDir     : frontend/src/features

  Stratégie de tests :
    Placement  : colocated (__tests__/)
    Règles     :
      use-cases [jest]   → **/application/use-cases/**/*UseCase.ts
      components [jest]  → **/features/**/components/**/*.tsx
      hooks [jest]       → **/features/**/hooks/use*.ts

  Cartographie sources ↔ tests :
  Couverture : ████████████░░░░░░░░ 66%  142 existants  73 à créer  (215 sources, 40 dossiers)

  [backend]
    alerts
      ✓ complet  application/use-cases  (11 src)  →  backend/src/.../alerts/use-cases/__tests__
    payments
      □ absent   use-cases/payments     (6 src)   →  backend/src/.../payments/use-cases/payments/__tests__
      □ absent   use-cases/plans        (6 src)   →  backend/src/.../payments/use-cases/plans/__tests__
      □ absent   use-cases/schedules    (7 src)   →  backend/src/.../payments/use-cases/schedules/__tests__
  ...
```

---

## Architectures détectées

| Type | Signaux clés | Stratégie de tests |
|---|---|---|
| `clean-architecture` | `src/modules/`, `use-cases/`, `nest-cli.json`, NestJS | `__tests__/` colocalisés |
| `feature-based` | `src/features/`, hooks `use*.ts`, Vite/React | `__tests__/` colocalisés |
| `mvc-layered` | `controllers/`, `services/`, Express/Fastify/Koa | `tests/controllers/`, `tests/services/` |
| `nextjs` | dépendance `next`, `pages/` ou `app/`, `next.config.*` | `__tests__/` colocalisés |
| `monorepo` | `pnpm-workspace.yaml`, `turbo.json`, `packages/` | par package |
| `unknown` | aucun signal suffisant | `__tests__/` colocalisés (défaut) |

---

## Ce qui est généré

### Stub backend — Use-Case (Jest)

```/dev/null/CreateAlertTypeUseCase.test.ts#L1-40
// alerts/application/use-cases/__tests__/CreateAlertTypeUseCase.test.ts

// @unitix:begin
import { CreateAlertTypeUseCase } from '../CreateAlertTypeUseCase';
import type { IAlertRepository }  from '../../../domain/repositories/IAlertRepository';

const mockRepo: jest.Mocked<IAlertRepository> = {
  findAllAlertTypes: jest.fn(),
  createAlertType:   jest.fn(),
  // ... toutes les méthodes de l'interface
} as jest.Mocked<IAlertRepository>;

let useCase: CreateAlertTypeUseCase;
beforeEach(() => { useCase = new CreateAlertTypeUseCase(mockRepo); });
afterEach(()  => { jest.clearAllMocks(); });

describe('CreateAlertTypeUseCase', () => {
  describe('execute', () => {
    it('devrait retourner le résultat quand les données sont valides', async () => {
      // TODO: mockRepo.createAlertType.mockResolvedValue(...)
      // const result = await useCase.execute({ name: '...' });
      // expect(result).toBeDefined();
      expect(true).toBe(true); // placeholder
    });

    it('devrait lancer une erreur si le repository échoue', async () => {
      // TODO: mockRepo.createAlertType.mockRejectedValue(new Error('DB error'));
      // await expect(useCase.execute(...)).rejects.toThrow('DB error');
      expect(true).toBe(true); // placeholder
    });
  });
});
// @unitix:end

// ─── Tests personnalisés ────────────────────────────────────────────────────
// Les blocs ci-dessous sont préservés lors d'un `unitix --sync`.
// Ajoutez ici vos tests supplémentaires.
```

### Stub frontend — Composant React (Vitest + RTL)

```/dev/null/AlertTypeBadge.test.tsx#L1-25
// features/alerts/components/__tests__/AlertTypeBadge.test.tsx

// @unitix:begin
import { describe, it, expect, vi } from 'vitest';
import { render, screen }           from '@testing-library/react';
import { AlertTypeBadge }           from '../AlertTypeBadge';

describe('AlertTypeBadge', () => {
  it('se rend sans erreur', () => {
    render(<AlertTypeBadge />);
    expect(true).toBe(true); // TODO: ajouter des assertions
  });

  it('affiche les props correctement', () => {
    // TODO: render(<AlertTypeBadge prop="value" />);
    // expect(screen.getByText('...')).toBeInTheDocument();
    expect(true).toBe(true);
  });
});
// @unitix:end

// ─── Tests personnalisés ────────────────────────────────────────────────────
// Les blocs ci-dessous sont préservés lors d'un `unitix --sync`.
// Ajoutez ici vos tests supplémentaires.
```

### Stub frontend — Hook (Vitest + renderHook)

```/dev/null/useAlerts.test.ts#L1-25
// features/alerts/hooks/__tests__/useAlerts.test.ts

// @unitix:begin
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor }                  from '@testing-library/react';
import { useAlertTypes, useCreateAlertType }    from '../useAlerts';

describe('useAlerts', () => {
  describe('useAlertTypes', () => {
    it('retourne les données initiales', async () => {
      const { result } = renderHook(() => useAlertTypes());
      await waitFor(() => expect(result.current).toBeDefined());
      // TODO: expect(result.current.data).toEqual([...]);
    });
  });
});
// @unitix:end

// ─── Tests personnalisés ────────────────────────────────────────────────────
// Les blocs ci-dessous sont préservés lors d'un `unitix --sync`.
// Ajoutez ici vos tests supplémentaires.
```

---

## Utilisation en CI

Unitix s'intègre directement dans tes pipelines via `--ci`, `--json` et `--no-color`.

```/dev/null/.github/workflows/ci.yml#L1-14
# .github/workflows/ci.yml

- name: Vérifier les stubs manquants
  run: npx unitix --detect --ci
  # → exit code 1 si des fichiers de tests sont absents

- name: Resynchroniser les stubs après changements
  run: npx unitix --sync --ci
  # → exit code 1 si des erreurs surviennent lors du sync

- name: Sortie JSON pour scripts
  run: npx unitix --detect --json > unitix-profile.json
  # → écrit le profil complet en JSON (logs sur stderr)

- name: Générer sans couleur ANSI (logs propres)
  run: npx unitix --auto --no-color
```

### Exemple de sortie `--json`

```/dev/null/unitix-profile.json#L1-15
{
  "type": "clean-architecture",
  "confidence": "high",
  "score": 13,
  "frameworks": {
    "language": "typescript",
    "backend": "nestjs",
    "frontend": "react",
    "testRunner": "jest",
    "bundler": "vite"
  },
  "sourceMapStats": {
    "totalDirs": 40,
    "totalSourceFiles": 215,
    "coveredDirs": 27,
    "missingDirs": 13
  }
}
```

---

## API programmatique

```/dev/null/programmatic-api.mjs#L1-22
import { generateTests, generateTestsAuto, detectArchitecture } from '@houthoofd/unitix';

// Détecter l'architecture uniquement
const profile = await detectArchitecture('/path/to/project');
console.log(profile.type);           // 'clean-architecture'
console.log(profile.confidence);     // 'high'
console.log(profile.sourceMapStats); // { totalDirs: 40, totalSourceFiles: 215, ... }

// Générer automatiquement (sans config)
const { profile, summary } = await generateTestsAuto('/path/to/project', {
  workspace: 'backend',
  dryRun: false,
});
console.log(`Créés : ${summary.created}`);

// Générer avec config manuelle
import { config } from './unitix.config.mjs';
const summary = await generateTests(config);
console.log(`Créés : ${summary.created}, Ignorés : ${summary.skipped}`);
```

---

## Architecture interne

```/dev/null/tree.txt#L1-36
unitix/
├── index.mjs                   ← API publique (generateTests, generateTestsAuto, detectArchitecture)
├── types.mjs                   ← Contrats JSDoc (ArchitectureProfile, TestStrategy, SourceDirEntry…)
│
├── core/
│   ├── engine.mjs              ← Orchestrateur principal
│   └── cli.mjs                 ← Parser d'arguments CLI
│
├── utils/
│   ├── logger.mjs              ← Sortie ANSI colorée (--no-color via setNoColor())
│   ├── fs-utils.mjs            ← ensureDir / writeFileSafe / fileExists
│   ├── hash-utils.mjs          ← computeFileHash / extractStoredHash
│   └── sync-merger.mjs         ← hasSyncMarkers / extractManualTail / mergeSyncContent
│
├── detectors/                  ← Détection d'architecture (5 fichiers)
│   ├── architecture-detector.mjs  ← Orchestrateur : scoring + sélection + profil complet
│   ├── framework-detector.mjs     ← Lit package.json → NestJS? React? Jest? Vitest?
│   ├── path-detector.mjs          ← Scanne les dossiers → modules/? features/? controllers/?
│   ├── test-strategy-builder.mjs  ← Construit les TestRule[] adaptées à l'archi
│   └── source-mapper.mjs          ← Cartographie récursive sources ↔ dossiers __tests__
│
├── parsers/                    ← Parsing AST des fichiers source (4 fichiers)
│   ├── use-case-parser.mjs        ← Classe, constructeur, execute() → UseCaseInfo
│   ├── interface-parser.mjs       ← Interface TS → méthodes à mocker
│   ├── component-parser.mjs       ← Composant React → props, dépendances
│   └── hook-parser.mjs            ← Hook → signatures exportées, useQuery/useMutation
│
├── scanners/                   ← Localisation des fichiers sources (2 fichiers)
│   ├── backend-scanner.mjs        ← Walk récursif modules/**/use-cases/**/*UseCase.ts
│   └── frontend-scanner.mjs       ← Walk features/**/components + hooks/
│
├── generators/                 ← Assemblage parser + template → contenu du test (2 fichiers)
│   ├── backend-generator.mjs
│   └── frontend-generator.mjs
│
├── templates/                  ← Fonctions de rendu ctx→string (3 fichiers)
│   ├── backend-use-case.mjs       ← Stub Jest avec mocks de repositories
│   ├── frontend-component.mjs     ← Stub Vitest + RTL
│   └── frontend-hook.mjs          ← Stub Vitest + renderHook
│
└── bin/unitix                  ← CLI binary (--detect, --auto, --sync, mode config)
```

---

## Roadmap

Voir [ROADMAP.md](./ROADMAP.md) pour le détail des versions passées et à venir.

---

## License

MIT © [Benoit Houthoofd](https://github.com/Houthoofd)
