import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { Text } from "ink";

const ThrowError = () => {
  throw new Error("Test error");
};

describe("ErrorBoundary", () => {
  it("should render children when no error", () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <Text>Hello World</Text>
      </ErrorBoundary>
    );

    expect(lastFrame()).toContain("Hello World");
  });

  it("should catch and display errors", () => {
    // Suppress console.error for this test
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(lastFrame()).toContain("Fatal Error");
    expect(lastFrame()).toContain("Test error");
    expect(lastFrame()).toContain("Ctrl+C");

    consoleError.mockRestore();
  });

  it("should log error to console", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(consoleError).toHaveBeenCalledWith(
      "TUI Error Boundary caught error:",
      expect.any(Error)
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Component stack:",
      expect.any(String)
    );

    consoleError.mockRestore();
  });

  it("should display default message for errors without message", () => {
    const ThrowEmptyError = () => {
      const error = new Error();
      error.message = "";
      throw error;
    };

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowEmptyError />
      </ErrorBoundary>
    );

    expect(lastFrame()).toContain("An unexpected error occurred");

    consoleError.mockRestore();
  });
});

