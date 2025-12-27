/**
 * Kalshi WebSocket Client
 * 
 * Provides real-time market data streaming from Kalshi.
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Subscription management
 * - Event-based message handling
 * - Connection health monitoring
 */

import WebSocket from 'ws';
import {
  type KalshiWsConfig,
  type KalshiWsEventHandlers,
  type WsCommand,
  type WsMessage,
  type SubscriptionChannel,
  type ConnectionState,
  type ActiveSubscriptions,
  WS_ENDPOINTS,
} from './types.js';
import { generateWsAuthHeaders } from './auth.js';

/** Default configuration values */
const DEFAULTS = {
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
  pingInterval: 30000,  // 30 seconds
  pongTimeout: 10000,   // 10 seconds
};

/**
 * Kalshi WebSocket Client
 * 
 * @example
 * ```typescript
 * const client = new KalshiWsClient({
 *   apiKeyId: 'your-api-key',
 *   privateKey: 'your-private-key',
 * });
 * 
 * client.on('ticker', (data) => {
 *   console.log('Price update:', data.market_ticker, data.yes_bid);
 * });
 * 
 * await client.connect();
 * client.subscribe(['ticker'], ['KXBTC-25JAN03']);
 * ```
 */
export class KalshiWsClient {
  private config: Required<KalshiWsConfig>;
  private ws: WebSocket | null = null;
  private handlers: KalshiWsEventHandlers = {};
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private commandId = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: ActiveSubscriptions = {
    orderbook_delta: new Set(),
    ticker: new Set(),
    trade: new Set(),
    fill: false,
  };

  constructor(config: KalshiWsConfig) {
    this.config = {
      ...config,
      demo: config.demo ?? false,
      autoReconnect: config.autoReconnect ?? DEFAULTS.autoReconnect,
      reconnectDelay: config.reconnectDelay ?? DEFAULTS.reconnectDelay,
      maxReconnectAttempts: config.maxReconnectAttempts ?? DEFAULTS.maxReconnectAttempts,
    };
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Register event handlers
   */
  on<K extends keyof KalshiWsEventHandlers>(
    event: K,
    handler: KalshiWsEventHandlers[K]
  ): void {
    this.handlers[event] = handler;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';
    
    return new Promise((resolve, reject) => {
      const endpoint = this.config.demo 
        ? WS_ENDPOINTS.demo 
        : WS_ENDPOINTS.production;

      const headers = generateWsAuthHeaders(
        this.config.apiKeyId,
        this.config.privateKey
      );

      this.ws = new WebSocket(endpoint, { headers });

      this.ws.on('open', () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.startPingPong();
        this.handlers.onConnect?.();
        this.resubscribeAll();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.handleClose(code, reason.toString());
      });

      this.ws.on('error', (error: Error) => {
        this.handlers.onError?.(error);
        if (this.state === 'connecting') {
          reject(error);
        }
      });

      this.ws.on('pong', () => {
        this.clearPongTimeout();
      });
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.state = 'disconnected';
    this.stopPingPong();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Subscribe to channels for specific market tickers
   * 
   * @param channels - Channels to subscribe to
   * @param marketTickers - Market tickers (not needed for 'fill' channel)
   */
  subscribe(channels: SubscriptionChannel[], marketTickers?: string[]): void {
    if (!this.ws || this.state !== 'connected') {
      // Store for later subscription when connected
      this.updateLocalSubscriptions(channels, marketTickers, 'add');
      return;
    }

    const command: WsCommand = {
      id: ++this.commandId,
      cmd: 'subscribe',
      params: {
        channels,
        ...(marketTickers && { market_tickers: marketTickers }),
      },
    };

    this.send(command);
    this.updateLocalSubscriptions(channels, marketTickers, 'add');
  }

  /**
   * Unsubscribe from channels
   */
  unsubscribe(channels: SubscriptionChannel[], marketTickers?: string[]): void {
    if (!this.ws || this.state !== 'connected') {
      this.updateLocalSubscriptions(channels, marketTickers, 'remove');
      return;
    }

    const command: WsCommand = {
      id: ++this.commandId,
      cmd: 'unsubscribe',
      params: {
        channels,
        ...(marketTickers && { market_tickers: marketTickers }),
      },
    };

    this.send(command);
    this.updateLocalSubscriptions(channels, marketTickers, 'remove');
  }

  /**
   * Add markets to existing subscription
   */
  addMarkets(channels: SubscriptionChannel[], marketTickers: string[]): void {
    if (!this.ws || this.state !== 'connected') {
      this.updateLocalSubscriptions(channels, marketTickers, 'add');
      return;
    }

    const command: WsCommand = {
      id: ++this.commandId,
      cmd: 'update_subscription',
      params: {
        channels,
        market_tickers: marketTickers,
        action: 'add_markets',
      },
    };

    this.send(command);
    this.updateLocalSubscriptions(channels, marketTickers, 'add');
  }

  /**
   * Remove markets from existing subscription
   */
  removeMarkets(channels: SubscriptionChannel[], marketTickers: string[]): void {
    if (!this.ws || this.state !== 'connected') {
      this.updateLocalSubscriptions(channels, marketTickers, 'remove');
      return;
    }

    const command: WsCommand = {
      id: ++this.commandId,
      cmd: 'update_subscription',
      params: {
        channels,
        market_tickers: marketTickers,
        action: 'remove_markets',
      },
    };

    this.send(command);
    this.updateLocalSubscriptions(channels, marketTickers, 'remove');
  }

  /**
   * Get currently subscribed tickers for a channel
   */
  getSubscribedTickers(channel: SubscriptionChannel): string[] {
    if (channel === 'fill') return [];
    return Array.from(this.subscriptions[channel]);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private send(data: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as WsMessage;

      switch (message.type) {
        case 'subscribed':
          this.handlers.onSubscribed?.(
            message.msg.channel,
            message.msg.market_tickers
          );
          break;

        case 'error':
          this.handlers.onError?.(
            new Error(`WebSocket error ${message.msg.code}: ${message.msg.message}`)
          );
          break;

        case 'orderbook_delta':
          this.handlers.onOrderbookDelta?.(message.msg);
          break;

        case 'ticker':
          this.handlers.onTicker?.(message.msg);
          break;

        case 'trade':
          this.handlers.onTrade?.(message.msg);
          break;

        case 'fill':
          this.handlers.onFill?.(message.msg);
          break;
      }
    } catch (error) {
      this.handlers.onError?.(
        error instanceof Error ? error : new Error('Failed to parse message')
      );
    }
  }

  private handleClose(code: number, reason: string): void {
    this.stopPingPong();
    this.handlers.onDisconnect?.(code, reason);

    if (
      this.config.autoReconnect &&
      this.state !== 'disconnected' &&
      this.reconnectAttempts < this.config.maxReconnectAttempts
    ) {
      this.scheduleReconnect();
    } else {
      this.state = 'disconnected';
    }
  }

  private scheduleReconnect(): void {
    this.state = 'reconnecting';
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (this.state === 'reconnecting') {
        this.connect().catch((error) => {
          this.handlers.onError?.(error);
        });
      }
    }, delay);
  }

  private resubscribeAll(): void {
    // Resubscribe to all previously active subscriptions
    const channels: SubscriptionChannel[] = [];
    const tickers: string[] = [];

    for (const [channel, data] of Object.entries(this.subscriptions)) {
      if (channel === 'fill') {
        if (data === true) {
          this.subscribe(['fill']);
        }
      } else if (data instanceof Set && data.size > 0) {
        channels.push(channel as SubscriptionChannel);
        tickers.push(...data);
      }
    }

    if (channels.length > 0 && tickers.length > 0) {
      const uniqueTickers = [...new Set(tickers)];
      this.subscribe(channels, uniqueTickers);
    }
  }

  private updateLocalSubscriptions(
    channels: SubscriptionChannel[],
    tickers: string[] | undefined,
    action: 'add' | 'remove'
  ): void {
    for (const channel of channels) {
      if (channel === 'fill') {
        this.subscriptions.fill = action === 'add';
      } else if (tickers) {
        for (const ticker of tickers) {
          if (action === 'add') {
            this.subscriptions[channel].add(ticker);
          } else {
            this.subscriptions[channel].delete(ticker);
          }
        }
      }
    }
  }

  private startPingPong(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.setPongTimeout();
      }
    }, DEFAULTS.pingInterval);
  }

  private stopPingPong(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimeout();
  }

  private setPongTimeout(): void {
    this.pongTimer = setTimeout(() => {
      // No pong received, connection might be dead
      this.handlers.onError?.(new Error('Pong timeout - connection may be dead'));
      this.ws?.terminate();
    }, DEFAULTS.pongTimeout);
  }

  private clearPongTimeout(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
}

