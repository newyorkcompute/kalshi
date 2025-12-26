/**
 * useKalshi Hook
 * Manages connection to Kalshi API and data fetching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  createMarketApi, 
  createPortfolioApi, 
  getKalshiConfig,
  type MarketDisplay,
  type OrderbookDisplay,
} from '@newyorkcompute/kalshi-core';
import type { MarketApi, PortfolioApi, Market, MarketPosition } from 'kalshi-typescript';

interface Position {
  ticker: string;
  position: number;
  market_exposure: number;
}

// Extended market with previous price for change tracking
interface MarketWithHistory extends MarketDisplay {
  previousYesBid?: number;
}

interface UseKalshiReturn {
  markets: MarketWithHistory[];
  orderbook: OrderbookDisplay | null;
  balance: number | null;
  positions: Position[];
  isConnected: boolean;
  error: string | null;
  selectMarket: (ticker: string) => void;
}

export function useKalshi(): UseKalshiReturn {
  const [markets, setMarkets] = useState<MarketWithHistory[]>([]);
  const [orderbook, setOrderbook] = useState<OrderbookDisplay | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  // API clients
  const marketApiRef = useRef<MarketApi | null>(null);
  const portfolioApiRef = useRef<PortfolioApi | null>(null);
  
  // Store previous prices for change detection
  const previousPricesRef = useRef<Map<string, number>>(new Map());

  // Initialize API clients
  useEffect(() => {
    try {
      const config = getKalshiConfig();
      marketApiRef.current = createMarketApi(config);
      portfolioApiRef.current = createPortfolioApi(config);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setIsConnected(false);
    }
  }, []);

  // Fetch markets
  const fetchMarkets = useCallback(async () => {
    if (!marketApiRef.current) return;

    try {
      const response = await marketApiRef.current.getMarkets(
        100, undefined, undefined, undefined, undefined, 
        undefined, undefined, undefined, undefined, undefined, 'open'
      );
      
      const marketData = (response.data.markets || []).map((m: Market): MarketWithHistory => {
        const ticker = m.ticker || '';
        const currentYesBid = m.yes_bid;
        const previousYesBid = previousPricesRef.current.get(ticker);
        
        // Store current price for next comparison
        if (currentYesBid !== undefined) {
          previousPricesRef.current.set(ticker, currentYesBid);
        }
        
        return {
          ticker,
          title: m.title || '',
          status: (m.status || 'open') as MarketDisplay['status'],
          yes_bid: currentYesBid,
          yes_ask: m.yes_ask,
          no_bid: m.no_bid,
          no_ask: m.no_ask,
          volume: m.volume,
          open_interest: m.open_interest,
          close_time: m.close_time,
          previousYesBid,
        };
      });
      
      setMarkets(marketData);
      setIsConnected(true);
    } catch {
      // Silently fail, will retry
    }
  }, []);

  // Fetch orderbook for selected market
  const fetchOrderbook = useCallback(async (ticker: string) => {
    if (!marketApiRef.current || !ticker) return;

    try {
      const response = await marketApiRef.current.getMarketOrderbook(ticker, 10);
      const ob = response.data.orderbook;
      
      if (ob) {
        const parseLevel = (entry: string[]): [number, number] => [
          parseFloat(entry[0] || '0'),
          parseInt(entry[1] || '0', 10),
        ];
        
        setOrderbook({
          yes: (ob.yes_dollars || []).map(parseLevel),
          no: (ob.no_dollars || []).map(parseLevel),
        });
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch portfolio data
  const fetchPortfolio = useCallback(async () => {
    if (!portfolioApiRef.current) return;

    try {
      const [balanceRes, positionsRes] = await Promise.all([
        portfolioApiRef.current.getBalance(),
        portfolioApiRef.current.getPositions(undefined, 100, 'position'),
      ]);

      setBalance(balanceRes.data.balance || 0);
      setPositions(
        (positionsRes.data.market_positions || []).map((p: MarketPosition) => ({
          ticker: p.ticker || '',
          position: p.position || 0,
          market_exposure: p.market_exposure || 0,
        }))
      );
      setIsConnected(true);
    } catch {
      // Silently fail
    }
  }, []);

  // Select market and fetch orderbook
  const selectMarket = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
    fetchOrderbook(ticker);
  }, [fetchOrderbook]);

  // Initial data fetch
  useEffect(() => {
    if (!isConnected) return;

    // Fetch immediately
    fetchMarkets();
    fetchPortfolio();

    // Set up polling
    const marketsInterval = setInterval(fetchMarkets, 60000);
    const portfolioInterval = setInterval(fetchPortfolio, 30000);

    return () => {
      clearInterval(marketsInterval);
      clearInterval(portfolioInterval);
    };
  }, [isConnected, fetchMarkets, fetchPortfolio]);

  // Poll orderbook for selected market
  useEffect(() => {
    if (!selectedTicker) return;

    const orderbookInterval = setInterval(() => {
      fetchOrderbook(selectedTicker);
    }, 30000);

    return () => clearInterval(orderbookInterval);
  }, [selectedTicker, fetchOrderbook]);

  return {
    markets,
    orderbook,
    balance,
    positions,
    isConnected,
    error,
    selectMarket,
  };
}
