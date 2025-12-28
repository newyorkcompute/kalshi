/**
 * Strategies Module
 *
 * Export all available strategies.
 */

export { type Strategy, type MarketSnapshot, BaseStrategy } from "./base.js";
export { SymmetricStrategy, type SymmetricParams } from "./symmetric.js";
export { AdaptiveStrategy, type AdaptiveParams } from "./adaptive.js";

import type { Strategy } from "./base.js";
import { SymmetricStrategy } from "./symmetric.js";
import { AdaptiveStrategy } from "./adaptive.js";
import type { StrategyConfig } from "../config.js";

/**
 * Create a strategy instance from config
 */
export function createStrategy(config: StrategyConfig): Strategy {
  switch (config.name) {
    case "symmetric":
      return new SymmetricStrategy(config.symmetric);

    case "adaptive":
      return new AdaptiveStrategy(config.adaptive);

    case "avellaneda":
      // TODO: Implement Avellaneda-Stoikov strategy
      console.warn("Avellaneda strategy not yet implemented, using symmetric");
      return new SymmetricStrategy(config.symmetric);

    default:
      throw new Error(`Unknown strategy: ${config.name}`);
  }
}

