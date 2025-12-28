/**
 * Adaptive Strategy
 *
 * Smart market making strategy that quotes dynamically based on market conditions:
 * - Quotes inside the current spread to be at front of queue
 * - Skews quotes based on inventory (Avellaneda-Stoikov style)
 * - Widens spread when market is volatile or illiquid
 * - Respects minimum profit margin
 */

import type { Quote } from "@newyorkcompute/kalshi-core";
import { BaseStrategy, type MarketSnapshot } from "./base.js";

export interface AdaptiveParams {
  /** How many cents inside the best bid/ask to quote (default 1) */
  edgeCents: number;
  /** Minimum spread to maintain for profit (default 2) */
  minSpreadCents: number;
  /** Number of contracts per side */
  sizePerSide: number;
  /** Skip markets with spread wider than this (illiquid) */
  maxMarketSpread: number;
  /** 
   * Inventory skew factor (default 0.5)
   * Higher = more aggressive skew to flatten inventory
   * 0 = no skew (symmetric quoting)
   * 
   * Example: skewFactor=0.5, inventory=+10 (long 10)
   * → bid drops 5¢, ask drops 5¢
   * → More likely to get hit on ask (reduce long position)
   */
  skewFactor: number;
  /**
   * Max inventory before we stop quoting the increasing side
   * e.g., if maxInventorySkew=20 and we're +20, don't bid anymore
   */
  maxInventorySkew: number;
}

const DEFAULT_PARAMS: AdaptiveParams = {
  edgeCents: 1,
  minSpreadCents: 2,
  sizePerSide: 5,
  maxMarketSpread: 20,
  skewFactor: 0.5,
  maxInventorySkew: 30,
};

/**
 * Adaptive strategy quotes:
 * - Bid = bestBid + edgeCents - inventorySkew
 * - Ask = bestAsk - edgeCents - inventorySkew
 * 
 * Inventory skew (Avellaneda-Stoikov style):
 * - If LONG: skew negative → lower bid (less eager to buy), lower ask (more eager to sell)
 * - If SHORT: skew positive → higher bid (more eager to buy), higher ask (less eager to sell)
 * 
 * This naturally flattens inventory over time while still capturing spread.
 */
export class AdaptiveStrategy extends BaseStrategy {
  readonly name = "adaptive";
  private params: AdaptiveParams;

  constructor(params: Partial<AdaptiveParams> = {}) {
    super();
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  computeQuotes(snapshot: MarketSnapshot): Quote[] {
    // Skip if not quotable
    if (!this.isQuotable(snapshot)) {
      return [];
    }

    const { bestBid, bestAsk, position } = snapshot;
    const marketSpread = bestAsk - bestBid;

    // Skip illiquid markets (wide spread = no one trading)
    if (marketSpread > this.params.maxMarketSpread) {
      return [];
    }

    // Calculate inventory and skew
    const inventory = position?.netExposure ?? 0;
    const inventorySkew = inventory * this.params.skewFactor;

    // Calculate our quotes: improve the market by edgeCents, then apply skew
    // Skew moves BOTH bid and ask in the same direction
    // LONG (+inventory) → negative skew → prices drop → more likely to sell
    // SHORT (-inventory) → positive skew → prices rise → more likely to buy
    let bidPrice = bestBid + this.params.edgeCents - inventorySkew;
    let askPrice = bestAsk - this.params.edgeCents - inventorySkew;

    // Ensure minimum spread for profitability
    const ourSpread = askPrice - bidPrice;
    if (ourSpread < this.params.minSpreadCents) {
      // Market is too tight - quote AT the market instead of inside
      bidPrice = bestBid - inventorySkew;
      askPrice = bestAsk - inventorySkew;

      // Still not enough spread? Skip this market
      if (bestAsk - bestBid < this.params.minSpreadCents) {
        return [];
      }
    }

    // Clamp to valid price range
    bidPrice = this.clampPrice(bidPrice);
    askPrice = this.clampPrice(askPrice);

    // Final sanity check
    if (askPrice <= bidPrice) {
      return [];
    }

    // Determine sizes based on inventory limits
    let bidSize = this.params.sizePerSide;
    let askSize = this.params.sizePerSide;

    // If we're at max long inventory, don't bid (don't accumulate more)
    if (inventory >= this.params.maxInventorySkew) {
      bidSize = 0;
    }
    // If we're at max short inventory, don't ask (don't accumulate more)
    if (inventory <= -this.params.maxInventorySkew) {
      askSize = 0;
    }

    // Skip if both sides are zero
    if (bidSize === 0 && askSize === 0) {
      return [];
    }

    return [
      {
        ticker: snapshot.ticker,
        side: "yes",
        bidPrice,
        bidSize,
        askPrice,
        askSize,
      },
    ];
  }

  updateParams(params: Record<string, unknown>): void {
    if (typeof params.edgeCents === "number") {
      this.params.edgeCents = params.edgeCents;
    }
    if (typeof params.minSpreadCents === "number") {
      this.params.minSpreadCents = params.minSpreadCents;
    }
    if (typeof params.sizePerSide === "number") {
      this.params.sizePerSide = params.sizePerSide;
    }
    if (typeof params.maxMarketSpread === "number") {
      this.params.maxMarketSpread = params.maxMarketSpread;
    }
    if (typeof params.skewFactor === "number") {
      this.params.skewFactor = params.skewFactor;
    }
    if (typeof params.maxInventorySkew === "number") {
      this.params.maxInventorySkew = params.maxInventorySkew;
    }
  }

  getParams(): AdaptiveParams {
    return { ...this.params };
  }
}

