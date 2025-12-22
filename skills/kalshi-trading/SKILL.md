---
name: kalshi-trading
description: Trade on Kalshi prediction markets. Use when user wants to check markets, analyze odds, view positions, place orders, or research prediction market opportunities. Kalshi is a regulated exchange for event contracts.
---

# Kalshi Trading

Trade on [Kalshi](https://kalshi.com), a CFTC-regulated prediction market exchange. This skill enables you to query markets, analyze probabilities, manage positions, and execute trades.

## Quick Start

```python
import requests
import time
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

# See AUTHENTICATION.md for full setup
API_BASE = "https://api.elections.kalshi.com/trade-api/v2"

def get_headers(api_key: str, private_key_pem: str, method: str, path: str) -> dict:
    """Generate authenticated headers for Kalshi API."""
    timestamp = str(int(time.time() * 1000))
    message = f"{timestamp}{method}{path}"
    
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode(), password=None
    )
    signature = private_key.sign(
        message.encode(),
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    
    return {
        "KALSHI-ACCESS-KEY": api_key,
        "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode(),
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "Content-Type": "application/json"
    }
```

## Common Operations

### Search Markets

```python
def search_markets(query: str, limit: int = 10) -> list:
    """Search for markets by keyword."""
    response = requests.get(
        f"{API_BASE}/markets",
        params={"status": "open", "limit": limit}
    )
    markets = response.json().get("markets", [])
    # Filter by query in title
    return [m for m in markets if query.lower() in m.get("title", "").lower()]
```

### Get Market Details

```python
def get_market(ticker: str) -> dict:
    """Get details for a specific market."""
    response = requests.get(f"{API_BASE}/markets/{ticker}")
    return response.json().get("market", {})
```

### Get Orderbook

```python
def get_orderbook(ticker: str) -> dict:
    """Get the orderbook for a market."""
    response = requests.get(f"{API_BASE}/markets/{ticker}/orderbook")
    return response.json().get("orderbook", {})
```

### Check Balance (Authenticated)

```python
def get_balance(api_key: str, private_key_pem: str) -> dict:
    """Get account balance."""
    path = "/portfolio/balance"
    headers = get_headers(api_key, private_key_pem, "GET", path)
    response = requests.get(f"{API_BASE}{path}", headers=headers)
    return response.json()
```

### Get Positions (Authenticated)

```python
def get_positions(api_key: str, private_key_pem: str) -> list:
    """Get current market positions."""
    path = "/portfolio/positions"
    headers = get_headers(api_key, private_key_pem, "GET", path)
    response = requests.get(f"{API_BASE}{path}", headers=headers)
    return response.json().get("market_positions", [])
```

### Place Order (Authenticated)

```python
def place_order(
    api_key: str,
    private_key_pem: str,
    ticker: str,
    side: str,  # "yes" or "no"
    action: str,  # "buy" or "sell"
    count: int,
    price: int  # In cents (1-99)
) -> dict:
    """Place a limit order."""
    path = "/portfolio/orders"
    headers = get_headers(api_key, private_key_pem, "POST", path)
    
    payload = {
        "ticker": ticker,
        "side": side,
        "action": action,
        "count": count,
        "type": "limit",
        "yes_price": price if side == "yes" else None,
        "no_price": price if side == "no" else None
    }
    
    response = requests.post(
        f"{API_BASE}{path}",
        headers=headers,
        json=payload
    )
    return response.json()
```

## Key Concepts

- **Markets**: Event contracts with Yes/No outcomes (e.g., "Will X happen by Y date?")
- **Prices**: Quoted in cents (1-99), representing probability percentage
- **Positions**: Your holdings in Yes or No contracts
- **Settlement**: Markets resolve to $1.00 (Yes wins) or $0.00 (No wins)

## Additional Resources

- [AUTHENTICATION.md](AUTHENTICATION.md) - Detailed API key setup
- [API_REFERENCE.md](API_REFERENCE.md) - Full endpoint documentation
- [scripts/kalshi_client.py](scripts/kalshi_client.py) - Ready-to-use helper functions

## Tips

1. **Start with market research**: Use `search_markets()` to explore opportunities
2. **Check liquidity**: Review orderbook depth before placing large orders
3. **Use limit orders**: Avoid market orders to control execution price
4. **Monitor positions**: Regularly check your positions and P&L

