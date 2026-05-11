# Unitix

> Test stub generator for Clean Architecture projects (TypeScript / Jest / Vitest)
>
> Created by **[odyssee-software](https://github.com/odyssee-software)**

Unitix scans your project's source files, parses them with a TypeScript AST, and scaffolds
ready-to-run test stubs — so you spend your time writing assertions, not boilerplate.

[![npm version](https://img.shields.io/npm/v/unitix.svg)](https://www.npmjs.com/package/unitix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **AST-powered** — uses `@typescript-eslint/typescript-estree` to accurately extract class names,
  constructor params, interface methods, React props and hook signatures
- **Clean Architecture aware** — knows about use-cases, repository interfaces, and DI patterns
- **Framework agnostic** — generates Jest or Vitest stubs depending on your config
- **Zero-bloat stubs** — every generated test passes immediately (`expect(true).toBe(true)`)
  and includes `// TODO:` comments to guide you to the real assertions
- **Dry-run mode** — preview what would be generated without touching the filesystem
- **Modular config** — a single `unitix.config.mjs` file adapts the generator to any project

---

## Install

```bash
npm install -D unitix
# or
pnpm add -D unitix
```

---

## Quick start

### 1. Create a config file

```js
// unitix.config.mjs
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

export const config = {
  projectRoot: ROOT,

  backend: {
    modulesDir:        resolve(ROOT, 'src/modules'),
    useCasesGlob:      'application/use-cases',
    repositoriesDir:   'domain/repositories',
    testFramework:     'jest',
    testFileExtension: '.test.ts',
  },

  frontend: {
    featuresDir:           resolve(ROOT, 'src/features'),
    sharedComponentsDir:   resolve(ROOT, 'src/shared/components'),
    testFramework:         'vitest',
    testFileExtension:     '.test.tsx',
    hookTestFileExtension: '.test.ts',
    renderHelper: {
      name:       'renderWithProviders',
      importPath: '@/shared/test/renderWithProviders',
    },
  },
};
```

### 2. Run

```bash
# Preview without writing
npx unitix --dry-run

# Generate all test stubs
npx unitix

# Backend use-cases only
npx unitix --workspace=backend

# Single module
npx unitix --module=alerts

# Force regenerate (overwrite existing)
npx unitix --force
```

---

## CLI options

| Option | Values | Default | Description |
|---|---|---|---|
| `--workspace` | `backend` \| `frontend` \| `all` | `all` | Target workspace |
| `--module` | module name | — | Filter to a single module (e.g. `alerts`) |
| `--sprint` | `1` \| `2` \| `all` | `all` | Sprint filter (1=use-cases, 2=components) |
| `--config` | path | auto-detect | Path to config file |
| `--dry-run` | — | `false` | Preview without writing |
| `--force` | — | `false` | Overwrite existing test files |
| `--verbose` | — | `false` | Detailed AST parsing logs |
| `--help` | — | — | Show help |

---

## Programmatic API

```js
import { generateTests } from 'unitix';
import { config }        from './unitix.config.mjs';

const summary = await generateTests(config);
console.log(`Created: ${summary.created}, Skipped: ${summary.skipped}`);
```

---

## What gets generated

### Backend use-case stub (Jest)

```typescript
// modules/alerts/application/use-cases/__tests__/CreateAlertTypeUseCase.test.ts

import { CreateAlertTypeUseCase } from '../CreateAlertTypeUseCase';
import type { IAlertRepository }  from '../../../domain/repositories/IAlertRepository';

const mockRepo: jest.Mocked<IAlertRepository> = {
  findAllAlertTypes:   jest.fn(),
  createAlertType:     jest.fn(),
  // ... all interface methods
} as jest.Mocked<IAlertRepository>;

let useCase: CreateAlertTypeUseCase;
beforeEach(() => { useCase = new CreateAlertTypeUseCase(mockRepo); });
afterEach(() => { jest.clearAllMocks(); });

describe('CreateAlertTypeUseCase', () => {
  describe('execute', () => {
    it('devrait retourner le résultat quand les données sont valides', async () => {
      // TODO: mockRepo.createAlertType.mockResolvedValue(...)
      // const result = await useCase.execute({ ... });
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

---

## Architecture

```
unitix/
├── index.mjs               ← Public API
├── engine.mjs              ← Main orchestrator
├── types.mjs               ← JSDoc type contracts
├── cli.mjs                 ← CLI arg parser
├── logger.mjs              ← Colored ANSI output
├── fs-utils.mjs            ← ensureDir / writeFileSafe / fileExists
├── parsers/
│   ├── use-case-parser.mjs   ← AST → UseCaseInfo
│   ├── interface-parser.mjs  ← AST → InterfaceInfo
│   ├── component-parser.mjs  ← AST → ComponentInfo
│   └── hook-parser.mjs       ← AST → HookInfo
├── scanners/
│   ├── backend-scanner.mjs   ← Walk modules/**/use-cases/
│   └── frontend-scanner.mjs  ← Walk features/**/components + hooks/
├── generators/
│   ├── backend-generator.mjs
│   └── frontend-generator.mjs
├── templates/
│   ├── backend-use-case.mjs    ← fn(ctx) → string (Jest)
│   ├── frontend-component.mjs  ← fn(ctx) → string (Vitest + RTL)
│   └── frontend-hook.mjs       ← fn(ctx) → string (Vitest + renderHook)
└── bin/
    └── unitix.mjs            ← CLI binary
```

---

## License

MIT © [Benoit Houthoofd](https://github.com/Houthoofd) — [odyssee-software](https://github.com/odyssee-software)
