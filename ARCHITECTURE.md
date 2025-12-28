# Architecture Overview

## Package Structure

```
kalshi/
├── packages/
│   ├── core/          # Shared utilities & business logic
│   ├── mcp/           # MCP Server (AI agent interface)
│   └── tui/           # Terminal UI (human interface)
└── skills/            # Agent Skills (code-first alternative to MCP)
```

## Core Package (`@newyorkcompute/kalshi-core`)

**Purpose**: Shared utilities and business logic that can be used across all packages.

**Exports**:
- **Configuration**: SDK setup, API client creation
- **Formatting**: Price, currency, time formatting utilities
- **Validation**: Order validation with pre-flight checks
- **Utilities**: Timeout wrapper, type definitions

**Why Core?**
- Single source of truth for business logic
- Reusable across TUI, MCP, and Agent Skills
- No UI or protocol-specific code
- Easy to test in isolation

## MCP Package (`@newyorkcompute/kalshi-mcp`)

**Purpose**: Model Context Protocol server for AI agents (Claude, ChatGPT, etc.)

**Architecture**:
```
mcp/
├── src/
│   ├── index.ts           # MCP server setup
│   ├── config.ts          # Environment configuration
│   └── tools/             # MCP tool implementations
│       ├── get-markets.ts
│       ├── get-orderbook.ts
│       ├── create-order.ts  # Uses validateOrder from core
│       └── ...
```

**Design Principle**: Tools are thin wrappers around core utilities + Kalshi SDK calls.

## TUI Package (`@newyorkcompute/kalshi-tui`)

**Purpose**: Terminal dashboard for human traders.

**Architecture**:
```
tui/
├── src/
│   ├── App.tsx            # Main application
│   ├── components/        # React components (Ink)
│   │   ├── MarketList.tsx
│   │   ├── OrderbookView.tsx
│   │   └── ErrorBoundary.tsx
│   └── hooks/             # Custom React hooks
│       ├── usePolling.ts      # Polling with backoff
│       ├── useMarkets.ts      # Market data
│       └── useOrderbook.ts    # Orderbook data
```

**Design Principle**: UI layer only. Business logic comes from core package.

## Agent Skills

**Purpose**: Code-first alternative to MCP for programmatic access.

**Design Principle**: Direct TypeScript functions that can be imported and called by AI agents or custom scripts.

## Example: Order Validation Flow

### Before Refactor (❌ Bad)
```typescript
// MCP had validation logic
packages/mcp/src/tools/validate-order.ts

// TUI couldn't use it
// Agent Skills couldn't use it
// Code duplication risk
```

### After Refactor (✅ Good)
```typescript
// Core has validation logic
packages/core/src/validate-order.ts

// MCP uses it
import { validateOrder } from '@newyorkcompute/kalshi-core';

// TUI can use it
import { validateOrder } from '@newyorkcompute/kalshi-core';

// Agent Skills can use it
import { validateOrder } from '@newyorkcompute/kalshi-core';

// Single source of truth ✨
```

## Usage Example: TUI Order Validation

```typescript
// packages/tui/src/components/OrderForm.tsx
import { validateOrder } from '@newyorkcompute/kalshi-core';
import { createMarketApi, createPortfolioApi } from '@newyorkcompute/kalshi-core';

function OrderForm({ ticker, side, action, count, price }) {
  const handleSubmit = async () => {
    // Validate before placing order
    const validation = await validateOrder(
      { ticker, side, action, count, price },
      marketApi,
      portfolioApi
    );

    if (!validation.valid) {
      // Show errors to user
      setErrors(validation.errors);
      return;
    }

    if (validation.warnings.length > 0) {
      // Show warnings but allow proceeding
      setWarnings(validation.warnings);
    }

    // Place order via Kalshi SDK
    await ordersApi.createOrder({ ... });
  };
}
```

## Design Principles

1. **Core = Business Logic**: All reusable logic goes in core
2. **Packages = Interfaces**: MCP and TUI are just different interfaces to the same logic
3. **No Duplication**: If code is needed in >1 package, it belongs in core
4. **Testability**: Core utilities are easy to test in isolation
5. **Scalability**: Adding new interfaces (web UI, CLI, etc.) is easy

## Benefits of This Architecture

✅ **Reusability**: Write once, use everywhere
✅ **Consistency**: Same validation logic across all interfaces
✅ **Maintainability**: Fix bugs in one place
✅ **Testability**: Test business logic independent of UI/protocol
✅ **Extensibility**: Easy to add new interfaces (web app, mobile, etc.)

