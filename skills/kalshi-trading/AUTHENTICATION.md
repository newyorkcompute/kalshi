# Kalshi API Authentication

Kalshi uses RSA-PSS signing for API authentication. This guide walks through the complete setup process.

## Prerequisites

- A Kalshi account at [kalshi.com](https://kalshi.com)
- Python with `cryptography` package installed

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

```python
import os
import time
import base64
import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

class KalshiAuth:
    """Handle Kalshi API authentication."""
    
    def __init__(self, api_key: str = None, private_key_pem: str = None):
        self.api_key = api_key or os.environ.get("KALSHI_API_KEY")
        self.private_key_pem = private_key_pem or os.environ.get("KALSHI_PRIVATE_KEY")
        
        if not self.api_key or not self.private_key_pem:
            raise ValueError(
                "Missing credentials. Set KALSHI_API_KEY and KALSHI_PRIVATE_KEY "
                "environment variables or pass them directly."
            )
        
        self.private_key = serialization.load_pem_private_key(
            self.private_key_pem.encode(),
            password=None
        )
    
    def get_headers(self, method: str, path: str) -> dict:
        """Generate authenticated headers for a request."""
        timestamp = str(int(time.time() * 1000))
        message = f"{timestamp}{method}{path}"
        
        signature = self.private_key.sign(
            message.encode(),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        
        return {
            "KALSHI-ACCESS-KEY": self.api_key,
            "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode(),
            "KALSHI-ACCESS-TIMESTAMP": timestamp,
            "Content-Type": "application/json"
        }
```

## Usage Example

```python
auth = KalshiAuth()
API_BASE = "https://api.elections.kalshi.com/trade-api/v2"

# Make authenticated request
path = "/portfolio/balance"
headers = auth.get_headers("GET", path)
response = requests.get(f"{API_BASE}{path}", headers=headers)

print(response.json())
# {'balance': 10000, 'payout': 0}  # balance in cents
```

## API Environments

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.elections.kalshi.com/trade-api/v2` |
| Demo | `https://demo-api.kalshi.co/trade-api/v2` |

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

