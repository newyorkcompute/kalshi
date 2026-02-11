import { describe, it, expect } from "vitest";
import { computeFairValue, computeLeadTimeHours } from "./fair-value.js";
import type { ParsedTicker, DailyForecast } from "./types.js";

function makeForecast(highF: number, lowF: number, date: string): DailyForecast {
  return { date, highF, lowF, fetchedAt: new Date() };
}

function makeParsed(overrides: Partial<ParsedTicker> & { ticker: string }): ParsedTicker {
  return {
    tempType: "high",
    cityCode: "AUS",
    date: "2026-02-12",
    strike: 85,
    direction: "above",
    ...overrides,
  };
}

describe("computeFairValue", () => {
  describe("above direction", () => {
    it("assigns low probability when forecast well below strike", () => {
      // Forecast 82°F, strike 85°F, 18h lead (sigma 2.5)
      // z = (85-82)/2.5 = 1.2 → P(>85) ≈ 11.5%
      const parsed = makeParsed({ ticker: "KXHIGHAUS-26FEB12-T85", strike: 85, direction: "above" });
      const forecast = makeForecast(82, 65, "2026-02-12");
      const result = computeFairValue(parsed, forecast, 18);

      expect(result.probability).toBeCloseTo(0.1151, 2);
      expect(result.fairPriceCents).toBe(12); // 11.5% → 12¢
      expect(result.forecastTemp).toBe(82);
      expect(result.sigma).toBe(2.5);
    });

    it("assigns near-zero probability for extreme longshots", () => {
      // Forecast 82°F, strike 95°F, 18h lead (sigma 2.5)
      // z = (95-82)/2.5 = 5.2 → P(>95) ≈ 0.00001%
      const parsed = makeParsed({ ticker: "KXHIGHAUS-26FEB12-T95", strike: 95, direction: "above" });
      const forecast = makeForecast(82, 65, "2026-02-12");
      const result = computeFairValue(parsed, forecast, 18);

      expect(result.probability).toBeLessThan(0.001);
      expect(result.fairPriceCents).toBe(1); // Clamped to minimum
    });

    it("assigns high probability when forecast well above strike", () => {
      // Forecast 90°F, strike 85°F, 18h lead (sigma 2.5)
      const parsed = makeParsed({ ticker: "KXHIGHAUS-26FEB12-T85", strike: 85, direction: "above" });
      const forecast = makeForecast(90, 70, "2026-02-12");
      const result = computeFairValue(parsed, forecast, 18);

      expect(result.probability).toBeGreaterThan(0.95);
      expect(result.fairPriceCents).toBeGreaterThanOrEqual(95);
    });
  });

  describe("below direction", () => {
    it("assigns low probability for below when forecast is high", () => {
      // Forecast 82°F, strike 72°F, 18h lead (sigma 2.5)
      // z = (72-82)/2.5 = -4.0 → P(<72) ≈ 0.003%
      const parsed = makeParsed({
        ticker: "KXHIGHAUS-26FEB12-T72",
        strike: 72,
        direction: "below",
      });
      const forecast = makeForecast(82, 65, "2026-02-12");
      const result = computeFairValue(parsed, forecast, 18);

      expect(result.probability).toBeLessThan(0.001);
      expect(result.fairPriceCents).toBe(1);
    });
  });

  describe("range direction", () => {
    it("assigns probability for range bucket centered near forecast", () => {
      // Forecast 82°F, range 82-83°F, sigma 2.5
      // P(82 <= temp <= 83) ≈ P(-0.0 <= Z <= 0.4) ≈ 15.5%
      const parsed = makeParsed({
        ticker: "KXHIGHAUS-26FEB12-B82.5",
        strike: 82.5,
        direction: "range",
        rangeLow: 82,
        rangeHigh: 83,
      });
      const forecast = makeForecast(82, 65, "2026-02-12");
      const result = computeFairValue(parsed, forecast, 18);

      expect(result.probability).toBeGreaterThan(0.10);
      expect(result.probability).toBeLessThan(0.25);
    });

    it("assigns low probability for range far from forecast", () => {
      // Forecast 82°F, range 90-91°F, sigma 2.5
      const parsed = makeParsed({
        ticker: "KXHIGHAUS-26FEB12-B90.5",
        strike: 90.5,
        direction: "range",
        rangeLow: 90,
        rangeHigh: 91,
      });
      const forecast = makeForecast(82, 65, "2026-02-12");
      const result = computeFairValue(parsed, forecast, 18);

      expect(result.probability).toBeLessThan(0.01);
    });
  });

  describe("low temperature markets", () => {
    it("uses low sigma config and lowF forecast", () => {
      const parsed = makeParsed({
        ticker: "KXLOWTCHI-26FEB11-B23.5",
        tempType: "low",
        cityCode: "CHI",
        date: "2026-02-11",
        strike: 23.5,
        direction: "range",
        rangeLow: 23,
        rangeHigh: 24,
      });
      const forecast = makeForecast(40, 25, "2026-02-11");
      const result = computeFairValue(parsed, forecast, 18);

      // Should use lowF (25) and low sigma config (3.0 at 18h)
      expect(result.forecastTemp).toBe(25);
      expect(result.sigma).toBe(3.0); // DEFAULT_LOW_SIGMA at 12-24h
    });
  });

  describe("lead time affects sigma", () => {
    it("uses tighter sigma for shorter lead times", () => {
      const parsed = makeParsed({ ticker: "KXHIGHAUS-26FEB12-T85", strike: 85, direction: "above" });
      const forecast = makeForecast(82, 65, "2026-02-12");

      const shortLead = computeFairValue(parsed, forecast, 3); // 0-6h: sigma 1.5
      const longLead = computeFairValue(parsed, forecast, 48); // 24-48h: sigma 3.5

      // With tighter sigma, the probability of hitting 85 from 82 is lower
      expect(shortLead.sigma).toBe(1.5);
      expect(longLead.sigma).toBe(3.5);
      expect(shortLead.probability).toBeLessThan(longLead.probability);
    });
  });
});

describe("computeLeadTimeHours", () => {
  it("returns positive hours for future date", () => {
    const now = new Date("2026-02-11T12:00:00Z");
    const hours = computeLeadTimeHours("2026-02-12", now);
    expect(hours).toBeCloseTo(30, 0); // ~30 hours from noon to 6PM next day
  });

  it("returns 0 for past date", () => {
    const now = new Date("2026-02-13T12:00:00Z");
    const hours = computeLeadTimeHours("2026-02-12", now);
    expect(hours).toBe(0);
  });

  it("returns small hours for same-day", () => {
    const now = new Date("2026-02-12T12:00:00Z");
    const hours = computeLeadTimeHours("2026-02-12", now);
    expect(hours).toBeCloseTo(6, 0); // ~6 hours from noon to 6PM
  });
});
