/**
 * Get Settlements Tool
 *
 * MCP tool for fetching the user's settlement history on Kalshi.
 * Returns settlement details including market outcomes and payouts.
 *
 * @module tools/get-settlements
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { z } from "zod";

/** Schema for get_settlements tool parameters */
const GetSettlementsSchema = z.object({
  ticker: z.string().optional().describe("Filter by market ticker"),
  event_ticker: z.string().optional().describe("Filter by event ticker"),
  limit: z
    .number()
    .min(1)
    .max(200)
    .optional()
    .describe("Number of settlements to return (default 100, max 200)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  min_ts: z
    .number()
    .optional()
    .describe("Filter settlements after this Unix timestamp"),
  max_ts: z
    .number()
    .optional()
    .describe("Filter settlements before this Unix timestamp"),
});

type GetSettlementsInput = z.infer<typeof GetSettlementsSchema>;

/**
 * Registers the get_settlements tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param portfolioApi - Kalshi Portfolio API client
 */
export function registerGetSettlements(
  server: McpServer,
  portfolioApi: PortfolioApi
) {
  server.tool(
    "get_settlements",
    "Get your settlement history on Kalshi. Shows settled market outcomes and your payouts.",
    GetSettlementsSchema.shape,
    async (params: GetSettlementsInput) => {
      try {
        const response = await portfolioApi.getSettlements(
          params.limit,
          params.cursor,
          params.ticker,
          params.event_ticker,
          params.min_ts,
          params.max_ts
        );

        const settlements = response.data.settlements || [];
        const cursor = response.data.cursor;

        // Format settlements for readable output
        const formattedSettlements = settlements.map((settlement) => ({
          ticker: settlement.ticker,
          market_result: settlement.market_result,
          // Position at settlement
          no_count: settlement.no_count,
          no_total_cost: settlement.no_total_cost,
          yes_count: settlement.yes_count,
          yes_total_cost: settlement.yes_total_cost,
          // Payouts
          revenue: settlement.revenue,
          // Timing
          settled_time: settlement.settled_time,
        }));

        // Calculate summary
        const totalRevenue = settlements.reduce(
          (sum, s) => sum + (s.revenue || 0),
          0
        );
        const wins = settlements.filter((s) => (s.revenue || 0) > 0);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  settlements: formattedSettlements,
                  summary: {
                    total: settlements.length,
                    total_revenue_cents: totalRevenue,
                    total_revenue_dollars: (totalRevenue / 100).toFixed(2),
                    profitable_settlements: wins.length,
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
              text: `Error fetching settlements: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

