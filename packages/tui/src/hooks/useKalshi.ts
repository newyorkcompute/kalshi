import { useState, useEffect, useMemo } from "react";
import {
  getKalshiConfig,
  createMarketApi,
  createPortfolioApi,
  createOrdersApi,
  type KalshiConfig,
} from "@newyorkcompute/kalshi-core";
import type { MarketApi, PortfolioApi, OrdersApi } from "kalshi-typescript";

interface UseKalshiResult {
  config: KalshiConfig | null;
  marketApi: MarketApi | null;
  portfolioApi: PortfolioApi | null;
  ordersApi: OrdersApi | null;
  isConfigured: boolean;
  configError: string | null;
}

/**
 * Hook to initialize and provide Kalshi API clients
 */
export function useKalshi(): UseKalshiResult {
  const [config, setConfig] = useState<KalshiConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const kalshiConfig = getKalshiConfig();
      setConfig(kalshiConfig);
      setConfigError(null);
    } catch (error) {
      setConfigError(
        error instanceof Error ? error.message : "Unknown configuration error"
      );
    }
  }, []);

  const marketApi = useMemo(
    () => (config ? createMarketApi(config) : null),
    [config]
  );

  const portfolioApi = useMemo(
    () => (config ? createPortfolioApi(config) : null),
    [config]
  );

  const ordersApi = useMemo(
    () => (config ? createOrdersApi(config) : null),
    [config]
  );

  return {
    config,
    marketApi,
    portfolioApi,
    ordersApi,
    isConfigured: config !== null,
    configError,
  };
}

