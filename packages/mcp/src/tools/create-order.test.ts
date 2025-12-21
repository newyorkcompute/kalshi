import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { registerCreateOrder } from "./create-order.js";

vi.mock("kalshi-typescript", () => ({
  OrdersApi: vi.fn(),
  CreateOrderRequestSideEnum: {
    Yes: "yes",
    No: "no",
  },
  CreateOrderRequestActionEnum: {
    Buy: "buy",
    Sell: "sell",
  },
  CreateOrderRequestTypeEnum: {
    Limit: "limit",
    Market: "market",
  },
}));

describe("create_order tool", () => {
  let server: McpServer;
  let mockOrdersApi: { createOrder: ReturnType<typeof vi.fn> };
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
      createOrder: vi.fn(),
    };

    registerCreateOrder(server, mockOrdersApi as unknown as OrdersApi);
  });

  it("should register the create_order tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "create_order",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should create order and return formatted response", async () => {
    const mockOrder = {
      order_id: "order-456",
      ticker: "KXBTC-25JAN03-B100500",
      status: "resting",
      side: "yes",
      action: "buy",
      type: "limit",
      yes_price: 45,
      no_price: 55,
      initial_count: 10,
      fill_count: 0,
      remaining_count: 10,
      created_time: "2024-12-21T00:00:00Z",
    };

    mockOrdersApi.createOrder.mockResolvedValue({
      data: { order: mockOrder },
    });

    const result = await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
      side: "yes",
      action: "buy",
      count: 10,
      yes_price: 45,
    });

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(true);
    expect(parsed.order.order_id).toBe("order-456");
    expect(parsed.order.status).toBe("resting");
  });

  it("should pass correct parameters to API", async () => {
    mockOrdersApi.createOrder.mockResolvedValue({
      data: { order: { order_id: "test" } },
    });

    await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
      side: "yes",
      action: "buy",
      count: 10,
      type: "limit",
      yes_price: 45,
    });

    expect(mockOrdersApi.createOrder).toHaveBeenCalledWith({
      ticker: "KXBTC-25JAN03-B100500",
      side: "yes",
      action: "buy",
      count: 10,
      type: "limit",
      yes_price: 45,
      no_price: undefined,
      client_order_id: undefined,
      expiration_ts: undefined,
    });
  });

  it("should return error on API failure", async () => {
    mockOrdersApi.createOrder.mockRejectedValue(
      new Error("Insufficient balance")
    );

    const result = await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
      side: "yes",
      action: "buy",
      count: 10,
      yes_price: 45,
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error creating order: Insufficient balance",
        },
      ],
      isError: true,
    });
  });
});

