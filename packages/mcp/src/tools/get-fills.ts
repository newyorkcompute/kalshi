/**
 * Get Fills Tool
 *
 * MCP tool for fetching the user's fill (executed trade) history on Kalshi.
 * Returns fill details including prices, quantities, and fees.
 *
 * @module tools/get-fills
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { z } from "zod";

/** Schema for get_fills tool parameters */
const GetFillsSchema = z.object({
  ticker: z.string().optional().describe("Filter by market ticker"),
  order_id: z.string().optional().describe("Filter by order ID"),
  limit: z
    .number()
    .min(1)
    .max(200)
    .optional()
    .describe("Number of fills to return (default 100, max 200)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  min_ts: z
    .number()
    .optional()
    .describe("Filter fills after this Unix timestamp"),
  max_ts: z
    .number()
    .optional()
    .describe("Filter fills before this Unix timestamp"),
});

type GetFillsInput = z.infer<typeof GetFillsSchema>;

/**
 * Registers the get_fills tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param portfolioApi - Kalshi Portfolio API client
 */
export function registerGetFills(server: McpServer, portfolioApi: PortfolioApi) {
  server.tool(
    "get_fills",
    "Get your fill (executed trade) history on Kalshi. Shows trade details including prices, quantities, and fees.",
    GetFillsSchema.shape,
    async (params: GetFillsInput) => {
      try {
        const response = await portfolioApi.getFills(
          params.ticker,
          params.order_id,
          params.min_ts,
          params.max_ts,
          params.limit,
          params.cursor
        );

        const fills = response.data.fills || [];
        const cursor = response.data.cursor;

        // Format fills for readable output
        const formattedFills = fills.map((fill) => ({
          fill_id: fill.fill_id,
          order_id: fill.order_id,
          ticker: fill.ticker,
          // Trade details
          side: fill.side,
          action: fill.action,
          type: fill.type,
          // Pricing
          yes_price: fill.yes_price,
          no_price: fill.no_price,
          count: fill.count,
          // Timing
          created_time: fill.created_time,
          // Costs
          is_taker: fill.is_taker,
          taker_fees: fill.taker_fees,
          maker_fees: fill.maker_fees,
        }));

        // Calculate summary
        const totalVolume = fills.reduce((sum, f) => sum + (f.count || 0), 0);
        const buyFills = fills.filter((f) => f.action === "buy");
        const sellFills = fills.filter((f) => f.action === "sell");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  fills: formattedFills,
                  summary: {
                    total: fills.length,
                    total_volume: totalVolume,
                    buys: buyFills.length,
                    sells: sellFills.length,
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
              text: `Error fetching fills: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

