import { describe, it, expect, vi } from "vitest";
import { validateOrder } from "./validate-order.js";
import type { MarketApi, PortfolioApi } from "kalshi-typescript";

describe("validateOrder", () => {
  const mockGetMarket = vi.fn();
  const mockGetBalance = vi.fn();

  const mockMarketApi = {
    getMarket: mockGetMarket,
  } as unknown as MarketApi;

  const mockPortfolioApi = {
    getBalance: mockGetBalance,
  } as unknown as PortfolioApi;

  it("should validate successful order", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "open",
          yes_ask: 50,
          yes_bid: 48,
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 10000 },
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.estimatedCost).toBe(500);
  });

  it("should reject order on closed market", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "closed",
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 10000 },
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("closed"))).toBe(true);
  });

  it("should reject order with insufficient balance", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "open",
          yes_ask: 50,
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 100 }, // Only 100¢
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50, // Costs 500¢
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("Insufficient balance"))
    ).toBe(true);
  });

  it("should warn on price far from market", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "open",
          yes_ask: 50,
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 10000 },
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 80, // 30¢ away from market
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("away from market"))).toBe(
      true
    );
  });

  it("should reject negative quantity", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "open",
          yes_ask: 50,
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 10000 },
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: -5,
        price: 50,
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Order quantity must be positive");
  });

  it("should warn on large order size", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "open",
          yes_ask: 50,
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 100000 },
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 1500,
        price: 50,
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      "Large order size may have poor execution"
    );
  });

  it("should reject invalid price range", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "open",
          yes_ask: 50,
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 10000 },
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 150, // Invalid: >99
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Price must be between 1¢ and 99¢");
  });

  it("should allow sell orders without balance check", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "open",
          yes_bid: 50,
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 0 }, // No balance
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        count: 10,
        price: 50,
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(true);
    expect(result.estimatedCost).toBe(0);
  });

  it("should handle API errors gracefully", async () => {
    mockGetMarket.mockRejectedValue(new Error("Network error"));

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Validation failed"))).toBe(
      true
    );
  });

  it("should use default price if not provided", async () => {
    mockGetMarket.mockResolvedValue({
      data: {
        market: {
          ticker: "TEST-MARKET",
          status: "open",
          yes_ask: 60,
        },
      },
    });

    mockGetBalance.mockResolvedValue({
      data: { balance: 10000 },
    });

    const result = await validateOrder(
      {
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        // No price provided
      },
      mockMarketApi,
      mockPortfolioApi
    );

    expect(result.valid).toBe(true);
    expect(result.estimatedCost).toBe(600); // Uses market price (60)
  });
});

