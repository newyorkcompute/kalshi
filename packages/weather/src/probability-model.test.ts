import { describe, it, expect } from "vitest";
import {
  standardNormalCDF,
  probAbove,
  probBelow,
  probInRange,
  probToCents,
  getSigma,
  DEFAULT_HIGH_SIGMA,
  DEFAULT_LOW_SIGMA,
} from "./probability-model.js";

describe("standardNormalCDF", () => {
  it("returns 0.5 at z=0", () => {
    expect(standardNormalCDF(0)).toBeCloseTo(0.5, 5);
  });

  it("returns ~0.8413 at z=1", () => {
    expect(standardNormalCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it("returns ~0.1587 at z=-1", () => {
    expect(standardNormalCDF(-1)).toBeCloseTo(0.1587, 3);
  });

  it("returns ~0.9772 at z=2", () => {
    expect(standardNormalCDF(2)).toBeCloseTo(0.9772, 3);
  });

  it("returns ~0.0228 at z=-2", () => {
    expect(standardNormalCDF(-2)).toBeCloseTo(0.0228, 3);
  });

  it("returns ~0.9987 at z=3", () => {
    expect(standardNormalCDF(3)).toBeCloseTo(0.9987, 3);
  });

  it("handles extreme positive values", () => {
    expect(standardNormalCDF(10)).toBe(1);
  });

  it("handles extreme negative values", () => {
    expect(standardNormalCDF(-10)).toBe(0);
  });

  it("is symmetric around 0.5", () => {
    const z = 1.5;
    const upper = standardNormalCDF(z);
    const lower = standardNormalCDF(-z);
    expect(upper + lower).toBeCloseTo(1.0, 5);
  });
});

describe("probAbove", () => {
  it("returns ~50% when forecast equals strike", () => {
    expect(probAbove(80, 80, 2.5)).toBeCloseTo(0.5, 2);
  });

  it("returns high probability when forecast well above strike", () => {
    // Forecast 85, strike 80, sigma 2.5 → z=-2 → P(>80) ≈ 97.7%
    expect(probAbove(85, 80, 2.5)).toBeCloseTo(0.9772, 2);
  });

  it("returns low probability when forecast well below strike", () => {
    // Forecast 75, strike 85, sigma 2.5 → z=4 → P(>85) ≈ 0.003%
    expect(probAbove(75, 85, 2.5)).toBeLessThan(0.01);
  });

  it("returns ~16% when strike is 1 sigma above forecast", () => {
    // P(>82.5) when forecast=80, sigma=2.5 → z=1 → ~15.87%
    expect(probAbove(80, 82.5, 2.5)).toBeCloseTo(0.1587, 2);
  });

  it("handles zero sigma", () => {
    expect(probAbove(82, 80, 0)).toBe(1.0);
    expect(probAbove(78, 80, 0)).toBe(0.0);
  });
});

describe("probBelow", () => {
  it("returns ~50% when forecast equals strike", () => {
    expect(probBelow(80, 80, 2.5)).toBeCloseTo(0.5, 2);
  });

  it("returns low probability when forecast well above strike", () => {
    // Forecast 82, strike 72, sigma 2.5 → z=-4 → P(<72) ≈ 0.003%
    expect(probBelow(82, 72, 2.5)).toBeLessThan(0.01);
  });

  it("returns high probability when forecast well below strike", () => {
    // Forecast 70, strike 80, sigma 2.5 → z=4 → P(<80) ≈ 99.997%
    expect(probBelow(70, 80, 2.5)).toBeGreaterThan(0.99);
  });

  it("is complement of probAbove", () => {
    const above = probAbove(80, 85, 2.5);
    const below = probBelow(80, 85, 2.5);
    expect(above + below).toBeCloseTo(1.0, 5);
  });
});

describe("probInRange", () => {
  it("returns ~38% for 1-sigma-wide range centered on forecast", () => {
    // P(79 <= temp <= 81) with forecast=80, sigma=2.5
    // z_low = (79-80)/2.5 = -0.4, z_high = (81-80)/2.5 = 0.4
    // CDF(0.4) - CDF(-0.4) ≈ 0.6554 - 0.3446 ≈ 0.3108
    const p = probInRange(80, 79, 81, 2.5);
    expect(p).toBeCloseTo(0.3108, 2);
  });

  it("returns ~68% for 1-sigma range on each side", () => {
    // P(77.5 <= temp <= 82.5) with forecast=80, sigma=2.5
    // z_low = -1, z_high = 1
    const p = probInRange(80, 77.5, 82.5, 2.5);
    expect(p).toBeCloseTo(0.6827, 2);
  });

  it("returns near zero for range far from forecast", () => {
    // P(90 <= temp <= 92) with forecast=80, sigma=2.5
    const p = probInRange(80, 90, 92, 2.5);
    expect(p).toBeLessThan(0.01);
  });

  it("handles zero sigma", () => {
    expect(probInRange(80, 79, 81, 0)).toBe(1.0); // forecast in range
    expect(probInRange(80, 81, 83, 0)).toBe(0.0); // forecast out of range
  });
});

describe("probToCents", () => {
  it("converts 50% to 50 cents", () => {
    expect(probToCents(0.5)).toBe(50);
  });

  it("converts 2% to 2 cents", () => {
    expect(probToCents(0.02)).toBe(2);
  });

  it("clamps to minimum 1 cent", () => {
    expect(probToCents(0.001)).toBe(1);
    expect(probToCents(0)).toBe(1);
  });

  it("clamps to maximum 99 cents", () => {
    expect(probToCents(0.999)).toBe(99);
    expect(probToCents(1.0)).toBe(99);
  });

  it("rounds correctly", () => {
    expect(probToCents(0.155)).toBe(16); // 15.5 → rounds to 16
    expect(probToCents(0.154)).toBe(15); // 15.4 → rounds to 15
  });
});

describe("getSigma", () => {
  it("returns correct sigma for each lead time bucket", () => {
    expect(getSigma(3, DEFAULT_HIGH_SIGMA)).toBe(1.5);
    expect(getSigma(6, DEFAULT_HIGH_SIGMA)).toBe(1.5);
    expect(getSigma(9, DEFAULT_HIGH_SIGMA)).toBe(2.0);
    expect(getSigma(12, DEFAULT_HIGH_SIGMA)).toBe(2.0);
    expect(getSigma(18, DEFAULT_HIGH_SIGMA)).toBe(2.5);
    expect(getSigma(24, DEFAULT_HIGH_SIGMA)).toBe(2.5);
    expect(getSigma(36, DEFAULT_HIGH_SIGMA)).toBe(3.5);
    expect(getSigma(48, DEFAULT_HIGH_SIGMA)).toBe(3.5);
    expect(getSigma(60, DEFAULT_HIGH_SIGMA)).toBe(5.0);
    expect(getSigma(72, DEFAULT_HIGH_SIGMA)).toBe(5.0);
    expect(getSigma(96, DEFAULT_HIGH_SIGMA)).toBe(6.5);
  });

  it("uses higher sigma for low temps", () => {
    expect(getSigma(18, DEFAULT_LOW_SIGMA)).toBe(3.0);
    expect(getSigma(18, DEFAULT_HIGH_SIGMA)).toBe(2.5);
  });
});
