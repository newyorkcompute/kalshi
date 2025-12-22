# Kalshi API Reference

Complete endpoint documentation for the Kalshi Trade API v2.

**Base URL**: `https://api.elections.kalshi.com/trade-api/v2`

## Markets (Public)

### List Markets

```
GET /markets
```

Query parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Max results (default: 100) |
| `cursor` | string | Pagination cursor |
| `status` | string | Filter: `open`, `closed`, `settled` |
| `event_ticker` | string | Filter by event |
| `series_ticker` | string | Filter by series |
| `tickers` | string | Comma-separated market tickers |

Response:
```json
{
  "markets": [
    {
      "ticker": "KXBTC-25DEC31-B100000",
      "title": "Will Bitcoin be above $100,000 on December 31?",
      "status": "open",
      "yes_bid": 52,
      "yes_ask": 53,
      "no_bid": 47,
      "no_ask": 48,
      "volume": 125000,
      "open_interest": 50000,
      "close_time": "2025-12-31T23:59:59Z"
    }
  ],
  "cursor": "next_page_token"
}
```

### Get Market

```
GET /markets/{ticker}
```

Response:
```json
{
  "market": {
    "ticker": "KXBTC-25DEC31-B100000",
    "title": "Will Bitcoin be above $100,000 on December 31?",
    "subtitle": "Resolves Yes if BTC price exceeds $100,000",
    "status": "open",
    "yes_bid": 52,
    "yes_ask": 53,
    "no_bid": 47,
    "no_ask": 48,
    "last_price": 52,
    "volume": 125000,
    "volume_24h": 5000,
    "open_interest": 50000,
    "close_time": "2025-12-31T23:59:59Z",
    "result": null,
    "rules_primary": "Market rules description...",
    "settlement_timer_seconds": 0
  }
}
```

### Get Orderbook

```
GET /markets/{ticker}/orderbook
```

Query parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `depth` | int | Number of price levels (default: all) |

Response:
```json
{
  "orderbook": {
    "yes": [[52, 1000], [51, 2500], [50, 5000]],
    "no": [[48, 1000], [47, 2000], [46, 3000]]
  }
}
```

Format: `[[price_cents, quantity], ...]`

### Get Trades

```
GET /markets/{ticker}/trades
```

Query parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Max results |
| `cursor` | string | Pagination cursor |
| `min_ts` | int | Min timestamp (unix ms) |
| `max_ts` | int | Max timestamp (unix ms) |

Response:
```json
{
  "trades": [
    {
      "trade_id": "abc123",
      "ticker": "KXBTC-25DEC31-B100000",
      "count": 100,
      "yes_price": 52,
      "no_price": 48,
      "taker_side": "yes",
      "created_time": "2025-01-15T10:30:00Z"
    }
  ],
  "cursor": "next_page_token"
}
```

## Events (Public)

### List Events

```
GET /events
```

Query parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Max results |
| `cursor` | string | Pagination cursor |
| `status` | string | Filter: `open`, `closed` |
| `series_ticker` | string | Filter by series |
| `with_nested_markets` | bool | Include nested markets |

### Get Event

```
GET /events/{event_ticker}
```

Response:
```json
{
  "event": {
    "event_ticker": "KXBTC",
    "title": "Bitcoin Price Markets",
    "category": "Crypto",
    "markets": ["KXBTC-25DEC31-B100000", "KXBTC-25DEC31-B150000"]
  }
}
```

## Portfolio (Authenticated)

### Get Balance

```
GET /portfolio/balance
```

Response:
```json
{
  "balance": 10000,
  "payout": 500
}
```

Values in cents. `payout` is pending settlement amount.

### Get Positions

```
GET /portfolio/positions
```

Query parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `ticker` | string | Filter by market |
| `settlement_status` | string | `unsettled`, `settled` |

Response:
```json
{
  "market_positions": [
    {
      "ticker": "KXBTC-25DEC31-B100000",
      "position": 100,
      "market_exposure": 5200,
      "realized_pnl": 0,
      "total_traded": 200,
      "resting_orders_count": 2
    }
  ]
}
```

`position` > 0 = Yes contracts, < 0 = No contracts.

## Orders (Authenticated)

### List Orders

```
GET /portfolio/orders
```

Query parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `ticker` | string | Filter by market |
| `status` | string | `resting`, `canceled`, `executed` |

Response:
```json
{
  "orders": [
    {
      "order_id": "order123",
      "ticker": "KXBTC-25DEC31-B100000",
      "side": "yes",
      "action": "buy",
      "type": "limit",
      "yes_price": 50,
      "no_price": 50,
      "count": 100,
      "remaining_count": 100,
      "status": "resting",
      "created_time": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### Create Order

```
POST /portfolio/orders
```

Request body:
```json
{
  "ticker": "KXBTC-25DEC31-B100000",
  "side": "yes",
  "action": "buy",
  "type": "limit",
  "count": 100,
  "yes_price": 50
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticker` | string | Yes | Market ticker |
| `side` | string | Yes | `yes` or `no` |
| `action` | string | Yes | `buy` or `sell` |
| `type` | string | Yes | `limit` or `market` |
| `count` | int | Yes | Number of contracts |
| `yes_price` | int | For limit | Price in cents (1-99) |
| `no_price` | int | For limit | Price in cents (1-99) |
| `expiration_ts` | int | No | Order expiration (unix ms) |

Response:
```json
{
  "order": {
    "order_id": "order123",
    "ticker": "KXBTC-25DEC31-B100000",
    "status": "resting"
  }
}
```

### Cancel Order

```
DELETE /portfolio/orders/{order_id}
```

Response:
```json
{
  "order": {
    "order_id": "order123",
    "status": "canceled"
  }
}
```

## Error Responses

All errors return:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Common error codes:
| Code | Description |
|------|-------------|
| `INVALID_TICKER` | Market ticker not found |
| `INSUFFICIENT_BALANCE` | Not enough funds |
| `INVALID_PRICE` | Price outside 1-99 range |
| `MARKET_CLOSED` | Market not accepting orders |
| `INVALID_SIGNATURE` | Authentication failed |

## Rate Limits

- Public endpoints: 100 requests/minute
- Authenticated endpoints: 200 requests/minute
- Orderbook: 300 requests/minute

## WebSocket (Advanced)

For real-time data, connect to:
```
wss://api.elections.kalshi.com/trade-api/ws/v2
```

See [Kalshi WebSocket docs](https://docs.kalshi.com) for subscription details.

