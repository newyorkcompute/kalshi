import { describe, it, expect } from "vitest";
import {
  parseFillLogLine,
  classifyMarketCategory,
  entryPriceBucket,
  reconstructRoundTrips,
  buildPerformanceReport,
  type FillRecord,
  type SettlementRecord,
} from "./performance.js";

function fill(
  overrides: Partial<FillRecord> & Pick<FillRecord, "ticker" | "action" | "side" | "count" | "price">,
): FillRecord {
  return {
    type: "fill",
    sessionId: "sess-1",
    timestamp: overrides.timestamp ?? "2025-01-01T12:00:00.000Z",
    isTaker: false,
    realizedPnL: 0,
    sessionPnL: 0,
    ...overrides,
  };
}

describe("parseFillLogLine", () => {
  it("parses a valid fill JSONL line", () => {
    const line = JSON.stringify({
      type: "fill",
      sessionId: "sess-abc",
      timestamp: "2025-01-02T10:00:00.000Z",
      ticker: "KXNFL-TEST",
      action: "buy",
      side: "yes",
      count: 5,
      price: 42,
      isTaker: true,
      realizedPnL: 0,
      sessionPnL: 0,
      orderId: "ord-1",
    });

    const parsed = parseFillLogLine(line);
    expect(parsed).toEqual({
      type: "fill",
      sessionId: "sess-abc",
      timestamp: "2025-01-02T10:00:00.000Z",
      ticker: "KXNFL-TEST",
      action: "buy",
      side: "yes",
      count: 5,
      price: 42,
      isTaker: true,
      realizedPnL: 0,
      sessionPnL: 0,
      orderId: "ord-1",
      fee: undefined,
    });
  });

  it("accepts realizedFromFill alias", () => {
    const line = JSON.stringify({
      type: "fill",
      ticker: "KXBTC-1",
      action: "sell",
      side: "yes",
      count: 1,
      price: 60,
      realizedFromFill: 15,
    });
    expect(parseFillLogLine(line)?.realizedPnL).toBe(15);
  });

  it("returns null for malformed lines", () => {
    expect(parseFillLogLine("not json")).toBeNull();
    expect(parseFillLogLine(JSON.stringify({ type: "session" }))).toBeNull();
    expect(parseFillLogLine(JSON.stringify({ type: "fill", action: "hold" }))).toBeNull();
  });
});

describe("classifyMarketCategory", () => {
  it("classifies weather threshold tickers", () => {
    expect(classifyMarketCategory("KXHIGHNY-25JAN03-T45")).toBe(
      "weather-threshold-strike",
    );
    expect(classifyMarketCategory("KXLOWTNYC-25JAN03-B32")).toBe(
      "weather-threshold-bracket",
    );
    expect(classifyMarketCategory("KXHIGHCHI-25JAN03-X99")).toBe(
      "weather-threshold",
    );
  });

  it("groups other tickers by first segment", () => {
    expect(classifyMarketCategory("KXNFL-GAME-123")).toBe("KXNFL");
    expect(classifyMarketCategory("KXBTC-100K")).toBe("KXBTC");
  });
});

describe("entryPriceBucket", () => {
  it("maps prices to buckets", () => {
    expect(entryPriceBucket(5)).toBe("1-10¢");
    expect(entryPriceBucket(20)).toBe("11-30¢");
    expect(entryPriceBucket(50)).toBe("31-70¢");
    expect(entryPriceBucket(80)).toBe("71-90¢");
    expect(entryPriceBucket(95)).toBe("91-99¢");
  });
});

describe("reconstructRoundTrips", () => {
  it("closes a round trip when position returns to flat via fills", () => {
    const fills = [
      fill({
        ticker: "KXNFL-1",
        action: "buy",
        side: "yes",
        count: 10,
        price: 40,
        timestamp: "2025-01-01T10:00:00.000Z",
      }),
      fill({
        ticker: "KXNFL-1",
        action: "sell",
        side: "yes",
        count: 10,
        price: 55,
        realizedPnL: 150,
        timestamp: "2025-01-01T11:00:00.000Z",
      }),
    ];

    const trips = reconstructRoundTrips(fills, []);
    expect(trips).toHaveLength(1);
    expect(trips[0].closeReason).toBe("fills");
    expect(trips[0].pnlCents).toBe(150);
    expect(trips[0].entryPriceCents).toBe(40);
    expect(trips[0].contracts).toBe(10);
  });

  it("closes via settlement when position remains open", () => {
    const fills = [
      fill({
        ticker: "KXBTC-1",
        action: "buy",
        side: "yes",
        count: 10,
        price: 45,
        timestamp: "2025-01-01T10:00:00.000Z",
      }),
    ];
    const settlements: SettlementRecord[] = [
      {
        ticker: "KXBTC-1",
        marketResult: "yes",
        yesCount: 10,
        yesTotalCost: 450,
        noCount: 0,
        noTotalCost: 0,
        revenue: 1000,
        settledTime: "2025-01-02T00:00:00.000Z",
      },
    ];

    const trips = reconstructRoundTrips(fills, settlements);
    expect(trips).toHaveLength(1);
    expect(trips[0].closeReason).toBe("settlement");
    expect(trips[0].pnlCents).toBe(550);
  });

  it("supports multiple round trips on the same ticker", () => {
    const fills = [
      fill({
        ticker: "KXNFL-1",
        action: "buy",
        side: "yes",
        count: 5,
        price: 30,
        timestamp: "2025-01-01T10:00:00.000Z",
      }),
      fill({
        ticker: "KXNFL-1",
        action: "sell",
        side: "yes",
        count: 5,
        price: 40,
        realizedPnL: 50,
        timestamp: "2025-01-01T11:00:00.000Z",
      }),
      fill({
        ticker: "KXNFL-1",
        action: "buy",
        side: "no",
        count: 3,
        price: 60,
        timestamp: "2025-01-01T12:00:00.000Z",
      }),
      fill({
        ticker: "KXNFL-1",
        action: "sell",
        side: "no",
        count: 3,
        price: 50,
        realizedPnL: 30,
        timestamp: "2025-01-01T13:00:00.000Z",
      }),
    ];

    const trips = reconstructRoundTrips(fills, []);
    expect(trips).toHaveLength(2);
    expect(trips[0].pnlCents).toBe(50);
    expect(trips[1].pnlCents).toBe(30);
  });
});

describe("buildPerformanceReport", () => {
  it("computes overall expectancy and bucket breakdown", () => {
    const fills = [
      fill({
        ticker: "KXNFL-WIN",
        action: "buy",
        side: "yes",
        count: 10,
        price: 8,
        timestamp: "2025-01-01T10:00:00.000Z",
      }),
      fill({
        ticker: "KXNFL-WIN",
        action: "sell",
        side: "yes",
        count: 10,
        price: 20,
        realizedPnL: 120,
        timestamp: "2025-01-01T11:00:00.000Z",
      }),
      fill({
        ticker: "KXBTC-LOSS",
        action: "buy",
        side: "yes",
        count: 5,
        price: 90,
        timestamp: "2025-01-02T10:00:00.000Z",
      }),
      fill({
        ticker: "KXBTC-LOSS",
        action: "sell",
        side: "yes",
        count: 5,
        price: 70,
        realizedPnL: -100,
        timestamp: "2025-01-02T11:00:00.000Z",
      }),
    ];

    const report = buildPerformanceReport(fills, []);
    expect(report.overall.marketsTraded).toBe(2);
    expect(report.overall.winRate).toBe(0.5);
    expect(report.overall.avgWinCents).toBe(120);
    expect(report.overall.avgLossCents).toBe(-100);
    expect(report.overall.expectancyPerMarketCents).toBe(10);
    expect(report.overall.totalRealizedPnlCents).toBe(20);
    expect(report.byEntryBucket.map((b) => b.bucket)).toEqual(
      expect.arrayContaining(["1-10¢", "71-90¢"]),
    );
    expect(report.topWins[0].ticker).toBe("KXNFL-WIN");
    expect(report.topLosses[0].ticker).toBe("KXBTC-LOSS");
  });
});
