# Testing Patterns

**Analysis Date:** 2026-03-12

## Test Framework

**Runner:**
- No automated test framework configured (no Jest, Vitest, Mocha, or Playwright)
- No test runner in `package.json` scripts: only `build`, `start`, and `dev`
- No test files exist in project source (`*.test.*` and `*.spec.*` found only in `node_modules/`)

**Assertion Library:**
- None configured

**Run Commands:**
```bash
# No test commands defined in package.json
npm run build              # TypeScript compilation (the only validation step)
```

## Test File Organization

**Location:**
- No test files exist in the project source tree
- No `__tests__/` or `test/` directories

**Naming:**
- No convention established (no test files to reference)

## Validation Scripts (Manual/Integration Testing)

The project uses shell/Node.js validation scripts in lieu of a test suite. These scripts perform end-to-end validation against the running MCP server process.

**Scripts Location:** `scripts/`

**Available Validation Scripts:**

| Script | Purpose | How It Works |
|--------|---------|-------------|
| `scripts/validate-boot.sh` | Phase 6 boot validation | Wraps `scripts/validate-boot.mjs` |
| `scripts/validate-api.sh` | API connectivity validation | Wraps `scripts/validate-api.mjs` |
| `scripts/validate-persistence.sh` | Database/snapshot validation | Wraps a Node.js script |
| `scripts/validate-deployment.sh` | Deployment validation | Wraps a Node.js script |
| `scripts/validate-messaging.sh` | Messaging integration validation | Wraps a Node.js script |

**Run Validation:**
```bash
# Boot validation (BOOT-01 through SAFE-01)
bash scripts/validate-boot.sh

# API validation
bash scripts/validate-api.sh
```

## Validation Script Structure

**Pattern (`scripts/validate-boot.mjs`):**

The validation scripts follow a consistent pattern:

```typescript
// 1. Spawn MCP server as child process with test env
serverProcess = spawn("node", ["dist/index.js"], {
  cwd: mcpDir,
  env: {
    ...process.env,
    PRICELABS_API_KEY: "test-key-for-validation",
    PRICELABS_DB_PATH: dbPath,
  },
  stdio: ["pipe", "pipe", "pipe"],
});

// 2. Send JSON-RPC requests via stdin
function sendJsonRpc(proc, message) {
  proc.stdin.write(JSON.stringify(message) + "\n");
}

// 3. Wait for JSON-RPC responses via stdout with timeout
function waitForResponse(proc, id, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    // Parse newline-delimited JSON from stdout
    // Match response by id
    // Timeout with clear error message
  });
}

// 4. Assert with pass/fail output
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}`);
    failures++;
  }
}

// 5. Cleanup: kill server, remove temp files
```

**What Boot Validation Checks (4 requirement groups):**
- **BOOT-01:** `npm run build` exits with code 0, server responds to MCP `initialize` handshake
- **BOOT-02:** SQLite database file exists, all 7 tables created (listing_snapshots, price_snapshots, reservations, audit_log, market_snapshots, change_tracking, user_config)
- **BOOT-03:** `tools/list` returns exactly 28 tools
- **SAFE-01:** 3 write tools (`pricelabs_set_overrides`, `pricelabs_delete_overrides`, `pricelabs_update_listings`) return `isError: true` with "Write operations are disabled" message when `PRICELABS_WRITES_ENABLED` is not set

## Mocking

**Framework:** None

**Patterns:**
- No mocking framework is used
- Validation scripts use real (but isolated) infrastructure:
  - Temp SQLite database created in OS temp directory
  - Fake API key (`"test-key-for-validation"`) that will fail on actual API calls
  - MCP server spawned as a real child process

**What to Mock (guidance for future test implementation):**
- `fetch()` global for API client tests (the codebase uses Node 22 built-in fetch, no HTTP library)
- `Date.now()` for cache TTL and rate limiter tests
- `better-sqlite3` `Database` for query unit tests
- `TokenBucketRateLimiter.tryConsume()` for testing rate limit fallback behavior

**What NOT to Mock:**
- Zod schema validation (test with real schemas)
- Computed field functions (`computeListingFields`, `computePriceFields`) -- these are pure functions, test directly
- Error classification (`isRetryable`) -- pure function, test directly

## Fixtures and Factories

**Test Data:**
- No test fixtures or factories exist
- Validation scripts use inline test data:

```typescript
// Example from validate-boot.mjs
const writeToolTests = [
  {
    name: "pricelabs_set_overrides",
    args: {
      listing_id: "test-listing",
      pms: "test-pms",
      overrides: [{ date: "2025-01-01", price_type: "percentage", price_value: 10 }],
      reason: "boot validation test run",
    },
  },
];
```

**Location:**
- No dedicated fixtures directory

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# No coverage tool configured
```

## Test Types

**Unit Tests:**
- Not implemented
- High-value targets for unit tests:
  - `mcp-servers/pricelabs/src/computed-fields.ts` -- pure functions, edge cases around null/undefined/NaN inputs
  - `mcp-servers/pricelabs/src/errors.ts` -- `isRetryable()` classification
  - `mcp-servers/pricelabs/src/services/rate-limiter.ts` -- token bucket math, refill timing
  - `mcp-servers/pricelabs/src/services/cache.ts` -- TTL expiration, invalidation, stats

**Integration Tests:**
- Partially implemented via validation scripts in `scripts/`
- `scripts/validate-boot.mjs` tests the full MCP server lifecycle (spawn, initialize, tool list, write safety gate)
- These are run manually, not in CI

**E2E Tests:**
- Not implemented
- `scripts/validate-api.sh` appears to test against the real PriceLabs API
- `scripts/messaging-test-checklist.md` documents manual testing procedures

## Common Patterns

**Async Testing (validation scripts):**
```javascript
// Top-level await in .mjs files
const initResponse = await waitForResponse(serverProcess, 1, 10000);
check("Server responds to initialize", !!initResponse.result);
```

**Error Testing (validation scripts):**
```javascript
// Assert write tools return disabled error
const callResponse = await waitForResponse(serverProcess, writeId, 10000);
const content = callResponse.result?.content || [];
const textContent = content.map((c) => c.text || "").join(" ");
const isError = callResponse.result?.isError === true;
const hasDisabledMsg = textContent.includes("Write operations are disabled");

check(
  `${test.name} returns disabled error`,
  isError && hasDisabledMsg,
  isError ? "isError=true" : "isError=false",
);
```

## Recommendations for Test Implementation

If adding a test framework, the following approach would align with existing conventions:

**Recommended Framework:** Vitest (ESM-native, TypeScript support, compatible with NodeNext module resolution)

**Config Location:** `mcp-servers/pricelabs/vitest.config.ts`

**Test File Location:** Co-located with source files
```
mcp-servers/pricelabs/src/
  services/
    cache.ts
    cache.test.ts
    rate-limiter.ts
    rate-limiter.test.ts
  computed-fields.ts
  computed-fields.test.ts
  errors.ts
  errors.test.ts
```

**Package.json Script:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Highest-value tests to add first:**
1. `computed-fields.test.ts` -- pure functions with many null/edge cases
2. `errors.test.ts` -- `isRetryable()` with all error types
3. `services/cache.test.ts` -- TTL, invalidation, stats
4. `services/rate-limiter.test.ts` -- token bucket refill math
5. `services/fetch-with-fallback.test.ts` -- fallback behavior (requires fetch mock)

---

*Testing analysis: 2026-03-12*
