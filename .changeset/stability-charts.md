---
"@newyorkcompute/kalshi-tui": minor
---

Add stability fixes and historical price charts

Stability:
- Rate limiting with exponential backoff (2x delay on 429 errors, max 5 min)
- Circuit breaker after 5 consecutive failures
- 30-second request timeouts on all API calls
- Error boundary for graceful crash handling

Features:
- Historical price charts using asciichart library
- Toggle between orderbook and chart with 'c' key
- Shows VWAP, price change %, high/low, trade count
- Rate limit status indicator in header

