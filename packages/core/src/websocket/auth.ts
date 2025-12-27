/**
 * Kalshi WebSocket Authentication
 * 
 * Handles signature generation for authenticated WebSocket connections.
 * Uses the same RSA-PSS signing as the REST API.
 */

import * as crypto from 'crypto';

/**
 * Generate authentication headers for WebSocket connection
 * 
 * @param apiKeyId - Your Kalshi API key ID
 * @param privateKey - Your private key in PEM format
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Headers object for WebSocket connection
 */
export function generateWsAuthHeaders(
  apiKeyId: string,
  privateKey: string,
  timestamp: number = Date.now()
): Record<string, string> {
  // The message to sign for WebSocket is typically the timestamp
  const timestampStr = timestamp.toString();
  
  // Create signature using RSA-PSS with SHA-256
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(timestampStr);
  sign.end();
  
  // Sign with PSS padding
  const signature = sign.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }, 'base64');

  return {
    'KALSHI-ACCESS-KEY': apiKeyId,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'KALSHI-ACCESS-TIMESTAMP': timestampStr,
  };
}

/**
 * Generate a signed WebSocket URL with auth params
 * 
 * Some WebSocket implementations don't support custom headers,
 * so we can pass auth as query parameters instead.
 * 
 * @param baseUrl - WebSocket endpoint URL
 * @param apiKeyId - Your Kalshi API key ID  
 * @param privateKey - Your private key in PEM format
 * @returns Full WebSocket URL with auth parameters
 */
export function generateSignedWsUrl(
  baseUrl: string,
  apiKeyId: string,
  privateKey: string
): string {
  const timestamp = Date.now();
  const headers = generateWsAuthHeaders(apiKeyId, privateKey, timestamp);
  
  const url = new URL(baseUrl);
  url.searchParams.set('api_key', headers['KALSHI-ACCESS-KEY']);
  url.searchParams.set('signature', headers['KALSHI-ACCESS-SIGNATURE']);
  url.searchParams.set('timestamp', headers['KALSHI-ACCESS-TIMESTAMP']);
  
  return url.toString();
}

