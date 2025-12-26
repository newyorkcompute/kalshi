/**
 * Error Boundary Component
 * Catches unhandled errors and displays a user-friendly message
 */

import React, { Component, ReactNode } from 'react';
import { Box, Text } from 'ink';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('TUI Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={2}>
          <Box marginBottom={1}>
            <Text color="red" bold>
              ╔══════════════════════════════════════════╗
            </Text>
          </Box>
          <Box>
            <Text color="red" bold>
              ║  ⚠️  FATAL ERROR                         ║
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="red" bold>
              ╚══════════════════════════════════════════╝
            </Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color="gray">Something went wrong:</Text>
          </Box>
          
          <Box marginBottom={1}>
            <Text color="yellow" wrap="wrap">
              {this.state.error?.message || 'Unknown error'}
            </Text>
          </Box>
          
          <Box marginTop={1}>
            <Text color="gray">Press </Text>
            <Text color="cyan" bold>Ctrl+C</Text>
            <Text color="gray"> to exit</Text>
          </Box>
          
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              If this persists, please report at github.com/newyorkcompute/kalshi/issues
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

