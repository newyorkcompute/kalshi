import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig, toggleFavorite, isFavorite, type TuiConfig } from './config.js';
import * as fs from 'fs';

vi.mock('fs');
vi.mock('os', () => ({
  homedir: () => '/home/testuser',
}));

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfig', () => {
    it('should return default config when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config = loadConfig();
      
      expect(config.sortBy).toBe('volume');
      expect(config.favorites).toEqual([]);
      expect(config.refreshInterval).toBe(10000);
      expect(config.favoritesFirst).toBe(true);
    });

    it('should load config from file when it exists', () => {
      const savedConfig = {
        sortBy: 'price',
        favorites: ['KXBTC-123'],
        refreshInterval: 5000,
        favoritesFirst: false,
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(savedConfig));
      
      const config = loadConfig();
      
      expect(config.sortBy).toBe('price');
      expect(config.favorites).toEqual(['KXBTC-123']);
      expect(config.refreshInterval).toBe(5000);
      expect(config.favoritesFirst).toBe(false);
    });

    it('should merge with defaults for missing fields', () => {
      const partialConfig = {
        sortBy: 'volume_24h',
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(partialConfig));
      
      const config = loadConfig();
      
      expect(config.sortBy).toBe('volume_24h');
      expect(config.favorites).toEqual([]); // Default
      expect(config.refreshInterval).toBe(10000); // Default
    });

    it('should return defaults on parse error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
      
      const config = loadConfig();
      
      expect(config.sortBy).toBe('volume');
    });
  });

  describe('saveConfig', () => {
    it('should create directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      
      const config: TuiConfig = {
        sortBy: 'price',
        favorites: ['KXBTC'],
        refreshInterval: 10000,
        favoritesFirst: true,
      };
      
      saveConfig(config);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/home/testuser/.kalshi-tui',
        { recursive: true }
      );
    });

    it('should write config to file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
      
      const config: TuiConfig = {
        sortBy: 'open_interest',
        favorites: ['KXBTC', 'KXINX'],
        refreshInterval: 5000,
        favoritesFirst: false,
      };
      
      saveConfig(config);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.kalshi-tui/config.json',
        expect.stringContaining('"sortBy": "open_interest"'),
        'utf-8'
      );
    });

    it('should silently fail on write error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      // Should not throw
      expect(() => saveConfig({
        sortBy: 'volume',
        favorites: [],
        refreshInterval: 10000,
        favoritesFirst: true,
      })).not.toThrow();
    });
  });

  describe('toggleFavorite', () => {
    it('should add ticker to favorites if not present', () => {
      const favorites = ['KXBTC'];
      const result = toggleFavorite(favorites, 'KXINX');
      
      expect(result).toEqual(['KXBTC', 'KXINX']);
    });

    it('should remove ticker from favorites if present', () => {
      const favorites = ['KXBTC', 'KXINX'];
      const result = toggleFavorite(favorites, 'KXBTC');
      
      expect(result).toEqual(['KXINX']);
    });

    it('should not mutate original array', () => {
      const favorites = ['KXBTC'];
      toggleFavorite(favorites, 'KXINX');
      
      expect(favorites).toEqual(['KXBTC']);
    });
  });

  describe('isFavorite', () => {
    it('should return true if ticker is in favorites', () => {
      expect(isFavorite(['KXBTC', 'KXINX'], 'KXBTC')).toBe(true);
    });

    it('should return false if ticker is not in favorites', () => {
      expect(isFavorite(['KXBTC'], 'KXINX')).toBe(false);
    });

    it('should return false for empty favorites', () => {
      expect(isFavorite([], 'KXBTC')).toBe(false);
    });
  });
});

