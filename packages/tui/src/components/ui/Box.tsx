import React from "react";
import { Box as InkBox, Text } from "ink";
import type { BoxProps as InkBoxProps } from "ink";

interface PanelProps extends InkBoxProps {
  title?: string;
  titleRight?: string;
  isActive?: boolean;
  children: React.ReactNode;
}

/**
 * Styled panel component following NYC design guidelines
 */
export function Panel({
  title,
  titleRight,
  isActive = false,
  children,
  ...props
}: PanelProps) {
  return (
    <InkBox
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? "green" : "gray"}
      {...props}
    >
      {/* Header */}
      {(title || titleRight) && (
        <InkBox paddingX={1} justifyContent="space-between">
          {title && (
            <Text bold color={isActive ? "green" : "white"}>
              {title}
            </Text>
          )}
          {titleRight && (
            <Text color="gray" dimColor>
              {titleRight}
            </Text>
          )}
        </InkBox>
      )}

      {/* Divider */}
      {title && (
        <InkBox paddingX={1}>
          <Text color="gray">{"─".repeat(40)}</Text>
        </InkBox>
      )}

      {/* Content */}
      <InkBox flexDirection="column" paddingX={1} flexGrow={1}>
        {children}
      </InkBox>
    </InkBox>
  );
}

