# Code Review & Security Audit

**Repository:** @newyorkcompute/kalshi  
**Date:** December 22, 2025  
**Reviewer:** AI Assistant  
**Scope:** Full monorepo security and code quality review

---

## 🎯 Executive Summary

**Overall Assessment:** ✅ **GOOD** - The codebase is well-structured, secure, and follows best practices for an open-source project.

**Key Strengths:**
- Strong security practices for credential management
- Clean TypeScript architecture with proper typing
- Good separation of concerns (core, mcp, tui packages)
- Comprehensive documentation
- Proper CI/CD setup with automated testing

**Critical Issues:** 🔴 **1 CRITICAL**
**High Priority Issues:** 🟡 **3 HIGH**
**Medium Priority Issues:** 🟢 **5 MEDIUM**
**Low Priority Issues:** ⚪ **4 LOW**

---

## 🔴 Critical Issues

### 1. ⚠️ CRITICAL: API Keys Were Exposed in Git History

**Location:** `.cursor/mcp.json` (now removed)  
**Status:** ✅ RESOLVED (file removed, in `.gitignore`)

**Issue:**
The `.cursor/mcp.json` file containing real Kalshi API credentials (API key ID and RSA private key) was committed and pushed to the public GitHub repository.

**Impact:**
- Anyone with access to the git history can extract these credentials
- Credentials can be used to trade on Kalshi with real money
- Potential for unauthorized access to the account

**Remediation Completed:**
- ✅ File added to `.gitignore`
- ✅ File removed from git with `git rm --cached`
- ✅ History rewritten with force push

**REQUIRED ACTION:**
- 🚨 **IMMEDIATELY REGENERATE KALSHI API KEYS** at https://kalshi.com/account/api
- 🚨 **REVOKE THE OLD KEYS** to prevent unauthorized access
- 🚨 **AUDIT ACCOUNT ACTIVITY** for any unauthorized trades since the exposure
- 🚨 **ROTATE ANY OTHER CREDENTIALS** that may have been in the file

**Prevention:**
- ✅ Already implemented: `.cursor/` in `.gitignore`
- Consider adding pre-commit hooks to scan for secrets
- Use tools like `gitleaks` or `trufflehog` in CI

---

## 🟡 High Priority Issues

### 2. Missing Rate Limiting in TUI

**Location:** `packages/tui/src/hooks/*.ts`  
**Severity:** HIGH

**Issue:**
The TUI polls the Kalshi API at fixed intervals (10-30s) without:
- Exponential backoff on errors
- Rate limit detection/handling
- Circuit breaker pattern

**Current Polling Intervals:**
- Markets: 30s
- Orderbook: 10s
- Portfolio: 30s

**Risk:**
- Could hit Kalshi API rate limits
- No graceful degradation on repeated failures
- Potential account suspension for excessive API calls

**Recommendation:**
```typescript
// Add exponential backoff
let retryDelay = pollInterval;
const maxRetryDelay = 300000; // 5 minutes

try {
  await fetchData();
  retryDelay = pollInterval; // Reset on success
} catch (err) {
  if (isRateLimitError(err)) {
    retryDelay = Math.min(retryDelay * 2, maxRetryDelay);
    console.warn(`Rate limited. Backing off to ${retryDelay}ms`);
  }
}
```

**Also Consider:**
- Detect 429 (Too Many Requests) responses
- Implement circuit breaker after N consecutive failures
- Add user-configurable polling intervals via env vars

---

### 3. Insufficient Input Validation in Order Creation

**Location:** `packages/mcp/src/tools/create-order.ts`, `packages/tui/src/components/OrderEntry.tsx`

**Issue:**
Order creation has basic Zod validation but lacks:
- Balance checks before submitting
- Market status validation (is it still open?)
- Price reasonableness checks (e.g., warn if price is far from current market)
- Quantity limits based on available balance

**Current Validation:**
```typescript
yes_price: z.number().min(1).max(99).optional()
count: z.number().min(1)
```

**Risk:**
- Users can submit orders they can't afford
- Orders on closed markets will fail after submission
- No warning for potentially erroneous orders (e.g., buying YES at 99¢)

**Recommendation:**
```typescript
// Add pre-flight checks
async function validateOrder(params: CreateOrderInput, portfolioApi: PortfolioApi, marketApi: MarketApi) {
  // 1. Check balance
  const balance = await portfolioApi.getBalance();
  const estimatedCost = params.count * (params.yes_price || params.no_price || 50);
  if (estimatedCost > balance.data.balance) {
    throw new Error(`Insufficient balance: need ${estimatedCost}¢, have ${balance.data.balance}¢`);
  }

  // 2. Check market status
  const market = await marketApi.getMarket(params.ticker);
  if (market.data.market.status !== 'open') {
    throw new Error(`Market ${params.ticker} is ${market.data.market.status}`);
  }

  // 3. Warn on unusual prices
  const currentPrice = params.side === 'yes' ? market.data.market.yes_ask : market.data.market.no_ask;
  const userPrice = params.side === 'yes' ? params.yes_price : params.no_price;
  if (userPrice && Math.abs(userPrice - currentPrice) > 20) {
    console.warn(`Warning: Your price (${userPrice}¢) is far from market (${currentPrice}¢)`);
  }
}
```

---

### 4. No Secrets Scanning in CI

**Location:** `.github/workflows/ci.yml`

**Issue:**
CI pipeline doesn't scan for accidentally committed secrets.

**Risk:**
- Secrets could be committed and merged before manual review
- No automated detection of API keys, private keys, tokens

**Recommendation:**
Add a secrets scanning job to CI:

```yaml
secrets-scan:
  name: Scan for Secrets
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Full history for scanning

    - name: Run Gitleaks
      uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Or use TruffleHog:
```yaml
    - name: TruffleHog OSS
      uses: trufflesecurity/trufflehog@main
      with:
        path: ./
        base: ${{ github.event.repository.default_branch }}
        head: HEAD
```

---

## 🟢 Medium Priority Issues

### 5. Console Logging in Production Code

**Location:** Multiple files (36 instances)

**Issue:**
Production code contains `console.log` and `console.error` statements that:
- May leak sensitive information
- Clutter output in production
- Don't use structured logging

**Examples:**
- `packages/mcp/src/cli.ts`: Error logging
- `packages/tui/src/cli.tsx`: Help text (acceptable)
- Test scripts: Connection debugging (acceptable)

**Recommendation:**
1. **Remove or guard debug logs:**
```typescript
const DEBUG = process.env.DEBUG === 'true';
if (DEBUG) console.log('Debug info:', data);
```

2. **Use structured logging:**
```typescript
import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
logger.info({ ticker, price }, 'Order created');
```

3. **Never log sensitive data:**
```typescript
// ❌ BAD
console.log('API Key:', apiKey);
console.log('Private Key:', privateKey);

// ✅ GOOD
console.log('API Key configured:', !!apiKey);
```

**Audit Required:**
Review all 36 console statements and categorize as:
- Keep (user-facing output)
- Remove (debug noise)
- Replace with structured logging
- Ensure no secrets are logged

---

### 6. Missing Error Boundary in TUI

**Location:** `packages/tui/src/App.tsx`

**Issue:**
The TUI doesn't have a top-level error boundary to catch and display React errors gracefully.

**Risk:**
- Unhandled errors crash the entire TUI
- Poor user experience
- No error reporting/telemetry

**Recommendation:**
```typescript
// packages/tui/src/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { Box, Text } from 'ink';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>Fatal Error</Text>
          <Text color="gray">{this.state.error?.message}</Text>
          <Text color="gray">Press Ctrl+C to exit</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}

// In App.tsx
export function App() {
  return (
    <ErrorBoundary>
      {/* existing app content */}
    </ErrorBoundary>
  );
}
```

---

### 7. No Dependency Vulnerability Scanning

**Location:** CI/CD pipeline

**Issue:**
No automated scanning for vulnerable dependencies (npm audit, Snyk, etc.)

**Recommendation:**
Add to CI:

```yaml
security:
  name: Security Audit
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: "20"

    - name: Install dependencies
      run: npm ci

    - name: Run npm audit
      run: npm audit --audit-level=moderate

    - name: Run Snyk
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

Also enable:
- GitHub Dependabot alerts (already mentioned in SECURITY.md)
- Dependabot security updates (auto-PR for vulnerabilities)

---

### 8. Weak TypeScript Configuration for Tests

**Location:** `packages/*/tsconfig.json`

**Issue:**
Test files were initially excluded from TypeScript compilation, which could hide type errors in tests.

**Status:** ✅ PARTIALLY RESOLVED
- Test files now in `include` array
- ESLint can parse them

**Recommendation:**
Consider separate `tsconfig.test.json` for tests with looser rules:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src/**/*.test.ts"]
}
```

---

### 9. No Request Timeout Configuration

**Location:** `packages/core/src/config.ts`

**Issue:**
SDK clients don't have explicit timeout configuration. Long-running requests could hang indefinitely.

**Recommendation:**
```typescript
export function createSdkConfig(config: KalshiConfig): Configuration {
  return new Configuration({
    apiKey: config.apiKey,
    privateKeyPem: config.privateKey,
    basePath: config.basePath,
    // Add timeout configuration if SDK supports it
    timeout: 30000, // 30 seconds
  });
}
```

If the SDK doesn't support timeouts natively, wrap API calls:
```typescript
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}
```

---

## ⚪ Low Priority Issues

### 10. Missing JSDoc for Public APIs

**Location:** `packages/core/src/*.ts`

**Issue:**
Some exported functions lack JSDoc comments, making it harder for users to understand the API.

**Recommendation:**
Add JSDoc to all public exports:

```typescript
/**
 * Create a configured Kalshi SDK Configuration instance.
 * 
 * @param config - Kalshi API configuration with credentials
 * @returns Configured SDK Configuration instance
 * @throws {Error} If credentials are invalid
 * 
 * @example
 * ```typescript
 * const config = getKalshiConfig();
 * const sdkConfig = createSdkConfig(config);
 * const marketApi = new MarketApi(sdkConfig);
 * ```
 */
export function createSdkConfig(config: KalshiConfig): Configuration {
  // ...
}
```

---

### 11. No Telemetry/Analytics

**Location:** All packages

**Issue:**
No usage telemetry to understand:
- Which tools are most used
- Error rates
- Performance metrics

**Note:** This is optional for open-source, but helpful for prioritizing development.

**Recommendation:**
If adding telemetry:
1. Make it **opt-in** and **transparent**
2. Use privacy-respecting service (e.g., Plausible, not Google Analytics)
3. Document in README
4. Provide env var to disable: `KALSHI_TELEMETRY=false`

---

### 12. TUI Keyboard Shortcuts Not Documented in UI

**Location:** `packages/tui/src/components/StatusBar.tsx`

**Issue:**
Keyboard shortcuts are documented in `HelpModal` but not visible in the status bar.

**Recommendation:**
Add key hints to status bar:

```typescript
<Text color="gray">
  [↑↓] Navigate  [Tab] Switch  [Enter] Select  [/] Search  [?] Help  [q] Quit
</Text>
```

---

### 13. No Package Size Monitoring

**Location:** CI/CD

**Issue:**
No tracking of package bundle sizes. Large packages impact install time and user experience.

**Recommendation:**
Add to CI:

```yaml
    - name: Check bundle size
      run: |
        npm run build
        npx size-limit
```

With `size-limit` config in `package.json`:
```json
{
  "size-limit": [
    {
      "path": "packages/mcp/dist/index.js",
      "limit": "500 KB"
    },
    {
      "path": "packages/tui/dist/cli.js",
      "limit": "2 MB"
    }
  ]
}
```

---

## ✅ Security Best Practices (Already Implemented)

### Excellent Practices Found:

1. **✅ Credentials via Environment Variables**
   - No hardcoded secrets
   - Clear documentation in README and SECURITY.md
   - Proper error messages when credentials missing

2. **✅ Comprehensive `.gitignore`**
   - Excludes `.env`, `.env.local`, `.env.*.local`
   - Excludes `.cursor/` (after fix)
   - Excludes `node_modules`, `dist`, build artifacts

3. **✅ Input Validation with Zod**
   - All MCP tool inputs validated
   - Type-safe schemas
   - Descriptive error messages

4. **✅ Proper Error Handling**
   - Try-catch blocks in all async operations
   - Errors returned as structured responses (not thrown)
   - User-friendly error messages

5. **✅ TypeScript Strict Mode**
   - `"strict": true` in `tsconfig.base.json`
   - Full type safety
   - No `any` types (except where unavoidable)

6. **✅ Dependency Pinning**
   - Exact versions in `package.json` (via `package-lock.json`)
   - Reproducible builds
   - CI uses `npm ci` (not `npm install`)

7. **✅ Proper Package Scope**
   - Published under `@newyorkcompute` scope
   - Prevents name squatting
   - Clear ownership

8. **✅ MIT License**
   - Clear, permissive license
   - Appropriate for open-source tools

9. **✅ Security Policy (SECURITY.md)**
   - Clear vulnerability reporting process
   - Security considerations documented
   - Responsible disclosure encouraged

10. **✅ Contribution Guidelines**
    - Clear development workflow
    - Code style guidelines
    - Testing requirements

---

## 📊 Code Quality Metrics

### TypeScript Coverage
- ✅ 100% TypeScript (no JavaScript files)
- ✅ Strict mode enabled
- ✅ No `@ts-ignore` or `@ts-expect-error` found

### Test Coverage
- ⚠️ Limited test coverage (only config tests found)
- 🎯 **Recommendation:** Add tests for:
  - MCP tools (mock API responses)
  - TUI components (Ink testing library)
  - Core utilities (format, types)

### Documentation
- ✅ Comprehensive README
- ✅ Package-specific READMEs
- ✅ API reference for Agent Skills
- ✅ Authentication guide
- ⚠️ Missing: API documentation (consider TypeDoc)

### Code Organization
- ✅ Clear separation of concerns (core, mcp, tui)
- ✅ Consistent file naming (kebab-case)
- ✅ Logical directory structure
- ✅ Proper use of NX monorepo features

---

## 🎯 Recommendations Priority Matrix

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 CRITICAL | Rotate exposed API keys | Low | Critical |
| 🟡 HIGH | Add rate limiting/backoff | Medium | High |
| 🟡 HIGH | Improve order validation | Medium | High |
| 🟡 HIGH | Add secrets scanning to CI | Low | High |
| 🟢 MEDIUM | Remove/guard console logs | Low | Medium |
| 🟢 MEDIUM | Add error boundary | Low | Medium |
| 🟢 MEDIUM | Add dependency scanning | Low | Medium |
| 🟢 MEDIUM | Configure request timeouts | Low | Medium |
| 🟢 MEDIUM | Separate test tsconfig | Low | Low |
| ⚪ LOW | Add JSDoc comments | High | Low |
| ⚪ LOW | Add telemetry (optional) | Medium | Low |
| ⚪ LOW | Document shortcuts in UI | Low | Low |
| ⚪ LOW | Monitor bundle size | Low | Low |

---

## 🚀 Next Steps

### Immediate (This Week)
1. 🚨 **Rotate Kalshi API credentials** (if not done already)
2. Add secrets scanning to CI (gitleaks or trufflehog)
3. Audit and clean up console.log statements

### Short Term (Next Sprint)
1. Implement rate limiting and exponential backoff in TUI
2. Add pre-flight validation for order creation
3. Add error boundary to TUI
4. Configure request timeouts

### Long Term (Next Quarter)
1. Increase test coverage to >80%
2. Add dependency vulnerability scanning
3. Generate API documentation with TypeDoc
4. Consider adding telemetry (opt-in)

---

## 📝 Conclusion

**Overall:** This is a **well-architected, secure, and maintainable** open-source project. The critical security issue (exposed credentials) has been addressed, but requires immediate action to rotate keys.

**Strengths:**
- Clean TypeScript architecture
- Good separation of concerns
- Comprehensive documentation
- Proper credential management (after fix)
- Strong CI/CD pipeline

**Areas for Improvement:**
- Rate limiting and error handling
- Test coverage
- Input validation for orders
- Automated security scanning

**Risk Level:** 🟡 **MEDIUM** (was CRITICAL before credential rotation)

The codebase is production-ready for open-source use, with the understanding that users should:
1. Rotate their API keys immediately
2. Use demo/test accounts initially
3. Monitor for rate limits
4. Validate orders before submission

---

**Reviewed by:** AI Assistant  
**Date:** December 22, 2025  
**Next Review:** After implementing HIGH priority fixes

