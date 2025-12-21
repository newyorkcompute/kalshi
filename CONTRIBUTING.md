# Contributing to @newyorkcompute/kalshi

Thanks for your interest in contributing! This document outlines how to get started.

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Getting Started

1. **Fork and clone the repo**

```bash
git clone https://github.com/YOUR_USERNAME/kalshi.git
cd kalshi
```

2. **Install dependencies**

```bash
npm install
```

3. **Build all packages**

```bash
npm run build
```

4. **Run tests**

```bash
npm run test
```

## Project Structure

This is an [NX](https://nx.dev) monorepo:

```
kalshi/
├── packages/
│   └── mcp/           # @newyorkcompute/kalshi-mcp
├── .changeset/        # Changesets for versioning
├── .github/           # GitHub Actions & templates
├── nx.json            # NX configuration
└── package.json       # Root workspace
```

## NX Commands

NX provides powerful tools for managing the monorepo:

```bash
# Run a target for all projects
npx nx run-many -t build
npx nx run-many -t test
npx nx run-many -t lint

# Run a target for a specific project
npx nx build @newyorkcompute/kalshi-mcp
npx nx test @newyorkcompute/kalshi-mcp

# Run only affected projects (based on git changes)
npx nx affected -t test
npx nx affected -t build

# Visualize the project graph
npx nx graph

# See what would be affected by your changes
npx nx affected:graph
```

### Caching

NX automatically caches task results. If you run `npm run build` twice without changes, the second run will be instant. To clear the cache:

```bash
npx nx reset
```

## Development Workflow

### Creating a Feature

1. **Create a branch from `main`**

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature
```

2. **Make your changes**

3. **Run checks** (NX will cache unchanged results)

```bash
# Run all checks
npm run typecheck
npm run lint
npm run test
npm run build

# Or run only affected (faster for large changes)
npx nx affected -t typecheck lint test build
```

4. **Add a changeset** (if your change affects published packages)

```bash
npx changeset
```

Follow the prompts to describe your change and select the appropriate version bump:
- `patch` — Bug fixes, documentation
- `minor` — New features (backwards compatible)
- `major` — Breaking changes

5. **Commit and push**

```bash
git add -A
git commit -m "feat: your feature description"
git push origin feat/your-feature
```

6. **Open a Pull Request**

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: resolve bug
docs: update documentation
chore: maintenance tasks
refactor: code restructuring
test: add or update tests
```

## Code Style

- **TypeScript** — All code is written in TypeScript
- **ESM** — We use ES modules (`"type": "module"`)
- **ESLint** — Linting with TypeScript rules

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | `kebab-case.ts` | `get-markets.ts` |
| Functions | `camelCase` | `registerGetMarkets` |
| Types/Interfaces | `PascalCase` | `KalshiConfig` |
| Constants | `SCREAMING_SNAKE_CASE` | `SERVER_VERSION` |

## Adding a New MCP Tool

1. **Create a new file** in `packages/mcp/src/tools/`:

```typescript
// packages/mcp/src/tools/my-new-tool.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SomeApi } from "kalshi-typescript";
import { z } from "zod";

const MyNewToolSchema = z.object({
  param: z.string().describe("Description of the parameter"),
});

type MyNewToolInput = z.infer<typeof MyNewToolSchema>;

export function registerMyNewTool(server: McpServer, api: SomeApi) {
  server.tool(
    "my_new_tool",
    "Description of what this tool does",
    MyNewToolSchema.shape,
    async (params: MyNewToolInput) => {
      try {
        const response = await api.someMethod(params.param);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
```

2. **Register in `packages/mcp/src/index.ts`**

```typescript
import { registerMyNewTool } from "./tools/my-new-tool.js";

// In main():
registerMyNewTool(server, someApi);
```

3. **Add tests** in `packages/mcp/src/tools/my-new-tool.test.ts`

4. **Update documentation** in `packages/mcp/README.md`

5. **Add a changeset** describing the new tool

## Testing

We use [Vitest](https://vitest.dev) for testing:

```bash
# Run all tests
npm run test

# Run tests for a specific project
npx nx test @newyorkcompute/kalshi-mcp

# Run tests in watch mode
cd packages/mcp && npm run test:watch

# Run a specific test file
npx vitest run packages/mcp/src/tools/get-markets.test.ts

# Run tests with coverage
npx vitest run --coverage
```

### Writing Tests

- **Mock external APIs** — Don't make real API calls
- **Test success and error cases** — Cover the happy path and edge cases
- **Keep tests focused** — One behavior per test
- **Use descriptive names** — `it("should return error when API fails")`

Example test structure:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("kalshi-typescript", () => ({ SomeApi: vi.fn() }));

describe("my_new_tool", () => {
  beforeEach(() => {
    // Setup mocks
  });

  it("should register the tool", () => { /* ... */ });
  it("should return data on success", async () => { /* ... */ });
  it("should return error on API failure", async () => { /* ... */ });
});
```

## Pull Request Guidelines

- [ ] Fill out the PR template
- [ ] Keep PRs focused on a single change
- [ ] Include tests for new functionality
- [ ] Update documentation as needed
- [ ] Add a changeset for version bumps
- [ ] Ensure CI passes (typecheck, lint, test, build)

## Getting Help

- **Questions?** Open an issue or start a discussion on GitHub
- **Found a bug?** Open an issue with reproduction steps
- **Feature request?** Open an issue describing the use case

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
