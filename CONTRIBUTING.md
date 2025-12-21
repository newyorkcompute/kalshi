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

This is an NX monorepo:

```
kalshi/
├── packages/
│   └── mcp/           # @newyorkcompute/kalshi-mcp
├── .changeset/        # Changesets for versioning
├── .github/           # GitHub Actions & templates
├── nx.json            # NX configuration
└── package.json       # Root workspace
```

## Development Workflow

### Creating a Feature

1. **Create a branch**

```bash
git checkout -b feat/your-feature
```

2. **Make your changes**

3. **Run checks**

```bash
npm run typecheck
npm run lint
npm run test
npm run build
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

## Code Style

- **TypeScript** — All code is written in TypeScript
- **ESM** — We use ES modules (`"type": "module"`)
- **Prettier** — Code formatting (coming soon)
- **ESLint** — Linting with TypeScript rules

### Naming Conventions

- Files: `kebab-case.ts`
- Functions: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

## Adding a New MCP Tool

1. Create a new file in `packages/mcp/src/tools/`:

```typescript
// packages/mcp/src/tools/my-new-tool.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const MyNewToolSchema = z.object({
  // Define your parameters
});

export function registerMyNewTool(server: McpServer, api: SomeApi) {
  server.tool(
    "my_new_tool",
    "Description of what this tool does",
    MyNewToolSchema.shape,
    async (params) => {
      // Implementation
    }
  );
}
```

2. Register in `packages/mcp/src/index.ts`

3. Add tests in `packages/mcp/src/tools/my-new-tool.test.ts`

4. Update `packages/mcp/README.md` with documentation

## Testing

We use [Vitest](https://vitest.dev) for testing:

```bash
# Run all tests
npm run test

# Run tests in watch mode
cd packages/mcp && npm run test:watch

# Run specific test file
npx vitest run src/tools/get-markets.test.ts
```

### Writing Tests

- Mock external APIs (Kalshi SDK)
- Test both success and error cases
- Keep tests focused and fast

## Pull Request Guidelines

- Fill out the PR template
- Keep PRs focused on a single change
- Include tests for new functionality
- Update documentation as needed
- Add a changeset for version bumps

## Questions?

Open an issue or start a discussion on GitHub!

