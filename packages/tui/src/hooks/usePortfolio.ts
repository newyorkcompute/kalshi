import { useState, useCallback, useRef } from "react";
import type { PositionDisplay } from "@newyorkcompute/kalshi-core";
import { withTimeout } from "@newyorkcompute/kalshi-core";
import { useKalshi } from "./useKalshi.js";
import { useAppStore } from "../stores/app-store.js";
import { usePolling } from "./usePolling.js";

// Helper to check if balance changed
function balanceChanged(
  prev: { balance: number; portfolioValue: number } | null,
  next: { balance: number; portfolioValue: number } | null
): boolean {
  if (!prev && !next) return false;
  if (!prev || !next) return true;
  return prev.balance !== next.balance || prev.portfolioValue !== next.portfolioValue;
}

interface Balance {
  balance: number;
  portfolioValue: number;
}

interface UsePortfolioResult {
  balance: Balance | null;
  positions: PositionDisplay[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  retryDelay: number;
  isCircuitOpen: boolean;
}

/**
 * Hook to fetch and poll portfolio data (balance + positions)
 */
export function usePortfolio(pollInterval = 30000): UsePortfolioResult {
  const { portfolioApi } = useKalshi();
  const setIsConnected = useAppStore((state) => state.setIsConnected);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [positions, setPositions] = useState<PositionDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const balanceRef = useRef<Balance | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!portfolioApi) return;

    try {
      // Fetch balance and positions in parallel with timeout
      // API signature: getPositions(cursor, limit, countFilter, settlementStatus, ticker, eventTicker)
      const [balanceResponse, positionsResponse] = await Promise.all([
        withTimeout(
          portfolioApi.getBalance(),
          30000,
          "Balance request timed out"
        ),
        withTimeout(
          portfolioApi.getPositions(
            undefined, // cursor
            100,       // limit
            "position" // countFilter
          ),
          30000,
          "Positions request timed out"
        ),
      ]);

      const newBalance = {
        balance: balanceResponse.data.balance || 0,
        portfolioValue: balanceResponse.data.portfolio_value || 0,
      };
      
      // Only update balance if it changed
      if (balanceChanged(balanceRef.current, newBalance)) {
        balanceRef.current = newBalance;
        setBalance(newBalance);
      }

      // Map to our display type
      const positionData = (positionsResponse.data.market_positions || []).map(
        (p) => ({
          ticker: p.ticker || "",
          position: p.position || 0,
          market_exposure: p.market_exposure || 0,
          realized_pnl: p.realized_pnl,
          total_traded: p.total_traded,
        })
      );
      setPositions(positionData);
      setError(null);
      setIsConnected(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch portfolio"
      );
      setIsConnected(false);
      throw err; // Re-throw for usePolling to handle
    } finally {
      setIsLoading(false);
    }
  }, [portfolioApi, setIsConnected]);

  // Use polling hook with exponential backoff
  const { retryDelay, isCircuitOpen } = usePolling(fetchPortfolio, {
    interval: pollInterval,
    maxRetryDelay: 300000, // 5 minutes
    maxConsecutiveErrors: 5,
    onError: (err) => setError(err.message),
  });

  return {
    balance,
    positions,
    isLoading,
    error,
    refresh: fetchPortfolio,
    retryDelay,
    isCircuitOpen,
  };
}
