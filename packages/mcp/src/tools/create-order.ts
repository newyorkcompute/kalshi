/**
 * Create Order Tool
 *
 * MCP tool for placing new orders on Kalshi markets.
 * Includes pre-flight validation to check market status, balance, and price reasonableness.
 *
 * ⚠️ CAUTION: This tool executes real trades with real money.
 *
 * @module tools/create-order
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  OrdersApi,
  MarketApi,
  PortfolioApi,
  CreateOrderRequestSideEnum,
  CreateOrderRequestActionEnum,
  CreateOrderRequestTypeEnum,
} from "kalshi-typescript";
import { z } from "zod";
import { validateOrder } from "@newyorkcompute/kalshi-core";

/** Schema for create_order tool parameters */
const CreateOrderSchema = z.object({
  ticker: z.string().describe("Market ticker to place order on"),
  side: z.enum(["yes", "no"]).describe("Side of the order: 'yes' or 'no'"),
  action: z.enum(["buy", "sell"]).describe("Action: 'buy' or 'sell'"),
  count: z.number().min(1).describe("Number of contracts"),
  type: z
    .enum(["limit", "market"])
    .optional()
    .default("limit")
    .describe("Order type (default: limit)"),
  yes_price: z
    .number()
    .min(1)
    .max(99)
    .optional()
    .describe("Yes price in cents (1-99). Required for limit orders on yes side."),
  no_price: z
    .number()
    .min(1)
    .max(99)
    .optional()
    .describe("No price in cents (1-99). Required for limit orders on no side."),
  client_order_id: z
    .string()
    .optional()
    .describe("Optional client-provided order ID for idempotency"),
  expiration_ts: z
    .number()
    .optional()
    .describe("Unix timestamp when order expires"),
});

type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/**
 * Registers the create_order tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param ordersApi - Kalshi Orders API client
 * @param marketApi - Kalshi Market API client (for validation)
 * @param portfolioApi - Kalshi Portfolio API client (for balance check)
 */
export function registerCreateOrder(
  server: McpServer,
  ordersApi: OrdersApi,
  marketApi: MarketApi,
  portfolioApi: PortfolioApi
) {
  server.tool(
    "create_order",
    "Place a new order on a Kalshi market. CAUTION: This will execute a real trade with real money.",
    CreateOrderSchema.shape,
    async (params: CreateOrderInput) => {
      try {
        // Pre-flight validation
        const validation = await validateOrder(
          {
            ticker: params.ticker,
            side: params.side,
            action: params.action,
            count: params.count,
            price: params.yes_price || params.no_price,
          },
          marketApi,
          portfolioApi
        );

        // Return validation errors
        if (!validation.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    estimatedCost: validation.estimatedCost,
                    currentBalance: validation.currentBalance,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Show warnings but proceed
        if (validation.warnings.length > 0) {
          console.warn("Order warnings:", validation.warnings);
        }
        // Map side and action to SDK enums
        const side =
          params.side === "yes"
            ? CreateOrderRequestSideEnum.Yes
            : CreateOrderRequestSideEnum.No;

        const action =
          params.action === "buy"
            ? CreateOrderRequestActionEnum.Buy
            : CreateOrderRequestActionEnum.Sell;

        const type =
          params.type === "market"
            ? CreateOrderRequestTypeEnum.Market
            : CreateOrderRequestTypeEnum.Limit;

        const response = await ordersApi.createOrder({
          ticker: params.ticker,
          side,
          action,
          count: params.count,
          type,
          yes_price: params.yes_price,
          no_price: params.no_price,
          client_order_id: params.client_order_id,
          expiration_ts: params.expiration_ts,
        });

        const order = response.data.order;

        if (!order) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Order created but no order details returned",
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
          type: order.type,
          yes_price: order.yes_price,
          no_price: order.no_price,
          initial_count: order.initial_count,
          fill_count: order.fill_count,
          remaining_count: order.remaining_count,
          created_time: order.created_time,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: "Order created successfully",
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
              text: `Error creating order: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

