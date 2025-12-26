/**
 * useKalshi Hook
 * Manages connection to Kalshi API and data fetching
 * Includes rate limiting, timeouts, and error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  createMarketApi, 
  createPortfolioApi, 
  getKalshiConfig,
  withTimeout,
  type MarketDisplay,
  type OrderbookDisplay,
} from '@newyorkcompute/kalshi-core';
import type { MarketApi, PortfolioApi, Market, MarketPosition, Trade } from 'kalshi-typescript';

// Constants
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MIN_POLL_INTERVAL = 10000; // 10 seconds
const MAX_POLL_INTERVAL = 300000; // 5 minutes
const MAX_CONSECUTIVE_FAILURES = 5;

interface Position {
  ticker: string;
  position: number;
  market_exposure: number;
}

// Extended market with previous price for change tracking
interface MarketWithHistory extends MarketDisplay {
  previousYesBid?: number;
}

// Trade data for price history
interface TradePoint {
  timestamp: number;
  price: number;
  volume: number;
}

interface UseKalshiReturn {
  markets: MarketWithHistory[];
  orderbook: OrderbookDisplay | null;
  balance: number | null;
  positions: Position[];
  isConnected: boolean;
  isRateLimited: boolean;
  error: string | null;
  selectMarket: (ticker: string) => void;
  priceHistory: TradePoint[];
  fetchPriceHistory: (ticker: string, hours?: number) => Promise<void>;
}

/**
 * Check if an error is a rate limit error (429)
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') || 
           error.message.toLowerCase().includes('rate limit') ||
           error.message.toLowerCase().includes('too many requests');
  }
  return false;
}

export function useKalshi(): UseKalshiReturn {
  const [markets, setMarkets] = useState<MarketWithHistory[]>([]);
  const [orderbook, setOrderbook] = useState<OrderbookDisplay | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<TradePoint[]>([]);

  // API clients
  const marketApiRef = useRef<MarketApi | null>(null);
  const portfolioApiRef = useRef<PortfolioApi | null>(null);
  
  // Store previous prices for change detection
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  
  // Rate limiting state
  const pollIntervalRef = useRef(MIN_POLL_INTERVAL);
  const consecutiveFailuresRef = useRef(0);
  const circuitBreakerOpenRef = useRef(false);

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

  /**
   * Handle successful API call - reset rate limiting
   */
  const handleSuccess = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    pollIntervalRef.current = MIN_POLL_INTERVAL;
    circuitBreakerOpenRef.current = false;
    setIsRateLimited(false);
    setIsConnected(true);
  }, []);

  /**
   * Handle failed API call - apply exponential backoff
   */
  const handleFailure = useCallback((err: unknown) => {
    consecutiveFailuresRef.current += 1;
    
    if (isRateLimitError(err)) {
      // Exponential backoff for rate limits
      pollIntervalRef.current = Math.min(
        pollIntervalRef.current * 2,
        MAX_POLL_INTERVAL
      );
      setIsRateLimited(true);
      setError(`Rate limited. Backing off to ${Math.round(pollIntervalRef.current / 1000)}s`);
    }
    
    // Circuit breaker
    if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
      circuitBreakerOpenRef.current = true;
      setError(`Too many failures. Pausing requests for ${Math.round(MAX_POLL_INTERVAL / 1000)}s`);
      
      // Auto-reset circuit breaker after max interval
      setTimeout(() => {
        circuitBreakerOpenRef.current = false;
        consecutiveFailuresRef.current = 0;
        pollIntervalRef.current = MIN_POLL_INTERVAL;
      }, MAX_POLL_INTERVAL);
    }
  }, []);

  // Fetch markets with timeout and rate limiting
  const fetchMarkets = useCallback(async () => {
    if (!marketApiRef.current || circuitBreakerOpenRef.current) return;

    try {
      const response = await withTimeout(
        marketApiRef.current.getMarkets(
          100, undefined, undefined, undefined, undefined, 
          undefined, undefined, undefined, undefined, undefined, 'open'
        ),
        DEFAULT_TIMEOUT,
        'Markets request timed out'
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
      
      // Sort by volume (highest first) - most active markets at top
      marketData.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      
      setMarkets(marketData);
      handleSuccess();
    } catch (err) {
      handleFailure(err);
    }
  }, [handleSuccess, handleFailure]);

  // Fetch orderbook for selected market with timeout
  const fetchOrderbook = useCallback(async (ticker: string) => {
    if (!marketApiRef.current || !ticker || circuitBreakerOpenRef.current) return;

    try {
      const response = await withTimeout(
        marketApiRef.current.getMarketOrderbook(ticker, 10),
        DEFAULT_TIMEOUT,
        'Orderbook request timed out'
      );
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
      handleSuccess();
    } catch (err) {
      handleFailure(err);
    }
  }, [handleSuccess, handleFailure]);

  // Fetch portfolio data with timeout
  const fetchPortfolio = useCallback(async () => {
    if (!portfolioApiRef.current || circuitBreakerOpenRef.current) return;

    try {
      const [balanceRes, positionsRes] = await Promise.all([
        withTimeout(
          portfolioApiRef.current.getBalance(),
          DEFAULT_TIMEOUT,
          'Balance request timed out'
        ),
        withTimeout(
          portfolioApiRef.current.getPositions(undefined, 100, 'position'),
          DEFAULT_TIMEOUT,
          'Positions request timed out'
        ),
      ]);

      setBalance(balanceRes.data.balance || 0);
      setPositions(
        (positionsRes.data.market_positions || []).map((p: MarketPosition) => ({
          ticker: p.ticker || '',
          position: p.position || 0,
          market_exposure: p.market_exposure || 0,
        }))
      );
      handleSuccess();
    } catch (err) {
      handleFailure(err);
    }
  }, [handleSuccess, handleFailure]);

  // Fetch price history for a market
  const fetchPriceHistory = useCallback(async (ticker: string, hours: number = 24) => {
    if (!marketApiRef.current || circuitBreakerOpenRef.current) return;

    try {
      const now = Math.floor(Date.now() / 1000);
      const minTs = now - (hours * 60 * 60);

      const response = await withTimeout(
        marketApiRef.current.getTrades(
          1000, // Get up to 1000 trades
          undefined,
          ticker,
          minTs,
          now
        ),
        DEFAULT_TIMEOUT,
        'Trades request timed out'
      );

      const trades = response.data.trades || [];
      
      // Convert trades to price points
      const points: TradePoint[] = trades.map((t: Trade) => ({
        timestamp: new Date(t.created_time || '').getTime(),
        price: t.yes_price || 0,
        volume: t.count || 0,
      })).sort((a, b) => a.timestamp - b.timestamp);

      setPriceHistory(points);
      handleSuccess();
    } catch (err) {
      handleFailure(err);
    }
  }, [handleSuccess, handleFailure]);

  // Select market and fetch orderbook
  const selectMarket = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
    fetchOrderbook(ticker);
    fetchPriceHistory(ticker, 24); // Fetch 24h of price history
  }, [fetchOrderbook, fetchPriceHistory]);

  // Initial data fetch with dynamic polling
  useEffect(() => {
    if (!isConnected) return;

    // Fetch immediately
    fetchMarkets();
    fetchPortfolio();

    // Set up dynamic polling with rate limiting
    let marketsTimeout: NodeJS.Timeout;
    let portfolioTimeout: NodeJS.Timeout;

    const pollMarkets = () => {
      fetchMarkets();
      marketsTimeout = setTimeout(pollMarkets, pollIntervalRef.current);
    };

    const pollPortfolio = () => {
      fetchPortfolio();
      portfolioTimeout = setTimeout(pollPortfolio, pollIntervalRef.current);
    };

    // Start polling after initial fetch
    marketsTimeout = setTimeout(pollMarkets, pollIntervalRef.current);
    portfolioTimeout = setTimeout(pollPortfolio, pollIntervalRef.current);

    return () => {
      clearTimeout(marketsTimeout);
      clearTimeout(portfolioTimeout);
    };
  }, [isConnected, fetchMarkets, fetchPortfolio]);

  // Poll orderbook for selected market
  useEffect(() => {
    if (!selectedTicker) return;

    let orderbookTimeout: NodeJS.Timeout;

    const pollOrderbook = () => {
      fetchOrderbook(selectedTicker);
      orderbookTimeout = setTimeout(pollOrderbook, pollIntervalRef.current);
    };

    orderbookTimeout = setTimeout(pollOrderbook, pollIntervalRef.current);

    return () => clearTimeout(orderbookTimeout);
  }, [selectedTicker, fetchOrderbook]);

  return {
    markets,
    orderbook,
    balance,
    positions,
    isConnected,
    isRateLimited,
    error,
    selectMarket,
    priceHistory,
    fetchPriceHistory,
  };
}
