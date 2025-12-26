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
  volume_24h?: number;
  open_interest?: number;
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
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color="green" bold> MARKETS </Text>
        <Box>
          <Text color="cyan" dimColor>{'   Vol'}</Text>
          <Text color="gray" dimColor>{'   24h'}</Text>
          <Text color="magenta" dimColor>{'    OI'}</Text>
          <Text color="gray" dimColor>{'    Exp'}</Text>
          <Text color="white" dimColor>{' Price'}</Text>
        </Box>
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
                    {market.ticker.slice(0, 22)}
                  </Text>
                </Box>
                <Box>
                  {/* Total Volume */}
                  <Text color="cyan" dimColor>
                    {formatVolume(market.volume).padStart(6)}
                  </Text>
                  {/* 24h Volume */}
                  <Text color="gray" dimColor>
                    {' '}{formatVolume(market.volume_24h).padStart(5)}
                  </Text>
                  {/* Open Interest */}
                  <Text color="magenta" dimColor>
                    {' '}{formatVolume(market.open_interest).padStart(5)}
                  </Text>
                  {/* Expiry time */}
                  <Text color="gray" dimColor>
                    {' '}{(expiry || '').padStart(6)}
                  </Text>
                  {/* Price */}
                  <Text color={isSelected ? 'green' : 'white'}>
                    {' '}{formatPrice(market.yes_bid).padStart(4)}
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
