# @newyorkcompute/kalshi

> Command-native tools for Kalshi prediction markets — MCP server, CLI, and more.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@newyorkcompute/kalshi-mcp`](./packages/mcp) | MCP server for AI agents | ✅ Available |
| `@newyorkcompute/kalshi-cli` | Command-line interface | 🚧 Coming soon |

## Quick Start

### MCP Server

Install and use with Claude Desktop or any MCP-compatible client:

```bash
npx @newyorkcompute/kalshi-mcp
```

Or install globally:

```bash
npm install -g @newyorkcompute/kalshi-mcp
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kalshi": {
      "command": "npx",
      "args": ["@newyorkcompute/kalshi-mcp"],
      "env": {
        "KALSHI_API_KEY": "your-api-key-id",
        "KALSHI_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
      }
    }
  }
}
```

## Authentication

The Kalshi API requires RSA-PSS authentication. You'll need:

1. **API Key ID** — Get this from your [Kalshi account settings](https://kalshi.com/account/api)
2. **Private Key** — The RSA private key (PEM format) you generated when creating your API key

Set these as environment variables:

```bash
export KALSHI_API_KEY="your-api-key-id"
export KALSHI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your key content...
-----END RSA PRIVATE KEY-----"
```

## MCP Tools

The MCP server exposes these tools:

| Tool | Description |
|------|-------------|
| `get_markets` | List and search markets with filters |
| `get_market` | Get detailed info for a specific market |
| `get_orderbook` | Get orderbook (bids/asks) for a market |

### Example Usage

Once connected to Claude Desktop, you can ask:

- "Show me the current Bitcoin prediction markets on Kalshi"
- "What's the orderbook for KXBTC-25JAN03-B100500?"
- "Get details on the market for Fed rate decisions"

## Development

This is an NX monorepo. To get started:

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build specific package
npx nx build @newyorkcompute/kalshi-mcp
```

## Requirements

- Node.js 18+
- Kalshi account with API access (US residency required)

## License

MIT © NewYorkCompute

## Links

- [Kalshi API Documentation](https://docs.kalshi.com)
- [MCP Specification](https://modelcontextprotocol.io)
- [Kalshi TypeScript SDK](https://www.npmjs.com/package/kalshi-typescript)

