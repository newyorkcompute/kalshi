/**
 * Markets Component
 * Displays a scrollable list of markets with selection
 */

import { Box, Text } from 'ink';
import { formatExpiry, getPriceChange, formatPrice, formatVolume } from '../utils.js';

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

export function Markets({ markets, selectedIndex, height }: MarketsProps) {
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
      <Box paddingX={1} justifyContent="space-between">
        <Text color="green" bold> MARKETS </Text>
        <Text color="gray" dimColor>sorted by volume</Text>
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
            const volume = formatVolume(market.volume);
            
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
                  {/* Volume */}
                  {volume && (
                    <Text color="cyan" dimColor>
                      {volume.padStart(6)} 
                    </Text>
                  )}
                  {/* Expiry time */}
                  {expiry && (
                    <Text color="gray" dimColor>
                      {expiry.padStart(8)} 
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
