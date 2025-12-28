# Kalshi TUI Roadmap

> Remaining features and phases for the Kalshi TUI.

**Last Updated:** December 26, 2025  
**Status:** Phase 1 (TUI Polish) - 70% Complete

---

## ✅ Completed (Phase 1)

| Feature | PR |
|---------|-----|
| Rate Limiting + Exponential Backoff | #34 |
| Circuit Breaker | #34 |
| Request Timeouts | #34 |
| Error Boundary | #34 |
| Order Validation | #34 |
| Historical Price Charts | #34 |
| Enhanced Orderbook (mid price, depth, imbalance) | #35 |
| Market Metrics (24h volume, open interest) | #37 |
| Keyboard Shortcuts in Footer | #29 |

---

## 🔴 Remaining (Phase 1)

### 1. Portfolio Analytics Dashboard
**Priority:** Medium | **Effort:** 3-4 days

Show comprehensive portfolio performance:
- Total P&L (realized + unrealized)
- Win rate, average trade size
- Best/worst trades
- P&L breakdown by market

### 2. Market Alerts
**Priority:** Medium | **Effort:** 2-3 days

Notify when conditions are met:
- Price crosses threshold
- Volume spike
- Position P&L threshold

### 3. Watchlists
**Priority:** Medium | **Effort:** 2 days

Save favorite markets:
- Multiple watchlists
- Quick switching
- Persist across sessions

### 4. Better Search & Filtering
**Priority:** Medium | **Effort:** 2 days

Improve market discovery:
- Fuzzy search (typo-tolerant)
- Filter by category, volume, expiry
- Search history

### 5. Loading States
**Priority:** Low | **Effort:** 1 day

Add spinners/indicators for:
- Market data fetching
- Order submission
- Balance updates

### 6. Offline Detection
**Priority:** Low | **Effort:** 1 day

Handle network issues:
- "Offline" indicator
- Last update timestamp
- Auto-reconnect

---

## Phase 2: User Validation

**Goal:** Get 10-20 active users, collect feedback

**Status:** 🔴 Not Started (blocked on Phase 1 completion)

### Launch Channels
- Reddit: r/Kalshi, r/algotrading, r/predictionmarkets
- Twitter/X: Demo video + thread
- Product Hunt
- Hacker News (Show HN)

### Success Metrics
- 50+ installs in first week
- 10+ weekly active users
- 5+ pieces of feedback

---

## Phase 3: Agent MVP

**Goal:** Simple rule-based trading automation

**Status:** 🔴 Not Started (blocked on Phase 2 validation)

### Features
1. Rule-based strategies (if price < X, buy Y)
2. Paper trading mode
3. Backtesting engine

---

## Phase 4: RL/Advanced Agents

**Goal:** Learning-based trading agents

**Status:** 🔴 Not Started (blocked on Phase 3)

### Features
1. Multi-armed bandit (market selection)
2. Q-learning (entry/exit timing)
3. Deep RL (stretch goal)

---

## Timeline

| Phase | Status | Remaining |
|-------|--------|-----------|
| Phase 1: TUI Polish | 🟡 70% | ~1 week |
| Phase 2: User Validation | 🔴 | 2 weeks |
| Phase 3: Agent MVP | 🔴 | 3 weeks |
| Phase 4: RL/Advanced | 🔴 | 8 weeks |

---

**Next Actions:**
1. Portfolio Analytics Dashboard
2. Market search/filter
3. Launch to users
