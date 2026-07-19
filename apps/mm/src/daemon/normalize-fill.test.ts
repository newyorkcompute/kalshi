import { describe, it, expect } from "vitest";
import {
  normalizeFill,
  normalizeFillCount,
  fillPriceCents,
  normalizeMarketPosition,
} from "./normalize-fill.js";

describe("normalizeFillCount", () => {
  it("prefers count_fp over count", () => {
    expect(normalizeFillCount(5, "40.00")).toBe(40);
  });

  it("falls back to count", () => {
    expect(normalizeFillCount(12, undefined)).toBe(12);
  });

  it("returns NaN when both missing", () => {
    expect(normalizeFillCount(undefined, undefined)).toBeNaN();
  });
});

describe("fillPriceCents", () => {
  it("uses legacy cents when present", () => {
    expect(fillPriceCents(55, "0.5500")).toBe(55);
  });

  it("converts dollars when cents absent", () => {
    expect(fillPriceCents(undefined, "0.5500")).toBe(55);
    expect(fillPriceCents(undefined, 0.45)).toBe(45);
  });
});

describe("normalizeFill", () => {
  it("normalizes World Cup-style fill without legacy fields", () => {
    const result = normalizeFill({
      order_id: "ord-1",
      market_ticker: "KXMENWORLDCUP-26-ES",
      side: "yes",
      action: "buy",
      count_fp: "40.00",
      yes_price_dollars: "0.5500",
      no_price_dollars: "0.4500",
    });

    expect(result).toEqual({
      orderId: "ord-1",
      ticker: "KXMENWORLDCUP-26-ES",
      side: "yes",
      action: "buy",
      count: 40,
      priceCents: 55,
      yesPriceCents: 55,
      noPriceCents: 45,
    });
  });

  it("returns null for invalid count", () => {
    expect(
      normalizeFill({
        order_id: "x",
        market_ticker: "T",
        side: "yes",
        action: "buy",
        yes_price_dollars: "0.50",
      })
    ).toBeNull();
  });

  it("returns null for invalid price", () => {
    expect(
      normalizeFill({
        order_id: "x",
        market_ticker: "T",
        side: "yes",
        action: "buy",
        count_fp: "10",
      })
    ).toBeNull();
  });
});

describe("normalizeMarketPosition", () => {
  it("reads position_fp and market_exposure_dollars", () => {
    expect(
      normalizeMarketPosition({
        ticker: "KXMENWORLDCUP-26-ES",
        position_fp: "40.00",
        market_exposure_dollars: "22.0000",
      })
    ).toEqual({
      ticker: "KXMENWORLDCUP-26-ES",
      position: 40,
      exposureCents: 2200,
    });
  });

  it("falls back to legacy integer fields", () => {
    expect(
      normalizeMarketPosition({
        ticker: "T",
        position: -5,
        market_exposure: 300,
      })
    ).toEqual({
      ticker: "T",
      position: -5,
      exposureCents: 300,
    });
  });
});
