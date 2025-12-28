/**
 * Kalshi WebSocket Authentication
 * 
 * Handles signature generation for authenticated WebSocket connections.
 * Uses the same RSA-PSS signing as the REST API.
 */

import * as crypto from 'crypto';

/** WebSocket API path for signing */
const WS_PATH = '/trade-api/ws/v2';

/**
 * Generate authentication headers for WebSocket connection
 * 
 * The message to sign is: timestamp + method + path
 * e.g., "1703702400000GET/trade-api/ws/v2"
 * 
 * @param apiKeyId - Your Kalshi API key ID
 * @param privateKeyPem - Your private key in PEM format
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Headers object for WebSocket connection
 */
export function generateWsAuthHeaders(
  apiKeyId: string,
  privateKeyPem: string,
  timestamp: number = Date.now()
): Record<string, string> {
  const timestampStr = timestamp.toString();
  
  // Message format: timestamp + method + path
  const message = timestampStr + 'GET' + WS_PATH;

  // Convert PEM string to KeyObject (required for proper signing)
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  
  // Sign using RSA-PSS with SHA-256
  const signature = crypto.sign('sha256', Buffer.from(message), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });

  return {
    'KALSHI-ACCESS-KEY': apiKeyId,
    'KALSHI-ACCESS-SIGNATURE': signature.toString('base64'),
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
  const headers = generateWsAuthHeaders(apiKeyId, privateKey);
  
  const url = new URL(baseUrl);
  url.searchParams.set('api_key', headers['KALSHI-ACCESS-KEY']);
  url.searchParams.set('signature', headers['KALSHI-ACCESS-SIGNATURE']);
  url.searchParams.set('timestamp', headers['KALSHI-ACCESS-TIMESTAMP']);
  
  return url.toString();
}

/** Export path for testing */
export { WS_PATH };

