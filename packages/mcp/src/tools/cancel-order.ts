/**
 * Cancel Order Tool
 *
 * MCP tool for canceling an existing order on Kalshi.
 * Only orders with 'resting' status can be canceled.
 *
 * @module tools/cancel-order
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { z } from "zod";

/** Schema for cancel_order tool parameters */
const CancelOrderSchema = z.object({
  order_id: z.string().describe("The order ID to cancel"),
});

type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

/**
 * Registers the cancel_order tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param ordersApi - Kalshi Orders API client
 */
export function registerCancelOrder(server: McpServer, ordersApi: OrdersApi) {
  server.tool(
    "cancel_order",
    "Cancel an existing order on Kalshi. The order must be in 'resting' status to be canceled.",
    CancelOrderSchema.shape,
    async (params: CancelOrderInput) => {
      try {
        const response = await ordersApi.cancelOrder(params.order_id);
        const order = response.data.order;

        if (!order) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Order ${params.order_id} canceled but no details returned`,
              },
            ],
          };
        }

        // Format order for readable output
        const formattedOrder = {
          order_id: order.order_id,
          ticker: order.ticker,
          status: order.status,
          side: order.side,
          action: order.action,
          yes_price: order.yes_price,
          no_price: order.no_price,
          initial_count: order.initial_count,
          fill_count: order.fill_count,
          remaining_count: order.remaining_count,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: "Order canceled successfully",
                  order: formattedOrder,
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
              text: `Error canceling order ${params.order_id}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

