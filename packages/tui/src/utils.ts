/**
 * TUI Utility Functions
 * 
 * Re-exports common utilities from core and provides TUI-specific helpers.
 */

// Re-export from core for convenience
export {
  formatExpiry,
  calculateSpread,
  formatCompactNumber,
} from '@newyorkcompute/kalshi-core';

/**
 * Get price change indicator and color (TUI-specific)
 * 
 * Returns an object with text (▲/▼/━) and color (green/red/gray)
 * for displaying price movement in the terminal.
 */
export function getPriceChange(current?: number, previous?: number): { text: string; color: string } {
  if (current === undefined || previous === undefined || current === previous) {
    return { text: '━', color: 'gray' };
  }
  
  const diff = current - previous;
  if (diff > 0) {
    return { text: '▲', color: 'green' };
  }
  return { text: '▼', color: 'red' };
}

/**
 * Format volume with K/M suffix (alias for formatCompactNumber)
 * 
 * @param volume - Volume number
 * @returns Formatted string (e.g., "1.5K", "2.3M")
 */
export function formatVolume(volume?: number): string {
  if (!volume) return '';
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return `${volume}`;
}

/**
 * Format price in cents (simple version for TUI)
 * 
 * @param cents - Price in cents
 * @returns Formatted string (e.g., "45¢", "—")
 */
export function formatPrice(cents?: number): string {
  return cents !== undefined ? `${cents}¢` : '—';
}

/**
 * Format price with decimals
 * 
 * @param cents - Price in cents
 * @returns Formatted string with 2 decimal places (e.g., "45.00¢")
 */
export function formatPriceDecimal(cents: number): string {
  return `${cents.toFixed(2)}¢`;
}

// ============================================================================
// Arbitrage Types and Calculations
// ============================================================================

/** Market data needed for arbitrage calculation */
export interface ArbitrageMarket {
  ticker: string;
  yes_ask?: number;
  no_ask?: number;
  event_ticker?: string;
}

/** Single-market arbitrage opportunity (YES + NO < 100) */
export interface SingleMarketArb {
  ticker: string;
  yesAsk: number;
  noAsk: number;
  total: number;
  profit: number;
}

/** Multi-outcome event arbitrage opportunity (sum of YES prices < 100) */
export interface EventArb {
  eventTicker: string;
  title: string;
  markets: { ticker: string; yesAsk: number }[];
  total: number;
  profit: number;
}

/** All arbitrage opportunities */
export interface ArbitrageOpportunities {
  singleMarket: SingleMarketArb[];
  events: EventArb[];
}

/**
 * Calculate arbitrage opportunities from markets
 * 
 * Single-market arbitrage: YES_ask + NO_ask < 100 (guaranteed profit)
 * - Buy both YES and NO, one will pay $1.00
 * - Profit = 100 - (YES_ask + NO_ask)
 * 
 * Event arbitrage: Sum of all YES_ask in mutually exclusive event < 100
 * - Buy YES on all outcomes, exactly one will pay $1.00
 * - Profit = 100 - sum(all YES_ask prices)
 * 
 * @param markets - Array of markets with yes_ask, no_ask, and event_ticker
 * @returns Object with singleMarket and events arrays, sorted by profit
 */
export function calculateArbitrage(markets: ArbitrageMarket[]): ArbitrageOpportunities {
  const singleMarket: SingleMarketArb[] = [];
  const eventMap = new Map<string, { markets: ArbitrageMarket[]; title: string }>();

  for (const market of markets) {
    const yesAsk = market.yes_ask;
    const noAsk = market.no_ask;

    // Single-market arbitrage: YES + NO < 100
    if (yesAsk !== undefined && noAsk !== undefined) {
      const total = yesAsk + noAsk;
      if (total < 100) {
        singleMarket.push({
          ticker: market.ticker,
          yesAsk,
          noAsk,
          total,
          profit: 100 - total,
        });
      }
    }

    // Group by event for multi-outcome arbitrage
    if (market.event_ticker && yesAsk !== undefined) {
      const existing = eventMap.get(market.event_ticker);
      if (existing) {
        existing.markets.push(market);
      } else {
        eventMap.set(market.event_ticker, {
          markets: [market],
          title: market.event_ticker,
        });
      }
    }
  }

  // Calculate event arbitrage (sum of YES < 100)
  const events: EventArb[] = [];
  for (const [eventTicker, data] of eventMap) {
    // Only consider events with 2+ markets (multi-outcome)
    if (data.markets.length >= 2) {
      const total = data.markets.reduce((sum, m) => sum + (m.yes_ask || 0), 0);
      if (total < 100) {
        events.push({
          eventTicker,
          title: data.title,
          markets: data.markets.map(m => ({
            ticker: m.ticker,
            yesAsk: m.yes_ask || 0,
          })),
          total,
          profit: 100 - total,
        });
      }
    }
  }

  // Sort by profit (highest first)
  singleMarket.sort((a, b) => b.profit - a.profit);
  events.sort((a, b) => b.profit - a.profit);

  return { singleMarket, events };
}
