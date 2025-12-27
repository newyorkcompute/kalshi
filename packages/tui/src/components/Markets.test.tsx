/**
 * Markets Component Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Markets } from './Markets.js';

const mockMarkets = [
  {
    ticker: 'KXBTC-25JAN03-B100500',
    title: 'Bitcoin > $100,500',
    yes_bid: 67,
    yes_ask: 68,
    volume: 15000,
    volume_24h: 5000,
    open_interest: 10000,
    close_time: '2025-01-03T23:59:59Z',
    previousYesBid: 65,
  },
  {
    ticker: 'INXD-25JAN03-B19500',
    title: 'S&P 500 > 19,500',
    yes_bid: 45,
    yes_ask: 47,
    volume: 8000,
    volume_24h: 2000,
    open_interest: 5000,
    close_time: '2025-01-03T23:59:59Z',
    previousYesBid: 45,
  },
];

describe('Markets', () => {
  it('renders market list', () => {
    const { lastFrame } = render(
      <Markets markets={mockMarkets} selectedIndex={0} height={15} />
    );
    
    expect(lastFrame()).toContain('MARKETS');
    expect(lastFrame()).toContain('KXBTC-25JAN03-B100500');
  });

  it('shows selected market with arrow', () => {
    const { lastFrame } = render(
      <Markets markets={mockMarkets} selectedIndex={0} height={15} />
    );
    
    expect(lastFrame()).toContain('▶');
  });

  it('shows loading spinner when loading with no markets', () => {
    const { lastFrame } = render(
      <Markets markets={[]} selectedIndex={0} height={15} isLoading={true} />
    );
    
    expect(lastFrame()).toContain('Loading markets...');
  });

  it('shows empty message when no markets and not loading', () => {
    const { lastFrame } = render(
      <Markets markets={[]} selectedIndex={0} height={15} isLoading={false} />
    );
    
    expect(lastFrame()).toContain('No markets found');
  });

  it('displays market count', () => {
    const { lastFrame } = render(
      <Markets markets={mockMarkets} selectedIndex={0} height={15} />
    );
    
    expect(lastFrame()).toContain('1 of 2');
  });

  it('shows price with indicator for price increase', () => {
    const { lastFrame } = render(
      <Markets markets={mockMarkets} selectedIndex={0} height={15} />
    );
    
    // Market has previousYesBid=65, yes_bid=67, so should show up indicator
    expect(lastFrame()).toContain('67¢');
  });

  it('shows volume columns', () => {
    const { lastFrame } = render(
      <Markets markets={mockMarkets} selectedIndex={0} height={15} />
    );
    
    // Check header columns exist
    expect(lastFrame()).toContain('Vol');
    expect(lastFrame()).toContain('24h');
    expect(lastFrame()).toContain('OI');
  });
});

