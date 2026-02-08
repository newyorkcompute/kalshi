---
"@newyorkcompute/kalshi-mm": minor
---

Bot resilience: connection health monitoring, pinned markets, esports category detection, and tightened risk controls

### Connection Health Monitor
- Auto-cancel all resting orders on WebSocket disconnect (safety)
- Detect stale connections (no data for 2+ minutes) and force reconnect
- Force full reconnect if disconnected for 5+ minutes
- Sync positions after reconnection to catch missed fills
- Expose `connectionHealth` in bot state API

### Pinned Markets
- Markets added via API (`POST /markets/:ticker`) are now "pinned"
- Scanner will never remove pinned markets during periodic rescans
- Pinned status cleared when market is explicitly removed

### Esports Category Detection
- Add Esports as a new category (CS2, Valorant, LoL, Dota, Overwatch, etc.)
- Esports weighted at 0.30 (lower than Sports 0.55) — less casual bettor participation means less optimism-tax edge
- Add ATP/WTA tennis ticker prefix detection

### Scanner Improvements
- Implement `preferredCategories` filter in market scanner
- When set, only markets matching preferred category labels pass pre-filter

### Risk Controls (config)
- `maxPositionPerMarket`: 30 → 15 (prevents oversized single-market bets)
- `maxOrderSize`: 5 → 3 (slower, safer accumulation)
- `sizePerSide`: 5 → 3
- `maxLongshotExposure`: 250 → 100
- `maxTotalExposure`: 500 → 300
