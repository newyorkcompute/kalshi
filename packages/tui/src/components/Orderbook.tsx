/**
 * Orderbook Component
 * Visual depth chart showing bids and asks with spread indicator
 */

import { Box, Text } from 'ink';
import { formatExpiry, formatVolume, formatPriceDecimal, calculateSpread } from '../utils.js';

interface OrderbookLevel {
  price: number;
  quantity: number;
}

interface OrderbookData {
  yes: [number, number][];
  no: [number, number][];
}

interface SelectedMarket {
  ticker: string;
  title: string;
  close_time?: string;
  volume?: number;
}

interface OrderbookProps {
  market: SelectedMarket | null;
  orderbook: OrderbookData | null;
  height: number;
}

export function Orderbook({ market, orderbook, height }: OrderbookProps) {
  // Parse orderbook into asks (no side, converted to YES equivalent) and bids (yes side)
  const asks: OrderbookLevel[] = (orderbook?.no ?? [])
    .slice(0, 5)
    .map(([price, qty]) => ({ price: 100 - price, quantity: qty }))
    .sort((a, b) => b.price - a.price);
    
  const bids: OrderbookLevel[] = (orderbook?.yes ?? [])
    .slice(0, 5)
    .map(([price, qty]) => ({ price, quantity: qty }))
    .sort((a, b) => b.price - a.price);

  // Calculate spread
  const bestAsk = asks.length > 0 ? Math.min(...asks.map(a => a.price)) : null;
  const bestBid = bids.length > 0 ? Math.max(...bids.map(b => b.price)) : null;
  const spread = calculateSpread(bestBid, bestAsk);

  // Calculate max quantity for bar scaling
  const maxQty = Math.max(
    ...asks.map(l => l.quantity),
    ...bids.map(l => l.quantity),
    1
  );

  const renderBar = (qty: number, color: string, maxWidth: number = 20) => {
    const barLength = Math.min(Math.floor((qty / maxQty) * maxWidth), maxWidth);
    return <Text color={color}>{'█'.repeat(barLength)}</Text>;
  };

  const expiry = formatExpiry(market?.close_time);
  const volume = formatVolume(market?.volume);

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="gray"
      height={height}
      width="100%"
    >
      {/* Title */}
      <Box paddingX={1} flexDirection="column">
        <Box>
          <Text bold> ORDERBOOK</Text>
          <Text color="gray">: {market?.ticker || 'Select a market'}</Text>
        </Box>
        {/* Market title (truncated) */}
        {market?.title && (
          <Text color="cyan" wrap="truncate">
            {market.title.slice(0, 50)}{market.title.length > 50 ? '…' : ''}
          </Text>
        )}
        {/* Expiry and volume */}
        {market && (
          <Box>
            {expiry && (
              <Text color="yellow">⏱ {expiry}</Text>
            )}
            {volume && (
              <Text color="gray">  Vol: {volume}</Text>
            )}
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {!orderbook ? (
          <Text color="gray">Select a market to view orderbook</Text>
        ) : (
          <>
            {/* Asks (top) */}
            {asks.map((level, i) => (
              <Box key={`ask-${i}`} justifyContent="space-between">
                <Box>
                  <Text color="gray">ASK </Text>
                  {renderBar(level.quantity, 'red')}
                </Box>
                <Box>
                  <Text color="red">{formatPriceDecimal(level.price)}</Text>
                  <Text color="gray"> ({level.quantity})</Text>
                </Box>
              </Box>
            ))}

            {/* Spread line */}
            <Box marginY={1} justifyContent="space-between">
              <Text color="gray">{'─'.repeat(30)}</Text>
              {spread !== null && (
                <Text color="yellow" bold>
                  SPREAD: {spread.toFixed(2)}¢
                </Text>
              )}
            </Box>

            {/* Bids (bottom) */}
            {bids.map((level, i) => (
              <Box key={`bid-${i}`} justifyContent="space-between">
                <Box>
                  <Text color="gray">BID </Text>
                  {renderBar(level.quantity, 'green')}
                </Box>
                <Box>
                  <Text color="green">{formatPriceDecimal(level.price)}</Text>
                  <Text color="gray"> ({level.quantity})</Text>
                </Box>
              </Box>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}
