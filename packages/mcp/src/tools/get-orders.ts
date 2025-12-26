/**
 * Get Orders Tool
 *
 * MCP tool for fetching the user's orders on Kalshi markets.
 * Returns order details including status, prices, quantities, and fill information.
 *
 * @module tools/get-orders
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { z } from "zod";

/** Schema for get_orders tool parameters */
const GetOrdersSchema = z.object({
  ticker: z.string().optional().describe("Filter by market ticker"),
  event_ticker: z
    .string()
    .optional()
    .describe("Filter by event ticker (comma-separated, max 10)"),
  status: z
    .enum(["resting", "canceled", "executed"])
    .optional()
    .describe("Filter by order status"),
  limit: z
    .number()
    .min(1)
    .max(200)
    .optional()
    .describe("Number of orders to return (default 100, max 200)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  min_ts: z
    .number()
    .optional()
    .describe("Filter orders after this Unix timestamp"),
  max_ts: z
    .number()
    .optional()
    .describe("Filter orders before this Unix timestamp"),
});

type GetOrdersInput = z.infer<typeof GetOrdersSchema>;

/**
 * Registers the get_orders tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param ordersApi - Kalshi Orders API client
 */
export function registerGetOrders(server: McpServer, ordersApi: OrdersApi) {
  server.tool(
    "get_orders",
    "Get your orders on Kalshi. Shows order details including status, prices, and fill information.",
    GetOrdersSchema.shape,
    async (params: GetOrdersInput) => {
      try {
        const response = await ordersApi.getOrders(
          params.ticker,
          params.event_ticker,
          params.min_ts,
          params.max_ts,
          params.status,
          params.limit,
          params.cursor
        );

        const orders = response.data.orders || [];
        const cursor = response.data.cursor;

        // Format orders for readable output
        const formattedOrders = orders.map((order) => ({
          order_id: order.order_id,
          ticker: order.ticker,
          // Order details
          side: order.side,
          action: order.action,
          type: order.type,
          status: order.status,
          // Pricing
          yes_price: order.yes_price,
          no_price: order.no_price,
          // Quantities
          initial_count: order.initial_count,
          fill_count: order.fill_count,
          remaining_count: order.remaining_count,
          // Timing
          created_time: order.created_time,
          expiration_time: order.expiration_time,
          // Fill costs
          taker_fill_cost: order.taker_fill_cost,
          maker_fill_cost: order.maker_fill_cost,
          taker_fees: order.taker_fees,
          maker_fees: order.maker_fees,
        }));

        // Calculate summary
        const restingOrders = orders.filter((o) => o.status === "resting");
        const executedOrders = orders.filter((o) => o.status === "executed");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  orders: formattedOrders,
                  summary: {
                    total: orders.length,
                    resting: restingOrders.length,
                    executed: executedOrders.length,
                  },
                  cursor,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching orders: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

