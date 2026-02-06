/**
 * Optimism Tax Strategy
 *
 * A strategy designed around Becker's research findings on the YES/NO asymmetry
 * in prediction markets. Instead of generic market making, this strategy leans
 * into the structural advantage of selling into optimistic taker flow.
 *
 * Key insights from the research:
 * 1. At longshot YES prices (1-15c), YES contracts have expected value of -41%
 *    while NO contracts at the same prices have EV of +23%. Gap: 64pp.
 * 2. Takers disproportionately buy YES at longshot prices (41-47% of volume).
 * 3. Makers don't need to predict outcomes -- they profit by being the
 *    counterparty to optimistic taker flow ("the Optimism Tax").
 * 4. The effect is strongest in emotional categories (Sports, Entertainment, Media).
 *
 * Strategy behavior by price range:
 * - Longshot YES (1-15c): Aggressively sell YES / buy NO as maker.
 *   We provide liquidity to the "hope premium" demand.
 * - Near-certainty (85-99c): Aggressively buy YES / sell NO as maker.
 *   Same dynamic in reverse (takers overpay for NO longshots).
 * - Mid-range (16-84c): Standard adaptive market making.
 *   Less asymmetry here, so fall back to spread capture.
 *
 * @see https://www.jbecker.dev/research/prediction-market-microstructure
 */

import type { Quote } from "@newyorkcompute/kalshi-core";
import { BaseStrategy, type MarketSnapshot } from "./base.js";

export interface OptimismTaxParams {
  // ─── Optimism Tax Zone Thresholds ───
  /** Below this price (cents), YES is a longshot → sell YES aggressively (default 15) */
  longShotThreshold: number;
  /** Above this price (cents), YES is near-certain → buy YES aggressively (default 85) */
  nearlyCertainThreshold: number;

  // ─── Longshot Zone Parameters ───
  /** Edge in cents for optimism-tax trades (default 2) */
  optimismEdgeCents: number;
  /** Size multiplier for optimism-tax trades vs normal (default 1.5) */
  optimismSizeMultiplier: number;
  /** Max contracts to risk in any single longshot market (default 50) */
  maxLongshotExposure: number;

  // ─── Standard MM Parameters (for mid-range) ───
  /** How many cents inside best bid/ask to quote in mid-range (default 1) */
  edgeCents: number;
  /** Minimum spread to maintain for profit (default 2) */
  minSpreadCents: number;
  /** Base contracts per side (default 5) */
  sizePerSide: number;
  /** Skip markets with spread wider than this (default 20) */
  maxMarketSpread: number;
  /** Inventory skew factor (default 0.5) */
  skewFactor: number;
  /** Max inventory before stopping one side (default 30) */
  maxInventorySkew: number;

  // ─── Microprice & Advanced ───
  /** Use microprice as fair value (default true) */
  useMicroprice: boolean;
  /** Spread multiplier when adverse selection detected (default 2.5) */
  adverseSelectionMultiplier: number;

  // ─── Time-decay near expiry ───
  /** Seconds before expiry to start widening (default 3600) */
  expiryWidenStartSec: number;
  /** Seconds before expiry to stop quoting (default 300) */
  expiryStopQuoteSec: number;
  /** Spread multiplier near expiry (default 2.0) */
  expirySpreadMultiplier: number;
}

const DEFAULT_PARAMS: OptimismTaxParams = {
  // Optimism Tax zones
  longShotThreshold: 15,
  nearlyCertainThreshold: 85,
  optimismEdgeCents: 2,
  optimismSizeMultiplier: 1.5,
  maxLongshotExposure: 50,

  // Standard MM
  edgeCents: 1,
  minSpreadCents: 2,
  sizePerSide: 5,
  maxMarketSpread: 20,
  skewFactor: 0.5,
  maxInventorySkew: 30,
  useMicroprice: true,
  adverseSelectionMultiplier: 2.5,

  // Time-decay
  expiryWidenStartSec: 3600,
  expiryStopQuoteSec: 300,
  expirySpreadMultiplier: 2.0,
};

export class OptimismTaxStrategy extends BaseStrategy {
  readonly name = "optimism-tax";
  private params: OptimismTaxParams;

  constructor(params: Partial<OptimismTaxParams> = {}) {
    super();
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  computeQuotes(snapshot: MarketSnapshot): Quote[] {
    if (!this.isQuotable(snapshot)) {
      return [];
    }

    const { bestBid, bestAsk, microprice, timeToExpiry } = snapshot;
    const mid = (this.params.useMicroprice && microprice) ? microprice : (bestBid + bestAsk) / 2;
    const marketSpread = bestAsk - bestBid;

    // ─── Time-decay near expiry ───
    if (timeToExpiry !== undefined && timeToExpiry <= this.params.expiryStopQuoteSec) {
      return [];
    }

    let expiryMultiplier = 1.0;
    if (timeToExpiry !== undefined && timeToExpiry <= this.params.expiryWidenStartSec) {
      const progress = 1 - (timeToExpiry - this.params.expiryStopQuoteSec) /
        (this.params.expiryWidenStartSec - this.params.expiryStopQuoteSec);
      expiryMultiplier = 1.0 + progress * (this.params.expirySpreadMultiplier - 1.0);
    }

    // Skip illiquid markets
    if (marketSpread > this.params.maxMarketSpread) {
      return [];
    }

    // Determine which zone we're in
    let quotes: Quote[];
    if (mid <= this.params.longShotThreshold) {
      quotes = this.computeLongshotQuotes(snapshot, mid, expiryMultiplier);
    } else if (mid >= this.params.nearlyCertainThreshold) {
      quotes = this.computeNearlyCertainQuotes(snapshot, mid, expiryMultiplier);
    } else {
      quotes = this.computeMidRangeQuotes(snapshot, mid, expiryMultiplier);
    }

    // ─── CRITICAL: Prevent spread-crossing (maker protection) ───
    // Ensure our bid never reaches the best ask and our ask never reaches
    // the best bid.  Without this guard the "edge" arithmetic can push
    // limit orders past the opposite side of the book, causing them to
    // execute immediately as **taker** fills rather than resting as maker.
    for (const q of quotes) {
      if (q.bidSize > 0 && q.bidPrice >= bestAsk) {
        q.bidPrice = this.clampPrice(bestAsk - 1);
      }
      if (q.askSize > 0 && q.askPrice <= bestBid) {
        q.askPrice = this.clampPrice(bestBid + 1);
      }
      // If after clamping the spread collapses, zero out the offending side
      if (q.bidPrice >= q.askPrice) {
        // Keep whichever side the zone logic considers more important:
        // in near-certainty we want the bid, in longshot the ask, in mid both.
        if (mid >= this.params.nearlyCertainThreshold) {
          q.askSize = 0;
          q.askPrice = 0;
        } else if (mid <= this.params.longShotThreshold) {
          q.bidSize = 0;
          q.bidPrice = 0;
        } else {
          // mid-range: skip entirely
          q.bidSize = 0;
          q.askSize = 0;
        }
      }
    }

    return quotes.filter(q => q.bidSize > 0 || q.askSize > 0);
  }

  /**
   * Longshot zone (YES price 1-15c):
   *
   * Takers here are buying YES "hope tickets" -- they want their team to win,
   * their candidate to be elected, their coin to moon. They systematically
   * overpay. We sell them YES (= buy NO) and collect the premium.
   *
   * We quote:
   * - ASK (sell YES): At or near best ask. We WANT to sell YES here.
   * - BID (buy YES): Further away. We don't want to accumulate YES longshots.
   *
   * The asymmetry: Our ask is aggressive, our bid is passive.
   */
  private computeLongshotQuotes(
    snapshot: MarketSnapshot,
    mid: number,
    expiryMultiplier: number,
  ): Quote[] {
    const { bestBid, bestAsk, ticker, position, adverseSelection } = snapshot;
    const inventory = position?.netExposure ?? 0;

    // Don't accumulate too much exposure
    if (Math.abs(inventory) >= this.params.maxLongshotExposure) {
      // Only quote the side that reduces our position
      if (inventory > 0) {
        // We're long YES, only quote ASK (sell YES to flatten)
        const askPrice = this.clampPrice(bestAsk - 1);
        return [{
          ticker,
          side: "yes",
          bidPrice: 0,
          bidSize: 0,
          askPrice,
          askSize: this.params.sizePerSide,
        }];
      }
      // We're short YES (long NO), only quote BID (buy YES to flatten)
      const bidPrice = this.clampPrice(bestBid + 1);
      return [{
        ticker,
        side: "yes",
        bidPrice,
        bidSize: this.params.sizePerSide,
        askPrice: 0,
        askSize: 0,
      }];
    }

    // Adjust for adverse selection
    let effectiveMinSpread = this.params.minSpreadCents * expiryMultiplier;
    if (adverseSelection) {
      effectiveMinSpread *= this.params.adverseSelectionMultiplier;
    }

    // Inventory skew: if we're accumulating YES, be even more eager to sell
    const skew = inventory * this.params.skewFactor;

    // AGGRESSIVE ASK: We want to sell YES to longshot buyers
    // Quote at or just above best bid to be at front of queue on the ask side
    const askPrice = this.clampPrice(bestAsk - this.params.optimismEdgeCents - skew);

    // PASSIVE BID: We don't really want to buy YES longshots
    // Quote well below market (only fill if market drops to us)
    const bidPrice = this.clampPrice(bestBid - this.params.optimismEdgeCents * 2 - skew);

    // Size: larger on ask (selling YES) since that's where we profit
    const optimismSize = Math.max(1, Math.round(this.params.sizePerSide * this.params.optimismSizeMultiplier));
    const askSize = optimismSize;
    const bidSize = Math.max(1, Math.floor(this.params.sizePerSide * 0.5)); // Half size on bid

    // Ensure minimum spread
    if (askPrice - bidPrice < effectiveMinSpread) {
      return [];
    }

    if (askPrice <= bidPrice) return [];

    return [{
      ticker,
      side: "yes",
      bidPrice,
      bidSize,
      askPrice,
      askSize,
    }];
  }

  /**
   * Near-certainty zone (YES price 85-99c):
   *
   * This is the mirror image. NO contracts are the longshot here.
   * Takers buy NO "hope tickets" (betting the favorite will lose).
   * We sell them NO (= buy YES) and collect the premium.
   *
   * We quote:
   * - BID (buy YES): Aggressive. We WANT to buy YES here (= sell NO).
   * - ASK (sell YES): Passive. We don't want to sell cheap YES.
   */
  private computeNearlyCertainQuotes(
    snapshot: MarketSnapshot,
    mid: number,
    expiryMultiplier: number,
  ): Quote[] {
    const { bestBid, bestAsk, ticker, position, adverseSelection } = snapshot;
    const inventory = position?.netExposure ?? 0;

    // Don't accumulate too much
    if (Math.abs(inventory) >= this.params.maxLongshotExposure) {
      if (inventory > 0) {
        const askPrice = this.clampPrice(bestAsk - 1);
        return [{
          ticker,
          side: "yes",
          bidPrice: 0,
          bidSize: 0,
          askPrice,
          askSize: this.params.sizePerSide,
        }];
      }
      const bidPrice = this.clampPrice(bestBid + 1);
      return [{
        ticker,
        side: "yes",
        bidPrice,
        bidSize: this.params.sizePerSide,
        askPrice: 0,
        askSize: 0,
      }];
    }

    let effectiveMinSpread = this.params.minSpreadCents * expiryMultiplier;
    if (adverseSelection) {
      effectiveMinSpread *= this.params.adverseSelectionMultiplier;
    }

    const skew = inventory * this.params.skewFactor;

    // AGGRESSIVE BID: We want to buy YES (= sell NO to longshot NO buyers)
    const bidPrice = this.clampPrice(bestBid + this.params.optimismEdgeCents - skew);

    // PASSIVE ASK: We don't want to sell cheap YES near certainty
    const askPrice = this.clampPrice(bestAsk + this.params.optimismEdgeCents * 2 - skew);

    const optimismSize = Math.max(1, Math.round(this.params.sizePerSide * this.params.optimismSizeMultiplier));
    const bidSize = optimismSize;
    const askSize = Math.max(1, Math.floor(this.params.sizePerSide * 0.5));

    if (askPrice - bidPrice < effectiveMinSpread) return [];
    if (askPrice <= bidPrice) return [];

    return [{
      ticker,
      side: "yes",
      bidPrice,
      bidSize,
      askPrice,
      askSize,
    }];
  }

  /**
   * Mid-range zone (YES price 16-84c):
   *
   * Standard adaptive market making. The YES/NO asymmetry is weaker here,
   * so we do standard spread capture with inventory management.
   */
  private computeMidRangeQuotes(
    snapshot: MarketSnapshot,
    fairValue: number,
    expiryMultiplier: number,
  ): Quote[] {
    const { bestBid, bestAsk, ticker, position, adverseSelection, imbalance } = snapshot;
    const inventory = position?.netExposure ?? 0;
    const currentImbalance = imbalance ?? 0;

    let effectiveEdge = this.params.edgeCents;
    let effectiveMinSpread = this.params.minSpreadCents * expiryMultiplier;

    if (adverseSelection) {
      effectiveEdge = 0;
      effectiveMinSpread = this.params.minSpreadCents * this.params.adverseSelectionMultiplier * expiryMultiplier;
    }

    // Inventory skew (Avellaneda-Stoikov style)
    const inventorySkew = inventory * this.params.skewFactor;

    let bidPrice = bestBid + effectiveEdge - inventorySkew;
    let askPrice = bestAsk - effectiveEdge - inventorySkew;

    // Ensure minimum spread
    if (askPrice - bidPrice < effectiveMinSpread) {
      bidPrice = bestBid - inventorySkew;
      askPrice = bestAsk - inventorySkew;

      if (bestAsk - bestBid < effectiveMinSpread) {
        return [];
      }
    }

    bidPrice = this.clampPrice(bidPrice);
    askPrice = this.clampPrice(askPrice);

    if (askPrice <= bidPrice) return [];

    let bidSize = this.params.sizePerSide;
    let askSize = this.params.sizePerSide;

    // Max inventory checks
    if (inventory >= this.params.maxInventorySkew) bidSize = 0;
    if (inventory <= -this.params.maxInventorySkew) askSize = 0;

    // Imbalance-based protection
    if (Math.abs(currentImbalance) >= 0.75) {
      if (currentImbalance > 0) askSize = 0;
      else bidSize = 0;
    } else if (Math.abs(currentImbalance) >= 0.6) {
      if (currentImbalance > 0) {
        askSize = Math.max(1, Math.floor(askSize * 0.5));
      } else {
        bidSize = Math.max(1, Math.floor(bidSize * 0.5));
      }
    }

    if (bidSize === 0 && askSize === 0) return [];

    return [{
      ticker,
      side: "yes",
      bidPrice,
      bidSize,
      askPrice,
      askSize,
    }];
  }

  updateParams(params: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(params)) {
      if (key in this.params) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.params as any)[key] = value;
      }
    }
  }

  getParams(): OptimismTaxParams {
    return { ...this.params };
  }
}
