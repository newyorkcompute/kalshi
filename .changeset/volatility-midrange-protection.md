---
"@newyorkcompute/kalshi-mm": minor
---

Add volatility-aware mid-range protection to prevent adverse selection on live events

- Track rolling mid-price window per market to detect volatile (live event) markets
- Volatile mid-range: suppress new position entry, allow flattening only
- Stable mid-range: continue normal two-sided spread capture
- Fix spread-crossing check for one-sided quotes (latent bug)
- Boost scanner longshot bonus to 30% (tails are 20x more profitable per Becker research)
- Add scanner guards against failed/partial scans removing existing markets
