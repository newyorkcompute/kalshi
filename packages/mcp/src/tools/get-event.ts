/**
 * Get Event Tool
 *
 * MCP tool for fetching detailed information about a specific Kalshi event.
 * Returns event details including all associated markets.
 *
 * @module tools/get-event
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EventsApi } from "kalshi-typescript";
import { z } from "zod";

/** Schema for get_event tool parameters */
const GetEventSchema = z.object({
  event_ticker: z.string().describe("The event ticker (e.g., 'KXBTC')"),
  with_nested_markets: z
    .boolean()
    .optional()
    .describe("Include markets within the event response"),
});

type GetEventInput = z.infer<typeof GetEventSchema>;

/**
 * Registers the get_event tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param eventsApi - Kalshi Events API client
 */
export function registerGetEvent(server: McpServer, eventsApi: EventsApi) {
  server.tool(
    "get_event",
    "Get detailed information about a specific Kalshi event by its ticker.",
    GetEventSchema.shape,
    async (params: GetEventInput) => {
      try {
        const response = await eventsApi.getEvent(
          params.event_ticker,
          params.with_nested_markets
        );

        const event = response.data.event;
        const markets = response.data.markets || [];

        if (!event) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Event not found: ${params.event_ticker}`,
              },
            ],
            isError: true,
          };
        }

        // Format event for readable output
        const formattedEvent = {
          event_ticker: event.event_ticker,
          title: event.title,
          sub_title: event.sub_title,
          category: event.category,
          mutually_exclusive: event.mutually_exclusive,
          series_ticker: event.series_ticker,
          // Markets
          markets: markets.map((m) => ({
            ticker: m.ticker,
            title: m.title,
            subtitle: m.subtitle,
            status: m.status,
            yes_bid: m.yes_bid,
            yes_ask: m.yes_ask,
            last_price: m.last_price,
            volume: m.volume,
            volume_24h: m.volume_24h,
            open_interest: m.open_interest,
          })),
          markets_count: markets.length,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(formattedEvent, null, 2),
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
              text: `Error fetching event ${params.event_ticker}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

