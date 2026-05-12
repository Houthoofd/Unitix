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

```
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
| **Incremental** | Ignore les fichiers déjà existants (skipExisting par défaut) |
| **Mode manuel** | Config explicite via `unitix.config.mjs` pour les cas non standards |

---

## Installation

```bash
npm install -D @houthoofd/unitix
# ou
pnpm add -D @houthoofd/unitix
```

> **GitHub Packages** — ajouter `.npmrc` à la racine :
> ```
> @houthoofd:registry=https://npm.pkg.github.com
> ```

---

## Démarrage rapide

### Mode automatique (recommandé)

```bash
# 1. Analyser l'architecture sans rien générer
npx unitix --detect

# 2. Générer tous les stubs de tests
npx unitix --auto

# 3. Cibler un workspace
npx unitix --auto --workspace=backend
npx unitix --auto --workspace=frontend

# 4. Prévisualiser d'abord
npx unitix --auto --dry-run
```

### Mode manuel (avec config)

```js
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

```bash
npx unitix --workspace=backend --module=alerts
```

---

## CLI — Référence complète

### Commandes

| Commande | Description |
|---|---|
| `--detect` | Analyse l'architecture et affiche le profil complet (sans génération) |
| `--auto` | Détecte l'architecture et génère les tests automatiquement |
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

---

## Sortie de `--detect`

```
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

```typescript
// alerts/application/use-cases/__tests__/CreateAlertTypeUseCase.test.ts

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
```

### Stub frontend — Composant React (Vitest + RTL)

```typescript
// features/alerts/components/__tests__/AlertTypeBadge.test.tsx

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
```

### Stub frontend — Hook (Vitest + renderHook)

```typescript
// features/alerts/hooks/__tests__/useAlerts.test.ts

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
```

---

## API programmatique

```js
import { generateTests, generateTestsAuto, detectArchitecture } from '@houthoofd/unitix';

// Détecter l'architecture uniquement
const profile = await detectArchitecture('/path/to/project');
console.log(profile.type);          // 'clean-architecture'
console.log(profile.confidence);    // 'high'
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

```
unitix/
├── index.mjs                  ← API publique (generateTests, generateTestsAuto, detectArchitecture)
├── engine.mjs                 ← Orchestrateur principal
├── types.mjs                  ← Contrats JSDoc (ArchitectureProfile, TestStrategy, SourceDirEntry…)
├── cli.mjs                    ← Parser d'arguments CLI
├── logger.mjs                 ← Sortie ANSI colorée
├── fs-utils.mjs               ← ensureDir / writeFileSafe / fileExists / readFileSafe
│
├── detectors/                 ← Détection d'architecture
│   ├── architecture-detector.mjs  ← Orchestrateur : scoring + sélection + profil complet
│   ├── framework-detector.mjs     ← Lit package.json → NestJS? React? Jest? Vitest?
│   ├── path-detector.mjs          ← Scanne les dossiers → modules/? features/? controllers/?
│   ├── test-strategy-builder.mjs  ← Construit les TestRule[] adaptées à l'archi
│   └── source-mapper.mjs          ← Cartographie récursive sources ↔ dossiers __tests__
│
├── parsers/                   ← Parsing AST des fichiers source
│   ├── use-case-parser.mjs        ← Classe, constructeur, execute() → UseCaseInfo
│   ├── interface-parser.mjs       ← Interface TS → méthodes à mocker
│   ├── component-parser.mjs       ← Composant React → props, dépendances
│   └── hook-parser.mjs            ← Hook → signatures exportées, useQuery/useMutation
│
├── scanners/                  ← Localisation des fichiers sources
│   ├── backend-scanner.mjs        ← Walk récursif modules/**/use-cases/**/*UseCase.ts
│   └── frontend-scanner.mjs       ← Walk features/**/components + hooks/
│
├── generators/                ← Assemblage parser + template → contenu du test
│   ├── backend-generator.mjs
│   └── frontend-generator.mjs
│
├── templates/                 ← Fonctions de rendu (ctx) → string
│   ├── backend-use-case.mjs       ← Stub Jest avec mocks de repositories
│   ├── frontend-component.mjs     ← Stub Vitest + RTL
│   └── frontend-hook.mjs          ← Stub Vitest + renderHook
│
└── bin/
    └── unitix                 ← CLI binary (--detect, --auto, mode config)
```

---

## Roadmap

Voir [ROADMAP.md](./ROADMAP.md) pour le détail des versions passées et à venir.

---

## License

MIT © [Benoit Houthoofd](https://github.com/Houthoofd)
