---
"@newyorkcompute/kalshi-tui": minor
---

Add stability fixes, historical price charts, and UX improvements

Stability:
- Rate limiting with exponential backoff (2x delay on 429 errors, max 5 min)
- Circuit breaker after 5 consecutive failures
- 30-second request timeouts on all API calls
- Error boundary for graceful crash handling
- Simple TTL cache for price history (5 min cache)

Features:
- Historical price charts using asciichart library
- Charts fill full width with interpolation for smooth visualization
- Orderbook and price chart displayed simultaneously (no toggle needed)
- Shows price change %, high/low, trade count
- Rate limit status indicator in header

UX Improvements:
- Markets sorted by volume (highest first)
- Fixed expiry formatting for distant dates (shows years, "distant" for >10y)
- Volume displayed alongside expiry in market list
- Better layout: orderbook (top) + chart (bottom) in right column
