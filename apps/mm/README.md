# Kalshi Market Maker (`apps/mm`)

Weather-informed market-making daemon for Kalshi prediction markets.

## Validation Run

The checked-in `config.yaml` is tuned for a **2–3 week validation run** at tiny size. Do not increase limits until go/no-go criteria are met.

### Starting the bot

From the repo root (or `apps/mm`):

```bash
# Set credentials (required)
export KALSHI_API_KEY=...
export KALSHI_PRIVATE_KEY=...

# Development (hot reload)
cd apps/mm && npm run dev

# Production
cd apps/mm && npm run build && npm start

# Optional: override config path
MM_CONFIG=./config.yaml npm start
```

The HTTP control plane listens on port **3001** (`POST /pause`, `POST /resume`, status endpoints).

### Go / no-go criteria

Run the bot until you have **at least 30 settled markets** with fill data, then analyze performance:

- **Go (allow size increase):** positive **expectancy per contract** in the analyzer overall summary.
- **No-go:** zero or negative expectancy per contract — keep validation size or stop and revisit the model.

Do not scale `maxPositionPerMarket`, `maxTotalExposure`, or order sizes until this threshold is met.

### Running the analyzer

From `apps/mm` (joins local fill logs with Kalshi settlements when credentials are set):

```bash
cd apps/mm
npm run analyze

# Optional filters
npm run analyze -- --since 2026-07-11
npm run analyze -- --logs ./logs --json
```

Review **Expectancy / contract** and settled-market count in the output.

### Halt semantics

Risk controls use **mark-to-market** P&L (realized + unrealized):

- **Daily loss halt** (`maxDailyLoss`): bot pauses, cancels all open orders, and sets a persistent risk halt. It does **not** auto-resume; restart the process or explicitly clear the halt after review.
- **Drawdown halt** (`haltDrawdown`): bot pauses and cancels all open orders when drawdown from session peak exceeds the limit. It does **not** auto-resume past a risk halt—manual restart or resume is required once limits have been breached.

Position sizing scales down between `scaleDownStart` and `halfSizeDrawdown` before a full halt at `haltDrawdown`.
