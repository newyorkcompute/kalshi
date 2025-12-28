/**
 * Risk Controls Tests
 * 
 * Tests for DrawdownManager and CircuitBreaker
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DrawdownManager, CircuitBreaker } from "./risk-controls.js";

describe("DrawdownManager", () => {
  let manager: DrawdownManager;

  beforeEach(() => {
    manager = new DrawdownManager({
      scaleDownStart: 300,
      halfSizeDrawdown: 500,
      haltDrawdown: 1000,
    });
  });

  describe("updatePnL", () => {
    it("should track peak P&L", () => {
      manager.updatePnL(100);
      manager.updatePnL(200);
      manager.updatePnL(150);

      const status = manager.getStatus();
      expect(status.peakPnL).toBe(200);
      expect(status.currentPnL).toBe(150);
    });

    it("should calculate drawdown from peak", () => {
      manager.updatePnL(500);
      manager.updatePnL(300);

      expect(manager.getDrawdown()).toBe(200);
    });

    it("should handle negative P&L", () => {
      // Starting from 0, peak stays at 0 when we go negative
      manager.updatePnL(-100);
      manager.updatePnL(-200);

      const status = manager.getStatus();
      expect(status.peakPnL).toBe(0); // Peak stays at initial 0
      expect(status.drawdown).toBe(200); // 200¢ drawdown from 0 to -200
    });

    it("should track peak correctly when starting positive then going negative", () => {
      manager.updatePnL(100);  // Peak = 100
      manager.updatePnL(-50);  // Current = -50

      const status = manager.getStatus();
      expect(status.peakPnL).toBe(100);
      expect(status.drawdown).toBe(150); // 150¢ drawdown from 100 to -50
    });
  });

  describe("getPositionMultiplier", () => {
    it("should return 1.0 when no drawdown", () => {
      manager.updatePnL(100);
      expect(manager.getPositionMultiplier()).toBe(1.0);
    });

    it("should return 1.0 when drawdown below scaleDownStart", () => {
      manager.updatePnL(1000);
      manager.updatePnL(800); // 200¢ drawdown < 300¢ threshold

      expect(manager.getPositionMultiplier()).toBe(1.0);
    });

    it("should scale between 1.0 and 0.5 between scaleDownStart and halfSizeDrawdown", () => {
      manager.updatePnL(1000);
      manager.updatePnL(600); // 400¢ drawdown (halfway between 300 and 500)

      const multiplier = manager.getPositionMultiplier();
      expect(multiplier).toBeCloseTo(0.75, 2); // 50% through, so 1.0 - 0.5*0.5 = 0.75
    });

    it("should return 0.5 at halfSizeDrawdown", () => {
      manager.updatePnL(1000);
      manager.updatePnL(500); // 500¢ drawdown

      expect(manager.getPositionMultiplier()).toBeCloseTo(0.5, 2);
    });

    it("should scale between 0.5 and 0.0 between halfSizeDrawdown and haltDrawdown", () => {
      manager.updatePnL(1000);
      manager.updatePnL(250); // 750¢ drawdown (halfway between 500 and 1000)

      const multiplier = manager.getPositionMultiplier();
      expect(multiplier).toBeCloseTo(0.25, 2); // 50% through second phase
    });

    it("should return 0.0 at haltDrawdown", () => {
      manager.updatePnL(1000);
      manager.updatePnL(0); // 1000¢ drawdown

      expect(manager.getPositionMultiplier()).toBe(0.0);
    });
  });

  describe("shouldHalt", () => {
    it("should not halt below threshold", () => {
      manager.updatePnL(1000);
      manager.updatePnL(100); // 900¢ drawdown

      expect(manager.shouldHalt()).toBe(false);
    });

    it("should halt at threshold", () => {
      manager.updatePnL(1000);
      manager.updatePnL(0); // 1000¢ drawdown

      expect(manager.shouldHalt()).toBe(true);
    });

    it("should halt beyond threshold", () => {
      manager.updatePnL(1000);
      manager.updatePnL(-500); // 1500¢ drawdown

      expect(manager.shouldHalt()).toBe(true);
    });
  });

  describe("setSessionStart", () => {
    it("should initialize all values", () => {
      manager.setSessionStart(500);

      const status = manager.getStatus();
      expect(status.peakPnL).toBe(500);
      expect(status.currentPnL).toBe(500);
      expect(status.drawdown).toBe(0);
    });
  });

  describe("reset", () => {
    it("should reset all values", () => {
      manager.updatePnL(1000);
      manager.updatePnL(500);
      manager.reset();

      const status = manager.getStatus();
      expect(status.peakPnL).toBe(0);
      expect(status.currentPnL).toBe(0);
      expect(status.drawdown).toBe(0);
    });
  });
});

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      maxConsecutiveLosses: 3,
      rapidLossWindowMs: 60000,
      rapidLossThreshold: 5,
      cooldownMs: 10000,
    });
  });

  describe("onFill - consecutive losses", () => {
    it("should not trigger on first loss", () => {
      const triggered = breaker.onFill(-100);
      expect(triggered).toBe(false);
      expect(breaker.isTriggered()).toBe(false);
    });

    it("should trigger on max consecutive losses", () => {
      breaker.onFill(-100);
      breaker.onFill(-100);
      const triggered = breaker.onFill(-100);

      expect(triggered).toBe(true);
      expect(breaker.isTriggered()).toBe(true);
    });

    it("should reset consecutive count on win", () => {
      breaker.onFill(-100);
      breaker.onFill(-100);
      breaker.onFill(50); // Win resets

      expect(breaker.isTriggered()).toBe(false);

      const status = breaker.getStatus();
      expect(status.consecutiveLosses).toBe(0);
    });

    it("should stay triggered after trigger", () => {
      breaker.onFill(-100);
      breaker.onFill(-100);
      breaker.onFill(-100);
      breaker.onFill(500); // Win shouldn't reset once triggered

      expect(breaker.isTriggered()).toBe(true);
    });
  });

  describe("onFill - rapid losses", () => {
    it("should trigger on rapid losses within window", () => {
      // 5 losses rapidly
      for (let i = 0; i < 5; i++) {
        const triggered = breaker.onFill(-100);
        if (i === 4) {
          expect(triggered).toBe(true);
        }
      }
      expect(breaker.isTriggered()).toBe(true);
    });
  });

  describe("cooldown", () => {
    it("should have cooldown after trigger", () => {
      breaker.onFill(-100);
      breaker.onFill(-100);
      breaker.onFill(-100);

      const status = breaker.getStatus();
      expect(status.cooldownEndsAt).not.toBeNull();
      expect(status.timeUntilReset).toBeGreaterThan(0);
    });

    it("should auto-reset after cooldown", () => {
      vi.useFakeTimers();
      
      breaker.onFill(-100);
      breaker.onFill(-100);
      breaker.onFill(-100);
      
      expect(breaker.isTriggered()).toBe(true);
      
      // Advance time past cooldown
      vi.advanceTimersByTime(15000);
      
      expect(breaker.isTriggered()).toBe(false);
      
      vi.useRealTimers();
    });
  });

  describe("forceReset", () => {
    it("should reset even during cooldown", () => {
      breaker.onFill(-100);
      breaker.onFill(-100);
      breaker.onFill(-100);

      expect(breaker.isTriggered()).toBe(true);

      breaker.forceReset();

      expect(breaker.isTriggered()).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("should return complete status", () => {
      breaker.onFill(-100);
      breaker.onFill(-100);

      const status = breaker.getStatus();
      
      expect(status).toHaveProperty("isTriggered", false);
      expect(status).toHaveProperty("reason", null);
      expect(status).toHaveProperty("consecutiveLosses", 2);
      expect(status).toHaveProperty("recentLosses");
      expect(status).toHaveProperty("cooldownEndsAt", null);
      expect(status).toHaveProperty("timeUntilReset", null);
    });

    it("should include trigger reason", () => {
      breaker.onFill(-100);
      breaker.onFill(-100);
      breaker.onFill(-100);

      const status = breaker.getStatus();
      expect(status.reason).toContain("consecutive losses");
    });
  });
});

