import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { registerCancelOrder } from "./cancel-order.js";

// Mock the OrdersApi
vi.mock("kalshi-typescript", () => ({
  OrdersApi: vi.fn(),
}));

describe("cancel_order tool", () => {
  let server: McpServer;
  let mockOrdersApi: { cancelOrder: ReturnType<typeof vi.fn> };
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
      cancelOrder: vi.fn(),
    };

    registerCancelOrder(server, mockOrdersApi as unknown as OrdersApi);
  });

  it("should register the cancel_order tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "cancel_order",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return success with order details when canceled", async () => {
    const mockOrder = {
      order_id: "order-123",
      ticker: "KXBTC-25JAN03-B100500",
      status: "canceled",
      side: "yes",
      action: "buy",
      yes_price: 45,
      no_price: 55,
      initial_count: 10,
      fill_count: 0,
      remaining_count: 0,
    };

    mockOrdersApi.cancelOrder.mockResolvedValue({
      data: { order: mockOrder },
    });

    const result = await registeredTool.handler({ order_id: "order-123" });

    expect(mockOrdersApi.cancelOrder).toHaveBeenCalledWith("order-123");

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(true);
    expect(parsed.message).toBe("Order canceled successfully");
    expect(parsed.order.order_id).toBe("order-123");
    expect(parsed.order.status).toBe("canceled");
  });

  it("should return message when order canceled but no details returned", async () => {
    mockOrdersApi.cancelOrder.mockResolvedValue({
      data: { order: null },
    });

    const result = await registeredTool.handler({ order_id: "order-456" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Order order-456 canceled but no details returned",
        },
      ],
    });
  });

  it("should return error on API failure", async () => {
    mockOrdersApi.cancelOrder.mockRejectedValue(new Error("Order not found"));

    const result = await registeredTool.handler({ order_id: "invalid-order" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error canceling order invalid-order: Order not found",
        },
      ],
      isError: true,
    });
  });

  it("should handle unknown errors", async () => {
    mockOrdersApi.cancelOrder.mockRejectedValue("some string error");

    const result = await registeredTool.handler({ order_id: "order-789" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error canceling order order-789: Unknown error occurred",
        },
      ],
      isError: true,
    });
  });
});

