import { describe, it, expect, vi } from 'vitest';
import * as crypto from 'crypto';

// Mock crypto module since we can't use real RSA keys in tests easily
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof crypto>('crypto');
  return {
    ...actual,
    createPrivateKey: vi.fn(() => 'mocked-key-object'),
    sign: vi.fn(() => Buffer.from('mocked-signature-base64')),
  };
});

import { generateWsAuthHeaders, generateSignedWsUrl, WS_PATH } from './auth.js';

describe('WebSocket Auth', () => {
  describe('generateWsAuthHeaders', () => {
    it('generates all required headers', () => {
      const headers = generateWsAuthHeaders('test-api-key', 'fake-private-key');
      
      expect(headers).toHaveProperty('KALSHI-ACCESS-KEY');
      expect(headers).toHaveProperty('KALSHI-ACCESS-SIGNATURE');
      expect(headers).toHaveProperty('KALSHI-ACCESS-TIMESTAMP');
    });

    it('uses the provided API key', () => {
      const headers = generateWsAuthHeaders('my-api-key-123', 'fake-key');
      
      expect(headers['KALSHI-ACCESS-KEY']).toBe('my-api-key-123');
    });

    it('uses the provided timestamp', () => {
      const timestamp = 1703721600000; // Fixed timestamp
      const headers = generateWsAuthHeaders('test-key', 'fake-key', timestamp);
      
      expect(headers['KALSHI-ACCESS-TIMESTAMP']).toBe('1703721600000');
    });

    it('returns a signature', () => {
      const headers = generateWsAuthHeaders('test-key', 'fake-key');
      
      expect(headers['KALSHI-ACCESS-SIGNATURE']).toBeDefined();
      expect(headers['KALSHI-ACCESS-SIGNATURE'].length).toBeGreaterThan(0);
    });

    it('signs the correct message format (timestamp + GET + path)', () => {
      const timestamp = 1703721600000;
      generateWsAuthHeaders('test-key', 'fake-key-pem', timestamp);

      // Verify crypto.createPrivateKey was called with the PEM
      expect(crypto.createPrivateKey).toHaveBeenCalledWith('fake-key-pem');

      // Verify crypto.sign was called with correct message format
      expect(crypto.sign).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(`${timestamp}GET${WS_PATH}`),
        expect.objectContaining({
          key: 'mocked-key-object',
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        })
      );
    });
  });

  describe('generateSignedWsUrl', () => {
    it('appends auth parameters to URL', () => {
      const url = generateSignedWsUrl(
        'wss://api.example.com/ws',
        'test-api-key',
        'fake-key'
      );
      
      expect(url).toContain('api_key=test-api-key');
      expect(url).toContain('signature=');
      expect(url).toContain('timestamp=');
    });

    it('preserves the base URL', () => {
      const url = generateSignedWsUrl(
        'wss://api.elections.kalshi.com/trade-api/ws/v2',
        'test-key',
        'fake-key'
      );
      
      expect(url.startsWith('wss://api.elections.kalshi.com/trade-api/ws/v2')).toBe(true);
    });

    it('properly encodes parameters', () => {
      const url = generateSignedWsUrl(
        'wss://api.example.com/ws',
        'test+key',
        'fake-key'
      );
      
      // URL should properly encode the + character
      expect(url).toContain('api_key=test%2Bkey');
    });
  });
});

