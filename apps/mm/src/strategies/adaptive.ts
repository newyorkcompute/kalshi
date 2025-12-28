/**
 * Adaptive Strategy (Phase 2: Elite MM)
 *
 * Smart market making strategy that quotes dynamically based on market conditions:
 * - Uses microprice (size-weighted mid) as fair value
 * - Quotes inside the current spread to be at front of queue
 * - Skews quotes based on inventory (Avellaneda-Stoikov style)
 * - Multi-level quoting for better inventory management
 * - Widens spread when adverse selection detected
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
  
  // === Phase 2: Elite MM params ===
  
  /** Use microprice as fair value instead of simple mid (default true) */
  useMicroprice: boolean;
  /** Enable multi-level quoting (default false for safety) */
  multiLevel: boolean;
  /** Spread multiplier when adverse selection detected (default 2) */
  adverseSelectionMultiplier: number;
}

const DEFAULT_PARAMS: AdaptiveParams = {
  edgeCents: 1,
  minSpreadCents: 2,
  sizePerSide: 5,
  maxMarketSpread: 20,
  skewFactor: 0.5,
  maxInventorySkew: 30,
  // Phase 2 defaults
  useMicroprice: true,
  multiLevel: false,
  adverseSelectionMultiplier: 2.0,
};

/**
 * Adaptive strategy quotes:
 * - Uses microprice (if available) for better fair value
 * - Bid = fairValue - halfSpread - inventorySkew
 * - Ask = fairValue + halfSpread - inventorySkew
 * 
 * Inventory skew (Avellaneda-Stoikov style):
 * - If LONG: skew negative → lower bid (less eager to buy), lower ask (more eager to sell)
 * - If SHORT: skew positive → higher bid (more eager to buy), higher ask (less eager to sell)
 * 
 * Multi-level quoting:
 * - Level 1: Tight spread, small size (capture spread)
 * - Level 2: Wider spread, larger size (inventory management)
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

    const { bestBid, bestAsk, position, microprice, adverseSelection } = snapshot;
    const marketSpread = bestAsk - bestBid;

    // Skip illiquid markets (wide spread = no one trading)
    if (marketSpread > this.params.maxMarketSpread) {
      return [];
    }

    // Use microprice as fair value if available and enabled
    const fairValue = (this.params.useMicroprice && microprice) 
      ? microprice 
      : (bestBid + bestAsk) / 2;

    // Calculate inventory and skew
    const inventory = position?.netExposure ?? 0;
    const inventorySkew = inventory * this.params.skewFactor;

    // Adjust edge for adverse selection
    let effectiveEdge = this.params.edgeCents;
    let effectiveMinSpread = this.params.minSpreadCents;
    
    if (adverseSelection) {
      // Widen spread when being picked off
      effectiveEdge = 0; // Don't quote inside market
      effectiveMinSpread = this.params.minSpreadCents * this.params.adverseSelectionMultiplier;
    }

    // Multi-level quoting if enabled
    if (this.params.multiLevel) {
      return this.computeMultiLevelQuotes(snapshot, fairValue, inventorySkew, effectiveMinSpread);
    }

    // Single-level quoting (default)
    // Calculate our quotes: improve the market by edgeCents, then apply skew
    // Skew moves BOTH bid and ask in the same direction
    // LONG (+inventory) → negative skew → prices drop → more likely to sell
    // SHORT (-inventory) → positive skew → prices rise → more likely to buy
    let bidPrice = bestBid + effectiveEdge - inventorySkew;
    let askPrice = bestAsk - effectiveEdge - inventorySkew;

    // Ensure minimum spread for profitability
    const ourSpread = askPrice - bidPrice;
    if (ourSpread < effectiveMinSpread) {
      // Market is too tight - quote AT the market instead of inside
      bidPrice = bestBid - inventorySkew;
      askPrice = bestAsk - inventorySkew;

      // Still not enough spread? Skip this market
      if (bestAsk - bestBid < effectiveMinSpread) {
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

  /**
   * Multi-level quoting - place orders at multiple price levels
   * 
   * Level 1: Tight spread (1¢ inside), small size - captures spread
   * Level 2: Wider spread (at market), larger size - inventory management
   */
  private computeMultiLevelQuotes(
    snapshot: MarketSnapshot,
    fairValue: number,
    inventorySkew: number,
    minSpread: number
  ): Quote[] {
    const { bestBid, bestAsk, ticker, position } = snapshot;
    const inventory = position?.netExposure ?? 0;
    const quotes: Quote[] = [];

    // Level 1: Tight - quote 1¢ inside market, small size
    const level1Bid = this.clampPrice(bestBid + 1 - inventorySkew);
    const level1Ask = this.clampPrice(bestAsk - 1 - inventorySkew);
    
    if (level1Ask > level1Bid && (level1Ask - level1Bid) >= minSpread) {
      const l1BidSize = inventory >= this.params.maxInventorySkew ? 0 : 2;
      const l1AskSize = inventory <= -this.params.maxInventorySkew ? 0 : 2;
      
      if (l1BidSize > 0 || l1AskSize > 0) {
        quotes.push({
          ticker,
          side: "yes",
          bidPrice: level1Bid,
          bidSize: l1BidSize,
          askPrice: level1Ask,
          askSize: l1AskSize,
        });
      }
    }

    // Level 2: At market - larger size for inventory management
    const level2Bid = this.clampPrice(bestBid - inventorySkew);
    const level2Ask = this.clampPrice(bestAsk - inventorySkew);
    
    if (level2Ask > level2Bid && (level2Ask - level2Bid) >= minSpread) {
      // Only add Level 2 if different from Level 1
      if (level2Bid !== level1Bid || level2Ask !== level1Ask) {
        const l2BidSize = inventory >= this.params.maxInventorySkew ? 0 : 5;
        const l2AskSize = inventory <= -this.params.maxInventorySkew ? 0 : 5;
        
        if (l2BidSize > 0 || l2AskSize > 0) {
          quotes.push({
            ticker,
            side: "yes",
            bidPrice: level2Bid,
            bidSize: l2BidSize,
            askPrice: level2Ask,
            askSize: l2AskSize,
          });
        }
      }
    }

    return quotes;
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
    // Phase 2 params
    if (typeof params.useMicroprice === "boolean") {
      this.params.useMicroprice = params.useMicroprice;
    }
    if (typeof params.multiLevel === "boolean") {
      this.params.multiLevel = params.multiLevel;
    }
    if (typeof params.adverseSelectionMultiplier === "number") {
      this.params.adverseSelectionMultiplier = params.adverseSelectionMultiplier;
    }
  }

  getParams(): AdaptiveParams {
    return { ...this.params };
  }
}

