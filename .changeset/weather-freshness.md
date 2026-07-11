---
"@newyorkcompute/kalshi-weather": minor
---

Observation-aware fair values and faster refresh support

- Add NWS station observation fetching for same-day running max/min extremes
- Add observation-conditioned probability helpers and fair-value integration
- Export `isSameDayMarket` and observation-aware probability functions
- Default forecast refresh interval reduced from 30 to 10 minutes (configurable)
