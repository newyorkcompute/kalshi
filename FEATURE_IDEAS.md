# Feature Ideas

> Consumer-focused feature ideas for the Kalshi toolkit, based on prediction market trends and user research.
>
> Last Updated: December 27, 2025

---

## Context: Market Trends (Dec 2025)

Based on Twitter/X research, prediction markets are seeing interest in:

- **Arbitrage detection** - Finding mispricing opportunities
- **Autonomous agents** - AI-powered trading bots
- **Copy trading** - Following successful traders
- **Cross-platform arbitrage** - Kalshi vs Polymarket vs PredictIt
- **Microstructure trading** - High-frequency inefficiency exploitation

Notable examples:
- RN1 trader: $1K → $2M via microstructure arbitrage on Polymarket
- Polymarket/agents: Open-source agent framework
- Multiple threads on 6+ types of prediction market arbitrage

---

## Priority Matrix

```
                    Value to Consumer
                           ↑
    High │  ┌─────────────────────────────────┐
         │  │ 1. ARBITRAGE      2. TRADING    │
         │  │    SCANNER           (orders)   │
         │  └─────────────────────────────────┘
         │  ┌─────────────────────────────────┐
    Med  │  │ 3. EVENT VIEW    4. REAL-TIME   │
         │  │    (grouped)        (WebSocket) │
         │  └─────────────────────────────────┘
         │  ┌─────────────────────────────────┐
    Low  │  │ 5. PAPER         6. PORTFOLIO   │
         │  │    TRADING          ANALYTICS   │
         │  └─────────────────────────────────┘
         └────────────────────────────────────→
               Easy                    Hard
                    Implementation Effort
```

---

## 1. Arbitrage Scanner ⭐ RECOMMENDED

**Value:** High | **Effort:** Medium | **Differentiator:** Yes

### What It Does

Automatically detects mispricing opportunities across Kalshi markets.

### Types of Arbitrage

#### Single-Market Arbitrage
- **Condition:** `YES_ask + NO_ask < 100¢`
- **Action:** Buy both YES and NO
- **Result:** Guaranteed profit (one side always wins $1)
- **Example:** YES at 47¢ + NO at 51¢ = 98¢ → profit 2¢

#### Multi-Outcome Arbitrage
- **Condition:** Sum of all YES prices in an event < $1
- **Action:** Buy YES on all outcomes
- **Result:** Exactly one outcome wins, pays $1
- **Example:** Election with 4 candidates at 32¢ + 28¢ + 22¢ + 12¢ = 94¢ → profit 6¢

### UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  💰 ARBITRAGE OPPORTUNITIES                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🟢 SINGLE-MARKET ARBS (YES + NO < 100)                     │
│  ─────────────────────────────────────                      │
│  KXBTC-25JAN03-B100500   YES: 47¢  NO: 51¢  = 98¢  +2¢ 🔥  │
│  INXD-25JAN03-B19500     YES: 44¢  NO: 54¢  = 98¢  +2¢ 🔥  │
│                                                             │
│  🟢 MULTI-OUTCOME ARBS (Sum < $1)                           │
│  ─────────────────────────────────                          │
│  EVENT: "Who wins 2028 election?"                           │
│  ├─ Trump:    32¢                                           │
│  ├─ DeSantis: 28¢                                           │
│  ├─ Newsom:   22¢                                           │
│  └─ Other:    12¢                                           │
│      TOTAL:   94¢  → Buy all = +6¢ guaranteed profit 🔥     │
│                                                             │
│  [a] Auto-refresh  [e] Event detail  [t] Execute trade      │
└─────────────────────────────────────────────────────────────┘
```

### Technical Approach

1. Fetch all open markets via `getMarkets()`
2. For each market, check if `yes_ask + no_ask < 100`
3. Group markets by `event_ticker`
4. For each event, sum all `yes_ask` prices
5. Flag if sum < 100
6. Display opportunities sorted by profit potential

### Why This First?

- **Unique:** Few tools do this for Kalshi
- **Tangible value:** Directly makes users money
- **Shareable:** "The tool that finds free money" → Twitter virality
- **Read-only safe:** No risk of accidental trades
- **Foundation:** Event grouping enables other features

---

## 2. Trading in TUI

**Value:** High | **Effort:** Medium | **Differentiator:** No (expected feature)

### Current State

- TUI is **read-only** (view markets, orderbook, positions)
- MCP has `create_order` and `cancel_order` tools
- TUI cannot place orders

### What It Would Enable

- Execute arbitrage opportunities found by scanner
- Quick buy/sell from keyboard
- Manage limit orders
- Full trading workflow without leaving terminal

### UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  📝 PLACE ORDER                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Market: KXBTC-25JAN03-B100500                              │
│  Title:  Bitcoin > $100,500 on Jan 3?                       │
│                                                             │
│  Side:     [YES]  NO                                        │
│  Action:   [BUY]  SELL                                      │
│  Type:     [LIMIT]  MARKET                                  │
│                                                             │
│  Price:    [67] ¢        (Best ask: 68¢)                    │
│  Quantity: [10] contracts                                   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Estimated Cost: $6.70                                      │
│  Balance:        $222.04                                    │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [Enter] Submit    [Esc] Cancel    [Tab] Next field         │
└─────────────────────────────────────────────────────────────┘
```

### Technical Approach

1. Add order entry component to TUI
2. Reuse `validateOrder` from kalshi-core
3. Call `create_order` via API
4. Show confirmation before submission
5. Display order status after submission

### Risks

- Real money involved
- Need robust validation
- Consider "confirm before trade" setting

---

## 3. Event-Level View

**Value:** Medium | **Effort:** Low | **Differentiator:** No

### What It Does

Group related markets by event, showing probability sums.

### Current State

- Markets displayed as flat list
- No grouping by event
- Can't easily see related markets

### UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  📊 EVENTS                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ▼ 2028 Presidential Election (4 markets)        Sum: 94%  │
│    ├─ Trump YES           32¢   Vol: 45K                    │
│    ├─ DeSantis YES        28¢   Vol: 32K                    │
│    ├─ Newsom YES          22¢   Vol: 28K                    │
│    └─ Other YES           12¢   Vol: 15K                    │
│                                                             │
│  ▶ Bitcoin Price Jan 3 (8 markets)               Sum: 102% │
│                                                             │
│  ▶ S&P 500 Close Today (12 markets)              Sum: 101% │
│                                                             │
│  [Enter] Expand/Collapse  [a] Show arbitrage only           │
└─────────────────────────────────────────────────────────────┘
```

### Technical Approach

1. Fetch events via `getEvents(with_nested_markets: true)`
2. Group UI by event
3. Calculate sum of YES prices
4. Highlight if sum < 100% (arbitrage) or > 100% (overpriced)

---

## 4. Real-Time Data (WebSocket)

**Value:** Medium | **Effort:** High | **Differentiator:** Yes

### What It Does

Stream live price updates instead of polling every 10+ seconds.

### Why It Matters

- Arbitrage opportunities are fleeting (seconds)
- Current polling misses fast-moving markets
- Better UX with instant updates

### Technical Approach

1. Check if Kalshi has WebSocket API (needs research)
2. Implement WebSocket client in kalshi-core
3. Stream orderbook updates
4. Update TUI in real-time

### Risks

- Kalshi may not have public WebSocket API
- More complex connection management
- Rate limits on WebSocket connections

---

## 5. Paper Trading

**Value:** Medium | **Effort:** Medium | **Differentiator:** Yes

### What It Does

Simulate trades with virtual money to test strategies.

### Features

- Virtual balance (e.g., $1,000)
- Execute "fake" trades at real market prices
- Track P&L as if trades were real
- One-click switch to live trading

### UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  📝 PAPER TRADING MODE                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Virtual Balance: $1,000.00                                 │
│  Virtual P&L:     +$45.20 (+4.5%)                           │
│                                                             │
│  Open Positions (simulated):                                │
│  KXBTC-25JAN03  10 YES @ 65¢   Current: 67¢   +$2.00       │
│  INXD-25JAN03   5 NO @ 55¢    Current: 52¢   +$1.50        │
│                                                             │
│  [l] Switch to LIVE trading   [r] Reset paper account       │
└─────────────────────────────────────────────────────────────┘
```

### Technical Approach

1. Store paper positions in local file
2. Track entry prices and quantities
3. Calculate P&L from current market prices
4. No actual API calls for trades

---

## 6. Portfolio Analytics

**Value:** Low-Medium | **Effort:** Medium | **Differentiator:** No

### What It Does

Comprehensive view of trading performance.

### Features

- Total P&L (realized + unrealized)
- Win rate (% of profitable trades)
- Best/worst trades
- P&L by market category
- Daily/weekly/monthly breakdown

### Already in Roadmap

See TUI_ROADMAP.md - Phase 1 remaining items.

---

## 7. Cross-Platform Arbitrage

**Value:** High | **Effort:** High | **Differentiator:** Yes

### What It Does

Detect price differences between Kalshi, Polymarket, PredictIt.

### Example

- Kalshi: "Trump wins" YES = 68¢
- Polymarket: "Trump wins" NO = 28¢
- Total: 96¢ → Buy YES on Kalshi + NO on Polymarket → profit 4¢

### Challenges

- Need multiple API integrations
- Market matching is hard (different naming)
- Settlement risk (different rules)
- Polymarket requires crypto

### Status

**Not recommended for now** - too complex, focus on single-platform first.

---

## 8. Autonomous Agents (Phase 3+)

**Value:** High | **Effort:** High | **Differentiator:** Yes

### What It Does

AI-powered trading agents that execute strategies automatically.

### Types

1. **Rule-based:** If price < X, buy Y
2. **Mean reversion:** Buy when price deviates from average
3. **Arbitrage bot:** Auto-execute detected arbitrage
4. **RL agents:** Learn optimal strategies (Phase 4)

### Prerequisites

- Trading must work first
- Paper trading for testing
- Backtesting engine

### Already in Roadmap

See TUI_ROADMAP.md - Phase 3 and Phase 4.

---

## 9. Copy Trading / Leaderboard

**Value:** High | **Effort:** N/A | **Feasibility:** Not Possible

### Why Not Possible

- Kalshi doesn't expose other traders' positions
- No public leaderboard API
- Privacy-focused platform

### Alternative

- Track your own performance over time
- Compare to market benchmarks

---

## Recommended Sequence

```
Phase 1 (Current)
├── ✅ TUI Polish (rate limiting, charts, etc.)
├── 🔜 Arbitrage Scanner        ← START HERE
└── 🔜 Event-level View

Phase 2
├── Trading in TUI
├── Paper Trading
└── User Validation

Phase 3
├── Real-time WebSocket
├── Rule-based Agents
└── Backtesting

Phase 4
├── Advanced Agents (RL)
└── Cross-platform (maybe)
```

---

## Next Steps

1. **Research:** Verify Kalshi API supports all needed data for arbitrage
2. **Prototype:** Build simple arbitrage scanner in TUI
3. **Validate:** Share with users, get feedback
4. **Iterate:** Add trading if arbitrage gets traction

---

## References

- @0xJeff: Q1/2026 prediction markets trends
- @0xMovez: 6 types of prediction market arbitrage
- @qwerty_ytrevvq: RN1 microstructure trader case study
- @dunik_7: Polymarket open-source tools overview
- Polymarket/agents: GitHub agent framework

---

*This document captures feature ideas for future development. Items are not committed to any timeline.*

