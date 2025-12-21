import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { z } from "zod";

const GetPositionsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of positions to return (default 100)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  ticker: z.string().optional().describe("Filter by specific market ticker"),
  event_ticker: z
    .string()
    .optional()
    .describe("Filter by event ticker (comma-separated, max 10)"),
  count_filter: z
    .enum(["position", "total_traded"])
    .optional()
    .describe("Filter to positions with non-zero values in specified field"),
});

type GetPositionsInput = z.infer<typeof GetPositionsSchema>;

export function registerGetPositions(
  server: McpServer,
  portfolioApi: PortfolioApi
) {
  server.tool(
    "get_positions",
    "Get your current positions on Kalshi markets. Shows contracts held, average prices, and P&L.",
    GetPositionsSchema.shape,
    async (params: GetPositionsInput) => {
      try {
        const response = await portfolioApi.getPositions(
          params.cursor,
          params.limit,
          params.count_filter,
          params.ticker,
          params.event_ticker
        );

        const positions = response.data.market_positions || [];
        const cursor = response.data.cursor;

        // Format positions for readable output
        const formattedPositions = positions.map((pos) => ({
          ticker: pos.ticker,
          // Position info
          position: pos.position,
          total_traded_cents: pos.total_traded,
          total_traded_dollars: pos.total_traded_dollars,
          // Exposure
          market_exposure_cents: pos.market_exposure,
          market_exposure_dollars: pos.market_exposure_dollars,
          // P&L
          realized_pnl_cents: pos.realized_pnl,
          realized_pnl_dollars: pos.realized_pnl_dollars,
          // Fees
          fees_paid_cents: pos.fees_paid,
          fees_paid_dollars: pos.fees_paid_dollars,
          // Resting orders
          resting_orders_count: pos.resting_orders_count,
        }));

        // Calculate summary
        const totalPositions = positions.filter((p) => p.position !== 0).length;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  positions: formattedPositions,
                  summary: {
                    total_positions: totalPositions,
                    total_returned: positions.length,
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
              text: `Error fetching positions: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

