/**
 * TUI Utility Functions
 * Formatting and display helpers
 */

/**
 * Format close time as relative time (e.g., "2d 14h", "3h 45m", "45m")
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
  
  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays}d ${remainingHours}h`;
  }
  if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  }
  return `${diffMins}m`;
}

/**
 * Get price change indicator and color
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
 * Format volume with K/M suffix
 */
export function formatVolume(volume?: number): string {
  if (!volume) return '';
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return `${volume}`;
}

/**
 * Format price in cents
 */
export function formatPrice(cents?: number): string {
  return cents !== undefined ? `${cents}¢` : '—';
}

/**
 * Format price with decimals
 */
export function formatPriceDecimal(cents: number): string {
  return `${cents.toFixed(2)}¢`;
}

/**
 * Calculate spread from best bid and ask
 */
export function calculateSpread(bestBid: number | null, bestAsk: number | null): number | null {
  if (bestBid === null || bestAsk === null) return null;
  return bestAsk - bestBid;
}

