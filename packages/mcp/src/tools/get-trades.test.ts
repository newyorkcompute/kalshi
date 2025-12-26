import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MarketApi } from "kalshi-typescript";
import { registerGetTrades } from "./get-trades.js";

// Mock the MarketApi
vi.mock("kalshi-typescript", () => ({
  MarketApi: vi.fn(),
}));

describe("get_trades tool", () => {
  let server: McpServer;
  let mockMarketApi: { getTrades: ReturnType<typeof vi.fn> };
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
      getTrades: vi.fn(),
    };

    registerGetTrades(server, mockMarketApi as unknown as MarketApi);
  });

  it("should register the get_trades tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_trades",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted trades list", async () => {
    const mockTrades = [
      {
        trade_id: "trade-001",
        ticker: "KXBTC-25JAN03-B100500",
        count: 10,
        yes_price: 45,
        no_price: 55,
        taker_side: "yes",
        created_time: "2024-12-26T10:00:00Z",
      },
      {
        trade_id: "trade-002",
        ticker: "KXBTC-25JAN03-B100500",
        count: 5,
        yes_price: 46,
        no_price: 54,
        taker_side: "no",
        created_time: "2024-12-26T10:05:00Z",
      },
    ];

    mockMarketApi.getTrades.mockResolvedValue({
      data: { trades: mockTrades, cursor: "next-cursor" },
    });

    const result = await registeredTool.handler({ limit: 100 });

    expect(mockMarketApi.getTrades).toHaveBeenCalledWith(
      100,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.count).toBe(2);
    expect(parsed.cursor).toBe("next-cursor");
    expect(parsed.trades).toHaveLength(2);
    expect(parsed.trades[0].trade_id).toBe("trade-001");
    expect(parsed.trades[0].yes_price).toBe(45);
  });

  it("should filter by ticker", async () => {
    mockMarketApi.getTrades.mockResolvedValue({
      data: { trades: [], cursor: null },
    });

    await registeredTool.handler({ ticker: "KXBTC-25JAN03-B100500" });

    expect(mockMarketApi.getTrades).toHaveBeenCalledWith(
      undefined,
      undefined,
      "KXBTC-25JAN03-B100500",
      undefined,
      undefined
    );
  });

  it("should filter by timestamp range", async () => {
    mockMarketApi.getTrades.mockResolvedValue({
      data: { trades: [], cursor: null },
    });

    await registeredTool.handler({
      min_ts: 1703577600,
      max_ts: 1703664000,
    });

    expect(mockMarketApi.getTrades).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      1703577600,
      1703664000
    );
  });

  it("should handle pagination with cursor", async () => {
    mockMarketApi.getTrades.mockResolvedValue({
      data: { trades: [], cursor: null },
    });

    await registeredTool.handler({ cursor: "prev-cursor", limit: 50 });

    expect(mockMarketApi.getTrades).toHaveBeenCalledWith(
      50,
      "prev-cursor",
      undefined,
      undefined,
      undefined
    );
  });

  it("should return empty trades list", async () => {
    mockMarketApi.getTrades.mockResolvedValue({
      data: { trades: [], cursor: null },
    });

    const result = await registeredTool.handler({});

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.count).toBe(0);
    expect(parsed.trades).toEqual([]);
  });

  it("should return error on API failure", async () => {
    mockMarketApi.getTrades.mockRejectedValue(new Error("Rate limited"));

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching trades: Rate limited",
        },
      ],
      isError: true,
    });
  });

  it("should handle unknown errors", async () => {
    mockMarketApi.getTrades.mockRejectedValue(undefined);

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching trades: Unknown error occurred",
        },
      ],
      isError: true,
    });
  });
});

