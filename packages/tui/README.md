# @newyorkcompute/kalshi-tui

[![npm version](https://img.shields.io/npm/v/@newyorkcompute/kalshi-tui)](https://www.npmjs.com/package/@newyorkcompute/kalshi-tui)
[![license](https://img.shields.io/npm/l/@newyorkcompute/kalshi-tui)](https://github.com/newyorkcompute/kalshi/blob/main/LICENSE)

**Free. Open source. Beautiful.**

A terminal so polished that the screenshot alone is the pitch. Real-time market data, orderbook visualization, portfolio management, and trading — all without leaving your terminal.

No AI. No gimmicks. Pure craft.

## Installation

```bash
npx @newyorkcompute/kalshi-tui
```

Or install globally:

```bash
npm install -g @newyorkcompute/kalshi-tui
```

## Screenshot

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ▓ KALSHI                                             Balance: $1,234.56  ◉  │
│  NEW YORK COMPUTE                                                            │
├────────────────────────────────────┬─────────────────────────────────────────┤
│  MARKETS                     [F1]  │  ORDERBOOK: KXBTC-25JAN-B100           │
│  ──────────────────────────────────│  ─────────────────────────────────────  │
│  KXBTC-25JAN-B100       45¢ ▲ +2  │  ASK  ████████████████  52¢  (120)     │
│  KXBTC-25JAN-B105       32¢ ▼ -1  │  ASK  ████████████      50¢  (85)      │
│  KXETH-25JAN-B4000      67¢ ━  0  │  BID  ██████████        46¢  (60)      │
│  TRUMP-WIN-2024         52¢ ▲ +5  │  BID  ████████████████  42¢  (150)     │
├───────────────────────────────────┼─────────────────────────────────────────┤
│  POSITIONS                  [F2]  │  QUICK TRADE                      [F4]  │
│  ──────────────────────────────────│  ─────────────────────────────────────  │
│  KXBTC-25JAN-B100   +10 YES  $45  │  Ticker: KXBTC-25JAN-B100              │
│  TRUMP-WIN-2024      -5 NO   $26  │  Side:   [YES] NO                      │
│  ──────────────────────────────────│  Qty:    10        Price: 45¢          │
│  Total Exposure: $71              │  Cost:   $4.50     [BUY]               │
├───────────────────────────────────┴─────────────────────────────────────────┤
│  Built by New York Compute • newyorkcompute.xyz   [?] Help  [q] Quit        │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Market Watch** - Real-time prices with keyboard navigation
- **Orderbook** - Visual depth chart for selected market
- **Portfolio** - Live balance and position tracking
- **Quick Trade** - Place orders without leaving the terminal
- **Keyboard-first** - Full navigation without a mouse

## Keybindings

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate markets |
| `Enter` | Select market |
| `Tab` | Toggle YES/NO side |
| `[` / `]` | Adjust quantity |
| `-` / `+` | Adjust price |
| `?` | Show help |
| `q` | Quit |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KALSHI_API_KEY` | Yes | Your Kalshi API key ID |
| `KALSHI_PRIVATE_KEY` | Yes | RSA private key (PEM format) |
| `KALSHI_BASE_PATH` | No | API base URL (default: production) |

## Usage

```bash
# With environment variables
export KALSHI_API_KEY="your-api-key"
export KALSHI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"

kalshi-tui
```

## Getting API Keys

1. Log into your [Kalshi account](https://kalshi.com)
2. Go to Account Settings → API
3. Generate a new API key (you'll create an RSA key pair)
4. Save your API Key ID and private key securely

## Built By

**New York Compute** — Command-native tools for quantitative research, execution, and market intelligence.

Want this for equities? [Request early access →](https://newyorkcompute.xyz)

## License

MIT © [NewYorkCompute](https://github.com/newyorkcompute)

