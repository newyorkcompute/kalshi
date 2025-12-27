/**
 * useKalshiWs Hook
 * 
 * React hook for real-time Kalshi market data via WebSocket.
 * Provides ticker updates, orderbook deltas, and trade notifications.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  KalshiWsClient,
  type KalshiWsConfig,
  type TickerMessage,
  type OrderbookDeltaMessage,
  type TradeMessage,
  type ConnectionState,
} from '@newyorkcompute/kalshi-core';

// ============================================================================
// Types
// ============================================================================

interface TickerData {
  market_ticker: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  updated_at: number;
}

interface OrderbookLevel {
  price: number;
  quantity: number;
}

interface OrderbookData {
  yes: OrderbookLevel[];
  no: OrderbookLevel[];
}

interface RecentTrade {
  trade_id: string;
  market_ticker: string;
  price: number;
  count: number;
  taker_side: 'yes' | 'no';
  created_time: string;
}

interface UseKalshiWsOptions {
  /** Market tickers to subscribe to */
  marketTickers?: string[];
  /** Enable ticker updates (default: true) */
  enableTicker?: boolean;
  /** Enable orderbook updates (default: true) */
  enableOrderbook?: boolean;
  /** Enable trade updates (default: false) */
  enableTrades?: boolean;
  /** Maximum recent trades to keep (default: 50) */
  maxRecentTrades?: number;
}

interface UseKalshiWsReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Whether connected */
  isConnected: boolean;
  /** Ticker data by market ticker */
  tickers: Map<string, TickerData>;
  /** Orderbook data by market ticker */
  orderbooks: Map<string, OrderbookData>;
  /** Recent trades (most recent first) */
  recentTrades: RecentTrade[];
  /** Last error message */
  error: string | null;
  /** Subscribe to additional markets */
  subscribe: (tickers: string[]) => void;
  /** Unsubscribe from markets */
  unsubscribe: (tickers: string[]) => void;
  /** Manually connect */
  connect: () => Promise<void>;
  /** Manually disconnect */
  disconnect: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for real-time Kalshi market data
 * 
 * @param config - WebSocket configuration (apiKeyId, privateKey)
 * @param options - Subscription options
 * @returns Real-time market data and control functions
 * 
 * @example
 * ```tsx
 * const { tickers, isConnected } = useKalshiWs(
 *   { apiKeyId: 'key', privateKey: 'private' },
 *   { marketTickers: ['KXBTC-25JAN03'], enableTicker: true }
 * );
 * ```
 */
export function useKalshiWs(
  config: KalshiWsConfig | null,
  options: UseKalshiWsOptions = {}
): UseKalshiWsReturn {
  const {
    marketTickers = [],
    enableTicker = true,
    enableOrderbook = true,
    enableTrades = false,
    maxRecentTrades = 50,
  } = options;

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [tickers, setTickers] = useState<Map<string, TickerData>>(new Map());
  const [orderbooks, setOrderbooks] = useState<Map<string, OrderbookData>>(new Map());
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const clientRef = useRef<KalshiWsClient | null>(null);
  const subscribedTickersRef = useRef<Set<string>>(new Set());

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  const handleTicker = useCallback((data: TickerMessage['msg']) => {
    setTickers(prev => {
      const next = new Map(prev);
      next.set(data.market_ticker, {
        ...data,
        updated_at: Date.now(),
      });
      return next;
    });
  }, []);

  const handleOrderbookDelta = useCallback((data: OrderbookDeltaMessage['msg']) => {
    setOrderbooks(prev => {
      const next = new Map(prev);
      const current = next.get(data.market_ticker) || { yes: [], no: [] };
      
      // Update the appropriate side
      const side = data.side === 'yes' ? 'yes' : 'no';
      const levels = [...current[side]];
      
      // Find existing level at this price
      const existingIndex = levels.findIndex(l => l.price === data.price);
      
      if (data.delta === 0) {
        // Remove level
        if (existingIndex >= 0) {
          levels.splice(existingIndex, 1);
        }
      } else if (existingIndex >= 0) {
        // Update existing level
        levels[existingIndex] = {
          price: data.price,
          quantity: levels[existingIndex].quantity + data.delta,
        };
        // Remove if quantity is zero or negative
        if (levels[existingIndex].quantity <= 0) {
          levels.splice(existingIndex, 1);
        }
      } else if (data.delta > 0) {
        // Add new level
        levels.push({ price: data.price, quantity: data.delta });
        // Sort by price (descending for yes, ascending for no)
        levels.sort((a, b) => side === 'yes' ? b.price - a.price : a.price - b.price);
      }
      
      next.set(data.market_ticker, {
        ...current,
        [side]: levels,
      });
      
      return next;
    });
  }, []);

  const handleTrade = useCallback((data: TradeMessage['msg']) => {
    setRecentTrades(prev => {
      const trade: RecentTrade = {
        trade_id: data.trade_id,
        market_ticker: data.market_ticker,
        price: data.price,
        count: data.count,
        taker_side: data.taker_side,
        created_time: data.created_time,
      };
      
      // Add to front, limit size
      const next = [trade, ...prev];
      if (next.length > maxRecentTrades) {
        next.length = maxRecentTrades;
      }
      return next;
    });
  }, [maxRecentTrades]);

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  const connect = useCallback(async () => {
    if (!config || clientRef.current?.isConnected) return;

    try {
      setError(null);
      
      const client = new KalshiWsClient(config);
      clientRef.current = client;

      // Set up event handlers
      client.on('onConnect', () => {
        setConnectionState('connected');
        setError(null);
      });

      client.on('onDisconnect', (_code, reason) => {
        setConnectionState('disconnected');
        if (reason) setError(`Disconnected: ${reason}`);
      });

      client.on('onError', (err) => {
        setError(err.message);
      });

      if (enableTicker) {
        client.on('onTicker', handleTicker);
      }

      if (enableOrderbook) {
        client.on('onOrderbookDelta', handleOrderbookDelta);
      }

      if (enableTrades) {
        client.on('onTrade', handleTrade);
      }

      setConnectionState('connecting');
      await client.connect();

      // Subscribe to initial tickers
      if (marketTickers.length > 0) {
        const channels: ('ticker' | 'orderbook_delta' | 'trade')[] = [];
        if (enableTicker) channels.push('ticker');
        if (enableOrderbook) channels.push('orderbook_delta');
        if (enableTrades) channels.push('trade');
        
        if (channels.length > 0) {
          client.subscribe(channels, marketTickers);
          marketTickers.forEach(t => subscribedTickersRef.current.add(t));
        }
      }
    } catch (err) {
      setConnectionState('disconnected');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [config, enableTicker, enableOrderbook, enableTrades, marketTickers, handleTicker, handleOrderbookDelta, handleTrade]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setConnectionState('disconnected');
    subscribedTickersRef.current.clear();
  }, []);

  const subscribe = useCallback((newTickers: string[]) => {
    if (!clientRef.current?.isConnected) return;

    const channels: ('ticker' | 'orderbook_delta' | 'trade')[] = [];
    if (enableTicker) channels.push('ticker');
    if (enableOrderbook) channels.push('orderbook_delta');
    if (enableTrades) channels.push('trade');

    const tickersToAdd = newTickers.filter(t => !subscribedTickersRef.current.has(t));
    
    if (channels.length > 0 && tickersToAdd.length > 0) {
      clientRef.current.addMarkets(channels, tickersToAdd);
      tickersToAdd.forEach(t => subscribedTickersRef.current.add(t));
    }
  }, [enableTicker, enableOrderbook, enableTrades]);

  const unsubscribe = useCallback((tickersToRemove: string[]) => {
    if (!clientRef.current?.isConnected) return;

    const channels: ('ticker' | 'orderbook_delta' | 'trade')[] = [];
    if (enableTicker) channels.push('ticker');
    if (enableOrderbook) channels.push('orderbook_delta');
    if (enableTrades) channels.push('trade');

    const existing = tickersToRemove.filter(t => subscribedTickersRef.current.has(t));
    
    if (channels.length > 0 && existing.length > 0) {
      clientRef.current.removeMarkets(channels, existing);
      existing.forEach(t => subscribedTickersRef.current.delete(t));
    }
  }, [enableTicker, enableOrderbook, enableTrades]);

  // ===========================================================================
  // Effects
  // ===========================================================================

  // Auto-connect when config is available
  useEffect(() => {
    if (config) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [config]); // Only reconnect when config changes

  // Update subscriptions when marketTickers change
  useEffect(() => {
    if (!clientRef.current?.isConnected) return;

    const currentTickers = subscribedTickersRef.current;
    const newTickers = new Set(marketTickers);

    // Find tickers to add
    const toAdd = marketTickers.filter(t => !currentTickers.has(t));
    if (toAdd.length > 0) {
      subscribe(toAdd);
    }

    // Find tickers to remove
    const toRemove = Array.from(currentTickers).filter(t => !newTickers.has(t));
    if (toRemove.length > 0) {
      unsubscribe(toRemove);
    }
  }, [marketTickers, subscribe, unsubscribe]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    tickers,
    orderbooks,
    recentTrades,
    error,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

