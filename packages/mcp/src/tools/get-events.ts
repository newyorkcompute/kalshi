import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EventsApi, GetEventsStatusEnum } from "kalshi-typescript";
import { z } from "zod";

const GetEventsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(200)
    .optional()
    .describe("Number of events to return (default 200, max 200)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  status: z
    .enum(["open", "closed", "settled"])
    .optional()
    .describe("Filter by event status"),
  series_ticker: z.string().optional().describe("Filter by series ticker"),
  with_nested_markets: z
    .boolean()
    .optional()
    .describe("Include markets within each event"),
});

type GetEventsInput = z.infer<typeof GetEventsSchema>;

export function registerGetEvents(server: McpServer, eventsApi: EventsApi) {
  server.tool(
    "get_events",
    "List Kalshi events. Events represent real-world occurrences (elections, sports games, etc.) that contain one or more markets.",
    GetEventsSchema.shape,
    async (params: GetEventsInput) => {
      try {
        // Map status string to SDK enum
        const statusEnum = params.status
          ? (GetEventsStatusEnum[
              (params.status.charAt(0).toUpperCase() +
                params.status.slice(1)) as keyof typeof GetEventsStatusEnum
            ] as GetEventsStatusEnum)
          : undefined;

        const response = await eventsApi.getEvents(
          params.limit,
          params.cursor,
          params.with_nested_markets,
          undefined, // withMilestones
          statusEnum,
          params.series_ticker
        );

        const events = response.data.events || [];
        const cursor = response.data.cursor;

        // Format events for readable output
        const formattedEvents = events.map((event) => ({
          event_ticker: event.event_ticker,
          title: event.title,
          sub_title: event.sub_title,
          category: event.category,
          markets_count: event.markets?.length || 0,
          mutually_exclusive: event.mutually_exclusive,
          series_ticker: event.series_ticker,
          // Include markets if requested
          ...(params.with_nested_markets && event.markets
            ? {
                markets: event.markets.map((m) => ({
                  ticker: m.ticker,
                  title: m.title,
                  status: m.status,
                  yes_bid: m.yes_bid,
                  yes_ask: m.yes_ask,
                })),
              }
            : {}),
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  events: formattedEvents,
                  count: events.length,
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
              text: `Error fetching events: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

