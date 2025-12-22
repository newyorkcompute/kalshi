import { useState, useEffect, useCallback, useRef } from "react";
import type { OrderbookDisplay } from "@newyorkcompute/kalshi-core";
import { useKalshi } from "./useKalshi.js";

// Helper to check if orderbook data has changed
function orderbookChanged(
  prev: OrderbookDisplay | null,
  next: OrderbookDisplay | null
): boolean {
  if (!prev && !next) return false;
  if (!prev || !next) return true;
  return JSON.stringify(prev) !== JSON.stringify(next);
}

interface UseOrderbookResult {
  orderbook: OrderbookDisplay | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and poll orderbook data for a specific market
 */
export function useOrderbook(
  ticker: string | null,
  pollInterval = 10000
): UseOrderbookResult {
  const { marketApi } = useKalshi();
  const [orderbook, setOrderbook] = useState<OrderbookDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderbookRef = useRef<OrderbookDisplay | null>(null);

  const fetchOrderbook = useCallback(async () => {
    if (!marketApi || !ticker) {
      if (orderbookRef.current !== null) {
        orderbookRef.current = null;
        setOrderbook(null);
      }
      return;
    }

    // Only show loading on first fetch
    if (!orderbookRef.current) {
      setIsLoading(true);
    }
    
    try {
      // API signature: getMarketOrderbook(ticker, depth)
      const response = await marketApi.getMarketOrderbook(ticker, 10);
      const ob = response.data.orderbook;
      let newOrderbook: OrderbookDisplay | null = null;
      
      if (ob) {
        // Orderbook has yes_dollars and no_dollars arrays (string[][])
        // Each entry is [price_string, quantity_string]
        const parseLevel = (entry: string[]): [number, number] => [
          parseFloat(entry[0] || "0"),
          parseInt(entry[1] || "0", 10),
        ];
        newOrderbook = {
          yes: (ob.yes_dollars || []).map(parseLevel),
          no: (ob.no_dollars || []).map(parseLevel),
        };
      }
      
      // Only update state if data actually changed
      if (orderbookChanged(orderbookRef.current, newOrderbook)) {
        orderbookRef.current = newOrderbook;
        setOrderbook(newOrderbook);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch orderbook"
      );
    } finally {
      setIsLoading(false);
    }
  }, [marketApi, ticker]);

  // Fetch when ticker changes
  useEffect(() => {
    fetchOrderbook();
  }, [fetchOrderbook]);

  // Polling
  useEffect(() => {
    if (!marketApi || !ticker) return;

    const interval = setInterval(fetchOrderbook, pollInterval);
    return () => clearInterval(interval);
  }, [marketApi, ticker, pollInterval, fetchOrderbook]);

  return {
    orderbook,
    isLoading,
    error,
    refresh: fetchOrderbook,
  };
}
