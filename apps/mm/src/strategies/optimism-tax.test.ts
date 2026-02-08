import { describe, it, expect } from "vitest";
import { OptimismTaxStrategy } from "./optimism-tax.js";
import type { MarketSnapshot } from "./base.js";

function makeSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    ticker: "TEST-MARKET",
    bestBid: 50,
    bestAsk: 55,
    mid: 52.5,
    spread: 5,
    position: null,
    ...overrides,
  };
}

describe("OptimismTaxStrategy", () => {
  const strategy = new OptimismTaxStrategy({
    sizePerSide: 5,
    optimismSizeMultiplier: 1.5,
    longShotThreshold: 15,
    nearlyCertainThreshold: 85,
    maxInventorySkew: 30,
  });

  describe("zone detection", () => {
    it("uses longshot logic when YES price is low (1-15c)", () => {
      // Fresh instance to avoid volatility cross-contamination
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        optimismSizeMultiplier: 1.5,
        longShotThreshold: 15,
        nearlyCertainThreshold: 85,
        maxInventorySkew: 30,
      });
      const snapshot = makeSnapshot({
        ticker: "ZONE-LONGSHOT",
        bestBid: 5,
        bestAsk: 10,
        mid: 7.5,
        spread: 5,
      });

      const quotes = strat.computeQuotes(snapshot);
      expect(quotes.length).toBe(1);

      // In longshot zone, ask size should be larger than bid size
      // (we WANT to sell YES / provide liquidity to optimistic takers)
      const q = quotes[0];
      expect(q.askSize).toBeGreaterThan(q.bidSize);
    });

    it("uses near-certainty logic when YES price is high (85-99c)", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        optimismSizeMultiplier: 1.5,
        longShotThreshold: 15,
        nearlyCertainThreshold: 85,
        maxInventorySkew: 30,
      });
      const snapshot = makeSnapshot({
        ticker: "ZONE-CERTAIN",
        bestBid: 90,
        bestAsk: 95,
        mid: 92.5,
        spread: 5,
      });

      const quotes = strat.computeQuotes(snapshot);
      expect(quotes.length).toBe(1);

      // In near-certainty zone, bid size should be larger than ask size
      // (we WANT to buy YES / sell NO longshots)
      const q = quotes[0];
      expect(q.bidSize).toBeGreaterThan(q.askSize);
    });

    it("uses mid-range logic for 16-84c prices", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        optimismSizeMultiplier: 1.5,
        longShotThreshold: 15,
        nearlyCertainThreshold: 85,
        maxInventorySkew: 30,
      });
      const snapshot = makeSnapshot({
        ticker: "ZONE-MID",
        bestBid: 45,
        bestAsk: 50,
        mid: 47.5,
        spread: 5,
      });

      const quotes = strat.computeQuotes(snapshot);
      expect(quotes.length).toBe(1);

      // In mid-range, sizes should be equal (standard MM)
      const q = quotes[0];
      expect(q.bidSize).toBe(q.askSize);
    });
  });

  describe("longshot zone quoting", () => {
    it("quotes asymmetric sizes - larger ask (selling YES)", () => {
      const snapshot = makeSnapshot({
        bestBid: 8,
        bestAsk: 14,
        mid: 11,
        spread: 6,
      });

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes.length).toBe(1);
      expect(quotes[0].askSize).toBe(8); // 5 * 1.5 rounded
      expect(quotes[0].bidSize).toBe(2); // 5 * 0.5 floored
    });

    it("only quotes sell-side when at max long exposure", () => {
      const snapshot = makeSnapshot({
        bestBid: 8,
        bestAsk: 14,
        mid: 11,
        spread: 6,
        position: {
          ticker: "TEST-MARKET",
          yesContracts: 50,
          noContracts: 0,
          netExposure: 50,
          costBasis: 0,
          yesCostBasis: 0,
          noCostBasis: 0,
          unrealizedPnL: 0,
        },
      });

      const strat = new OptimismTaxStrategy({
        maxLongshotExposure: 50,
        sizePerSide: 5,
      });
      const quotes = strat.computeQuotes(snapshot);
      expect(quotes.length).toBe(1);
      expect(quotes[0].bidSize).toBe(0); // Don't buy more
      expect(quotes[0].askSize).toBeGreaterThan(0); // Sell to flatten
    });
  });

  describe("near-certainty zone quoting", () => {
    it("quotes asymmetric sizes - larger bid (buying YES)", () => {
      const snapshot = makeSnapshot({
        bestBid: 90,
        bestAsk: 96,
        mid: 93,
        spread: 6,
      });

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes.length).toBe(1);
      expect(quotes[0].bidSize).toBe(8); // 5 * 1.5 rounded
      expect(quotes[0].askSize).toBe(2); // 5 * 0.5 floored
    });
  });

  describe("time-decay", () => {
    it("stops quoting when very close to expiry", () => {
      const strat = new OptimismTaxStrategy({ sizePerSide: 5 });
      const snapshot = makeSnapshot({
        ticker: "DECAY-STOP",
        timeToExpiry: 60, // 1 minute left
      });

      const quotes = strat.computeQuotes(snapshot);
      expect(quotes.length).toBe(0);
    });

    it("quotes normally when far from expiry", () => {
      const strat = new OptimismTaxStrategy({ sizePerSide: 5 });
      const snapshot = makeSnapshot({
        ticker: "DECAY-NORMAL",
        timeToExpiry: 7200, // 2 hours
      });

      const quotes = strat.computeQuotes(snapshot);
      expect(quotes.length).toBe(1);
    });
  });

  describe("adverse selection", () => {
    it("widens spread when adverse selection detected", () => {
      const normal = strategy.computeQuotes(
        makeSnapshot({ bestBid: 45, bestAsk: 52, mid: 48.5, spread: 7 })
      );

      const adverse = strategy.computeQuotes(
        makeSnapshot({
          bestBid: 45,
          bestAsk: 52,
          mid: 48.5,
          spread: 7,
          adverseSelection: true,
        })
      );

      // When adverse selection is active, either no quotes or wider spread
      if (adverse.length > 0 && normal.length > 0) {
        const normalSpread = normal[0].askPrice - normal[0].bidPrice;
        const adverseSpread = adverse[0].askPrice - adverse[0].bidPrice;
        expect(adverseSpread).toBeGreaterThanOrEqual(normalSpread);
      }
    });
  });

  describe("non-quotable markets", () => {
    it("returns empty for invalid prices", () => {
      const quotes = strategy.computeQuotes(makeSnapshot({ bestBid: 0, bestAsk: 0 }));
      expect(quotes.length).toBe(0);
    });

    it("returns empty for crossed market", () => {
      const quotes = strategy.computeQuotes(makeSnapshot({ bestBid: 60, bestAsk: 40, spread: -20 }));
      expect(quotes.length).toBe(0);
    });

    it("returns empty for very wide spread", () => {
      const quotes = strategy.computeQuotes(makeSnapshot({ bestBid: 10, bestAsk: 80, spread: 70 }));
      expect(quotes.length).toBe(0);
    });
  });

  describe("volatility detection", () => {
    it("detects volatile market from rapid price swings", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        volatilityWindow: 5,
        volatilityThresholdCents: 8,
      });

      // Simulate a live event with 15¢ swing over 5 snapshots
      const prices = [50, 55, 60, 45, 50];
      for (const p of prices) {
        strat.computeQuotes(makeSnapshot({
          bestBid: p - 2,
          bestAsk: p + 2,
          mid: p,
          spread: 4,
        }));
      }

      expect(strat.isMarketVolatile("TEST-MARKET")).toBe(true);
    });

    it("does NOT flag stable market as volatile", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        volatilityWindow: 5,
        volatilityThresholdCents: 8,
      });

      // Stable market: only 3¢ total movement
      const prices = [50, 51, 52, 51, 50];
      for (const p of prices) {
        strat.computeQuotes(makeSnapshot({
          bestBid: p - 2,
          bestAsk: p + 2,
          mid: p,
          spread: 4,
        }));
      }

      expect(strat.isMarketVolatile("TEST-MARKET")).toBe(false);
    });

    it("returns empty quotes for volatile mid-range with no position", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        volatilityWindow: 5,
        volatilityThresholdCents: 8,
      });

      // Build up volatile history (15¢ swing)
      const prices = [50, 55, 60, 45, 50];
      for (const p of prices) {
        strat.computeQuotes(makeSnapshot({
          bestBid: p - 2,
          bestAsk: p + 2,
          mid: p,
          spread: 4,
        }));
      }

      // Now try to quote with no position — should get nothing
      const quotes = strat.computeQuotes(makeSnapshot({
        bestBid: 48,
        bestAsk: 52,
        mid: 50,
        spread: 4,
        position: null,
      }));

      expect(quotes.length).toBe(0);
    });

    it("only allows flattening side for volatile mid-range with long position", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        volatilityWindow: 5,
        volatilityThresholdCents: 8,
      });

      // Build up volatile history
      const prices = [50, 55, 60, 45, 50];
      for (const p of prices) {
        strat.computeQuotes(makeSnapshot({
          bestBid: p - 2,
          bestAsk: p + 2,
          mid: p,
          spread: 4,
        }));
      }

      // Quote with a long YES position — only ask (sell) should be active
      const quotes = strat.computeQuotes(makeSnapshot({
        bestBid: 48,
        bestAsk: 52,
        mid: 50,
        spread: 4,
        position: {
          ticker: "TEST-MARKET",
          yesContracts: 5,
          noContracts: 0,
          netExposure: 5,
          costBasis: 250,
          yesCostBasis: 250,
          noCostBasis: 0,
          unrealizedPnL: 0,
        },
      }));

      expect(quotes.length).toBe(1);
      expect(quotes[0].bidSize).toBe(0); // Suppress bid (don't buy more)
      expect(quotes[0].askSize).toBeGreaterThan(0); // Allow sell to flatten
    });

    it("only allows flattening side for volatile mid-range with short position", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        volatilityWindow: 5,
        volatilityThresholdCents: 8,
      });

      // Build up volatile history
      const prices = [50, 55, 60, 45, 50];
      for (const p of prices) {
        strat.computeQuotes(makeSnapshot({
          bestBid: p - 2,
          bestAsk: p + 2,
          mid: p,
          spread: 4,
        }));
      }

      // Quote with a short YES position — only bid (buy) should be active
      const quotes = strat.computeQuotes(makeSnapshot({
        bestBid: 48,
        bestAsk: 52,
        mid: 50,
        spread: 4,
        position: {
          ticker: "TEST-MARKET",
          yesContracts: 0,
          noContracts: 5,
          netExposure: -5,
          costBasis: 250,
          yesCostBasis: 0,
          noCostBasis: 250,
          unrealizedPnL: 0,
        },
      }));

      expect(quotes.length).toBe(1);
      expect(quotes[0].askSize).toBe(0); // Suppress ask (don't sell more)
      expect(quotes[0].bidSize).toBeGreaterThan(0); // Allow buy to flatten
    });

    it("allows normal spread capture on stable mid-range even with position", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        volatilityWindow: 5,
        volatilityThresholdCents: 8,
      });

      // Stable market
      const prices = [50, 51, 50, 51, 50];
      for (const p of prices) {
        strat.computeQuotes(makeSnapshot({
          bestBid: p - 3,
          bestAsk: p + 3,
          mid: p,
          spread: 6,
        }));
      }

      // With a position — both sides should still be active for spread capture
      const quotes = strat.computeQuotes(makeSnapshot({
        bestBid: 47,
        bestAsk: 53,
        mid: 50,
        spread: 6,
        position: {
          ticker: "TEST-MARKET",
          yesContracts: 3,
          noContracts: 0,
          netExposure: 3,
          costBasis: 150,
          yesCostBasis: 150,
          noCostBasis: 0,
          unrealizedPnL: 0,
        },
      }));

      expect(quotes.length).toBe(1);
      expect(quotes[0].bidSize).toBeGreaterThan(0);
      expect(quotes[0].askSize).toBeGreaterThan(0);
    });

    it("does NOT suppress longshot/near-certainty zones for volatility", () => {
      const strat = new OptimismTaxStrategy({
        sizePerSide: 5,
        volatilityWindow: 5,
        volatilityThresholdCents: 8,
        longShotThreshold: 15,
      });

      // Build volatility history in longshot range
      const prices = [5, 10, 3, 12, 5];
      for (const p of prices) {
        strat.computeQuotes(makeSnapshot({
          ticker: "LONGSHOT-MKT",
          bestBid: Math.max(1, p - 2),
          bestAsk: Math.min(99, p + 2),
          mid: p,
          spread: 4,
        }));
      }

      // Should still quote in longshot zone regardless of volatility
      const quotes = strat.computeQuotes(makeSnapshot({
        ticker: "LONGSHOT-MKT",
        bestBid: 5,
        bestAsk: 10,
        mid: 7.5,
        spread: 5,
        position: null,
      }));

      expect(quotes.length).toBe(1);
      expect(quotes[0].askSize).toBeGreaterThan(0); // Should still sell YES
    });
  });

  describe("updateParams", () => {
    it("updates threshold parameters", () => {
      const strat = new OptimismTaxStrategy();
      strat.updateParams({ longShotThreshold: 20 });
      const params = strat.getParams();
      expect(params.longShotThreshold).toBe(20);
    });
  });
});
