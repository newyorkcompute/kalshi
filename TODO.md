# Kalshi — Project Plan

> Command-native tools for Kalshi prediction markets — MCP server, CLI, and more.

---

## Overview

This is an NX monorepo for open-source Kalshi developer tools, published under the `@newyorkcompute` npm scope.

**Goal:** Become the de-facto developer toolkit for Kalshi, targeting quantitative teams, trading desks, and AI agent builders.

---

## Package Structure

```
kalshi/
├── packages/
│   ├── mcp/           # @newyorkcompute/kalshi-mcp
│   ├── cli/           # @newyorkcompute/kalshi-cli
│   └── core/          # @newyorkcompute/kalshi-core (shared utilities)
├── nx.json
├── package.json
├── tsconfig.base.json
├── README.md
└── LICENSE            # MIT
```

---

## Packages

### 1. `@newyorkcompute/kalshi-mcp`

MCP (Model Context Protocol) server for AI agents to interact with Kalshi.

**Priority:** HIGH — Ship first

**Tools to implement:**

| Tool | Description | Priority |
|------|-------------|----------|
| `get_markets` | List/search markets with filters | P0 |
| `get_market` | Get single market details | P0 |
| `get_orderbook` | Get orderbook for a market | P0 |
| `get_trades` | Get recent trades | P1 |
| `get_events` | List events | P1 |
| `get_event` | Get event details | P1 |
| `get_series` | Get series info | P2 |
| `get_balance` | Get account balance | P1 |
| `get_positions` | Get current positions | P1 |
| `get_portfolio` | Get portfolio summary | P1 |
| `create_order` | Place an order | P1 |
| `cancel_order` | Cancel an order | P1 |
| `get_orders` | List user's orders | P1 |
| `get_fills` | Get fill history | P2 |

**Resources to implement:**

| Resource | Description | Priority |
|----------|-------------|----------|
| `kalshi://markets` | Live market listing | P2 |
| `kalshi://portfolio` | Portfolio state | P2 |

**Tech stack:**
- TypeScript
- `@modelcontextprotocol/sdk` — MCP SDK
- Official Kalshi TypeScript SDK (or raw API calls)
- Zod for schema validation

**Reference:**
- Kalshi API docs: https://docs.kalshi.com
- Kalshi TS SDK: https://docs.kalshi.com/sdks/overview
- MCP spec: https://modelcontextprotocol.io

---

### 2. `@newyorkcompute/kalshi-cli`

Command-line interface for Kalshi trading and market data.

**Priority:** MEDIUM — Ship second

**Commands to implement:**

```bash
# Market data
kalshi markets                    # List markets
kalshi markets --search "bitcoin" # Search markets
kalshi market <ticker>            # Get market details
kalshi orderbook <ticker>         # Show orderbook
kalshi watch <ticker>             # Real-time price stream

# Trading
kalshi buy <ticker> <qty> <price>   # Place buy order
kalshi sell <ticker> <qty> <price>  # Place sell order
kalshi orders                       # List open orders
kalshi cancel <order_id>            # Cancel order

# Portfolio
kalshi balance                    # Show balance
kalshi positions                  # Show positions
kalshi portfolio                  # Portfolio summary
kalshi history                    # Trade history

# Config
kalshi login                      # Configure API keys
kalshi config                     # Show/edit config
kalshi logout                     # Clear credentials
```

**Tech stack:**
- TypeScript
- `commander` or `yargs` — CLI framework
- `chalk` — Colors
- `ora` — Spinners
- `cli-table3` — Tables
- `conf` — Config storage (for API keys)
- `inquirer` — Interactive prompts

---

### 3. `@newyorkcompute/kalshi-core`

Shared utilities and types used by MCP and CLI packages.

**Priority:** HIGH — Build alongside MCP

**Contents:**
- TypeScript types for Kalshi API responses
- API client wrapper (if not using official SDK directly)
- Authentication helpers (RSA-PSS signing)
- Common utilities (formatting, validation)
- Error types

---

## Technical Decisions

### Use Official Kalshi SDK?

**Option A:** Use official Kalshi TypeScript SDK
- Pros: Maintained by Kalshi, full coverage
- Cons: Another dependency, may not expose everything we need

**Option B:** Build thin wrapper over REST API
- Pros: Full control, lighter
- Cons: More maintenance

**Recommendation:** Start with official SDK, wrap if needed in `core` package.

### Authentication

Kalshi uses RSA-PSS signing for API authentication:
1. User provides API key ID + private key file
2. Each request is signed with timestamp
3. Official SDK handles this automatically

For CLI: Store credentials securely using `conf` with encryption or system keychain.
For MCP: Accept credentials via environment variables or config.

---

## Publishing

### npm Scope

Publish under `@newyorkcompute` scope:
- `@newyorkcompute/kalshi-mcp`
- `@newyorkcompute/kalshi-cli`
- `@newyorkcompute/kalshi-core`

### Versioning

Use semantic versioning. Consider using Changesets or NX release for coordinated releases.

### CI/CD

- GitHub Actions for CI
- Auto-publish on tag/release
- Run tests, lint, build before publish

---

## Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Set up NX monorepo
- [ ] Create `core` package with types
- [ ] Create `mcp` package skeleton
- [ ] Implement read-only MCP tools (markets, orderbook)
- [ ] Basic README and documentation

### Phase 2: MCP Complete (Week 2)
- [ ] Implement portfolio/balance tools
- [ ] Implement trading tools (create/cancel order)
- [ ] Add authentication handling
- [ ] Publish `@newyorkcompute/kalshi-mcp` v0.1.0
- [ ] Submit to MCP registries (Smithery, etc.)

### Phase 3: CLI (Week 3-4)
- [ ] Create `cli` package
- [ ] Implement market data commands
- [ ] Implement trading commands
- [ ] Implement portfolio commands
- [ ] Credential management
- [ ] Publish `@newyorkcompute/kalshi-cli` v0.1.0

### Phase 4: Polish (Ongoing)
- [ ] Comprehensive documentation
- [ ] Example scripts/recipes
- [ ] WebSocket support for real-time data
- [ ] TUI dashboard (stretch goal)

---

## Competitive Landscape

Existing projects (for reference, not to copy):
- `kalashdotai/mcp` — Kalshi MCP with whale tracking
- `JamesANZ/prediction-market-mcp` — Multi-platform MCP
- `kalshi-js-sdk` on npm — Community JS SDK

**Differentiation:**
- Institutional-grade, not hobby project
- Full trading capabilities (not just read-only)
- CLI as first-class citizen
- NewYorkCompute brand recognition

---

## Resources

- **Kalshi API Docs:** https://docs.kalshi.com
- **Kalshi SDK Overview:** https://docs.kalshi.com/sdks/overview
- **MCP Specification:** https://modelcontextprotocol.io
- **MCP TypeScript SDK:** https://github.com/modelcontextprotocol/typescript-sdk
- **NX Documentation:** https://nx.dev

---

## Notes

- Kalshi requires US residency for trading accounts
- API has rate limits — implement proper backoff
- WebSocket available for real-time market data
- RSA-PSS authentication is required (not simple API keys)

---

Good luck! 🚀

