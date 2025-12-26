/**
 * Orderbook Component
 * Visual depth chart showing bids and asks with enhanced market data
 */

import { Box, Text } from 'ink';
import { formatExpiry, formatVolume } from '../utils.js';

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

// Number of price levels to show
const LEVELS_TO_SHOW = 8;

/**
 * Format price with proper decimal places
 */
function formatPrice(cents: number): string {
  if (cents >= 1) {
    return `${cents.toFixed(2)}¢`;
  }
  return `${cents.toFixed(3)}¢`;
}

/**
 * Format dollar value
 */
function formatDollarValue(cents: number, quantity: number): string {
  const dollars = (cents * quantity) / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  if (dollars >= 1) {
    return `$${dollars.toFixed(0)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

/**
 * Format quantity with K suffix
 */
function formatQty(qty: number): string {
  if (qty >= 10000) {
    return `${(qty / 1000).toFixed(1)}K`;
  }
  if (qty >= 1000) {
    return `${(qty / 1000).toFixed(1)}K`;
  }
  return `${qty}`;
}

export function Orderbook({ market, orderbook, height }: OrderbookProps) {
  // Parse orderbook into asks (no side, converted to YES equivalent) and bids (yes side)
  const asks: OrderbookLevel[] = (orderbook?.no ?? [])
    .slice(0, LEVELS_TO_SHOW)
    .map(([price, qty]) => ({ price: 100 - price, quantity: qty }))
    .sort((a, b) => b.price - a.price);
    
  const bids: OrderbookLevel[] = (orderbook?.yes ?? [])
    .slice(0, LEVELS_TO_SHOW)
    .map(([price, qty]) => ({ price, quantity: qty }))
    .sort((a, b) => b.price - a.price);

  // Calculate metrics
  const bestAsk = asks.length > 0 ? Math.min(...asks.map(a => a.price)) : null;
  const bestBid = bids.length > 0 ? Math.max(...bids.map(b => b.price)) : null;
  const spread = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null;
  const midPrice = bestAsk !== null && bestBid !== null ? (bestAsk + bestBid) / 2 : null;
  
  // Total depth
  const totalAskQty = asks.reduce((sum, l) => sum + l.quantity, 0);
  const totalBidQty = bids.reduce((sum, l) => sum + l.quantity, 0);
  
  // Imbalance: >1 means more buyers (bullish), <1 means more sellers (bearish)
  const imbalance = totalAskQty > 0 ? totalBidQty / totalAskQty : 0;
  const imbalanceText = imbalance > 1.2 ? 'buyers' : imbalance < 0.8 ? 'sellers' : 'neutral';
  const imbalanceColor = imbalance > 1.2 ? 'green' : imbalance < 0.8 ? 'red' : 'gray';

  // Calculate max quantity for bar scaling
  const maxQty = Math.max(
    ...asks.map(l => l.quantity),
    ...bids.map(l => l.quantity),
    1
  );

  const renderBar = (qty: number, color: string, maxWidth: number = 15) => {
    const barLength = Math.min(Math.floor((qty / maxQty) * maxWidth), maxWidth);
    return <Text color={color}>{'█'.repeat(barLength)}{'░'.repeat(maxWidth - barLength)}</Text>;
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
      {/* Header */}
      <Box paddingX={1} flexDirection="column">
        <Box justifyContent="space-between">
          <Box>
            <Text color="green" bold> ORDERBOOK</Text>
            <Text color="gray">: {market?.ticker || 'Select a market'}</Text>
          </Box>
          {midPrice !== null && (
            <Text color="white" bold>Mid: {midPrice.toFixed(2)}¢</Text>
          )}
        </Box>
        {/* Market title */}
        {market?.title && (
          <Text color="cyan" wrap="truncate">
            {market.title.slice(0, 55)}{market.title.length > 55 ? '…' : ''}
          </Text>
        )}
        {/* Expiry and volume */}
        {market && (
          <Box>
            {expiry && (
              <Text color="yellow">⏱ {expiry}</Text>
            )}
            {volume && (
              <Text color="gray">   Vol: {volume}</Text>
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
            {/* Asks (top) - shown in reverse so lowest ask is at bottom */}
            {asks.map((level, i) => {
              const isTopOfBook = level.price === bestAsk;
              return (
                <Box key={`ask-${i}`} justifyContent="space-between">
                  <Box>
                    <Text color={isTopOfBook ? 'red' : 'gray'} bold={isTopOfBook}>
                      {isTopOfBook ? 'ASK▸' : 'ASK '}
                    </Text>
                    {renderBar(level.quantity, 'red')}
                  </Box>
                  <Box>
                    <Text color="red" bold={isTopOfBook}>{formatPrice(level.price)}</Text>
                    <Text color="gray"> {formatQty(level.quantity).padStart(6)}</Text>
                    <Text color="gray" dimColor> {formatDollarValue(level.price, level.quantity).padStart(6)}</Text>
                  </Box>
                </Box>
              );
            })}

            {/* Spread line with metrics */}
            <Box marginY={0} flexDirection="column">
              <Box justifyContent="space-between">
                <Text color="gray">{'─'.repeat(20)}</Text>
                <Box>
                  {spread !== null && (
                    <Text color="yellow" bold> SPREAD: {spread.toFixed(2)}¢ </Text>
                  )}
                </Box>
                <Text color="gray">{'─'.repeat(10)}</Text>
              </Box>
              {/* Imbalance indicator */}
              <Box justifyContent="space-between">
                <Text color="gray" dimColor>
                  Depth: {formatQty(totalAskQty)} ask / {formatQty(totalBidQty)} bid
                </Text>
                <Text color={imbalanceColor} dimColor>
                  {imbalance.toFixed(2)}x ({imbalanceText})
                </Text>
              </Box>
            </Box>

            {/* Bids (bottom) */}
            {bids.map((level, i) => {
              const isTopOfBook = level.price === bestBid;
              return (
                <Box key={`bid-${i}`} justifyContent="space-between">
                  <Box>
                    <Text color={isTopOfBook ? 'green' : 'gray'} bold={isTopOfBook}>
                      {isTopOfBook ? 'BID▸' : 'BID '}
                    </Text>
                    {renderBar(level.quantity, 'green')}
                  </Box>
                  <Box>
                    <Text color="green" bold={isTopOfBook}>{formatPrice(level.price)}</Text>
                    <Text color="gray"> {formatQty(level.quantity).padStart(6)}</Text>
                    <Text color="gray" dimColor> {formatDollarValue(level.price, level.quantity).padStart(6)}</Text>
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
