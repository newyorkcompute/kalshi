import React, { Component, ReactNode } from "react";
import { Box, Text } from "ink";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * Error boundary component to catch and display React errors gracefully
 *
 * Catches errors in child components and displays a user-friendly error message
 * instead of crashing the entire TUI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error("TUI Error Boundary caught error:", error);
    console.error("Component stack:", errorInfo.componentStack);

    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          flexDirection="column"
          padding={1}
          borderStyle="round"
          borderColor="red"
        >
          <Text color="red" bold>
            ⚠️  Fatal Error
          </Text>
          <Text color="gray"> </Text>
          <Text color="white">
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Text color="gray"> </Text>
          <Text color="gray" dimColor>
            {this.state.error?.stack?.split("\n").slice(0, 3).join("\n")}
          </Text>
          <Text color="gray"> </Text>
          <Text color="yellow">Press Ctrl+C to exit</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}

