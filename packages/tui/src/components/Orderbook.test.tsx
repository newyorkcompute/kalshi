/**
 * Orderbook Component Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Orderbook } from './Orderbook.js';

const mockMarket = {
  ticker: 'KXBTC-25JAN03-B100500',
  title: 'Bitcoin > $100,500',
  close_time: '2025-01-03T23:59:59Z',
  volume: 15000,
};

const mockOrderbook = {
  yes: [
    [0.65, 100],
    [0.64, 200],
    [0.63, 150],
  ] as [number, number][],
  no: [
    [0.33, 80],
    [0.34, 120],
    [0.35, 90],
  ] as [number, number][],
};

describe('Orderbook', () => {
  it('renders orderbook header', () => {
    const { lastFrame } = render(
      <Orderbook market={mockMarket} orderbook={mockOrderbook} height={20} />
    );
    
    expect(lastFrame()).toContain('ORDERBOOK');
    expect(lastFrame()).toContain('KXBTC-25JAN03-B100500');
  });

  it('shows market title', () => {
    const { lastFrame } = render(
      <Orderbook market={mockMarket} orderbook={mockOrderbook} height={20} />
    );
    
    expect(lastFrame()).toContain('Bitcoin > $100,500');
  });

  it('shows loading spinner when loading with no orderbook', () => {
    const { lastFrame } = render(
      <Orderbook market={mockMarket} orderbook={null} height={20} isLoading={true} />
    );
    
    expect(lastFrame()).toContain('Loading orderbook...');
  });

  it('shows placeholder when no market selected', () => {
    const { lastFrame } = render(
      <Orderbook market={null} orderbook={null} height={20} />
    );
    
    expect(lastFrame()).toContain('Select a market');
  });

  it('displays bid and ask levels', () => {
    const { lastFrame } = render(
      <Orderbook market={mockMarket} orderbook={mockOrderbook} height={20} />
    );
    
    expect(lastFrame()).toContain('BID');
    expect(lastFrame()).toContain('ASK');
  });

  it('shows spread line', () => {
    const { lastFrame } = render(
      <Orderbook market={mockMarket} orderbook={mockOrderbook} height={20} />
    );
    
    expect(lastFrame()).toContain('SPREAD');
  });

  it('shows mid price', () => {
    const { lastFrame } = render(
      <Orderbook market={mockMarket} orderbook={mockOrderbook} height={20} />
    );
    
    expect(lastFrame()).toContain('Mid:');
  });

  it('shows depth information', () => {
    const { lastFrame } = render(
      <Orderbook market={mockMarket} orderbook={mockOrderbook} height={20} />
    );
    
    expect(lastFrame()).toContain('Depth:');
  });

  it('shows volume', () => {
    const { lastFrame } = render(
      <Orderbook market={mockMarket} orderbook={mockOrderbook} height={20} />
    );
    
    expect(lastFrame()).toContain('Vol:');
  });
});

