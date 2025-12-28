import { describe, it, expect, beforeEach } from "vitest";
import { AdverseSelectionDetector, type FillRecord } from "./adverse-selection.js";

describe("AdverseSelectionDetector", () => {
  let detector: AdverseSelectionDetector;

  beforeEach(() => {
    detector = new AdverseSelectionDetector({
      consecutiveThreshold: 3,
      priceMoveCents: 2,
      adverseThreshold: 50,
      cooldownMs: 1000, // 1 second for testing
    });
  });

  describe("recordFill", () => {
    it("should track fills", () => {
      const fill: FillRecord = {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        timestamp: Date.now(),
      };

      detector.recordFill(fill, 50);
      
      const stats = detector.getStats("TEST-MARKET");
      expect(stats).not.toBeNull();
      expect(stats?.recentFills).toHaveLength(1);
      expect(stats?.consecutiveBuys).toBe(1);
      expect(stats?.consecutiveSells).toBe(0);
    });

    it("should track consecutive fills", () => {
      const now = Date.now();
      
      // 3 consecutive sells
      for (let i = 0; i < 3; i++) {
        detector.recordFill({
          ticker: "TEST-MARKET",
          side: "yes",
          action: "sell",
          price: 50,
          timestamp: now + i * 100,
        }, 50);
      }

      const stats = detector.getStats("TEST-MARKET");
      expect(stats?.consecutiveSells).toBe(3);
      expect(stats?.consecutiveBuys).toBe(0);
    });

    it("should reset consecutive count on direction change", () => {
      detector.recordFill({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        timestamp: Date.now(),
      }, 50);

      detector.recordFill({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        price: 50,
        timestamp: Date.now() + 100,
      }, 50);

      const stats = detector.getStats("TEST-MARKET");
      expect(stats?.consecutiveSells).toBe(1);
      expect(stats?.consecutiveBuys).toBe(0);
    });
  });

  describe("adverse detection", () => {
    it("should not flag with few fills", () => {
      detector.recordFill({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        price: 50,
        timestamp: Date.now(),
      }, 50);

      expect(detector.isAdverse("TEST-MARKET")).toBe(false);
    });

    it("should flag on consecutive fills + price move", () => {
      const now = Date.now();
      
      // 3 consecutive sells at 50
      for (let i = 0; i < 3; i++) {
        detector.recordFill({
          ticker: "TEST-MARKET",
          side: "yes",
          action: "sell",
          price: 50,
          timestamp: now + i * 100,
        }, 50);
      }

      // Price moved up (adverse for seller)
      detector.updatePrice("TEST-MARKET", 55);

      expect(detector.isAdverse("TEST-MARKET")).toBe(true);
    });

    it("should return flagged markets", () => {
      const now = Date.now();
      
      // Flag market 1
      for (let i = 0; i < 3; i++) {
        detector.recordFill({
          ticker: "MARKET-1",
          side: "yes",
          action: "sell",
          price: 50,
          timestamp: now + i * 100,
        }, 50);
      }
      detector.updatePrice("MARKET-1", 55);

      const flagged = detector.getFlaggedMarkets();
      expect(flagged).toContain("MARKET-1");
    });
  });

  describe("cooldown", () => {
    it("should expire after cooldown", async () => {
      const now = Date.now();
      
      // Trigger adverse detection
      for (let i = 0; i < 3; i++) {
        detector.recordFill({
          ticker: "TEST-MARKET",
          side: "yes",
          action: "sell",
          price: 50,
          timestamp: now + i * 100,
        }, 50);
      }
      detector.updatePrice("TEST-MARKET", 55);

      expect(detector.isAdverse("TEST-MARKET")).toBe(true);

      // Wait for cooldown (1 second in test config)
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(detector.isAdverse("TEST-MARKET")).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset single market", () => {
      detector.recordFill({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        timestamp: Date.now(),
      }, 50);

      detector.reset("TEST-MARKET");

      expect(detector.getStats("TEST-MARKET")).toBeNull();
    });

    it("should reset all markets", () => {
      detector.recordFill({
        ticker: "MARKET-1",
        side: "yes",
        action: "buy",
        price: 50,
        timestamp: Date.now(),
      }, 50);

      detector.recordFill({
        ticker: "MARKET-2",
        side: "yes",
        action: "buy",
        price: 50,
        timestamp: Date.now(),
      }, 50);

      detector.resetAll();

      expect(detector.getStats("MARKET-1")).toBeNull();
      expect(detector.getStats("MARKET-2")).toBeNull();
    });
  });

  describe("getScore", () => {
    it("should return 0 for unknown market", () => {
      expect(detector.getScore("UNKNOWN")).toBe(0);
    });

    it("should return score for tracked market", () => {
      detector.recordFill({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        timestamp: Date.now(),
      }, 50);

      // Score should be low with just one fill
      expect(detector.getScore("TEST-MARKET")).toBeLessThan(50);
    });
  });
});

