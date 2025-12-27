/**
 * Arbitrage Component
 * Displays arbitrage opportunities (single-market and multi-outcome)
 */

import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';

/** Single-market arbitrage opportunity (YES + NO < 100) */
export interface SingleMarketArb {
  ticker: string;
  yesAsk: number;
  noAsk: number;
  total: number;
  profit: number; // 100 - total
}

/** Multi-outcome arbitrage opportunity (sum of YES prices < 100) */
export interface EventArb {
  eventTicker: string;
  title: string;
  markets: { ticker: string; yesAsk: number }[];
  total: number;
  profit: number; // 100 - total
}

export interface ArbitrageOpportunities {
  singleMarket: SingleMarketArb[];
  events: EventArb[];
}

interface ArbitrageProps {
  opportunities: ArbitrageOpportunities;
  height: number;
  isLoading?: boolean;
}

/**
 * Format profit with color
 */
function formatProfit(profit: number): { text: string; color: string } {
  if (profit >= 5) {
    return { text: `+${profit.toFixed(1)}¢`, color: 'green' };
  } else if (profit >= 2) {
    return { text: `+${profit.toFixed(1)}¢`, color: 'yellow' };
  } else if (profit > 0) {
    return { text: `+${profit.toFixed(1)}¢`, color: 'gray' };
  }
  return { text: '—', color: 'gray' };
}

export function Arbitrage({ opportunities, height, isLoading }: ArbitrageProps) {
  const { singleMarket, events } = opportunities;
  const totalOpps = singleMarket.length + events.length;
  
  // Calculate how many items we can show
  const availableRows = height - 4; // Border + title + padding
  const singleMarketRows = Math.min(singleMarket.length, Math.floor(availableRows * 0.6));
  const eventRows = Math.min(events.length, availableRows - singleMarketRows - 1);

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor={totalOpps > 0 ? 'yellow' : 'gray'}
      height={height}
      width="100%"
    >
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color="yellow" bold>
          {totalOpps > 0 ? '💰' : '○'} ARBITRAGE
        </Text>
        {totalOpps > 0 && (
          <Text color="green" bold>{totalOpps} found</Text>
        )}
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {isLoading && totalOpps === 0 ? (
          <Spinner label="Scanning..." />
        ) : totalOpps === 0 ? (
          <Text color="gray">No arbitrage opportunities</Text>
        ) : (
          <>
            {/* Single-market arbitrage */}
            {singleMarket.slice(0, singleMarketRows).map((arb) => {
              const profit = formatProfit(arb.profit);
              return (
                <Box key={arb.ticker} justifyContent="space-between">
                  <Text color="white">
                    {arb.ticker.slice(0, 20)}
                  </Text>
                  <Box>
                    <Text color="gray" dimColor>
                      {arb.yesAsk}+{arb.noAsk}={arb.total}¢
                    </Text>
                    <Text color={profit.color} bold> {profit.text}</Text>
                  </Box>
                </Box>
              );
            })}

            {/* Separator if both types exist */}
            {singleMarket.length > 0 && events.length > 0 && eventRows > 0 && (
              <Text color="gray" dimColor>─ events ─</Text>
            )}

            {/* Event arbitrage */}
            {events.slice(0, eventRows).map((arb) => {
              const profit = formatProfit(arb.profit);
              return (
                <Box key={arb.eventTicker} justifyContent="space-between">
                  <Text color="cyan">
                    {arb.eventTicker.slice(0, 15)}
                  </Text>
                  <Box>
                    <Text color="gray" dimColor>
                      Σ={arb.total}¢
                    </Text>
                    <Text color={profit.color} bold> {profit.text}</Text>
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </Box>
    </Box>
  );
}

