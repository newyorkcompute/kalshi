import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NWSClient } from "./nws-client.js";
import type { CityConfig } from "./types.js";

const AUS: CityConfig = {
  kalshiCode: "AUS",
  name: "Austin",
  nwsStation: "KAUS",
  lat: 30.1945,
  lon: -97.6699,
};

describe("NWSClient.getObservedDayExtremes", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("computes running max and min from station observations for the local day", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/stations/KAUS") && !url.includes("/observations")) {
        return new Response(
          JSON.stringify({ properties: { timeZone: "America/Chicago" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/stations/KAUS/observations")) {
        return new Response(
          JSON.stringify({
            features: [
              {
                properties: {
                  timestamp: "2026-02-12T10:00:00-06:00",
                  temperature: { value: 20, unitCode: "wmoUnit:degC" },
                },
              },
              {
                properties: {
                  timestamp: "2026-02-12T15:00:00-06:00",
                  temperature: { value: 75, unitCode: "wmoUnit:degF" },
                },
              },
              {
                properties: {
                  timestamp: "2026-02-11T23:00:00-06:00",
                  temperature: { value: 10, unitCode: "wmoUnit:degC" },
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const client = new NWSClient();
    const result = await client.getObservedDayExtremes(AUS, "2026-02-12");

    expect(result).not.toBeNull();
    expect(result!.maxF).toBeCloseTo(75, 1);
    expect(result!.minF).toBeCloseTo(68, 1);
  });

  it("returns null extremes when no observations match the target date", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/stations/KAUS") && !url.includes("/observations")) {
        return new Response(
          JSON.stringify({ properties: { timeZone: "America/Chicago" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/stations/KAUS/observations")) {
        return new Response(
          JSON.stringify({ features: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const client = new NWSClient();
    const result = await client.getObservedDayExtremes(AUS, "2026-02-12");

    expect(result).toEqual({
      date: "2026-02-12",
      maxF: null,
      minF: null,
      fetchedAt: expect.any(Date),
    });
  });
});
