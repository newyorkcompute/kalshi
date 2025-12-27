import { describe, it, expect } from 'vitest';
import { WS_ENDPOINTS } from './types.js';

describe('WebSocket Types', () => {
  describe('WS_ENDPOINTS', () => {
    it('has production endpoint', () => {
      expect(WS_ENDPOINTS.production).toBe('wss://api.elections.kalshi.com/trade-api/ws/v2');
    });

    it('has demo endpoint', () => {
      expect(WS_ENDPOINTS.demo).toBe('wss://demo-api.kalshi.co/trade-api/ws/v2');
    });

    it('endpoints use secure WebSocket protocol', () => {
      expect(WS_ENDPOINTS.production.startsWith('wss://')).toBe(true);
      expect(WS_ENDPOINTS.demo.startsWith('wss://')).toBe(true);
    });
  });
});

