import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { registerBatchCancelOrders } from "./batch-cancel-orders.js";

vi.mock("kalshi-typescript", () => ({
  OrdersApi: vi.fn(),
}));

describe("batch_cancel_orders tool", () => {
  let server: McpServer;
  let mockOrdersApi: { batchCancelOrders: ReturnType<typeof vi.fn> };
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
      batchCancelOrders: vi.fn(),
    };

    registerBatchCancelOrders(server, mockOrdersApi as unknown as OrdersApi);
  });

  it("should register the batch_cancel_orders tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "batch_cancel_orders",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return cancelled orders on success", async () => {
    const mockCancelledOrders = [
      {
        order_id: "order-123",
        ticker: "KXBTC-25JAN03-B100500",
        side: "yes",
        action: "buy",
        status: "canceled",
        remaining_count: 0,
      },
      {
        order_id: "order-456",
        ticker: "KXINX-25JAN03-B19500",
        side: "no",
        action: "sell",
        status: "canceled",
        remaining_count: 0,
      },
    ];

    mockOrdersApi.batchCancelOrders.mockResolvedValue({
      data: {
        orders: mockCancelledOrders,
      },
    });

    const result = await registeredTool.handler({
      order_ids: ["order-123", "order-456"],
    });

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(true);
    expect(parsed.cancelled_count).toBe(2);
    expect(parsed.requested_count).toBe(2);
    expect(parsed.cancelled_orders).toHaveLength(2);
    expect(parsed.cancelled_orders[0].order_id).toBe("order-123");
  });

  it("should call API with correct order IDs", async () => {
    mockOrdersApi.batchCancelOrders.mockResolvedValue({
      data: { orders: [] },
    });

    await registeredTool.handler({
      order_ids: ["order-1", "order-2", "order-3"],
    });

    expect(mockOrdersApi.batchCancelOrders).toHaveBeenCalledWith({
      order_ids: ["order-1", "order-2", "order-3"],
    });
  });

  it("should return error on API failure", async () => {
    mockOrdersApi.batchCancelOrders.mockRejectedValue(
      new Error("Order not found")
    );

    const result = await registeredTool.handler({
      order_ids: ["invalid-order"],
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error cancelling orders: Order not found",
        },
      ],
      isError: true,
    });
  });
});

