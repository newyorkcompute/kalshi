# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to the maintainers (open a private security advisory on GitHub)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to understand and address the issue.

## Security Considerations

### API Key Safety

- **Never commit API keys** to version control
- Use environment variables for `KALSHI_API_KEY` and `KALSHI_PRIVATE_KEY`
- Rotate keys if you suspect they've been compromised

### Private Key Handling

- The `KALSHI_PRIVATE_KEY` is used for RSA-PSS signing
- Store it securely (environment variables, secrets manager)
- Never log or expose the private key

### MCP Server Security

- The MCP server runs locally with stdio transport
- It only connects to official Kalshi API endpoints
- No data is sent to third parties

## Dependencies

We regularly update dependencies to patch security vulnerabilities. Enable Dependabot alerts on your fork to stay informed.

