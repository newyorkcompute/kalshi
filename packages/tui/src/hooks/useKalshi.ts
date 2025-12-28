/**
 * useKalshi Hook
 * Manages connection to Kalshi API and data fetching
 * Includes rate limiting, timeouts, and error handling
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  createMarketApi, 
  createPortfolioApi, 
  getKalshiConfig,
  withTimeout,
  KalshiWsClient,
  type MarketDisplay,
  type OrderbookDisplay,
  type TickerMessage,
  type OrderbookDeltaMessage,
  type ConnectionState,
} from '@newyorkcompute/kalshi-core';
import type { MarketApi, PortfolioApi, Market, MarketPosition, Trade } from 'kalshi-typescript';
import { getCached, setCache, CACHE_TTL } from '../cache.js';
import { calculateArbitrage, type ArbitrageOpportunities } from '../utils.js';

// Constants
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MIN_POLL_INTERVAL = 10000; // 10 seconds
const MAX_POLL_INTERVAL = 300000; // 5 minutes
const MAX_CONSECUTIVE_FAILURES = 5;

interface Position {
  ticker: string;
  position: number;
  market_exposure: number;
  /** Realized P&L from Kalshi API in cents */
  realized_pnl?: number;
  /** Current market price (yes_bid) in cents */
  currentPrice?: number;
  /** P&L to display (realized from API) */
  pnl?: number;
}

// Extended market with previous price for change tracking
interface MarketWithHistory extends MarketDisplay {
  previousYesBid?: number;
  event_ticker?: string;
}

// Trade data for price history
interface TradePoint {
  timestamp: number;
  price: number;
  volume: number;
}

/** Loading states for each data type */
interface LoadingState {
  markets: boolean;
  orderbook: boolean;
  portfolio: boolean;
  priceHistory: boolean;
}

interface UseKalshiReturn {
  markets: MarketWithHistory[];
  orderbook: OrderbookDisplay | null;
  balance: number | null;
  positions: Position[];
  isConnected: boolean;
  isRateLimited: boolean;
  isOffline: boolean;
  error: string | null;
  selectMarket: (ticker: string) => void;
  priceHistory: TradePoint[];
  fetchPriceHistory: (ticker: string, hours?: number) => Promise<void>;
  loading: LoadingState;
  lastUpdateTime: number | null;
  arbitrage: ArbitrageOpportunities;
  /** WebSocket connection state */
  wsState: ConnectionState;
  /** Whether real-time updates are active */
  isRealtime: boolean;
  /** Initialize WebSocket connection for real-time updates */
  initWebSocket: (apiKeyId: string, privateKey: string) => Promise<void>;
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

/**
 * Check if an error is a network/offline error
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('enotfound') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('offline') ||
      msg.includes('internet');
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
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<TradePoint[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const [loading, setLoading] = useState<LoadingState>({
    markets: true,
    orderbook: false,
    portfolio: true,
    priceHistory: false,
  });

  // API clients
  const marketApiRef = useRef<MarketApi | null>(null);
  const portfolioApiRef = useRef<PortfolioApi | null>(null);
  
  // WebSocket client
  const wsClientRef = useRef<KalshiWsClient | null>(null);
  const [wsState, setWsState] = useState<ConnectionState>('disconnected');
  
  // Store previous prices for change detection
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  
  // Rate limiting state
  const pollIntervalRef = useRef(MIN_POLL_INTERVAL);
  const consecutiveFailuresRef = useRef(0);
  const circuitBreakerOpenRef = useRef(false);

  // Initialize API clients and WebSocket
  useEffect(() => {
    try {
      const config = getKalshiConfig();
      marketApiRef.current = createMarketApi(config);
      portfolioApiRef.current = createPortfolioApi(config);
      setIsConnected(true);
      setError(null);
      
      // Initialize WebSocket if credentials available
      if (config.apiKey && config.privateKey) {
        // WebSocket requires the same credentials as REST API
        // For now, WebSocket auto-connects if credentials are present
        // The initWebSocket function can be called to set up WS connection
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setIsConnected(false);
    }
  }, []);

  // Handle WebSocket ticker updates - merge into markets state
  const handleTickerUpdate = useCallback((data: TickerMessage['msg']) => {
    setMarkets(prev => {
      const index = prev.findIndex(m => m.ticker === data.market_ticker);
      if (index === -1) return prev;
      
      const updated = [...prev];
      const market = updated[index];
      const previousYesBid = market.yes_bid;
      
      updated[index] = {
        ...market,
        yes_bid: data.yes_bid,
        yes_ask: data.yes_ask,
        no_bid: data.no_bid,
        no_ask: data.no_ask,
        volume: data.volume,
        open_interest: data.open_interest,
        previousYesBid,
      };
      
      return updated;
    });
    setLastUpdateTime(Date.now());
  }, []);

  // Handle WebSocket orderbook delta updates
  const handleOrderbookDelta = useCallback((data: OrderbookDeltaMessage['msg']) => {
    setOrderbook(prev => {
      if (!prev) return prev;
      
      const side = data.side === 'yes' ? 'yes' : 'no';
      const levels = [...prev[side]];
      
      // Find existing level at this price
      const existingIndex = levels.findIndex(([price]) => price === data.price);
      
      if (data.delta === 0) {
        // Remove level
        if (existingIndex >= 0) {
          levels.splice(existingIndex, 1);
        }
      } else if (existingIndex >= 0) {
        // Update existing level
        const newQuantity = levels[existingIndex][1] + data.delta;
        if (newQuantity <= 0) {
          levels.splice(existingIndex, 1);
        } else {
          levels[existingIndex] = [data.price, newQuantity];
        }
      } else if (data.delta > 0) {
        // Add new level
        levels.push([data.price, data.delta]);
        // Sort by price (descending for asks, ascending for bids)
        levels.sort((a, b) => b[0] - a[0]);
      }
      
      return {
        ...prev,
        [side]: levels,
      };
    });
    setLastUpdateTime(Date.now());
  }, []);

  // Initialize WebSocket connection (when explicitly enabled)
  const initWebSocket = useCallback(async (apiKeyId: string, privateKey: string) => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
    }

    const client = new KalshiWsClient({
      apiKeyId,
      privateKey,
      autoReconnect: true,
    });

    client.on('onConnect', () => {
      setWsState('connected');
      // Subscribe to ticker for all markets we have
      const tickers = markets.map(m => m.ticker);
      if (tickers.length > 0) {
        client.subscribe(['ticker'], tickers);
      }
    });

    client.on('onDisconnect', () => {
      setWsState('disconnected');
    });

    client.on('onError', (err) => {
      console.error('WebSocket error:', err);
    });

    client.on('onTicker', handleTickerUpdate);
    client.on('onOrderbookDelta', handleOrderbookDelta);

    wsClientRef.current = client;
    setWsState('connecting');

    try {
      await client.connect();
    } catch (err) {
      setWsState('disconnected');
      console.error('WebSocket connection failed:', err);
    }
  }, [markets, handleTickerUpdate, handleOrderbookDelta]);

  // Subscribe to orderbook for selected market via WebSocket
  useEffect(() => {
    if (!wsClientRef.current || wsState !== 'connected' || !selectedTicker) return;

    // Subscribe to orderbook delta for selected market
    wsClientRef.current.subscribe(['orderbook_delta'], [selectedTicker]);

    return () => {
      // Unsubscribe when market changes
      if (wsClientRef.current && wsState === 'connected') {
        wsClientRef.current.unsubscribe(['orderbook_delta'], [selectedTicker]);
      }
    };
  }, [wsState, selectedTicker]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
      }
    };
  }, []);

  /**
   * Handle successful API call - reset rate limiting and offline status
   */
  const handleSuccess = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    pollIntervalRef.current = MIN_POLL_INTERVAL;
    circuitBreakerOpenRef.current = false;
    setIsRateLimited(false);
    setIsOffline(false);
    setIsConnected(true);
    setLastUpdateTime(Date.now());
    setError(null);
  }, []);

  /**
   * Handle failed API call - apply exponential backoff and detect offline
   */
  const handleFailure = useCallback((err: unknown) => {
    consecutiveFailuresRef.current += 1;
    
    // Detect network/offline errors
    if (isNetworkError(err)) {
      setIsOffline(true);
      setError('Network error. Retrying...');
    } else if (isRateLimitError(err)) {
      // Exponential backoff for rate limits
      pollIntervalRef.current = Math.min(
        pollIntervalRef.current * 2,
        MAX_POLL_INTERVAL
      );
      setIsRateLimited(true);
      setError(`Rate limited. Backing off to ${Math.round(pollIntervalRef.current / 1000)}s`);
    } else {
      // Generic error
      setError(err instanceof Error ? err.message : 'Unknown error');
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
        setIsOffline(false);
      }, MAX_POLL_INTERVAL);
    }
  }, []);

  // Fetch markets with timeout and rate limiting
  const fetchMarkets = useCallback(async () => {
    if (!marketApiRef.current || circuitBreakerOpenRef.current) return;

    setLoading(prev => ({ ...prev, markets: true }));
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
          volume_24h: m.volume_24h,
          open_interest: m.open_interest,
          close_time: m.close_time,
          previousYesBid,
          event_ticker: m.event_ticker,
        };
      });
      
      // Sort by volume (highest first) - most active markets at top
      marketData.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      
      setMarkets(marketData);
      handleSuccess();
    } catch (err) {
      handleFailure(err);
    } finally {
      setLoading(prev => ({ ...prev, markets: false }));
    }
  }, [handleSuccess, handleFailure]);

  // Fetch orderbook for selected market with timeout
  const fetchOrderbook = useCallback(async (ticker: string) => {
    if (!marketApiRef.current || !ticker || circuitBreakerOpenRef.current) return;

    setLoading(prev => ({ ...prev, orderbook: true }));
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
    } finally {
      setLoading(prev => ({ ...prev, orderbook: false }));
    }
  }, [handleSuccess, handleFailure]);

  // Fetch portfolio data with timeout
  const fetchPortfolio = useCallback(async () => {
    if (!portfolioApiRef.current || circuitBreakerOpenRef.current) return;

    setLoading(prev => ({ ...prev, portfolio: true }));
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
          realized_pnl: p.realized_pnl || 0,
        }))
      );
      handleSuccess();
    } catch (err) {
      handleFailure(err);
    } finally {
      setLoading(prev => ({ ...prev, portfolio: false }));
    }
  }, [handleSuccess, handleFailure]);

  // Fetch price history for a market (with caching)
  const fetchPriceHistory = useCallback(async (ticker: string, hours: number = 24) => {
    if (!marketApiRef.current || circuitBreakerOpenRef.current) return;

    // Check cache first
    const cacheKey = `price_history:${ticker}:${hours}`;
    const cached = getCached<TradePoint[]>(cacheKey, CACHE_TTL.PRICE_HISTORY);
    if (cached) {
      setPriceHistory(cached);
      return;
    }

    setLoading(prev => ({ ...prev, priceHistory: true }));
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

      // Cache the result
      setCache(cacheKey, points);
      
      setPriceHistory(points);
      handleSuccess();
    } catch (err) {
      handleFailure(err);
    } finally {
      setLoading(prev => ({ ...prev, priceHistory: false }));
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

  // Calculate arbitrage opportunities when markets change
  const arbitrage = useMemo(() => calculateArbitrage(markets), [markets]);

  // Enrich positions with current prices and P&L
  // Note: We use realized_pnl from Kalshi API directly as it's the most accurate
  const positionsWithPnl = useMemo(() => {
    // Create a price lookup map from markets
    const priceMap = new Map<string, number>();
    for (const m of markets) {
      if (m.yes_bid !== undefined) {
        priceMap.set(m.ticker, m.yes_bid);
      }
    }

    return positions.map(pos => {
      const currentPrice = priceMap.get(pos.ticker);
      
      // Use realized_pnl from Kalshi API - this is the actual P&L from closed trades
      // Note: Kalshi tracks this accurately including partial fills
      return {
        ...pos,
        currentPrice,
        pnl: pos.realized_pnl || 0,
      };
    });
  }, [positions, markets]);

  // Derived state: are we receiving real-time updates?
  const isRealtime = wsState === 'connected';

  return {
    markets,
    orderbook,
    balance,
    positions: positionsWithPnl,
    isConnected,
    isRateLimited,
    isOffline,
    error,
    selectMarket,
    priceHistory,
    fetchPriceHistory,
    loading,
    lastUpdateTime,
    arbitrage,
    wsState,
    isRealtime,
    initWebSocket,
  };
}
