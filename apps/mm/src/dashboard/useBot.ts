/**
 * useBot - React hook that polls the MM bot's HTTP API.
 *
 * Fetches /state, /metrics, and /markets every `intervalMs` and
 * exposes the combined data plus connection status.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types matching the bot's HTTP API responses ─────────────────────────────

export interface BotPosition {
  ticker: string;
  yesContracts: number;
  noContracts: number;
  netExposure: number;
  costBasis: number;
  yesCostBasis: number;
  noCostBasis: number;
  unrealizedPnL: number;
}

export interface BotPnL {
  realizedToday: number;
  unrealized: number;
  total: number;
  fillsToday: number;
  volumeToday: number;
}

export interface BotRisk {
  halted: boolean;
  haltReason?: string;
  dailyPnL: number;
  totalExposure: number;
  utilizationPercent: number;
}

export interface BotDrawdown {
  peakPnL: number;
  currentPnL: number;
  drawdown: number;
  positionMultiplier: number;
  shouldHalt: boolean;
}

export interface BotCircuitBreaker {
  isTriggered: boolean;
  reason: string | null;
  consecutiveLosses: number;
  recentLosses: number;
  cooldownEndsAt: number | null;
  timeUntilReset: number | null;
}

export interface BotScanner {
  enabled: boolean;
  lastScan: string | null;
  marketsFound: number;
}

export interface BotState {
  running: boolean;
  paused: boolean;
  connected: boolean;
  markets: string[];
  activeOrders: number;
  positions: BotPosition[];
  pnl: BotPnL;
  risk: BotRisk;
  drawdown: BotDrawdown;
  circuitBreaker: BotCircuitBreaker;
  scanner?: BotScanner;
}

export interface BotMarket {
  ticker: string;
  realized: number;
  fills: number;
  addedAt: string | null;
}

export interface BotMarketsResponse {
  count: number;
  markets: BotMarket[];
}

export interface BotMetrics {
  running: boolean;
  paused: boolean;
  connected: boolean;
  activeOrders: number;
  totalExposure: number;
  dailyPnL: number;
  fillsToday: number;
  volumeToday: number;
  halted: boolean;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  latency_max: number;
  adverseFlagged: number;
  adverseMarkets: string;
}

export interface UseBotResult {
  state: BotState | null;
  markets: BotMarketsResponse | null;
  metrics: BotMetrics | null;
  online: boolean;
  lastUpdate: Date | null;
  error: string | null;
  sendCommand: (command: "pause" | "resume" | "flatten" | "scan") => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBot(port: number = 3001, intervalMs: number = 2000): UseBotResult {
  const [state, setState] = useState<BotState | null>(null);
  const [markets, setMarkets] = useState<BotMarketsResponse | null>(null);
  const [metrics, setMetrics] = useState<BotMetrics | null>(null);
  const [online, setOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = `http://localhost:${port}`;
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const [stateRes, marketsRes, metricsRes] = await Promise.all([
        fetch(`${baseUrl}/state`).then((r) => r.json()),
        fetch(`${baseUrl}/markets`).then((r) => r.json()),
        fetch(`${baseUrl}/metrics`).then((r) => r.json()),
      ]);

      if (!mountedRef.current) return;

      setState(stateRes as BotState);
      setMarkets(marketsRes as BotMarketsResponse);
      setMetrics(metricsRes as BotMetrics);
      setOnline(true);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setOnline(false);
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [baseUrl]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    const timer = setInterval(fetchData, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchData, intervalMs]);

  const sendCommand = useCallback(
    async (command: "pause" | "resume" | "flatten" | "scan") => {
      try {
        await fetch(`${baseUrl}/${command}`, { method: "POST" });
        // Immediately refetch state
        await fetchData();
      } catch {
        // Ignore command errors
      }
    },
    [baseUrl, fetchData],
  );

  return { state, markets, metrics, online, lastUpdate, error, sendCommand };
}
