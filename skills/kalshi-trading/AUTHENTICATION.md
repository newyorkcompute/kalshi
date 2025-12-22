# Kalshi API Authentication

Kalshi uses RSA-SHA256 signing for API authentication. This guide walks through the complete setup process.

## Prerequisites

- A Kalshi account at [kalshi.com](https://kalshi.com)
- Node.js 18+ (uses built-in `crypto` module)

## Step 1: Generate RSA Key Pair

```bash
# Generate a 4096-bit RSA private key
openssl genrsa -out kalshi_private_key.pem 4096

# Extract the public key
openssl rsa -in kalshi_private_key.pem -pubout -out kalshi_public_key.pem
```

## Step 2: Add Public Key to Kalshi

1. Log in to [kalshi.com](https://kalshi.com)
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Paste the contents of `kalshi_public_key.pem`
5. Save the **API Key ID** that Kalshi generates

## Step 3: Store Credentials Securely

Option A: Environment variables (recommended)

```bash
export KALSHI_API_KEY="your-api-key-id"
export KALSHI_PRIVATE_KEY="$(cat kalshi_private_key.pem)"
```

Option B: `.env` file

```
KALSHI_API_KEY=your-api-key-id
KALSHI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your key content...
-----END RSA PRIVATE KEY-----"
```

## Step 4: Authentication Code

```typescript
import * as crypto from "crypto";

interface KalshiAuthConfig {
  apiKey?: string;
  privateKeyPem?: string;
}

class KalshiAuth {
  private readonly apiKey: string;
  private readonly privateKeyPem: string;

  constructor(config: KalshiAuthConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.KALSHI_API_KEY ?? "";
    this.privateKeyPem =
      config.privateKeyPem ?? process.env.KALSHI_PRIVATE_KEY ?? "";

    if (!this.apiKey || !this.privateKeyPem) {
      throw new Error(
        "Missing credentials. Set KALSHI_API_KEY and KALSHI_PRIVATE_KEY " +
          "environment variables or pass them directly."
      );
    }
  }

  getHeaders(method: string, path: string): Record<string, string> {
    const timestamp = Date.now().toString();
    const message = `${timestamp}${method}${path}`;

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(message);
    const signature = sign.sign(this.privateKeyPem, "base64");

    return {
      "KALSHI-ACCESS-KEY": this.apiKey,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
    };
  }
}

export { KalshiAuth };
```

## Usage Example

```typescript
const auth = new KalshiAuth();
const API_BASE = "https://api.elections.kalshi.com/trade-api/v2";

// Make authenticated request
const path = "/portfolio/balance";
const headers = auth.getHeaders("GET", path);

const response = await fetch(`${API_BASE}${path}`, { headers });
const data = await response.json();

console.log(data);
// { balance: 10000, payout: 0 }  // balance in cents
```

## API Environments

| Environment | Base URL                                         |
| ----------- | ------------------------------------------------ |
| Production  | `https://api.elections.kalshi.com/trade-api/v2`  |
| Demo        | `https://demo-api.kalshi.co/trade-api/v2`        |

## Troubleshooting

### "Invalid signature" error

- Ensure timestamp is in milliseconds
- Check that the message format is exactly: `{timestamp}{METHOD}{path}`
- Verify your private key matches the public key on Kalshi

### "Unauthorized" error

- Verify your API key ID is correct
- Check that your key hasn't been revoked in Kalshi settings

### "Clock skew" error

- Ensure your system clock is synchronized
- Timestamp must be within 5 minutes of server time

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use environment variables** for credentials
3. **Rotate keys periodically** in Kalshi settings
4. **Use separate keys** for production vs development
5. **Limit key permissions** if Kalshi supports scoped keys
