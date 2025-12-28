/**
 * Positions Component
 * Displays open positions with P&L
 */

import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';

interface Position {
  ticker: string;
  position: number;
  market_exposure: number;
  currentPrice?: number;
  pnl?: number;
}

interface PositionsProps {
  positions: Position[];
  height: number;
  isLoading?: boolean;
}

export function Positions({ positions, height, isLoading }: PositionsProps) {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const formatPnl = (pnl: number) => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}${(pnl / 100).toFixed(2)}`;
  };

  // Calculate total P&L
  const totalPnl = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
  const totalPnlColor = totalPnl >= 0 ? 'green' : 'red';

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="gray"
      height={height}
      width="100%"
    >
      {/* Title with total P&L */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold> POSITIONS </Text>
        {positions.length > 0 && (
          <Text color={totalPnlColor} bold>
            {formatPnl(totalPnl)}
          </Text>
        )}
      </Box>

      {/* Positions List */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {isLoading && positions.length === 0 ? (
          <Spinner label="Loading positions..." />
        ) : positions.length === 0 ? (
          <Text color="gray">No open positions</Text>
        ) : (
          positions.slice(0, height - 3).map((pos) => {
            const side = pos.position > 0 ? 'YES' : 'NO';
            const sideColor = pos.position > 0 ? 'green' : 'red';
            const pnlColor = (pos.pnl || 0) >= 0 ? 'green' : 'red';
            
            return (
              <Box key={pos.ticker} justifyContent="space-between">
                <Text>{pos.ticker.slice(0, 16)}</Text>
                <Box>
                  <Text color={sideColor}>
                    {Math.abs(pos.position)} {side}
                  </Text>
                  <Text color="gray" dimColor> {formatCurrency(pos.market_exposure)}</Text>
                  {pos.pnl !== undefined && (
                    <Text color={pnlColor}> {formatPnl(pos.pnl)}</Text>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}

