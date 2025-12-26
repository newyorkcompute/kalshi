/**
 * Formatting Utilities
 *
 * Common formatting functions for Kalshi market data.
 */

/**
 * Format a price in cents to a display string (e.g., 45 -> "45¢")
 */
export function formatPrice(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) {
    return "—";
  }
  return `${cents}¢`;
}

/**
 * Format a price in cents to dollars (e.g., 4500 -> "$45.00")
 */
export function formatCurrency(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) {
    return "—";
  }
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Format a number as a percentage (e.g., 0.45 -> "45%")
 */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

/**
 * Format a price change with indicator (e.g., 2 -> "▲ +2", -3 -> "▼ -3", 0 -> "━ 0")
 */
export function formatPriceChange(change: number): string {
  if (change > 0) {
    return `▲ +${change}`;
  } else if (change < 0) {
    return `▼ ${change}`;
  }
  return "━ 0";
}

/**
 * Format a large number with abbreviations (e.g., 1500000 -> "1.5M")
 */
export function formatCompactNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "—";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Format a timestamp to a relative time string
 * 
 * @param timestamp - Date string or Date object
 * @returns Relative time string (e.g., "2d ago", "in 3h")
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSecs = Math.abs(Math.floor(diffMs / 1000));
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isPast = diffMs < 0;
  const suffix = isPast ? " ago" : "";
  const prefix = isPast ? "" : "in ";

  if (diffDays > 0) {
    return `${prefix}${diffDays}d${suffix}`;
  }
  if (diffHours > 0) {
    return `${prefix}${diffHours}h${suffix}`;
  }
  if (diffMins > 0) {
    return `${prefix}${diffMins}m${suffix}`;
  }
  return "now";
}

/**
 * Format market close time as expiry string
 * 
 * Handles various time ranges:
 * - Minutes: "45m"
 * - Hours: "3h 45m"
 * - Days: "2d 14h" or "45d" (for >30 days)
 * - Years: "2y 3mo" or "2y"
 * - Very distant (>10y): "distant"
 * - Past: "CLOSED"
 * 
 * @param closeTime - ISO date string for market close time
 * @returns Formatted expiry string
 * 
 * @example
 * ```ts
 * formatExpiry('2025-12-31T23:59:59Z') // "1y 2mo"
 * formatExpiry('2099-01-01T00:00:00Z') // "distant"
 * formatExpiry('2024-01-01T00:00:00Z') // "CLOSED" (if past)
 * ```
 */
export function formatExpiry(closeTime?: string): string {
  if (!closeTime) return '';
  
  const now = new Date();
  const close = new Date(closeTime);
  const diffMs = close.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'CLOSED';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffYears = Math.floor(diffDays / 365);
  
  // For very distant dates, show "distant"
  if (diffYears > 10) {
    return 'distant';
  }
  
  // For dates > 1 year, show years and months
  if (diffYears >= 1) {
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    return remainingMonths > 0 ? `${diffYears}y ${remainingMonths}mo` : `${diffYears}y`;
  }
  
  // For dates > 30 days, show just days
  if (diffDays > 30) {
    return `${diffDays}d`;
  }
  
  // For dates with days remaining, show days and hours
  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays}d ${remainingHours}h`;
  }
  
  // For dates with hours remaining, show hours and minutes
  if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  }
  
  // Just minutes
  return `${diffMins}m`;
}

/**
 * Calculate spread between best bid and best ask
 * 
 * @param bestBid - Best (highest) bid price
 * @param bestAsk - Best (lowest) ask price
 * @returns Spread in cents, or null if either price is missing
 * 
 * @example
 * ```ts
 * calculateSpread(48, 52) // 4
 * calculateSpread(null, 52) // null
 * ```
 */
export function calculateSpread(
  bestBid: number | null | undefined,
  bestAsk: number | null | undefined
): number | null {
  if (bestBid == null || bestAsk == null) return null;
  return bestAsk - bestBid;
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Pad a string to a fixed width (left or right aligned)
 */
export function padString(
  str: string,
  width: number,
  align: "left" | "right" = "left"
): string {
  if (str.length >= width) {
    return str.slice(0, width);
  }
  const padding = " ".repeat(width - str.length);
  return align === "left" ? str + padding : padding + str;
}

