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

  it('renders with border', () => {
    const { lastFrame } = render(<Footer />);
    
    // Check that it renders a bordered box
    expect(lastFrame()).toContain('Built by');
    expect(lastFrame()).toContain('│'); // Border character
  });
});

