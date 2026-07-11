import { describe, it, expect } from "vitest";
import { selectTopEdges, type WeatherMarketEdge } from "./weather-scanner.js";

describe("selectTopEdges", () => {
  const candidates: WeatherMarketEdge[] = [
    { ticker: "LOW", marketPriceCents: 50, fairValueCents: 48, edgeCents: 2 },
    { ticker: "HIGH", marketPriceCents: 30, fairValueCents: 20, edgeCents: 10 },
    { ticker: "NEG", marketPriceCents: 15, fairValueCents: 22, edgeCents: -7 },
    { ticker: "MID", marketPriceCents: 40, fairValueCents: 35, edgeCents: 5 },
    { ticker: "TINY", marketPriceCents: 10, fairValueCents: 9, edgeCents: 1 },
    { ticker: "SIXTH", marketPriceCents: 60, fairValueCents: 55, edgeCents: 5 },
  ];

  it("returns top 5 by absolute edge descending", () => {
    const top = selectTopEdges(candidates);
    expect(top).toHaveLength(5);
    expect(top.map((e) => e.ticker)).toEqual(["HIGH", "NEG", "MID", "SIXTH", "LOW"]);
  });

  it("respects custom limit", () => {
    const top = selectTopEdges(candidates, 2);
    expect(top.map((e) => e.ticker)).toEqual(["HIGH", "NEG"]);
  });

  it("returns empty array when no candidates", () => {
    expect(selectTopEdges([])).toEqual([]);
  });
});
