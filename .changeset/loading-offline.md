---
"@newyorkcompute/kalshi-tui": patch
---

Add loading indicators and offline detection

- Add animated Spinner component with braille frames
- Show spinner during initial data loading
- Show refresh indicator (↻) when updating in background
- Detect network errors and show offline status (⊘)
- Display last update timestamp ("30s ago")
- Auto-retry when connection is restored
