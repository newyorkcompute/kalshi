/**
 * Positions Component Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Positions } from './Positions.js';

const mockPositions = [
  {
    ticker: 'KXBTC-25JAN03-B100500',
    position: 10, // Long YES
    market_exposure: 6700,
  },
  {
    ticker: 'INXD-25JAN03-B19500',
    position: -5, // Short (NO)
    market_exposure: 2250,
  },
];

describe('Positions', () => {
  it('renders positions header', () => {
    const { lastFrame } = render(
      <Positions positions={mockPositions} height={10} />
    );
    
    expect(lastFrame()).toContain('POSITIONS');
  });

  it('shows loading spinner when loading with no positions', () => {
    const { lastFrame } = render(
      <Positions positions={[]} height={10} isLoading={true} />
    );
    
    expect(lastFrame()).toContain('Loading positions...');
  });

  it('shows empty message when no positions', () => {
    const { lastFrame } = render(
      <Positions positions={[]} height={10} isLoading={false} />
    );
    
    expect(lastFrame()).toContain('No open positions');
  });

  it('displays position ticker', () => {
    const { lastFrame } = render(
      <Positions positions={mockPositions} height={10} />
    );
    
    expect(lastFrame()).toContain('KXBTC-25JAN03-B100');
  });

  it('shows YES for long positions', () => {
    const { lastFrame } = render(
      <Positions positions={[mockPositions[0]]} height={10} />
    );
    
    expect(lastFrame()).toContain('10 YES');
  });

  it('shows NO for short positions', () => {
    const { lastFrame } = render(
      <Positions positions={[mockPositions[1]]} height={10} />
    );
    
    expect(lastFrame()).toContain('5 NO');
  });

  it('displays market exposure in dollars', () => {
    const { lastFrame } = render(
      <Positions positions={mockPositions} height={10} />
    );
    
    expect(lastFrame()).toContain('$67.00');
  });
});

