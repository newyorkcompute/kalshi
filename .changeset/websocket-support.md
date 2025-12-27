---
"@newyorkcompute/kalshi-core": minor
"@newyorkcompute/kalshi-tui": minor
---

Add WebSocket support for real-time market data

**kalshi-core:**
- New `KalshiWsClient` class for WebSocket connections
- Supports `ticker`, `orderbook_delta`, `trade`, and `fill` channels
- Automatic reconnection with exponential backoff
- RSA-PSS authentication for secure connections
- Ping/pong heartbeat for connection health
- New exports: `KalshiWsClient`, `generateWsAuthHeaders`, `generateSignedWsUrl`
- 10 new unit tests for WebSocket auth and types

**kalshi-tui:**
- New `useKalshiWs` hook for React components
- Real-time ticker updates with automatic state management
- Orderbook delta handling with level updates
- Trade feed with recent trades buffer
- Easy subscription management (subscribe/unsubscribe)

