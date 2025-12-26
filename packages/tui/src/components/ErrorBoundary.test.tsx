import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { ErrorBoundary } from './ErrorBoundary.js';

// Component that throws an error
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <Text>Normal content</Text>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <Text>Hello World</Text>
      </ErrorBoundary>
    );
    
    expect(lastFrame()).toContain('Hello World');
  });

  it('renders error UI when child throws', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(lastFrame()).toContain('FATAL ERROR');
    expect(lastFrame()).toContain('Test error message');
    expect(lastFrame()).toContain('Ctrl+C');
  });

  it('shows generic message for unknown errors', () => {
    // Create a component that throws a non-Error
    function ThrowsNonError(): React.ReactElement {
      throw 'not an error object';
    }
    
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowsNonError />
      </ErrorBoundary>
    );
    
    expect(lastFrame()).toContain('Unknown error');
  });

  it('displays github issues link', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(lastFrame()).toContain('github.com/newyorkcompute/kalshi/issues');
  });

  it('logs error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(consoleSpy).toHaveBeenCalled();
  });
});

