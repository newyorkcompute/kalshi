import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EventsApi, GetEventsStatusEnum } from "kalshi-typescript";
import { registerGetEvents } from "./get-events.js";

// Mock the EventsApi
vi.mock("kalshi-typescript", () => ({
  EventsApi: vi.fn(),
  GetEventsStatusEnum: {
    Open: "open",
    Closed: "closed",
    Settled: "settled",
  },
}));

describe("get_events tool", () => {
  let server: McpServer;
  let mockEventsApi: { getEvents: ReturnType<typeof vi.fn> };
  let registeredTool: {
    name: string;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  };

  beforeEach(() => {
    server = {
      tool: vi.fn((_name, _desc, _schema, handler) => {
        registeredTool = { name: _name, handler };
      }),
    } as unknown as McpServer;

    mockEventsApi = {
      getEvents: vi.fn(),
    };

    registerGetEvents(server, mockEventsApi as unknown as EventsApi);
  });

  it("should register the get_events tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_events",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted events list", async () => {
    const mockEvents = [
      {
        event_ticker: "KXBTC",
        title: "Bitcoin Price Markets",
        sub_title: "Daily BTC predictions",
        category: "Crypto",
        markets: [],
        mutually_exclusive: false,
        series_ticker: "KXBTC-SERIES",
      },
      {
        event_ticker: "ELECTION",
        title: "2024 Election",
        sub_title: "Presidential race",
        category: "Politics",
        markets: [],
        mutually_exclusive: true,
        series_ticker: null,
      },
    ];

    mockEventsApi.getEvents.mockResolvedValue({
      data: { events: mockEvents, cursor: "next-cursor" },
    });

    const result = await registeredTool.handler({ limit: 10 });

    expect(mockEventsApi.getEvents).toHaveBeenCalledWith(
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.count).toBe(2);
    expect(parsed.cursor).toBe("next-cursor");
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0].event_ticker).toBe("KXBTC");
  });

  it("should filter by status", async () => {
    mockEventsApi.getEvents.mockResolvedValue({
      data: { events: [], cursor: null },
    });

    await registeredTool.handler({ status: "open" });

    expect(mockEventsApi.getEvents).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      GetEventsStatusEnum.Open,
      undefined
    );
  });

  it("should include nested markets when requested", async () => {
    const mockEvents = [
      {
        event_ticker: "KXBTC",
        title: "Bitcoin Price Markets",
        sub_title: "Daily BTC predictions",
        category: "Crypto",
        mutually_exclusive: false,
        series_ticker: null,
        markets: [
          {
            ticker: "KXBTC-25JAN03-B100500",
            title: "BTC above $100,500?",
            status: "active",
            yes_bid: 45,
            yes_ask: 47,
          },
        ],
      },
    ];

    mockEventsApi.getEvents.mockResolvedValue({
      data: { events: mockEvents, cursor: null },
    });

    const result = await registeredTool.handler({ with_nested_markets: true });

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.events[0].markets).toBeDefined();
    expect(parsed.events[0].markets[0].ticker).toBe("KXBTC-25JAN03-B100500");
  });

  it("should handle pagination with cursor", async () => {
    mockEventsApi.getEvents.mockResolvedValue({
      data: { events: [], cursor: null },
    });

    await registeredTool.handler({ cursor: "prev-cursor", limit: 50 });

    expect(mockEventsApi.getEvents).toHaveBeenCalledWith(
      50,
      "prev-cursor",
      undefined,
      undefined,
      undefined,
      undefined
    );
  });

  it("should filter by series_ticker", async () => {
    mockEventsApi.getEvents.mockResolvedValue({
      data: { events: [], cursor: null },
    });

    await registeredTool.handler({ series_ticker: "KXBTC-SERIES" });

    expect(mockEventsApi.getEvents).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "KXBTC-SERIES"
    );
  });

  it("should return error on API failure", async () => {
    mockEventsApi.getEvents.mockRejectedValue(new Error("API unavailable"));

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching events: API unavailable",
        },
      ],
      isError: true,
    });
  });

  it("should handle unknown errors", async () => {
    mockEventsApi.getEvents.mockRejectedValue(null);

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching events: Unknown error occurred",
        },
      ],
      isError: true,
    });
  });
});

