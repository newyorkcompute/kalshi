---
"@newyorkcompute/kalshi-core": patch
---

Robust WebSocket auto-reconnection with unlimited retries, capped exponential backoff, and stale connection detection

- Change `maxReconnectAttempts` default to `Infinity` for unlimited retries
- Add `maxReconnectDelay` config option (default 60s) to cap exponential backoff
- Add jitter (±25%) to reconnect delay to avoid thundering herd
- Track `lastDataReceived` timestamp on all data messages for stale detection
- Add `forceReconnect()` method for forced connection reset
- Clear pending reconnect timers on `disconnect()`
