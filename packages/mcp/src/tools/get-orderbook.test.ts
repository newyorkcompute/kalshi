import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MarketApi } from "kalshi-typescript";
import { registerGetOrderbook } from "./get-orderbook.js";

// Mock the MarketApi
vi.mock("kalshi-typescript", () => ({
  MarketApi: vi.fn(),
}));

describe("get_orderbook tool", () => {
  let server: McpServer;
  let mockMarketApi: { getMarketOrderbook: ReturnType<typeof vi.fn> };
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
      getMarketOrderbook: vi.fn(),
    };

    registerGetOrderbook(server, mockMarketApi as unknown as MarketApi);
  });

  it("should register the get_orderbook tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_orderbook",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted orderbook on success", async () => {
    const mockOrderbook = {
      yes_dollars: [
        ["0.45", "100"],
        ["0.44", "200"],
        ["0.43", "150"],
      ],
      no_dollars: [
        ["0.55", "100"],
        ["0.56", "180"],
      ],
    };

    mockMarketApi.getMarketOrderbook.mockResolvedValue({
      data: { orderbook: mockOrderbook },
    });

    const result = await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
    });

    expect(mockMarketApi.getMarketOrderbook).toHaveBeenCalledWith(
      "KXBTC-25JAN03-B100500",
      undefined
    );

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.ticker).toBe("KXBTC-25JAN03-B100500");
    expect(parsed.yes_bids).toHaveLength(3);
    expect(parsed.no_bids).toHaveLength(2);
    expect(parsed.summary.yes_levels).toBe(3);
    expect(parsed.summary.no_levels).toBe(2);
  });

  it("should pass depth parameter to API", async () => {
    mockMarketApi.getMarketOrderbook.mockResolvedValue({
      data: {
        orderbook: {
          yes_dollars: [],
          no_dollars: [],
        },
      },
    });

    await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
      depth: 10,
    });

    expect(mockMarketApi.getMarketOrderbook).toHaveBeenCalledWith(
      "KXBTC-25JAN03-B100500",
      10
    );
  });

  it("should handle empty orderbook", async () => {
    mockMarketApi.getMarketOrderbook.mockResolvedValue({
      data: {
        orderbook: {
          yes_dollars: [],
          no_dollars: [],
        },
      },
    });

    const result = await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
    });

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.yes_bids).toHaveLength(0);
    expect(parsed.no_bids).toHaveLength(0);
    expect(parsed.summary.yes_levels).toBe(0);
    expect(parsed.summary.no_levels).toBe(0);
    expect(parsed.summary.best_yes_bid).toBeNull();
    expect(parsed.summary.best_no_bid).toBeNull();
  });

  it("should return error when orderbook not found", async () => {
    mockMarketApi.getMarketOrderbook.mockResolvedValue({
      data: { orderbook: null },
    });

    const result = await registeredTool.handler({ ticker: "INVALID-TICKER" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Orderbook not found for market: INVALID-TICKER",
        },
      ],
      isError: true,
    });
  });

  it("should return error on API failure", async () => {
    mockMarketApi.getMarketOrderbook.mockRejectedValue(
      new Error("Connection timeout")
    );

    const result = await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching orderbook for KXBTC-25JAN03-B100500: Connection timeout",
        },
      ],
      isError: true,
    });
  });
});

