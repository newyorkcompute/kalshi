# @newyorkcompute/kalshi-core

Shared utilities for Kalshi prediction market tools — SDK configuration, formatting, and types.

## Installation

```bash
npm install @newyorkcompute/kalshi-core
```

## Usage

### Configuration

```typescript
import {
  getKalshiConfig,
  createMarketApi,
  createPortfolioApi,
} from "@newyorkcompute/kalshi-core";

// Get config from environment variables
const config = getKalshiConfig();

// Create API clients
const marketApi = createMarketApi(config);
const portfolioApi = createPortfolioApi(config);
```

### Formatting

```typescript
import {
  formatPrice,
  formatCurrency,
  formatPriceChange,
} from "@newyorkcompute/kalshi-core";

formatPrice(45);        // "45¢"
formatCurrency(4500);   // "$45.00"
formatPriceChange(2);   // "▲ +2"
formatPriceChange(-3);  // "▼ -3"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KALSHI_API_KEY` | Yes | Your Kalshi API key ID |
| `KALSHI_PRIVATE_KEY` | Yes | RSA private key (PEM format) |
| `KALSHI_BASE_PATH` | No | API base URL (default: production) |

## License

MIT © [NewYorkCompute](https://github.com/newyorkcompute)

