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
}

interface PositionsProps {
  positions: Position[];
  height: number;
  isLoading?: boolean;
}

export function Positions({ positions, height, isLoading }: PositionsProps) {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="gray"
      height={height}
      width="100%"
    >
      {/* Title */}
      <Box paddingX={1}>
        <Text bold> POSITIONS </Text>
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
            
            return (
              <Box key={pos.ticker} justifyContent="space-between">
                <Text>{pos.ticker.slice(0, 18)}</Text>
                <Box>
                  <Text color={sideColor}>
                    {Math.abs(pos.position)} {side}
                  </Text>
                  <Text> {formatCurrency(pos.market_exposure)}</Text>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}

