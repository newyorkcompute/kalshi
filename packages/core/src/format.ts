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

