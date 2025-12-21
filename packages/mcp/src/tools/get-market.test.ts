import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MarketApi } from "kalshi-typescript";
import { registerGetMarket } from "./get-market.js";

// Mock the MarketApi
vi.mock("kalshi-typescript", () => ({
  MarketApi: vi.fn(),
}));

describe("get_market tool", () => {
  let server: McpServer;
  let mockMarketApi: { getMarket: ReturnType<typeof vi.fn> };
  let registeredTool: {
    name: string;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  };

  beforeEach(() => {
    server = {
      tool: vi.fn((_name, _desc, _schema, handler) => {
        registeredTool = { name: _name, handler };
      }),
    } as unknown as McpServer;

    mockMarketApi = {
      getMarket: vi.fn(),
    };

    registerGetMarket(server, mockMarketApi as unknown as MarketApi);
  });

  it("should register the get_market tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_market",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted market details on success", async () => {
    const mockMarket = {
      ticker: "KXBTC-25JAN03-B100500",
      title: "Bitcoin above $100,500?",
      subtitle: "Will BTC be above $100,500 on Jan 3?",
      yes_sub_title: "Yes",
      no_sub_title: "No",
      status: "active",
      result: "",
      market_type: "binary",
      event_ticker: "KXBTC",
      category: "Crypto",
      yes_bid: 45,
      yes_ask: 47,
      no_bid: 53,
      no_ask: 55,
      last_price: 46,
      previous_yes_bid: 44,
      previous_yes_ask: 46,
      previous_price: 45,
      volume: 10000,
      volume_24h: 500,
      open_interest: 2500,
      liquidity: 5000,
      created_time: "2024-12-01T00:00:00Z",
      open_time: "2024-12-01T00:00:00Z",
      close_time: "2025-01-03T00:00:00Z",
      expected_expiration_time: "2025-01-03T12:00:00Z",
      latest_expiration_time: "2025-01-03T23:59:59Z",
      rules_primary: "Settles YES if BTC >= $100,500",
      rules_secondary: "Based on CoinGecko price",
      settlement_value: null,
      settlement_timer_seconds: 3600,
      notional_value: 100,
      strike_type: "greater_or_equal",
      cap_strike: null,
      floor_strike: 100500,
    };

    mockMarketApi.getMarket.mockResolvedValue({
      data: { market: mockMarket },
    });

    const result = await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
    });

    expect(mockMarketApi.getMarket).toHaveBeenCalledWith(
      "KXBTC-25JAN03-B100500"
    );

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.ticker).toBe("KXBTC-25JAN03-B100500");
    expect(parsed.title).toBe("Bitcoin above $100,500?");
    expect(parsed.yes_bid).toBe(45);
    expect(parsed.rules_primary).toBe("Settles YES if BTC >= $100,500");
  });

  it("should return error when market not found", async () => {
    mockMarketApi.getMarket.mockResolvedValue({
      data: { market: null },
    });

    const result = await registeredTool.handler({ ticker: "INVALID-TICKER" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Market not found: INVALID-TICKER",
        },
      ],
      isError: true,
    });
  });

  it("should return error on API failure", async () => {
    mockMarketApi.getMarket.mockRejectedValue(new Error("Network error"));

    const result = await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching market KXBTC-25JAN03-B100500: Network error",
        },
      ],
      isError: true,
    });
  });
});

