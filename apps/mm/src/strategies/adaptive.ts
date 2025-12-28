/**
 * Adaptive Strategy
 *
 * Smart market making strategy that quotes dynamically based on market conditions:
 * - Quotes inside the current spread to be at front of queue
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
}

const DEFAULT_PARAMS: AdaptiveParams = {
  edgeCents: 1,
  minSpreadCents: 2,
  sizePerSide: 5,
  maxMarketSpread: 20,
};

/**
 * Adaptive strategy quotes:
 * - Bid = bestBid + edgeCents (improve the bid)
 * - Ask = bestAsk - edgeCents (improve the ask)
 * 
 * This makes you the new best bid/ask, so takers hit you first.
 * If market spread is too tight, falls back to quoting AT best bid/ask.
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

    const { bestBid, bestAsk } = snapshot;
    const marketSpread = bestAsk - bestBid;

    // Skip illiquid markets (wide spread = no one trading)
    if (marketSpread > this.params.maxMarketSpread) {
      return [];
    }

    // Calculate our quotes: improve the market by edgeCents
    let bidPrice = bestBid + this.params.edgeCents;
    let askPrice = bestAsk - this.params.edgeCents;

    // Ensure minimum spread for profitability
    const ourSpread = askPrice - bidPrice;
    if (ourSpread < this.params.minSpreadCents) {
      // Market is too tight - quote AT the market instead of inside
      bidPrice = bestBid;
      askPrice = bestAsk;

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

    return [
      {
        ticker: snapshot.ticker,
        side: "yes",
        bidPrice,
        bidSize: this.params.sizePerSide,
        askPrice,
        askSize: this.params.sizePerSide,
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
  }

  getParams(): AdaptiveParams {
    return { ...this.params };
  }
}

