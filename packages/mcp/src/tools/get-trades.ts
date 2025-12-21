import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MarketApi } from "kalshi-typescript";
import { z } from "zod";

const GetTradesSchema = z.object({
  ticker: z.string().optional().describe("Filter by market ticker"),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .describe("Number of trades to return (default 100, max 1000)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  min_ts: z
    .number()
    .optional()
    .describe("Filter trades after this Unix timestamp"),
  max_ts: z
    .number()
    .optional()
    .describe("Filter trades before this Unix timestamp"),
});

type GetTradesInput = z.infer<typeof GetTradesSchema>;

export function registerGetTrades(server: McpServer, marketApi: MarketApi) {
  server.tool(
    "get_trades",
    "Get recent trades on Kalshi markets. Shows executed trades with prices, quantities, and timestamps.",
    GetTradesSchema.shape,
    async (params: GetTradesInput) => {
      try {
        const response = await marketApi.getTrades(
          params.limit,
          params.cursor,
          params.ticker,
          params.min_ts,
          params.max_ts
        );

        const trades = response.data.trades || [];
        const cursor = response.data.cursor;

        // Format trades for readable output
        const formattedTrades = trades.map((trade) => ({
          trade_id: trade.trade_id,
          ticker: trade.ticker,
          // Trade details
          count: trade.count,
          yes_price: trade.yes_price,
          no_price: trade.no_price,
          taker_side: trade.taker_side,
          // Timing
          created_time: trade.created_time,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  trades: formattedTrades,
                  count: trades.length,
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
              text: `Error fetching trades: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

