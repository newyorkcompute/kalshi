# @newyorkcompute/kalshi

[![CI](https://img.shields.io/github/actions/workflow/status/newyorkcompute/kalshi/ci.yml?branch=main&label=CI)](https://github.com/newyorkcompute/kalshi/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/newyorkcompute/kalshi/graph/badge.svg)](https://codecov.io/gh/newyorkcompute/kalshi)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NX](https://img.shields.io/badge/maintained%20with-NX-143055?logo=nx)](https://nx.dev)

> Command-native tools for Kalshi prediction markets — MCP server, Agent Skills, and more.

## Features

- 🤖 **14 MCP Tools** — Markets, events, portfolio, and order management
- 🧠 **Agent Skills** — Code-first alternative for Claude Code/API
- 📈 **Real Trading** — Place and cancel orders via AI agents
- 🔐 **Secure Auth** — RSA-PSS authentication with the official SDK
- 📡 **WebSocket** — Real-time market data streaming
- 🤑 **Market Maker** — Automated quoting bot with 5 strategies, market scanner, and risk controls
- 🌤️ **Weather Intelligence** — NWS forecast integration with probability model and fair value pricing
- 📋 **MM Compliance** — Formal Market Maker Program support (CFTC Rule 40.6(a)) with availability tracking and audit logging
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
| [`@newyorkcompute/kalshi-tui`](./packages/tui) | Terminal UI dashboard | [![npm](https://img.shields.io/npm/v/@newyorkcompute/kalshi-tui)](https://www.npmjs.com/package/@newyorkcompute/kalshi-tui) |
| [`@newyorkcompute/kalshi-core`](./packages/core) | Shared SDK utilities | [![npm](https://img.shields.io/npm/v/@newyorkcompute/kalshi-core)](https://www.npmjs.com/package/@newyorkcompute/kalshi-core) |
| [`@newyorkcompute/kalshi-weather`](./packages/weather) | Weather intelligence & fair value | [![npm](https://img.shields.io/npm/v/@newyorkcompute/kalshi-weather)](https://www.npmjs.com/package/@newyorkcompute/kalshi-weather) |
| [`@newyorkcompute/kalshi-mm`](./apps/mm) | Market maker bot | 🚧 Internal |
| [`kalshi-trading`](./skills/kalshi-trading) | Agent Skill for Claude | [![npm](https://img.shields.io/badge/npm-skill-lightgrey?logo=npm&label=skill)](https://github.com/newyorkcompute/kalshi/tree/main/skills/kalshi-trading) |

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
| `get_fills` | Get executed trade history |
| `get_settlements` | Get settlement history for resolved markets |

### Order Tools
| Tool | Description |
|------|-------------|
| `get_orders` | List your orders with filters |
| `create_order` | Place buy/sell orders ⚠️ |
| `cancel_order` | Cancel resting orders |
| `batch_cancel_orders` | Cancel multiple orders at once |

### Example Prompts

> "Show me the current Bitcoin prediction markets on Kalshi"

> "What's my balance and current positions?"

> "Buy 10 YES contracts at 45 cents on KXBTC-25JAN03-B100500"

> "Cancel my open order xyz-123"

## Market Maker Bot

The market maker bot (`apps/mm`) is an automated quoting engine with configurable strategies, dynamic market scanning, and risk controls.

### Strategies

| Strategy | Description |
|----------|-------------|
| `symmetric` | Balanced bid/ask quoting around mid with inventory skew |
| `optimism-tax` | Zone-based directional strategy exploiting retail optimism bias in tail regions |
| `adaptive` | Dynamically adjusts spread and size based on volatility and orderbook imbalance |
| `avellaneda-stoikov` | Academic market-making model with time-decay and inventory penalization |
| `weather-informed` | Uses NWS forecasts to compute fair value for weather markets |

### Key Components

- **Market Scanner** — Automatically discovers and ranks tradeable markets by volume, spread, and category
- **Adverse Selection Detector** — Flags toxic flow from consecutive fills + price moves, widens quotes defensively
- **Risk Controls** — Position limits, exposure caps, daily loss limits, drawdown-based scaling, and circuit breaker
- **WebSocket Orderbook** — Real-time local orderbook with microprice and imbalance signals
- **HTTP Control Plane** — REST API for monitoring bot state, adding/removing markets, and viewing P&L

### Formal Market Maker Program (Compliance)

For participants in Kalshi's 2025 Market Maker Program, the bot includes a compliance layer that can be enabled via config:

- **Compliance Enforcer** — Guarantees two-sided quoting at minimum depth and maximum spread for Covered Products
- **Availability Tracker** — Rolling 1-hour window uptime tracking targeting 98% per product
- **Audit Logger** — Structured JSONL trail of all quote decisions, fills, and compliance events
- **Self-Trade Guard** — Pre-placement check preventing self-crossing
- **10x Position Accountability** — Elevated position limits for MM-designated products (Rule 4.5(a))

Enable with `compliance.formalMarketMaker: true` in your config. See [`config.example-formal-mm.yaml`](./apps/mm/config.example-formal-mm.yaml) for a full example.

---

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
├── apps/
│   └── mm/                  # Market maker bot
│       └── src/
│           ├── daemon/      # Bot lifecycle and quote pipeline
│           ├── strategies/  # Quoting strategies (symmetric, optimism-tax, adaptive, avellaneda, weather-informed)
│           ├── compliance/  # Formal MM Program compliance (enforcer, availability, audit, self-trade guard)
│           ├── scanner/     # Dynamic market discovery and ranking
│           ├── weather/     # NWS weather service integration
│           ├── dashboard/   # Terminal dashboard
│           └── api/         # HTTP control plane
├── packages/
│   ├── core/                # @newyorkcompute/kalshi-core
│   │   └── src/
│   │       ├── config.ts    # SDK configuration
│   │       ├── format.ts    # Formatting utilities
│   │       ├── mm/          # Market making primitives (orders, risk, inventory, orderbook)
│   │       └── websocket/   # WebSocket client
│   ├── mcp/                 # @newyorkcompute/kalshi-mcp
│   │   └── src/
│   │       ├── index.ts     # MCP server entry
│   │       └── tools/       # 14 tool implementations
│   ├── tui/                 # @newyorkcompute/kalshi-tui
│   │   └── src/
│   │       ├── cli.tsx      # CLI entry point
│   │       ├── App.tsx      # Main application
│   │       └── components/  # UI components
│   └── weather/             # @newyorkcompute/kalshi-weather
│       └── src/
│           ├── fair-value.ts       # Fair value calculation
│           ├── probability-model.ts # Weather probability model
│           ├── ticker-parser.ts    # Kalshi weather ticker parsing
│           └── nws-client.ts       # NWS forecast API client
├── skills/
│   └── kalshi-trading/      # Agent Skill
│       ├── SKILL.md
│       └── scripts/
├── nx.json                  # NX configuration
├── package.json             # Root workspace
└── tsconfig.base.json       # Shared TypeScript config
```

## Requirements

- Node.js 22+ (LTS)
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
