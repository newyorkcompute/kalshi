import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { registerGetFills } from "./get-fills.js";

vi.mock("kalshi-typescript", () => ({
  PortfolioApi: vi.fn(),
}));

describe("get_fills tool", () => {
  let server: McpServer;
  let mockPortfolioApi: { getFills: ReturnType<typeof vi.fn> };
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
      getFills: vi.fn(),
    };

    registerGetFills(server, mockPortfolioApi as unknown as PortfolioApi);
  });

  it("should register the get_fills tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_fills",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted fills on success", async () => {
    const mockFills = [
      {
        fill_id: "fill-123",
        order_id: "order-456",
        ticker: "KXBTC-25JAN03-B100500",
        side: "yes",
        action: "buy",
        yes_price: 45,
        no_price: 55,
        count: 10,
        created_time: "2024-12-21T00:00:00Z",
        is_taker: true,
      },
    ];

    mockPortfolioApi.getFills.mockResolvedValue({
      data: {
        fills: mockFills,
        cursor: "next-cursor",
      },
    });

    const result = await registeredTool.handler({});

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.fills).toHaveLength(1);
    expect(parsed.fills[0].fill_id).toBe("fill-123");
    expect(parsed.summary.total).toBe(1);
    expect(parsed.summary.total_volume).toBe(10);
    expect(parsed.summary.buys).toBe(1);
    expect(parsed.summary.sells).toBe(0);
  });

  it("should filter by ticker", async () => {
    mockPortfolioApi.getFills.mockResolvedValue({
      data: { fills: [], cursor: null },
    });

    await registeredTool.handler({ ticker: "KXBTC-25JAN03-B100500" });

    expect(mockPortfolioApi.getFills).toHaveBeenCalledWith(
      "KXBTC-25JAN03-B100500", // ticker
      undefined, // order_id
      undefined, // min_ts
      undefined, // max_ts
      undefined, // limit
      undefined // cursor
    );
  });

  it("should filter by order_id", async () => {
    mockPortfolioApi.getFills.mockResolvedValue({
      data: { fills: [], cursor: null },
    });

    await registeredTool.handler({ order_id: "order-123" });

    expect(mockPortfolioApi.getFills).toHaveBeenCalledWith(
      undefined, // ticker
      "order-123", // order_id
      undefined, // min_ts
      undefined, // max_ts
      undefined, // limit
      undefined // cursor
    );
  });

  it("should return error on API failure", async () => {
    mockPortfolioApi.getFills.mockRejectedValue(new Error("Unauthorized"));

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching fills: Unauthorized",
        },
      ],
      isError: true,
    });
  });
});

