/**
 * Advanced Risk Controls
 * 
 * Includes:
 * - DrawdownManager: Scale position size based on drawdown from peak P&L
 * - CircuitBreaker: Halt trading on rapid consecutive losses
 */

export interface DrawdownConfig {
  /** Drawdown level (in cents) to start scaling down (default 300 = $3) */
  scaleDownStart: number;
  /** Drawdown level to cut to 50% size (default 500 = $5) */
  halfSizeDrawdown: number;
  /** Drawdown level to halt trading entirely (default 1000 = $10) */
  haltDrawdown: number;
}

const DEFAULT_DRAWDOWN_CONFIG: DrawdownConfig = {
  scaleDownStart: 300,   // Start scaling at $3 drawdown
  halfSizeDrawdown: 500, // 50% size at $5 drawdown
  haltDrawdown: 1000,    // Halt at $10 drawdown
};

/**
 * DrawdownManager - Scale position size based on drawdown from peak P&L
 * 
 * As drawdown increases, position size decreases:
 * - At scaleDownStart: 100% size
 * - At halfSizeDrawdown: 50% size
 * - At haltDrawdown: 0% size (halt)
 * 
 * This prevents catastrophic losses by reducing exposure as we lose.
 */
export class DrawdownManager {
  private config: DrawdownConfig;
  private peakPnL: number = 0;
  private currentPnL: number = 0;
  private sessionStartPnL: number = 0;

  constructor(config: Partial<DrawdownConfig> = {}) {
    this.config = { ...DEFAULT_DRAWDOWN_CONFIG, ...config };
  }

  /**
   * Update current P&L and track peak
   */
  updatePnL(realizedPnL: number): void {
    this.currentPnL = realizedPnL;
    this.peakPnL = Math.max(this.peakPnL, realizedPnL);
  }

  /**
   * Set starting P&L for the session (called on startup)
   */
  setSessionStart(pnl: number): void {
    this.sessionStartPnL = pnl;
    this.currentPnL = pnl;
    this.peakPnL = pnl;
  }

  /**
   * Get current drawdown from peak (positive number)
   */
  getDrawdown(): number {
    return Math.max(0, this.peakPnL - this.currentPnL);
  }

  /**
   * Get drawdown from session start
   */
  getSessionDrawdown(): number {
    return Math.max(0, this.sessionStartPnL - this.currentPnL);
  }

  /**
   * Get position size multiplier based on drawdown
   * Returns 0.0 to 1.0
   */
  getPositionMultiplier(): number {
    const drawdown = this.getDrawdown();

    // No scaling needed if within normal range
    if (drawdown <= this.config.scaleDownStart) {
      return 1.0;
    }

    // Halt if at max drawdown
    if (drawdown >= this.config.haltDrawdown) {
      return 0.0;
    }

    // Linear interpolation between scaleDownStart and haltDrawdown
    // scaleDownStart → 1.0
    // halfSizeDrawdown → 0.5
    // haltDrawdown → 0.0
    if (drawdown <= this.config.halfSizeDrawdown) {
      // Between scaleDownStart and halfSizeDrawdown: 1.0 → 0.5
      const progress = (drawdown - this.config.scaleDownStart) / 
                       (this.config.halfSizeDrawdown - this.config.scaleDownStart);
      return 1.0 - 0.5 * progress;
    } else {
      // Between halfSizeDrawdown and haltDrawdown: 0.5 → 0.0
      const progress = (drawdown - this.config.halfSizeDrawdown) / 
                       (this.config.haltDrawdown - this.config.halfSizeDrawdown);
      return 0.5 * (1 - progress);
    }
  }

  /**
   * Should we halt trading due to drawdown?
   */
  shouldHalt(): boolean {
    return this.getDrawdown() >= this.config.haltDrawdown;
  }

  /**
   * Get status for logging/monitoring
   */
  getStatus(): {
    peakPnL: number;
    currentPnL: number;
    drawdown: number;
    positionMultiplier: number;
    shouldHalt: boolean;
  } {
    return {
      peakPnL: this.peakPnL,
      currentPnL: this.currentPnL,
      drawdown: this.getDrawdown(),
      positionMultiplier: this.getPositionMultiplier(),
      shouldHalt: this.shouldHalt(),
    };
  }

  /**
   * Reset for new session
   */
  reset(): void {
    this.peakPnL = 0;
    this.currentPnL = 0;
    this.sessionStartPnL = 0;
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export interface CircuitBreakerConfig {
  /** Number of consecutive losses to trigger circuit breaker (default 5) */
  maxConsecutiveLosses: number;
  /** Time window in ms to count rapid losses (default 60000 = 1 minute) */
  rapidLossWindowMs: number;
  /** Number of losses within window to trigger (default 5) */
  rapidLossThreshold: number;
  /** Cooldown period in ms after circuit breaker triggers (default 300000 = 5 minutes) */
  cooldownMs: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  maxConsecutiveLosses: 5,
  rapidLossWindowMs: 60000,     // 1 minute
  rapidLossThreshold: 5,         // 5 losses in 1 minute
  cooldownMs: 300000,            // 5 minute cooldown
};

export interface CircuitBreakerStatus {
  isTriggered: boolean;
  reason: string | null;
  consecutiveLosses: number;
  recentLosses: number;
  cooldownEndsAt: number | null;
  timeUntilReset: number | null;
}

/**
 * CircuitBreaker - Halt trading on rapid consecutive losses
 * 
 * Triggers when:
 * - N consecutive losing fills
 * - N losses within a short time window
 * 
 * After triggering, enters a cooldown period before resuming.
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private consecutiveLosses: number = 0;
  private recentLossTimestamps: number[] = [];
  private triggered: boolean = false;
  private triggerReason: string | null = null;
  private cooldownEndsAt: number | null = null;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Record a fill with its P&L impact
   * Returns true if circuit breaker triggers
   */
  onFill(realizedPnL: number): boolean {
    const now = Date.now();

    // Check if we're in cooldown
    if (this.triggered && this.cooldownEndsAt && now >= this.cooldownEndsAt) {
      this.reset();
    }

    // If already triggered, stay triggered
    if (this.triggered) {
      return true;
    }

    // Track losses
    if (realizedPnL < 0) {
      this.consecutiveLosses++;
      this.recentLossTimestamps.push(now);

      // Clean up old timestamps
      this.recentLossTimestamps = this.recentLossTimestamps.filter(
        (t) => now - t < this.config.rapidLossWindowMs
      );

      // Check consecutive losses
      if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this.trigger(`${this.consecutiveLosses} consecutive losses`);
        return true;
      }

      // Check rapid losses
      if (this.recentLossTimestamps.length >= this.config.rapidLossThreshold) {
        this.trigger(
          `${this.recentLossTimestamps.length} losses in ${this.config.rapidLossWindowMs / 1000}s`
        );
        return true;
      }
    } else if (realizedPnL > 0) {
      // Win resets consecutive loss counter
      this.consecutiveLosses = 0;
    }

    return false;
  }

  /**
   * Trigger the circuit breaker
   */
  private trigger(reason: string): void {
    this.triggered = true;
    this.triggerReason = reason;
    this.cooldownEndsAt = Date.now() + this.config.cooldownMs;
    console.warn(`[CircuitBreaker] 🚨 TRIGGERED: ${reason}. Cooldown until ${new Date(this.cooldownEndsAt).toISOString()}`);
  }

  /**
   * Check if circuit breaker is currently active
   */
  isTriggered(): boolean {
    // Check if cooldown has expired
    if (this.triggered && this.cooldownEndsAt && Date.now() >= this.cooldownEndsAt) {
      this.reset();
    }
    return this.triggered;
  }

  /**
   * Get remaining cooldown time in ms (or null if not in cooldown)
   */
  getRemainingCooldown(): number | null {
    if (!this.triggered || !this.cooldownEndsAt) {
      return null;
    }
    const remaining = this.cooldownEndsAt - Date.now();
    return remaining > 0 ? remaining : null;
  }

  /**
   * Get status for logging/monitoring
   */
  getStatus(): CircuitBreakerStatus {
    const now = Date.now();
    
    // Clean up old timestamps for accurate count
    this.recentLossTimestamps = this.recentLossTimestamps.filter(
      (t) => now - t < this.config.rapidLossWindowMs
    );

    return {
      isTriggered: this.isTriggered(),
      reason: this.triggerReason,
      consecutiveLosses: this.consecutiveLosses,
      recentLosses: this.recentLossTimestamps.length,
      cooldownEndsAt: this.cooldownEndsAt,
      timeUntilReset: this.getRemainingCooldown(),
    };
  }

  /**
   * Reset the circuit breaker (manual or after cooldown)
   */
  reset(): void {
    this.triggered = false;
    this.triggerReason = null;
    this.cooldownEndsAt = null;
    this.consecutiveLosses = 0;
    this.recentLossTimestamps = [];
  }

  /**
   * Force reset even during cooldown (manual override)
   */
  forceReset(): void {
    this.reset();
    console.log("[CircuitBreaker] Manually reset");
  }
}

