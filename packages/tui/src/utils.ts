/**
 * TUI Utility Functions
 * 
 * Re-exports common utilities from core and provides TUI-specific helpers.
 */

// Re-export from core for convenience
export {
  formatExpiry,
  calculateSpread,
  formatCompactNumber,
} from '@newyorkcompute/kalshi-core';

/**
 * Get price change indicator and color (TUI-specific)
 * 
 * Returns an object with text (▲/▼/━) and color (green/red/gray)
 * for displaying price movement in the terminal.
 */
export function getPriceChange(current?: number, previous?: number): { text: string; color: string } {
  if (current === undefined || previous === undefined || current === previous) {
    return { text: '━', color: 'gray' };
  }
  
  const diff = current - previous;
  if (diff > 0) {
    return { text: '▲', color: 'green' };
  }
  return { text: '▼', color: 'red' };
}

/**
 * Format volume with K/M suffix (alias for formatCompactNumber)
 * 
 * @param volume - Volume number
 * @returns Formatted string (e.g., "1.5K", "2.3M")
 */
export function formatVolume(volume?: number): string {
  if (!volume) return '';
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return `${volume}`;
}

/**
 * Format price in cents (simple version for TUI)
 * 
 * @param cents - Price in cents
 * @returns Formatted string (e.g., "45¢", "—")
 */
export function formatPrice(cents?: number): string {
  return cents !== undefined ? `${cents}¢` : '—';
}

/**
 * Format price with decimals
 * 
 * @param cents - Price in cents
 * @returns Formatted string with 2 decimal places (e.g., "45.00¢")
 */
export function formatPriceDecimal(cents: number): string {
  return `${cents.toFixed(2)}¢`;
}
