/**
 * Batch Cancel Orders Tool
 *
 * MCP tool for canceling multiple orders at once on Kalshi.
 * Can cancel up to 20 orders in a single request.
 *
 * @module tools/batch-cancel-orders
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { z } from "zod";

/** Schema for batch_cancel_orders tool parameters */
const BatchCancelOrdersSchema = z.object({
  order_ids: z
    .array(z.string())
    .min(1)
    .max(20)
    .describe("Array of order IDs to cancel (max 20)"),
});

type BatchCancelOrdersInput = z.infer<typeof BatchCancelOrdersSchema>;

/**
 * Registers the batch_cancel_orders tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param ordersApi - Kalshi Orders API client
 */
export function registerBatchCancelOrders(
  server: McpServer,
  ordersApi: OrdersApi
) {
  server.tool(
    "batch_cancel_orders",
    "Cancel multiple orders at once on Kalshi. Can cancel up to 20 orders in a single request.",
    BatchCancelOrdersSchema.shape,
    async (params: BatchCancelOrdersInput) => {
      try {
        const response = await ordersApi.batchCancelOrders({
          order_ids: params.order_ids,
        });

        const cancelledOrders = response.data.orders || [];

        // Format cancelled orders for readable output
        const formattedOrders = cancelledOrders.map((order) => ({
          order_id: order.order_id,
          ticker: order.ticker,
          side: order.side,
          action: order.action,
          status: order.status,
          remaining_count: order.remaining_count,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  cancelled_count: cancelledOrders.length,
                  requested_count: params.order_ids.length,
                  cancelled_orders: formattedOrders,
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
              text: `Error cancelling orders: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

