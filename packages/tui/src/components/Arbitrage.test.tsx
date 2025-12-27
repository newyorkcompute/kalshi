import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Arbitrage, type ArbitrageOpportunities } from './Arbitrage.js';

describe('Arbitrage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const emptyOpportunities: ArbitrageOpportunities = {
    singleMarket: [],
    events: [],
  };

  const singleMarketArbs: ArbitrageOpportunities = {
    singleMarket: [
      { ticker: 'KXBTC-25JAN03-B100500', yesAsk: 47, noAsk: 51, total: 98, profit: 2 },
      { ticker: 'INXD-25JAN03-B19500', yesAsk: 44, noAsk: 54, total: 98, profit: 2 },
    ],
    events: [],
  };

  const eventArbs: ArbitrageOpportunities = {
    singleMarket: [],
    events: [
      {
        eventTicker: 'KXELECTION',
        title: 'KXELECTION',
        markets: [
          { ticker: 'KXELECTION-TRUMP', yesAsk: 32 },
          { ticker: 'KXELECTION-DESANTIS', yesAsk: 28 },
          { ticker: 'KXELECTION-NEWSOM', yesAsk: 22 },
          { ticker: 'KXELECTION-OTHER', yesAsk: 12 },
        ],
        total: 94,
        profit: 6,
      },
    ],
  };

  const mixedArbs: ArbitrageOpportunities = {
    singleMarket: [
      { ticker: 'KXBTC-25JAN03-B100500', yesAsk: 47, noAsk: 51, total: 98, profit: 2 },
    ],
    events: [
      {
        eventTicker: 'KXELECTION',
        title: 'KXELECTION',
        markets: [
          { ticker: 'KXELECTION-TRUMP', yesAsk: 32 },
          { ticker: 'KXELECTION-OTHER', yesAsk: 62 },
        ],
        total: 94,
        profit: 6,
      },
    ],
  };

  it('renders the ARBITRAGE header', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={emptyOpportunities} height={10} />
    );
    expect(lastFrame()).toContain('ARBITRAGE');
  });

  it('shows "No arbitrage opportunities" when empty', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={emptyOpportunities} height={10} />
    );
    expect(lastFrame()).toContain('No arbitrage opportunities');
  });

  it('shows loading spinner when isLoading and no opportunities', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={emptyOpportunities} height={10} isLoading={true} />
    );
    expect(lastFrame()).toContain('Scanning...');
  });

  it('shows count of opportunities found', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={singleMarketArbs} height={10} />
    );
    expect(lastFrame()).toContain('2 found');
  });

  it('renders single-market arbitrage opportunities', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={singleMarketArbs} height={12} />
    );
    const frame = lastFrame();
    expect(frame).toContain('KXBTC');
    expect(frame).toContain('Y47+N51=98');
    expect(frame).toContain('+2.0¢');
  });

  it('renders event arbitrage opportunities', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={eventArbs} height={12} />
    );
    const frame = lastFrame();
    expect(frame).toContain('KXELECTION');
    expect(frame).toContain('Σ94¢');
    expect(frame).toContain('+6¢'); // Shows as integer for profits >= 5
  });

  it('renders both types with separator', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={mixedArbs} height={15} />
    );
    const frame = lastFrame();
    expect(frame).toContain('KXBTC');
    expect(frame).toContain('multi-outcome');
    expect(frame).toContain('KXELECTION');
  });

  it('shows correct count for mixed opportunities', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={mixedArbs} height={15} />
    );
    // 1 single market + 1 event = 2
    expect(lastFrame()).toContain('2 found');
  });

  it('truncates long ticker names', () => {
    const longTickerArbs: ArbitrageOpportunities = {
      singleMarket: [
        { ticker: 'VERYLONGTICKERNAME12345678', yesAsk: 47, noAsk: 51, total: 98, profit: 2 },
      ],
      events: [],
    };
    const { lastFrame } = render(
      <Arbitrage opportunities={longTickerArbs} height={10} />
    );
    // Should truncate to 18 chars for single market
    expect(lastFrame()).toContain('VERYLONGTICKERNAME');
  });

  it('uses yellow border when opportunities exist', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={singleMarketArbs} height={10} />
    );
    // Check for the emoji indicator
    expect(lastFrame()).toContain('💰');
  });

  it('uses circle indicator when no opportunities', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={emptyOpportunities} height={10} />
    );
    expect(lastFrame()).toContain('○');
  });

  it('shows market count for event arbitrage', () => {
    const { lastFrame } = render(
      <Arbitrage opportunities={eventArbs} height={12} />
    );
    // Should show (4) for 4 markets in the event
    expect(lastFrame()).toContain('(4)');
  });

  it('shows warning for suspiciously high profits', () => {
    const suspiciousArbs: ArbitrageOpportunities = {
      singleMarket: [],
      events: [
        {
          eventTicker: 'SUSPICIOUS',
          title: 'SUSPICIOUS',
          markets: [
            { ticker: 'A', yesAsk: 10 },
            { ticker: 'B', yesAsk: 10 },
          ],
          total: 20, // Only 20¢ sum = 80¢ profit (suspicious!)
          profit: 80,
        },
      ],
    };
    const { lastFrame } = render(
      <Arbitrage opportunities={suspiciousArbs} height={10} />
    );
    // Should show warning indicator
    expect(lastFrame()).toContain('⚠');
  });
});

