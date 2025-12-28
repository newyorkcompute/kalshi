/**
 * TUI Configuration
 * 
 * Handles reading/writing user preferences to ~/.kalshi-tui/config.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/** Sort options for markets list */
export type SortOption = 'volume' | 'volume_24h' | 'open_interest' | 'price';

/** User configuration schema */
export interface TuiConfig {
  /** Current sort preference */
  sortBy: SortOption;
  /** List of favorited market tickers */
  favorites: string[];
  /** Refresh interval in milliseconds */
  refreshInterval: number;
  /** Show favorites at top of list */
  favoritesFirst: boolean;
}

/** Default configuration */
const DEFAULT_CONFIG: TuiConfig = {
  sortBy: 'volume',
  favorites: [],
  refreshInterval: 10000,
  favoritesFirst: true,
};

/** Config directory path */
const CONFIG_DIR = join(homedir(), '.kalshi-tui');

/** Config file path */
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Load configuration from disk
 * Returns default config if file doesn't exist
 */
export function loadConfig(): TuiConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }
    
    const data = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Merge with defaults to handle missing fields
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    };
  } catch {
    // Return defaults on any error
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration to disk
 * Creates config directory if it doesn't exist
 */
export function saveConfig(config: TuiConfig): void {
  try {
    // Ensure directory exists
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // Silently fail - config is not critical
  }
}

/**
 * Toggle a market in favorites
 * Returns the updated favorites list
 */
export function toggleFavorite(favorites: string[], ticker: string): string[] {
  if (favorites.includes(ticker)) {
    return favorites.filter(t => t !== ticker);
  }
  return [...favorites, ticker];
}

/**
 * Check if a market is favorited
 */
export function isFavorite(favorites: string[], ticker: string): boolean {
  return favorites.includes(ticker);
}

