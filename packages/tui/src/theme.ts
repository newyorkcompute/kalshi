/**
 * NYC + Kalshi Theme Colors
 *
 * Based on NYC brand guidelines with Kalshi green accent.
 */

export const theme = {
  // Core colors
  background: "#000000",
  foreground: "#FFFFFF",

  // Accent (Kalshi green instead of NYC blue)
  accent: "#00D26A",
  accentDim: "#00A857",

  // Grayscale
  border: "#262626", // gray-800
  muted: "#525252", // gray-600
  body: "#737373", // gray-500

  // Semantic colors
  success: "#00D26A", // Same as accent
  error: "#EF4444",
  warning: "#F59E0B",

  // Price indicators
  up: "#00D26A",
  down: "#EF4444",
  unchanged: "#737373",
} as const;

/**
 * Terminal-friendly color mappings for Ink
 */
export const colors = {
  // Use Ink's built-in color names that map to theme
  accent: "green" as const,
  error: "red" as const,
  warning: "yellow" as const,
  muted: "gray" as const,
  text: "white" as const,
};

