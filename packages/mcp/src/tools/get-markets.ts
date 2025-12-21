import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MarketApi, GetMarketsStatusEnum } from "kalshi-typescript";
import { z } from "zod";

const GetMarketsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .describe("Maximum number of markets to return (1-1000, default 100)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  event_ticker: z
    .string()
    .optional()
    .describe("Filter by event ticker (e.g., 'KXBTC')"),
  series_ticker: z.string().optional().describe("Filter by series ticker"),
  status: z
    .enum(["unopened", "open", "paused", "closed", "settled"])
    .optional()
    .describe("Filter by market status"),
  tickers: z
    .string()
    .optional()
    .describe("Comma-separated list of market tickers to fetch"),
});

type GetMarketsInput = z.infer<typeof GetMarketsSchema>;

export function registerGetMarkets(server: McpServer, marketApi: MarketApi) {
  server.tool(
    "get_markets",
    "List and search Kalshi prediction markets. Returns market details including ticker, title, status, and current prices.",
    GetMarketsSchema.shape,
    async (params: GetMarketsInput) => {
      try {
        // Map status string to SDK enum
        const statusEnum = params.status
          ? (GetMarketsStatusEnum[
              (params.status.charAt(0).toUpperCase() +
                params.status.slice(1)) as keyof typeof GetMarketsStatusEnum
            ] as GetMarketsStatusEnum)
          : undefined;

        const response = await marketApi.getMarkets(
          params.limit,
          params.cursor,
          params.event_ticker,
          params.series_ticker,
          undefined, // minCreatedTs
          undefined, // maxCreatedTs
          undefined, // maxCloseTs
          undefined, // minCloseTs
          undefined, // minSettledTs
          undefined, // maxSettledTs
          statusEnum,
          params.tickers
        );

        const markets = response.data.markets || [];
        const cursor = response.data.cursor;

        // Format markets for readable output
        const formattedMarkets = markets.map((market) => ({
          ticker: market.ticker,
          title: market.title,
          subtitle: market.subtitle,
          status: market.status,
          yes_bid: market.yes_bid,
          yes_ask: market.yes_ask,
          no_bid: market.no_bid,
          no_ask: market.no_ask,
          last_price: market.last_price,
          volume: market.volume,
          volume_24h: market.volume_24h,
          open_interest: market.open_interest,
          event_ticker: market.event_ticker,
          close_time: market.close_time,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  markets: formattedMarkets,
                  cursor,
                  count: markets.length,
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
              text: `Error fetching markets: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
