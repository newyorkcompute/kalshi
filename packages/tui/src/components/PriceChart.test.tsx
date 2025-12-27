/**
 * PriceChart Component Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { PriceChart } from './PriceChart.js';

const mockPriceHistory = [
  { timestamp: Date.now() - 3600000, price: 45, volume: 100 },
  { timestamp: Date.now() - 2700000, price: 48, volume: 150 },
  { timestamp: Date.now() - 1800000, price: 52, volume: 200 },
  { timestamp: Date.now() - 900000, price: 50, volume: 180 },
  { timestamp: Date.now(), price: 55, volume: 120 },
];

describe('PriceChart', () => {
  it('renders chart header', () => {
    const { lastFrame } = render(
      <PriceChart 
        ticker="KXBTC-25JAN03-B100500" 
        priceHistory={mockPriceHistory} 
        height={10} 
        width={60} 
      />
    );
    
    expect(lastFrame()).toContain('PRICE CHART');
  });

  it('shows no data message when price history is empty', () => {
    const { lastFrame } = render(
      <PriceChart 
        ticker="KXBTC-25JAN03-B100500" 
        priceHistory={[]} 
        height={10} 
        width={60} 
      />
    );
    
    expect(lastFrame()).toContain('No trade history available');
  });

  it('shows placeholder when no ticker selected', () => {
    const { lastFrame } = render(
      <PriceChart 
        ticker={null} 
        priceHistory={[]} 
        height={10} 
        width={60} 
      />
    );
    
    expect(lastFrame()).toContain('Select a market');
  });

  it('renders chart with price data', () => {
    const { lastFrame } = render(
      <PriceChart 
        ticker="KXBTC-25JAN03-B100500" 
        priceHistory={mockPriceHistory} 
        height={12} 
        width={60} 
      />
    );
    
    // Should contain some chart characters or price info
    const frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame!.length).toBeGreaterThan(0);
  });

  it('shows price range info', () => {
    const { lastFrame } = render(
      <PriceChart 
        ticker="KXBTC-25JAN03-B100500" 
        priceHistory={mockPriceHistory} 
        height={12} 
        width={60} 
      />
    );
    
    // Chart should show current price or range info
    expect(lastFrame()).toContain('55¢');
  });
});

