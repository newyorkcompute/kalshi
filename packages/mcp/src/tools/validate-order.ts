import type { MarketApi, PortfolioApi } from "@newyorkcompute/kalshi-core";

export interface OrderValidationInput {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  price?: number; // In cents
}

export interface OrderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  estimatedCost?: number;
  currentBalance?: number;
  marketStatus?: string;
}

/**
 * Validates an order before submission
 *
 * Performs pre-flight checks:
 * - Market is open for trading
 * - Sufficient balance for buy orders
 * - Price is reasonable (warns if far from market)
 * - Order quantity is valid
 *
 * @param input - Order parameters to validate
 * @param marketApi - Market API client
 * @param portfolioApi - Portfolio API client
 * @returns Validation result with errors and warnings
 */
export async function validateOrder(
  input: OrderValidationInput,
  marketApi: MarketApi,
  portfolioApi: PortfolioApi
): Promise<OrderValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let estimatedCost = 0;
  let currentBalance = 0;
  let marketStatus = "unknown";

  try {
    // 1. Fetch market details
    const marketResponse = await marketApi.getMarket(input.ticker);
    const market = marketResponse.data.market;
    marketStatus = market.status || "unknown";

    // Check market is open
    if (market.status !== "open") {
      errors.push(
        `Market ${input.ticker} is ${market.status}, not open for trading`
      );
    }

    // Get current market price
    const currentPrice =
      input.side === "yes"
        ? input.action === "buy"
          ? market.yes_ask
          : market.yes_bid
        : input.action === "buy"
          ? market.no_ask
          : market.no_bid;

    // Warn if user price is far from market
    if (input.price && currentPrice) {
      const priceDiff = Math.abs(input.price - currentPrice);
      if (priceDiff > 20) {
        warnings.push(
          `Your price (${input.price}¢) is ${priceDiff}¢ away from market (${currentPrice}¢)`
        );
      }
    }

    // 2. Fetch balance
    const balanceResponse = await portfolioApi.getBalance();
    currentBalance = balanceResponse.data.balance || 0;

    // Calculate estimated cost
    // For buy orders: cost = count * price
    // For sell orders: no cost (you receive money)
    if (input.action === "buy") {
      const price = input.price || currentPrice || 50; // Default to 50¢ if unknown
      estimatedCost = input.count * price;

      // Check sufficient balance
      if (estimatedCost > currentBalance) {
        errors.push(
          `Insufficient balance: need ${estimatedCost}¢, have ${currentBalance}¢`
        );
      }
    }

    // 3. Sanity checks
    if (input.count <= 0) {
      errors.push("Order quantity must be positive");
    }

    if (input.count > 1000) {
      warnings.push("Large order size may have poor execution");
    }

    if (input.price && (input.price < 1 || input.price > 99)) {
      errors.push("Price must be between 1¢ and 99¢");
    }
  } catch (error) {
    errors.push(
      `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    estimatedCost,
    currentBalance,
    marketStatus,
  };
}

