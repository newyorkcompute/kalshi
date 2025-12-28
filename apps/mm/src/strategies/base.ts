/**
 * Strategy Interface
 *
 * Base interface for market making strategies.
 */

import type { Quote, Fill, Position } from "@newyorkcompute/kalshi-core";

/**
 * Market data snapshot for strategy computation
 */
export interface MarketSnapshot {
  /** Market ticker */
  ticker: string;
  /** Best bid price (cents) */
  bestBid: number;
  /** Best ask price (cents) */
  bestAsk: number;
  /** Mid price (cents) */
  mid: number;
  /** Current spread (cents) */
  spread: number;
  /** Our current position */
  position: Position | null;
  /** Time to market expiry (seconds) */
  timeToExpiry?: number;
  
  // === Enhanced market data (Phase 2) ===
  
  /** Microprice - size-weighted mid (better fair value estimate) */
  microprice?: number;
  /** Size at best bid */
  bidSize?: number;
  /** Size at best ask */
  askSize?: number;
  /** Orderbook imbalance: (bidDepth - askDepth) / (bidDepth + askDepth) */
  imbalance?: number;
  /** Is there adverse selection detected for this market? */
  adverseSelection?: boolean;
}

/**
 * Strategy interface
 */
export interface Strategy {
  /** Strategy name for logging */
  readonly name: string;

  /**
   * Compute quotes for a market
   *
   * @param snapshot - Current market state
   * @returns Array of quotes to place (usually 1, but could be 0 if skipping)
   */
  computeQuotes(snapshot: MarketSnapshot): Quote[];

  /**
   * Called when one of our orders is filled
   * Strategy can use this to adjust behavior
   */
  onFill(fill: Fill): void;

  /**
   * Update strategy parameters at runtime
   */
  updateParams(params: Record<string, unknown>): void;
}

/**
 * Base class with common functionality
 */
export abstract class BaseStrategy implements Strategy {
  abstract readonly name: string;

  abstract computeQuotes(snapshot: MarketSnapshot): Quote[];

  onFill(_fill: Fill): void {
    // Default: no-op, subclasses can override
  }

  updateParams(_params: Record<string, unknown>): void {
    // Default: no-op, subclasses can override
  }

  /**
   * Helper to clamp price to valid range
   */
  protected clampPrice(price: number): number {
    return Math.max(1, Math.min(99, Math.round(price)));
  }

  /**
   * Helper to check if market is quotable
   */
  protected isQuotable(snapshot: MarketSnapshot): boolean {
    // Skip if no valid prices
    if (snapshot.bestBid <= 0 || snapshot.bestAsk <= 0) return false;
    if (snapshot.bestBid >= snapshot.bestAsk) return false;

    // Skip if spread is too wide (illiquid)
    if (snapshot.spread > 20) return false;

    return true;
  }
}

