import { describe, it, expect } from 'vitest';
import { HelpOverlay } from './HelpOverlay.js';

describe('HelpOverlay', () => {
  it('should be a valid React component', () => {
    expect(typeof HelpOverlay).toBe('function');
  });

  it('should accept width and height props', () => {
    // Component accepts these props without error
    const element = HelpOverlay({ width: 80, height: 40 });
    expect(element).toBeDefined();
  });

  // Note: position="absolute" doesn't render in ink-testing-library
  // Visual testing should be done manually or with snapshot tests
});
