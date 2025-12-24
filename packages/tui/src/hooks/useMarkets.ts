import { useState, useCallback, useRef } from "react";
import type { MarketDisplay } from "@newyorkcompute/kalshi-core";
import { GetMarketsStatusEnum, withTimeout } from "@newyorkcompute/kalshi-core";
import { useKalshi } from "./useKalshi.js";
import { usePolling } from "./usePolling.js";

// Helper to check if markets data has changed (compares by ticker list and prices)
function marketsChanged(prev: MarketDisplay[], next: MarketDisplay[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].ticker !== next[i].ticker) return true;
    if (prev[i].yes_bid !== next[i].yes_bid) return true;
    if (prev[i].yes_ask !== next[i].yes_ask) return true;
  }
  return false;
}

interface UseMarketsResult {
  markets: MarketDisplay[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  retryDelay: number;
  isCircuitOpen: boolean;
}

/**
 * Hook to fetch and poll market data
 */
export function useMarkets(pollInterval = 30000): UseMarketsResult {
  const { marketApi } = useKalshi();
  const [markets, setMarkets] = useState<MarketDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const marketsRef = useRef<MarketDisplay[]>([]);

  const fetchMarkets = useCallback(async () => {
    if (!marketApi) return;

    setIsLoading(true);

    try {
      // API signature: getMarkets(limit, cursor, eventTicker, seriesTicker, minCreatedTs, maxCreatedTs, maxCloseTs, minCloseTs, minSettledTs, maxSettledTs, status, tickers)
      const response = await withTimeout(
        marketApi.getMarkets(
          100,       // limit
          undefined, // cursor
          undefined, // eventTicker
          undefined, // seriesTicker
          undefined, // minCreatedTs
          undefined, // maxCreatedTs
          undefined, // maxCloseTs
          undefined, // minCloseTs
          undefined, // minSettledTs
          undefined, // maxSettledTs
          GetMarketsStatusEnum.Open // status
        ),
        30000, // 30 second timeout
        "Market data request timed out"
      );
      // Map to our display type
      const marketData = (response.data.markets || []).map((m) => ({
        ticker: m.ticker || "",
        title: m.title || "",
        status: (m.status || "open") as MarketDisplay["status"],
        yes_bid: m.yes_bid,
        yes_ask: m.yes_ask,
        no_bid: m.no_bid,
        no_ask: m.no_ask,
        volume: m.volume,
        open_interest: m.open_interest,
        close_time: m.close_time,
      }));
      
      // Only update state if data actually changed
      if (marketsChanged(marketsRef.current, marketData)) {
        marketsRef.current = marketData;
        setMarkets(marketData);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch markets");
      throw err; // Re-throw for usePolling to handle
    } finally {
      setIsLoading(false);
    }
  }, [marketApi]);

  // Use polling hook with exponential backoff
  const { retryDelay, isCircuitOpen } = usePolling(fetchMarkets, {
    interval: pollInterval,
    maxRetryDelay: 300000, // 5 minutes
    maxConsecutiveErrors: 5,
    onError: (err) => setError(err.message),
  });

  return {
    markets,
    isLoading,
    error,
    refresh: fetchMarkets,
    retryDelay,
    isCircuitOpen,
  };
}
