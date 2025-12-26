import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EventsApi } from "kalshi-typescript";
import { registerGetEvent } from "./get-event.js";

// Mock the EventsApi
vi.mock("kalshi-typescript", () => ({
  EventsApi: vi.fn(),
}));

describe("get_event tool", () => {
  let server: McpServer;
  let mockEventsApi: { getEvent: ReturnType<typeof vi.fn> };
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
      getEvent: vi.fn(),
    };

    registerGetEvent(server, mockEventsApi as unknown as EventsApi);
  });

  it("should register the get_event tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_event",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted event details on success", async () => {
    const mockEvent = {
      event_ticker: "KXBTC",
      title: "Bitcoin Price Markets",
      sub_title: "Daily BTC price predictions",
      category: "Crypto",
      mutually_exclusive: false,
      series_ticker: "KXBTC-SERIES",
    };

    const mockMarkets = [
      {
        ticker: "KXBTC-25JAN03-B100500",
        title: "Bitcoin above $100,500?",
        subtitle: "Jan 3 settlement",
        status: "active",
        yes_bid: 45,
        yes_ask: 47,
        last_price: 46,
        volume: 10000,
        volume_24h: 500,
        open_interest: 2500,
      },
      {
        ticker: "KXBTC-25JAN03-B101000",
        title: "Bitcoin above $101,000?",
        subtitle: "Jan 3 settlement",
        status: "active",
        yes_bid: 30,
        yes_ask: 32,
        last_price: 31,
        volume: 8000,
        volume_24h: 400,
        open_interest: 2000,
      },
    ];

    mockEventsApi.getEvent.mockResolvedValue({
      data: { event: mockEvent, markets: mockMarkets },
    });

    const result = await registeredTool.handler({
      event_ticker: "KXBTC",
      with_nested_markets: true,
    });

    expect(mockEventsApi.getEvent).toHaveBeenCalledWith("KXBTC", true);

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.event_ticker).toBe("KXBTC");
    expect(parsed.title).toBe("Bitcoin Price Markets");
    expect(parsed.markets_count).toBe(2);
    expect(parsed.markets).toHaveLength(2);
    expect(parsed.markets[0].ticker).toBe("KXBTC-25JAN03-B100500");
  });

  it("should return event without nested markets", async () => {
    const mockEvent = {
      event_ticker: "ELECTION",
      title: "2024 Presidential Election",
      sub_title: "Who will win?",
      category: "Politics",
      mutually_exclusive: true,
      series_ticker: null,
    };

    mockEventsApi.getEvent.mockResolvedValue({
      data: { event: mockEvent, markets: [] },
    });

    const result = await registeredTool.handler({
      event_ticker: "ELECTION",
    });

    expect(mockEventsApi.getEvent).toHaveBeenCalledWith("ELECTION", undefined);

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.event_ticker).toBe("ELECTION");
    expect(parsed.markets_count).toBe(0);
  });

  it("should return error when event not found", async () => {
    mockEventsApi.getEvent.mockResolvedValue({
      data: { event: null, markets: [] },
    });

    const result = await registeredTool.handler({ event_ticker: "INVALID" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Event not found: INVALID",
        },
      ],
      isError: true,
    });
  });

  it("should return error on API failure", async () => {
    mockEventsApi.getEvent.mockRejectedValue(new Error("Network error"));

    const result = await registeredTool.handler({ event_ticker: "KXBTC" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching event KXBTC: Network error",
        },
      ],
      isError: true,
    });
  });

  it("should handle unknown errors", async () => {
    mockEventsApi.getEvent.mockRejectedValue({ code: 500 });

    const result = await registeredTool.handler({ event_ticker: "KXBTC" });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching event KXBTC: Unknown error occurred",
        },
      ],
      isError: true,
    });
  });
});

