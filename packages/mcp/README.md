# @newyorkcompute/kalshi-mcp

MCP (Model Context Protocol) server for Kalshi prediction markets — enables AI agents to interact with Kalshi.

## Installation

```bash
npx @newyorkcompute/kalshi-mcp
```

Or install globally:

```bash
npm install -g @newyorkcompute/kalshi-mcp
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KALSHI_API_KEY` | Yes | Your Kalshi API key ID |
| `KALSHI_PRIVATE_KEY` | Yes | RSA private key (PEM format) |
| `KALSHI_BASE_PATH` | No | API base URL (default: production) |

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Cursor IDE

Add to your MCP configuration:

```json
{
  "kalshi": {
    "command": "npx",
    "args": ["@newyorkcompute/kalshi-mcp"],
    "env": {
      "KALSHI_API_KEY": "your-api-key-id",
      "KALSHI_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
    }
  }
}
```

## Tools

### `get_markets`

List and search Kalshi prediction markets.

**Parameters:**
- `limit` (optional): Maximum markets to return (1-1000)
- `cursor` (optional): Pagination cursor
- `event_ticker` (optional): Filter by event ticker
- `series_ticker` (optional): Filter by series ticker
- `status` (optional): Filter by status (`open`, `closed`, `settled`)
- `tickers` (optional): Comma-separated list of specific tickers

### `get_market`

Get detailed information about a specific market.

**Parameters:**
- `ticker` (required): Market ticker (e.g., `KXBTC-25JAN03-B100500`)

### `get_orderbook`

Get the orderbook for a market.

**Parameters:**
- `ticker` (required): Market ticker
- `depth` (optional): Number of price levels (1-100)

## Example Conversations

> "What prediction markets are available for Bitcoin on Kalshi?"

> "Show me the orderbook for the KXBTC-25JAN03-B100500 market"

> "What's the current price and volume for Fed rate decision markets?"

## Requirements

- Node.js 18+
- Kalshi account with API access
- RSA key pair for API authentication

## Getting API Keys

1. Log into your [Kalshi account](https://kalshi.com)
2. Go to Account Settings → API
3. Generate a new API key (you'll create an RSA key pair)
4. Save your API Key ID and private key securely

## License

MIT © NewYorkCompute

