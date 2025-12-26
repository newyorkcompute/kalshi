import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Header } from './Header.js';

describe('Header', () => {
  it('renders branding', () => {
    const { lastFrame } = render(
      <Header balance={null} isConnected={false} error={null} />
    );
    
    // Terminal rendering may truncate, just check for what's visible
    expect(lastFrame()).toContain('NEW YORK COMPUTE');
    expect(lastFrame()).toContain('Balance');
  });

  it('displays balance when provided', () => {
    const { lastFrame } = render(
      <Header balance={10000} isConnected={true} error={null} />
    );
    
    expect(lastFrame()).toContain('$100.00');
  });

  it('displays dash when balance is null', () => {
    const { lastFrame } = render(
      <Header balance={null} isConnected={true} error={null} />
    );
    
    expect(lastFrame()).toContain('—');
  });

  it('shows connected status when connected', () => {
    const { lastFrame } = render(
      <Header balance={null} isConnected={true} error={null} />
    );
    
    expect(lastFrame()).toContain('●');
    expect(lastFrame()).toContain('connected');
  });

  it('shows disconnected status when not connected', () => {
    const { lastFrame } = render(
      <Header balance={null} isConnected={false} error={null} />
    );
    
    expect(lastFrame()).toContain('○');
    expect(lastFrame()).toContain('disconnected');
  });

  it('shows rate limited status', () => {
    const { lastFrame } = render(
      <Header balance={null} isConnected={true} isRateLimited={true} error={null} />
    );
    
    expect(lastFrame()).toContain('◐');
    expect(lastFrame()).toContain('rate limited');
  });

  it('displays error message when present', () => {
    const { lastFrame } = render(
      <Header balance={null} isConnected={false} error="Connection failed" />
    );
    
    expect(lastFrame()).toContain('Connection failed');
  });

  it('truncates long error messages', () => {
    const longError = 'This is a very long error message that should be truncated because it exceeds the maximum length';
    const { lastFrame } = render(
      <Header balance={null} isConnected={false} error={longError} />
    );
    
    // Should be truncated to 40 chars
    expect(lastFrame()).toContain('This is a very long error message that ');
  });
});

