import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Footer } from './Footer.js';

describe('Footer', () => {
  it('renders branding', () => {
    const { lastFrame } = render(<Footer />);
    
    expect(lastFrame()).toContain('New York Compute');
    expect(lastFrame()).toContain('newyorkcompute.xyz');
  });

  it('displays keyboard shortcuts', () => {
    const { lastFrame } = render(<Footer />);
    
    expect(lastFrame()).toContain('[↑↓] Navigate');
    expect(lastFrame()).toContain('[q] Quit');
  });

  it('renders consistently (snapshot)', () => {
    const { lastFrame } = render(<Footer />);
    
    // Basic snapshot - checks the overall structure
    expect(lastFrame()).toMatchSnapshot();
  });
});

