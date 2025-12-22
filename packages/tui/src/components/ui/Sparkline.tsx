import React from "react";
import { Text } from "ink";

interface SparklineProps {
  data: number[];
  width?: number;
  color?: string;
}

// Sparkline characters (in order of fill level)
const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/**
 * Sparkline component for visualizing price history
 */
export function Sparkline({ data, width = 10, color = "green" }: SparklineProps) {
  if (data.length === 0) {
    return <Text color="gray">{"─".repeat(width)}</Text>;
  }

  // Normalize data to fit in sparkline range
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Sample data to fit width
  const sampledData: number[] = [];
  for (let i = 0; i < width; i++) {
    const index = Math.floor((i / width) * data.length);
    sampledData.push(data[index]);
  }

  // Convert to sparkline characters
  const sparkline = sampledData
    .map((value) => {
      const normalized = (value - min) / range;
      const charIndex = Math.floor(normalized * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[charIndex];
    })
    .join("");

  return <Text color={color}>{sparkline}</Text>;
}

