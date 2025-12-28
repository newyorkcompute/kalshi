import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { HelpOverlay } from './HelpOverlay.js';

describe('HelpOverlay', () => {
  it('should render with title', () => {
    const { lastFrame } = render(<HelpOverlay width={80} height={40} />);
    expect(lastFrame()).toContain('KEYBOARD SHORTCUTS');
  });

  it('should show navigation shortcut', () => {
    const { lastFrame } = render(<HelpOverlay width={80} height={40} />);
    expect(lastFrame()).toContain('Navigate markets');
  });

  it('should show sort shortcut', () => {
    const { lastFrame } = render(<HelpOverlay width={80} height={40} />);
    expect(lastFrame()).toContain('Cycle sort');
  });

  it('should show favorite shortcut', () => {
    const { lastFrame } = render(<HelpOverlay width={80} height={40} />);
    expect(lastFrame()).toContain('Toggle favorite');
  });

  it('should show quit shortcut', () => {
    const { lastFrame } = render(<HelpOverlay width={80} height={40} />);
    expect(lastFrame()).toContain('Quit');
  });

  it('should show help toggle shortcut', () => {
    const { lastFrame } = render(<HelpOverlay width={80} height={40} />);
    expect(lastFrame()).toContain('Toggle this help');
  });

  it('should show close hint', () => {
    const { lastFrame } = render(<HelpOverlay width={80} height={40} />);
    expect(lastFrame()).toContain('Press ? to close');
  });
});

