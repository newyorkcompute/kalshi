# @newyorkcompute/kalshi-mcp

[![npm version](https://img.shields.io/npm/v/@newyorkcompute/kalshi-mcp)](https://www.npmjs.com/package/@newyorkcompute/kalshi-mcp)
[![license](https://img.shields.io/npm/l/@newyorkcompute/kalshi-mcp)](https://github.com/newyorkcompute/kalshi/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/newyorkcompute/kalshi/ci.yml?branch=main&label=CI)](https://github.com/newyorkcompute/kalshi/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@newyorkcompute/kalshi-mcp)](https://www.npmjs.com/package/@newyorkcompute/kalshi-mcp)

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

### Market Tools

#### `get_markets`

List and search Kalshi prediction markets.

**Parameters:**
- `limit` (optional): Maximum markets to return (1-1000)
- `cursor` (optional): Pagination cursor
- `event_ticker` (optional): Filter by event ticker
- `series_ticker` (optional): Filter by series ticker
- `status` (optional): Filter by status (`open`, `closed`, `settled`)
- `tickers` (optional): Comma-separated list of specific tickers

#### `get_market`

Get detailed information about a specific market.

**Parameters:**
- `ticker` (required): Market ticker (e.g., `KXBTC-25JAN03-B100500`)

#### `get_orderbook`

Get the orderbook for a market.

**Parameters:**
- `ticker` (required): Market ticker
- `depth` (optional): Number of price levels (1-100)

#### `get_trades`

Get recent trades on markets.

**Parameters:**
- `ticker` (optional): Filter by market ticker
- `limit` (optional): Number of trades to return (1-1000)
- `cursor` (optional): Pagination cursor
- `min_ts` (optional): Filter trades after this Unix timestamp
- `max_ts` (optional): Filter trades before this Unix timestamp

### Event Tools

#### `get_events`

List Kalshi events. Events contain one or more markets.

**Parameters:**
- `limit` (optional): Number of events to return (1-200)
- `cursor` (optional): Pagination cursor
- `status` (optional): Filter by status (`open`, `closed`, `settled`)
- `series_ticker` (optional): Filter by series ticker
- `with_nested_markets` (optional): Include markets in response

#### `get_event`

Get detailed information about a specific event.

**Parameters:**
- `event_ticker` (required): Event ticker (e.g., `KXBTC`)
- `with_nested_markets` (optional): Include markets in response

### Portfolio Tools

#### `get_balance`

Get your account balance and portfolio value.

**Parameters:** None

**Returns:** Balance in dollars and cents, portfolio value.

#### `get_positions`

Get your current positions on markets.

**Parameters:**
- `limit` (optional): Number of positions to return (1-100)
- `cursor` (optional): Pagination cursor
- `ticker` (optional): Filter by market ticker
- `event_ticker` (optional): Filter by event ticker
- `count_filter` (optional): Filter by `position` or `total_traded`

### Order Tools

#### `get_orders`

Get your orders on Kalshi.

**Parameters:**
- `ticker` (optional): Filter by market ticker
- `event_ticker` (optional): Filter by event ticker
- `status` (optional): Filter by status (`resting`, `canceled`, `executed`)
- `limit` (optional): Number of orders to return (1-200)
- `cursor` (optional): Pagination cursor
- `min_ts` (optional): Filter after Unix timestamp
- `max_ts` (optional): Filter before Unix timestamp

#### `create_order`

Place a new order on a market. **⚠️ This executes real trades!**

**Parameters:**
- `ticker` (required): Market ticker
- `side` (required): `yes` or `no`
- `action` (required): `buy` or `sell`
- `count` (required): Number of contracts
- `type` (optional): `limit` or `market` (default: limit)
- `yes_price` (optional): Price in cents (1-99) for yes orders
- `no_price` (optional): Price in cents (1-99) for no orders
- `client_order_id` (optional): Your order ID for idempotency
- `expiration_ts` (optional): Unix timestamp when order expires

#### `cancel_order`

Cancel an existing order.

**Parameters:**
- `order_id` (required): The order ID to cancel

## Example Conversations

> "What prediction markets are available for Bitcoin on Kalshi?"

> "Show me the orderbook for the KXBTC-25JAN03-B100500 market"

> "What's my current balance and positions?"

> "Buy 10 contracts of YES at 45 cents on KXBTC-25JAN03-B100500"

> "What are my open orders? Cancel order xyz-123"

## Requirements

- Node.js 18+
- Kalshi account with API access
- RSA key pair for API authentication

## Getting API Keys

1. Log into your [Kalshi account](https://kalshi.com)
2. Go to Account Settings → API
3. Generate a new API key (you'll create an RSA key pair)
4. Save your API Key ID and private key securely

## Links

- [GitHub](https://github.com/newyorkcompute/kalshi)
- [npm](https://www.npmjs.com/package/@newyorkcompute/kalshi-mcp)
- [Kalshi API Docs](https://docs.kalshi.com)
- [MCP Protocol](https://modelcontextprotocol.io)

## License

MIT © [NewYorkCompute](https://github.com/newyorkcompute)
