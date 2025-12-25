/**
 * Vanilla Terminal Utilities
 * Direct ANSI escape code control - no React, no Ink
 */

// ANSI escape codes
export const ESC = '\x1B';
export const CSI = `${ESC}[`;

// Cursor control
export const cursor = {
  hide: () => process.stdout.write(`${CSI}?25l`),
  show: () => process.stdout.write(`${CSI}?25h`),
  moveTo: (row: number, col: number) => process.stdout.write(`${CSI}${row};${col}H`),
  moveUp: (n = 1) => process.stdout.write(`${CSI}${n}A`),
  moveDown: (n = 1) => process.stdout.write(`${CSI}${n}B`),
  home: () => process.stdout.write(`${CSI}H`),
};

// Screen control
export const screen = {
  clear: () => process.stdout.write(`${CSI}2J${CSI}H`),
  clearLine: () => process.stdout.write(`${CSI}2K`),
  enterAlt: () => process.stdout.write(`${CSI}?1049h`),
  exitAlt: () => process.stdout.write(`${CSI}?1049l`),
};

// Colors
export const color = {
  reset: `${CSI}0m`,
  bold: `${CSI}1m`,
  dim: `${CSI}2m`,
  
  // Foreground
  black: `${CSI}30m`,
  red: `${CSI}31m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan: `${CSI}36m`,
  white: `${CSI}37m`,
  gray: `${CSI}90m`,
  
  // Background
  bgBlack: `${CSI}40m`,
  bgRed: `${CSI}41m`,
  bgGreen: `${CSI}42m`,
  bgYellow: `${CSI}43m`,
  bgBlue: `${CSI}44m`,
  bgMagenta: `${CSI}45m`,
  bgCyan: `${CSI}46m`,
  bgWhite: `${CSI}47m`,
};

// Box drawing characters (Unicode)
export const box = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
  teeDown: '┬',
  teeUp: '┴',
  cross: '┼',
};

// Get terminal size
export function getTerminalSize(): { rows: number; cols: number } {
  return {
    rows: process.stdout.rows || 40,
    cols: process.stdout.columns || 120,
  };
}

// Write at specific position
export function writeAt(row: number, col: number, text: string) {
  cursor.moveTo(row, col);
  process.stdout.write(text);
}

// Draw a box
export function drawBox(
  row: number,
  col: number,
  width: number,
  height: number,
  borderColor = color.gray
) {
  const { topLeft, topRight, bottomLeft, bottomRight, horizontal, vertical } = box;
  
  // Top border
  writeAt(row, col, `${borderColor}${topLeft}${horizontal.repeat(width - 2)}${topRight}${color.reset}`);
  
  // Side borders
  for (let i = 1; i < height - 1; i++) {
    writeAt(row + i, col, `${borderColor}${vertical}${color.reset}`);
    writeAt(row + i, col + width - 1, `${borderColor}${vertical}${color.reset}`);
  }
  
  // Bottom border
  writeAt(row + height - 1, col, `${borderColor}${bottomLeft}${horizontal.repeat(width - 2)}${bottomRight}${color.reset}`);
}

// Truncate text to fit width
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

// Pad text to width
export function padRight(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

export function padLeft(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return ' '.repeat(width - text.length) + text;
}

// Format currency (cents to dollars)
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Format price (cents)
export function formatPrice(cents: number): string {
  return `${cents}¢`;
}

