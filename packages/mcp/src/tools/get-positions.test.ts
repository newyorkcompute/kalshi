import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { registerGetPositions } from "./get-positions.js";

vi.mock("kalshi-typescript", () => ({
  PortfolioApi: vi.fn(),
}));

describe("get_positions tool", () => {
  let server: McpServer;
  let mockPortfolioApi: { getPositions: ReturnType<typeof vi.fn> };
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

    mockPortfolioApi = {
      getPositions: vi.fn(),
    };

    registerGetPositions(server, mockPortfolioApi as unknown as PortfolioApi);
  });

  it("should register the get_positions tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_positions",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted positions on success", async () => {
    const mockPositions = [
      {
        ticker: "KXBTC-25JAN03-B100500",
        position: 10, // 10 YES contracts
        total_traded: 5000,
        total_traded_dollars: "50.0000",
        market_exposure: 4500,
        market_exposure_dollars: "45.0000",
        realized_pnl: 500,
        realized_pnl_dollars: "5.0000",
        fees_paid: 50,
        fees_paid_dollars: "0.5000",
        resting_orders_count: 2,
      },
    ];

    mockPortfolioApi.getPositions.mockResolvedValue({
      data: {
        market_positions: mockPositions,
        cursor: "next-cursor",
      },
    });

    const result = await registeredTool.handler({});

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.positions).toHaveLength(1);
    expect(parsed.positions[0].ticker).toBe("KXBTC-25JAN03-B100500");
    expect(parsed.positions[0].position).toBe(10);
    expect(parsed.summary.total_positions).toBe(1);
  });

  it("should handle empty positions", async () => {
    mockPortfolioApi.getPositions.mockResolvedValue({
      data: {
        market_positions: [],
        cursor: null,
      },
    });

    const result = await registeredTool.handler({});

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.positions).toHaveLength(0);
    expect(parsed.summary.total_positions).toBe(0);
  });

  it("should pass filter parameters to API", async () => {
    mockPortfolioApi.getPositions.mockResolvedValue({
      data: { market_positions: [], cursor: null },
    });

    await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
      limit: 50,
    });

    expect(mockPortfolioApi.getPositions).toHaveBeenCalledWith(
      undefined, // cursor
      50, // limit
      undefined, // count_filter
      "KXBTC-25JAN03-B100500", // ticker
      undefined // event_ticker
    );
  });

  it("should return error on API failure", async () => {
    mockPortfolioApi.getPositions.mockRejectedValue(new Error("Network error"));

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching positions: Network error",
        },
      ],
      isError: true,
    });
  });
});

