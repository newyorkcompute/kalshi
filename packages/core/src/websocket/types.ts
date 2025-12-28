/**
 * Kalshi WebSocket Types
 * 
 * Message formats for Kalshi's WebSocket API
 * Based on: https://docs.kalshi.com/websockets
 */

// ============================================================================
// Connection & Authentication
// ============================================================================

/** WebSocket connection configuration */
export interface KalshiWsConfig {
  /** API Key ID */
  apiKeyId: string;
  /** API Private Key (PEM format) */
  privateKey: string;
  /** Use demo environment (default: false) */
  demo?: boolean;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Max reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
}

/** WebSocket endpoints */
export const WS_ENDPOINTS = {
  production: 'wss://api.elections.kalshi.com/trade-api/ws/v2',
  demo: 'wss://demo-api.kalshi.co/trade-api/ws/v2',
} as const;

// ============================================================================
// Subscription Channels
// ============================================================================

/** Available subscription channels */
export type SubscriptionChannel = 
  | 'orderbook_delta'  // Orderbook updates
  | 'ticker'           // Price/market updates
  | 'trade'            // Trade executions
  | 'fill';            // User's fills (authenticated)

/** Subscription command */
export interface SubscribeCommand {
  id: number;
  cmd: 'subscribe';
  params: {
    channels: SubscriptionChannel[];
    market_tickers?: string[];
  };
}

/** Unsubscribe command */
export interface UnsubscribeCommand {
  id: number;
  cmd: 'unsubscribe';
  params: {
    channels: SubscriptionChannel[];
    market_tickers?: string[];
  };
}

/** Update subscription command */
export interface UpdateSubscriptionCommand {
  id: number;
  cmd: 'update_subscription';
  params: {
    channels: SubscriptionChannel[];
    market_tickers: string[];
    action: 'add_markets' | 'remove_markets';
  };
}

export type WsCommand = SubscribeCommand | UnsubscribeCommand | UpdateSubscriptionCommand;

// ============================================================================
// Server Messages
// ============================================================================

/** Base message structure */
interface BaseMessage {
  type: string;
  sid?: number;  // Sequence ID
}

/** Subscription confirmation */
export interface SubscribedMessage extends BaseMessage {
  type: 'subscribed';
  msg: {
    channel: SubscriptionChannel;
    market_tickers?: string[];
  };
}

/** Error message */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  msg: {
    code: number;
    message: string;
  };
}

/** Orderbook delta update */
export interface OrderbookDeltaMessage extends BaseMessage {
  type: 'orderbook_delta';
  msg: {
    market_ticker: string;
    price: number;
    delta: number;  // Change in quantity (can be negative)
    side: 'yes' | 'no';
  };
}

/** Orderbook snapshot (full state) */
export interface OrderbookSnapshotMessage extends BaseMessage {
  type: 'orderbook_snapshot';
  msg: {
    market_ticker: string;
    market_id: string;
    yes: [number, number][];  // [price, quantity][]
    no: [number, number][];   // [price, quantity][]
  };
}

/** Ticker update (market price change) */
export interface TickerMessage extends BaseMessage {
  type: 'ticker';
  msg: {
    market_ticker: string;
    yes_bid: number;
    yes_ask: number;
    no_bid: number;
    no_ask: number;
    last_price: number;
    volume: number;
    open_interest: number;
  };
}

/** Trade execution */
export interface TradeMessage extends BaseMessage {
  type: 'trade';
  msg: {
    market_ticker: string;
    trade_id: string;
    price: number;
    count: number;  // Number of contracts
    taker_side: 'yes' | 'no';
    created_time: string;  // ISO timestamp
  };
}

/** User fill notification (authenticated) */
export interface FillMessage extends BaseMessage {
  type: 'fill';
  msg: {
    trade_id: string;
    order_id: string;
    market_ticker: string;
    side: 'yes' | 'no';
    action: 'buy' | 'sell';
    count: number;
    price: number;
    created_time: string;
  };
}

/** All possible server messages */
export type WsMessage = 
  | SubscribedMessage
  | ErrorMessage
  | OrderbookDeltaMessage
  | OrderbookSnapshotMessage
  | TickerMessage
  | TradeMessage
  | FillMessage;

// ============================================================================
// Event Handlers
// ============================================================================

/** WebSocket event handlers */
export interface KalshiWsEventHandlers {
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when connection is closed */
  onDisconnect?: (code: number, reason: string) => void;
  /** Called on any error */
  onError?: (error: Error) => void;
  /** Called when subscription is confirmed */
  onSubscribed?: (channel: SubscriptionChannel, tickers?: string[]) => void;
  /** Called on orderbook snapshot (initial state) */
  onOrderbookSnapshot?: (data: OrderbookSnapshotMessage['msg']) => void;
  /** Called on orderbook update */
  onOrderbookDelta?: (data: OrderbookDeltaMessage['msg']) => void;
  /** Called on ticker update */
  onTicker?: (data: TickerMessage['msg']) => void;
  /** Called on trade */
  onTrade?: (data: TradeMessage['msg']) => void;
  /** Called on fill (user's order filled) */
  onFill?: (data: FillMessage['msg']) => void;
}

// ============================================================================
// Client State
// ============================================================================

/** WebSocket connection state */
export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

/** Active subscriptions */
export interface ActiveSubscriptions {
  orderbook_delta: Set<string>;  // Market tickers
  ticker: Set<string>;
  trade: Set<string>;
  fill: boolean;  // Global, not per-ticker
}

