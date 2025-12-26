/**
 * Markets Component
 * Displays a scrollable list of markets with selection
 */

import { Box, Text } from 'ink';

interface Market {
  ticker: string;
  title: string;
  yes_bid?: number;
  yes_ask?: number;
  volume?: number;
  close_time?: string;
  // For tracking price changes
  previousYesBid?: number;
}

interface MarketsProps {
  markets: Market[];
  selectedIndex: number;
  height: number;
}

/**
 * Format close time as relative time (e.g., "2d 14h", "3h 45m", "45m")
 */
function formatExpiry(closeTime?: string): string {
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
function getPriceChange(current?: number, previous?: number): { text: string; color: string } {
  if (current === undefined || previous === undefined || current === previous) {
    return { text: '━', color: 'gray' };
  }
  
  const diff = current - previous;
  if (diff > 0) {
    return { text: '▲', color: 'green' };
  }
  return { text: '▼', color: 'red' };
}

export function Markets({ markets, selectedIndex, height }: MarketsProps) {
  const formatPrice = (cents?: number) => cents !== undefined ? `${cents}¢` : '—';
  
  // Calculate visible window (scroll with selection)
  const visibleRows = height - 4; // Border + title + padding
  const halfWindow = Math.floor(visibleRows / 2);
  
  let startIndex = Math.max(0, selectedIndex - halfWindow);
  const maxStart = Math.max(0, markets.length - visibleRows);
  startIndex = Math.min(startIndex, maxStart);
  
  const visibleMarkets = markets.slice(startIndex, startIndex + visibleRows);

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="green"
      height={height}
      width="100%"
    >
      {/* Title */}
      <Box paddingX={1}>
        <Text color="green" bold> MARKETS </Text>
      </Box>

      {/* Market List */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {markets.length === 0 ? (
          <Text color="gray">Loading markets...</Text>
        ) : (
          visibleMarkets.map((market, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === selectedIndex;
            const priceChange = getPriceChange(market.yes_bid, market.previousYesBid);
            const expiry = formatExpiry(market.close_time);
            
            return (
              <Box key={market.ticker} justifyContent="space-between">
                <Box>
                  <Text color={isSelected ? 'green' : 'gray'}>
                    {isSelected ? '▶ ' : '  '}
                  </Text>
                  <Text 
                    color={isSelected ? 'green' : 'white'} 
                    bold={isSelected}
                  >
                    {market.ticker.slice(0, 20)}
                  </Text>
                </Box>
                <Box>
                  {/* Expiry time */}
                  {expiry && (
                    <Text color="gray" dimColor>
                      {expiry.padStart(7)} 
                    </Text>
                  )}
                  {/* Price */}
                  <Text color={isSelected ? 'green' : 'white'}>
                    {formatPrice(market.yes_bid).padStart(5)}
                  </Text>
                  {/* Price change indicator */}
                  <Text color={priceChange.color}> {priceChange.text}</Text>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {/* Scroll indicator */}
      {markets.length > 0 && (
        <Box justifyContent="center" paddingX={1}>
          <Text color="gray">
            {selectedIndex + 1} of {markets.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
