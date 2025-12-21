import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MarketApi } from "kalshi-typescript";
import { registerGetMarkets } from "./get-markets.js";

// Mock the MarketApi
vi.mock("kalshi-typescript", () => ({
  MarketApi: vi.fn(),
  GetMarketsStatusEnum: {
    Unopened: "unopened",
    Open: "open",
    Paused: "paused",
    Closed: "closed",
    Settled: "settled",
  },
}));

describe("get_markets tool", () => {
  let server: McpServer;
  let mockMarketApi: { getMarkets: ReturnType<typeof vi.fn> };
  let registeredTool: {
    name: string;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  };

  beforeEach(() => {
    // Create mock server that captures the registered tool
    server = {
      tool: vi.fn((_name, _desc, _schema, handler) => {
        registeredTool = { name: _name, handler };
      }),
    } as unknown as McpServer;

    // Create mock MarketApi
    mockMarketApi = {
      getMarkets: vi.fn(),
    };

    // Register the tool
    registerGetMarkets(server, mockMarketApi as unknown as MarketApi);
  });

  it("should register the get_markets tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_markets",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted markets on success", async () => {
    const mockMarkets = [
      {
        ticker: "KXBTC-25JAN03-B100500",
        title: "Bitcoin above $100,500?",
        subtitle: "Will BTC be above $100,500 on Jan 3?",
        status: "active",
        yes_bid: 45,
        yes_ask: 47,
        no_bid: 53,
        no_ask: 55,
        last_price: 46,
        volume: 10000,
        volume_24h: 500,
        open_interest: 2500,
        event_ticker: "KXBTC",
        close_time: "2025-01-03T00:00:00Z",
      },
    ];

    mockMarketApi.getMarkets.mockResolvedValue({
      data: {
        markets: mockMarkets,
        cursor: "next-page-cursor",
      },
    });

    const result = await registeredTool.handler({ limit: 10 });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("KXBTC-25JAN03-B100500"),
        },
      ],
    });

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.markets).toHaveLength(1);
    expect(parsed.markets[0].ticker).toBe("KXBTC-25JAN03-B100500");
    expect(parsed.cursor).toBe("next-page-cursor");
    expect(parsed.count).toBe(1);
  });

  it("should pass filter parameters to the API", async () => {
    mockMarketApi.getMarkets.mockResolvedValue({
      data: { markets: [], cursor: null },
    });

    await registeredTool.handler({
      limit: 50,
      event_ticker: "KXBTC",
      status: "open",
    });

    expect(mockMarketApi.getMarkets).toHaveBeenCalledWith(
      50, // limit
      undefined, // cursor
      "KXBTC", // eventTicker
      undefined, // seriesTicker
      undefined, // minCreatedTs
      undefined, // maxCreatedTs
      undefined, // maxCloseTs
      undefined, // minCloseTs
      undefined, // minSettledTs
      undefined, // maxSettledTs
      "open", // status
      undefined // tickers
    );
  });

  it("should handle empty markets response", async () => {
    mockMarketApi.getMarkets.mockResolvedValue({
      data: { markets: [], cursor: null },
    });

    const result = await registeredTool.handler({});

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.markets).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });

  it("should return error on API failure", async () => {
    mockMarketApi.getMarkets.mockRejectedValue(new Error("API rate limited"));

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching markets: API rate limited",
        },
      ],
      isError: true,
    });
  });
});

