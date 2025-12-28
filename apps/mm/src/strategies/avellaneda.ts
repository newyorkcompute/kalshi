/**
 * Avellaneda-Stoikov Market Making Strategy
 * 
 * Based on the seminal paper:
 * "High-frequency trading in a limit order book" (Avellaneda & Stoikov, 2008)
 * 
 * Key concepts:
 * - Reservation price: The price at which the MM is indifferent to trading
 * - Optimal spread: Based on inventory risk and order arrival rates
 * - Time decay: Spread narrows as we approach market close
 * 
 * The strategy solves for optimal bid/ask quotes that maximize expected
 * utility while managing inventory risk.
 */

import type { Quote } from "@newyorkcompute/kalshi-core";
import { BaseStrategy, type MarketSnapshot } from "./base.js";

export interface AvellanedaStoikovParams {
  /**
   * Risk aversion parameter (gamma)
   * Higher = more conservative (wider spreads, faster inventory reduction)
   * Typical range: 0.01 - 1.0
   */
  gamma: number;

  /**
   * Order arrival intensity (k)
   * Estimate of how frequently orders arrive at our price level
   * Higher = expect more fills, can quote tighter
   * Typical range: 0.5 - 5.0
   */
  k: number;

  /**
   * Volatility estimate (sigma)
   * Standard deviation of price per unit time
   * Higher volatility = wider spreads needed
   * Typical range: 0.05 - 0.5 (5% - 50% annualized)
   */
  sigma: number;

  /**
   * Time horizon in seconds (T)
   * How far ahead we're optimizing for
   * Could be time until market close or a rolling window
   * Default: 3600 (1 hour)
   */
  T: number;

  /**
   * Maximum position (inventory) per side
   * Stop quoting the increasing side at this level
   */
  maxPosition: number;

  /**
   * Size per order
   */
  sizePerSide: number;

  /**
   * Minimum spread (cents)
   * Floor to ensure profitability
   */
  minSpread: number;

  /**
   * Maximum spread (cents)
   * Cap to stay competitive
   */
  maxSpread: number;

  /**
   * Use time-to-expiry from market data if available
   * Otherwise uses fixed T parameter
   */
  useMarketExpiry: boolean;
}

const DEFAULT_PARAMS: AvellanedaStoikovParams = {
  gamma: 0.1,        // Moderate risk aversion
  k: 1.5,            // Moderate order arrival rate
  sigma: 0.15,       // 15% volatility
  T: 3600,           // 1 hour horizon
  maxPosition: 100,  // Max 100 contracts per side
  sizePerSide: 5,    // 5 contracts per order
  minSpread: 2,      // Minimum 2¢ spread
  maxSpread: 20,     // Maximum 20¢ spread
  useMarketExpiry: true,
};

/**
 * Avellaneda-Stoikov Strategy
 * 
 * Quote prices are derived from:
 * 
 * 1. Reservation price (r):
 *    r = s - q * γ * σ² * τ
 *    where:
 *    - s = mid price
 *    - q = current inventory
 *    - γ = risk aversion
 *    - σ = volatility
 *    - τ = time remaining
 * 
 * 2. Optimal spread (δ):
 *    δ = γ * σ² * τ + (2/γ) * ln(1 + γ/k)
 *    where:
 *    - k = order arrival intensity
 * 
 * 3. Bid/Ask:
 *    bid = r - δ/2
 *    ask = r + δ/2
 * 
 * The reservation price adjusts for inventory risk:
 * - If LONG (q > 0): r < s (we value the asset less, more eager to sell)
 * - If SHORT (q < 0): r > s (we value the asset more, more eager to buy)
 */
export class AvellanedaStoikovStrategy extends BaseStrategy {
  readonly name = "avellaneda";
  private params: AvellanedaStoikovParams;

  constructor(params: Partial<AvellanedaStoikovParams> = {}) {
    super();
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  computeQuotes(snapshot: MarketSnapshot): Quote[] {
    // Skip if not quotable
    if (!this.isQuotable(snapshot)) {
      return [];
    }

    const { bestBid, bestAsk, position, timeToExpiry, microprice } = snapshot;
    const { gamma, k, sigma, minSpread, maxSpread, maxPosition, sizePerSide, useMarketExpiry, T } = this.params;

    // Current inventory
    const q = position?.netExposure ?? 0;

    // Mid price (use microprice if available for better fair value)
    const s = microprice ?? (bestBid + bestAsk) / 2;

    // Time remaining (τ)
    // Use market expiry if available and enabled, otherwise use fixed T
    let tau = T;
    if (useMarketExpiry && timeToExpiry !== undefined && timeToExpiry > 0) {
      tau = timeToExpiry;
    }

    // Don't quote in final 5 minutes (too risky)
    if (tau < 300) {
      return [];
    }

    // Normalize tau for the formulas (typically expressed in units where σ is per-unit-time)
    // For simplicity, we use tau in seconds and scale sigma accordingly
    const tauNormalized = tau / 3600; // Convert to hours for typical σ scaling

    // === AVELLANEDA-STOIKOV FORMULAS ===

    // Reservation price: r = s - q * γ * σ² * τ
    // This shifts our "fair value" based on inventory
    const r = s - q * gamma * sigma * sigma * tauNormalized;

    // Optimal spread: δ = γ * σ² * τ + (2/γ) * ln(1 + γ/k)
    const spreadFromVolatility = gamma * sigma * sigma * tauNormalized;
    const spreadFromArrival = (2 / gamma) * Math.log(1 + gamma / k);
    let optimalSpread = spreadFromVolatility + spreadFromArrival;

    // Scale spread to cents (assuming sigma is in percentage terms)
    // This scaling factor may need tuning based on your market
    optimalSpread = optimalSpread * 100; // Convert to cents

    // Clamp spread to min/max
    optimalSpread = Math.max(minSpread, Math.min(maxSpread, optimalSpread));

    // Calculate bid and ask
    let bidPrice = r - optimalSpread / 2;
    let askPrice = r + optimalSpread / 2;

    // Clamp to valid price range
    bidPrice = this.clampPrice(bidPrice);
    askPrice = this.clampPrice(askPrice);

    // Sanity check
    if (askPrice <= bidPrice) {
      return [];
    }

    // Determine sizes based on inventory limits
    let bidSize = sizePerSide;
    let askSize = sizePerSide;

    // If we're at max long inventory, don't bid
    if (q >= maxPosition) {
      bidSize = 0;
    }
    // If we're at max short inventory, don't ask
    if (q <= -maxPosition) {
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
        bidPrice: Math.round(bidPrice),
        bidSize,
        askPrice: Math.round(askPrice),
        askSize,
      },
    ];
  }

  updateParams(params: Record<string, unknown>): void {
    if (typeof params.gamma === "number") {
      this.params.gamma = params.gamma;
    }
    if (typeof params.k === "number") {
      this.params.k = params.k;
    }
    if (typeof params.sigma === "number") {
      this.params.sigma = params.sigma;
    }
    if (typeof params.T === "number") {
      this.params.T = params.T;
    }
    if (typeof params.maxPosition === "number") {
      this.params.maxPosition = params.maxPosition;
    }
    if (typeof params.sizePerSide === "number") {
      this.params.sizePerSide = params.sizePerSide;
    }
    if (typeof params.minSpread === "number") {
      this.params.minSpread = params.minSpread;
    }
    if (typeof params.maxSpread === "number") {
      this.params.maxSpread = params.maxSpread;
    }
    if (typeof params.useMarketExpiry === "boolean") {
      this.params.useMarketExpiry = params.useMarketExpiry;
    }
  }

  getParams(): AvellanedaStoikovParams {
    return { ...this.params };
  }
}

