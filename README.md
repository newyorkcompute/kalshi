# @newyorkcompute/kalshi

[![CI](https://img.shields.io/github/actions/workflow/status/newyorkcompute/kalshi/ci.yml?branch=main&label=CI)](https://github.com/newyorkcompute/kalshi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NX](https://img.shields.io/badge/maintained%20with-NX-143055?logo=nx)](https://nx.dev)

> Command-native tools for Kalshi prediction markets — MCP server, Agent Skills, and more.

## Features

- 🤖 **11 MCP Tools** — Markets, events, portfolio, and order management
- 🧠 **Agent Skills** — Code-first alternative for Claude Code/API
- 📈 **Real Trading** — Place and cancel orders via AI agents
- 🔐 **Secure Auth** — RSA-PSS authentication with the official SDK
- ⚡ **TypeScript** — Fully typed, modern ESM package
- 📦 **NX Monorepo** — Scalable, cacheable builds

## Choose Your Approach

| Approach | Best For | How It Works |
|----------|----------|--------------|
| **MCP Server** | Structured tool access | Run server process, AI calls tools |
| **Agent Skills** | Code-first workflows | AI reads instructions, writes code directly |

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@newyorkcompute/kalshi-mcp`](./packages/mcp) | MCP server for AI agents | [![npm](https://img.shields.io/npm/v/@newyorkcompute/kalshi-mcp)](https://www.npmjs.com/package/@newyorkcompute/kalshi-mcp) |
| [`@newyorkcompute/kalshi-tui`](./packages/tui) | Terminal UI dashboard | ✅ Available |
| [`@newyorkcompute/kalshi-core`](./packages/core) | Shared SDK utilities | ✅ Available |
| [`kalshi-trading`](./skills/kalshi-trading) | Agent Skill for Claude | ✅ Available |

## Quick Start

### Terminal UI (TUI)

```bash
npx @newyorkcompute/kalshi-tui
```

A beautiful terminal dashboard with real-time market data, orderbook visualization, and trading.

### MCP Server

```bash
npx @newyorkcompute/kalshi-mcp
```

Or install globally:

```bash
npm install -g @newyorkcompute/kalshi-mcp
```

### Claude Code

Add the MCP server using the CLI ([docs](https://code.claude.com/docs/en/mcp)):

```bash
claude mcp add --transport stdio kalshi \
  --env KALSHI_API_KEY=your-api-key-id \
  --env KALSHI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..." \
  -- npx -y @newyorkcompute/kalshi-mcp
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "kalshi": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@newyorkcompute/kalshi-mcp"],
      "env": {
        "KALSHI_API_KEY": "your-api-key-id",
        "KALSHI_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kalshi": {
      "command": "npx",
      "args": ["-y", "@newyorkcompute/kalshi-mcp"],
      "env": {
        "KALSHI_API_KEY": "your-api-key-id",
        "KALSHI_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
      }
    }
  }
}
```

### Cursor IDE

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "kalshi": {
      "command": "npx",
      "args": ["-y", "@newyorkcompute/kalshi-mcp"],
      "env": {
        "KALSHI_API_KEY": "your-api-key-id",
        "KALSHI_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
      }
    }
  }
}
```

> **Tip:** Use `-y` flag with npx to skip confirmation prompts.

---

## Agent Skills (Alternative to MCP)

Agent Skills let Claude write and execute code directly against the Kalshi API — no MCP server needed.

### Claude Code

```bash
# Personal (available in all projects)
cp -r skills/kalshi-trading ~/.claude/skills/

# Or project-specific
cp -r skills/kalshi-trading .claude/skills/
```

### Claude.ai

1. Download the `skills/kalshi-trading` folder as a zip
2. Go to **Settings** → **Features** → **Upload Skill**
3. Upload the zip file

### What's Included

| File | Purpose |
|------|---------|
| `SKILL.md` | Main instructions and quick start |
| `AUTHENTICATION.md` | API key setup guide |
| `API_REFERENCE.md` | Full endpoint documentation |
| `scripts/kalshi-client.ts` | Ready-to-use TypeScript client |

### Example Usage

Once installed, just ask Claude:

> "Search for markets about Bitcoin on Kalshi"

> "Show me my Kalshi portfolio balance and positions"

> "Place a limit order for 10 YES contracts at 45 cents"

Claude will use the Skill's instructions to write and execute the appropriate code.

---

## MCP Tools

### Market Tools
| Tool | Description |
|------|-------------|
| `get_markets` | List and search markets with filters |
| `get_market` | Get detailed info for a specific market |
| `get_orderbook` | Get orderbook (bids/asks) for a market |
| `get_trades` | Get recent trades on markets |

### Event Tools
| Tool | Description |
|------|-------------|
| `get_events` | List events with filters |
| `get_event` | Get detailed event information |

### Portfolio Tools
| Tool | Description |
|------|-------------|
| `get_balance` | Get account balance and portfolio value |
| `get_positions` | Get current positions on markets |

### Order Tools
| Tool | Description |
|------|-------------|
| `get_orders` | List your orders with filters |
| `create_order` | Place buy/sell orders ⚠️ |
| `cancel_order` | Cancel resting orders |

### Example Prompts

> "Show me the current Bitcoin prediction markets on Kalshi"

> "What's my balance and current positions?"

> "Buy 10 YES contracts at 45 cents on KXBTC-25JAN03-B100500"

> "Cancel my open order xyz-123"

## Authentication

The Kalshi API requires RSA-PSS authentication:

1. **API Key ID** — Get from [Kalshi account settings](https://kalshi.com/account/api)
2. **Private Key** — RSA private key (PEM format) from API key generation

```bash
export KALSHI_API_KEY="your-api-key-id"
export KALSHI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your key content...
-----END RSA PRIVATE KEY-----"
```

## Development

This is an [NX](https://nx.dev) monorepo with TypeScript packages.

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint

# Build specific package
npx nx build @newyorkcompute/kalshi-mcp
```

### Project Structure

```
kalshi/
├── packages/
│   ├── core/                # @newyorkcompute/kalshi-core
│   │   └── src/
│   │       ├── config.ts    # SDK configuration
│   │       ├── format.ts    # Formatting utilities
│   │       └── types.ts     # Type re-exports
│   ├── mcp/                 # @newyorkcompute/kalshi-mcp
│   │   └── src/
│   │       ├── index.ts     # MCP server entry
│   │       └── tools/       # Tool implementations
│   └── tui/                 # @newyorkcompute/kalshi-tui
│       └── src/
│           ├── cli.tsx      # CLI entry point
│           ├── App.tsx      # Main application
│           └── components/  # UI components
├── skills/
│   └── kalshi-trading/      # Agent Skill
│       ├── SKILL.md
│       └── scripts/
├── nx.json                  # NX configuration
├── package.json             # Root workspace
└── tsconfig.base.json       # Shared TypeScript config
```

## Requirements

- Node.js 18+
- Kalshi account with API access

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT © [NewYorkCompute](https://github.com/newyorkcompute)

## Links

- [Kalshi API Documentation](https://docs.kalshi.com)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Kalshi TypeScript SDK](https://www.npmjs.com/package/kalshi-typescript)
- [NX](https://nx.dev)
