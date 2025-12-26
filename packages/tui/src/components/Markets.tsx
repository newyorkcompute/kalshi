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
}

interface MarketsProps {
  markets: Market[];
  selectedIndex: number;
  height: number;
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
                  <Text color={isSelected ? 'green' : 'white'}>
                    {formatPrice(market.yes_bid)}
                  </Text>
                  <Text color="gray"> ━ +0</Text>
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

