/**
 * Weather-Informed Strategy
 *
 * An informed market-making strategy that uses NWS weather forecasts
 * to compute fair values for temperature contracts. Only trades when
 * the model disagrees with the market by a configurable threshold.
 *
 * Key differences from OptimismTaxStrategy:
 * - Uses external data (NWS forecasts) instead of blind directional bets
 * - Only trades when model-market edge exceeds minEdgeCents
 * - Position sizing proportional to edge magnitude
 * - Designed for hold-to-settlement (no need to close before expiry)
 * - Uses post_only for zero fees
 *
 * Decision flow:
 * 1. Get model fair value from MarketSnapshot.modelFairValue (injected by bot)
 * 2. Compute edge = |market_price - model_fair_value|
 * 3. If edge < minEdgeCents → no quote (skip)
 * 4. If market > model → SELL YES (market overpriced)
 * 5. If market < model → BUY YES (market underpriced)
 * 6. Size = sizePerEdgeCent * edge (capped by maxPositionPerMarket)
 */

import type { Quote } from "@newyorkcompute/kalshi-core";
import { BaseStrategy, type MarketSnapshot } from "./base.js";

export interface WeatherInformedParams {
  /** Minimum edge in cents to trade (default 3) */
  minEdgeCents: number;
  /** Maximum position per market in contracts (default 15) */
  maxPositionPerMarket: number;
  /** Contracts per cent of edge (default 2) */
  sizePerEdgeCent: number;
  /** Maximum contracts per order (default 10) */
  maxOrderSize: number;
  /** Price offset from fair value (cents) to place limit orders (default 1) */
  priceOffset: number;
}

const DEFAULT_PARAMS: WeatherInformedParams = {
  minEdgeCents: 3,
  maxPositionPerMarket: 15,
  sizePerEdgeCent: 2,
  maxOrderSize: 10,
  priceOffset: 1,
};

export class WeatherInformedStrategy extends BaseStrategy {
  readonly name = "weather-informed";
  private params: WeatherInformedParams;

  constructor(params: Partial<WeatherInformedParams> = {}) {
    super();
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  computeQuotes(snapshot: MarketSnapshot): Quote[] {
    const { ticker, bestBid, bestAsk, position, modelFairValue } = snapshot;

    // No model fair value → can't trade this market
    if (modelFairValue === undefined || modelFairValue === null) {
      return [];
    }

    // Basic quotability check (valid BBO, reasonable spread)
    if (bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) {
      return [];
    }

    const marketMid = (bestBid + bestAsk) / 2;
    const edge = marketMid - modelFairValue;
    const absEdge = Math.abs(edge);

    // Not enough edge → don't trade
    if (absEdge < this.params.minEdgeCents) {
      return [];
    }

    // Current inventory
    const inventory = position?.netExposure ?? 0;

    // Check position limits
    if (Math.abs(inventory) >= this.params.maxPositionPerMarket) {
      // At max position — only allow reducing trades
      return this.computeReducingQuote(ticker, inventory, bestBid, bestAsk, edge);
    }

    // Compute size proportional to edge, capped by limits
    const remainingCapacity = this.params.maxPositionPerMarket - Math.abs(inventory);
    const edgeBasedSize = Math.floor(this.params.sizePerEdgeCent * absEdge);
    const size = Math.max(1, Math.min(
      edgeBasedSize,
      this.params.maxOrderSize,
      remainingCapacity,
    ));

    if (edge > 0) {
      // Market overpriced relative to model → SELL YES
      // Place an ask (sell YES) above model fair value
      return this.computeSellQuote(ticker, size, bestBid, bestAsk, modelFairValue);
    } else {
      // Market underpriced relative to model → BUY YES
      // Place a bid (buy YES) below model fair value
      return this.computeBuyQuote(ticker, size, bestBid, bestAsk, modelFairValue);
    }
  }

  /**
   * Compute a SELL YES quote (market is overpriced).
   *
   * We want to sell YES above our fair value to capture the optimism premium.
   * Quote as a limit order near the ask side, but above fair value.
   */
  private computeSellQuote(
    ticker: string,
    size: number,
    bestBid: number,
    bestAsk: number,
    fairValue: number,
  ): Quote[] {
    // Ask price: at least fairValue + offset, but don't go below bestBid + 1
    const minAsk = Math.max(
      this.clampPrice(fairValue + this.params.priceOffset),
      this.clampPrice(bestBid + 1),
    );
    // Also try to be competitive: near the best ask
    const askPrice = Math.min(minAsk, this.clampPrice(bestAsk - 1));

    // Final check: ask must be above fair value
    if (askPrice <= fairValue) {
      return [];
    }

    return [{
      ticker,
      side: "yes" as const,
      bidPrice: 0,
      bidSize: 0,
      askPrice,
      askSize: size,
    }];
  }

  /**
   * Compute a BUY YES quote (market is underpriced).
   *
   * We want to buy YES below our fair value.
   * Quote as a limit order near the bid side, but below fair value.
   */
  private computeBuyQuote(
    ticker: string,
    size: number,
    bestBid: number,
    bestAsk: number,
    fairValue: number,
  ): Quote[] {
    // Bid price: at most fairValue - offset, but don't go above bestAsk - 1
    const maxBid = Math.min(
      this.clampPrice(fairValue - this.params.priceOffset),
      this.clampPrice(bestAsk - 1),
    );
    // Also try to be competitive: near the best bid
    const bidPrice = Math.max(maxBid, this.clampPrice(bestBid + 1));

    // Final check: bid must be below fair value
    if (bidPrice >= fairValue) {
      return [];
    }

    return [{
      ticker,
      side: "yes" as const,
      bidPrice,
      bidSize: size,
      askPrice: 0,
      askSize: 0,
    }];
  }

  /**
   * When at max position, only allow trades that reduce exposure.
   */
  private computeReducingQuote(
    ticker: string,
    inventory: number,
    bestBid: number,
    bestAsk: number,
    edge: number,
  ): Quote[] {
    const size = Math.min(this.params.maxOrderSize, Math.abs(inventory));

    if (inventory > 0 && edge > 0) {
      // Long YES and market is overpriced → sell YES to reduce
      const askPrice = this.clampPrice(bestAsk - 1);
      return [{
        ticker,
        side: "yes" as const,
        bidPrice: 0,
        bidSize: 0,
        askPrice,
        askSize: size,
      }];
    }

    if (inventory < 0 && edge < 0) {
      // Short YES and market is underpriced → buy YES to reduce
      const bidPrice = this.clampPrice(bestBid + 1);
      return [{
        ticker,
        side: "yes" as const,
        bidPrice,
        bidSize: size,
        askPrice: 0,
        askSize: 0,
      }];
    }

    // Edge direction doesn't align with reducing — skip
    return [];
  }

  updateParams(params: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(params)) {
      if (key in this.params) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.params as any)[key] = value;
      }
    }
  }

  getParams(): WeatherInformedParams {
    return { ...this.params };
  }
}
