---
"@newyorkcompute/kalshi-core": minor
---

Add elite MM improvements: inventory skew, local orderbook, atomic quote updates

- **Inventory Skew**: Adaptive strategy now skews quotes based on inventory (Avellaneda-Stoikov style)
- **LocalOrderbook**: New class to maintain orderbook from WebSocket snapshots/deltas
- **OrderbookManager**: Manages multiple LocalOrderbook instances
- **Microprice**: Size-weighted mid price calculation for better fair value
- **Atomic Updates**: Place new orders before canceling old ones (no naked periods)
- **Latency Tracking**: Track quote update latencies with percentile stats
