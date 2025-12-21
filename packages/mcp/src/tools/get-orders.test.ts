import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { registerGetOrders } from "./get-orders.js";

vi.mock("kalshi-typescript", () => ({
  OrdersApi: vi.fn(),
}));

describe("get_orders tool", () => {
  let server: McpServer;
  let mockOrdersApi: { getOrders: ReturnType<typeof vi.fn> };
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

    mockOrdersApi = {
      getOrders: vi.fn(),
    };

    registerGetOrders(server, mockOrdersApi as unknown as OrdersApi);
  });

  it("should register the get_orders tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_orders",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted orders on success", async () => {
    const mockOrders = [
      {
        order_id: "order-123",
        ticker: "KXBTC-25JAN03-B100500",
        side: "yes",
        action: "buy",
        type: "limit",
        status: "resting",
        yes_price: 45,
        no_price: 55,
        initial_count: 10,
        fill_count: 0,
        remaining_count: 10,
        created_time: "2024-12-21T00:00:00Z",
        expiration_time: null,
        taker_fill_cost: 0,
        maker_fill_cost: 0,
        taker_fees: 0,
        maker_fees: 0,
      },
    ];

    mockOrdersApi.getOrders.mockResolvedValue({
      data: {
        orders: mockOrders,
        cursor: "next-cursor",
      },
    });

    const result = await registeredTool.handler({});

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.orders).toHaveLength(1);
    expect(parsed.orders[0].order_id).toBe("order-123");
    expect(parsed.summary.total).toBe(1);
    expect(parsed.summary.resting).toBe(1);
  });

  it("should filter by status", async () => {
    mockOrdersApi.getOrders.mockResolvedValue({
      data: { orders: [], cursor: null },
    });

    await registeredTool.handler({ status: "resting" });

    expect(mockOrdersApi.getOrders).toHaveBeenCalledWith(
      undefined, // ticker
      undefined, // event_ticker
      undefined, // min_ts
      undefined, // max_ts
      "resting", // status
      undefined, // limit
      undefined // cursor
    );
  });

  it("should return error on API failure", async () => {
    mockOrdersApi.getOrders.mockRejectedValue(new Error("Unauthorized"));

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching orders: Unauthorized",
        },
      ],
      isError: true,
    });
  });
});

