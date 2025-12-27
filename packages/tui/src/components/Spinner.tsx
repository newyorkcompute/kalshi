/**
 * Spinner Component
 * Animated loading indicator for the TUI
 */

import { Text } from 'ink';
import { useState, useEffect } from 'react';

interface SpinnerProps {
  /** Text to display alongside the spinner */
  label?: string;
  /** Color of the spinner */
  color?: string;
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_INTERVAL = 80; // ms

/**
 * Animated spinner component
 * 
 * @example
 * ```tsx
 * <Spinner label="Loading markets..." />
 * ```
 */
export function Spinner({ label, color = 'cyan' }: SpinnerProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(i => (i + 1) % FRAMES.length);
    }, FRAME_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return (
    <Text>
      <Text color={color}>{FRAMES[frameIndex]}</Text>
      {label && <Text color="gray"> {label}</Text>}
    </Text>
  );
}

