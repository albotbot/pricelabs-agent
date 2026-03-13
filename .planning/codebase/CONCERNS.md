# Codebase Concerns

**Analysis Date:** 2026-03-12

## Tech Debt

**Compiled `dist/` Directory Committed to Git:**
- Issue: The entire `mcp-servers/pricelabs/dist/` directory (compiled JS + declaration files) is tracked in git. This means every source change requires a manual rebuild + commit of dist, and pull diffs are inflated with generated code.
- Files: `mcp-servers/pricelabs/dist/**/*.js`, `mcp-servers/pricelabs/dist/**/*.d.ts`
- Impact: Merge conflicts in generated files, risk of source/dist drift (forgetting to rebuild), bloated repository history. Currently 40+ generated files tracked.
- Fix approach: Add `mcp-servers/pricelabs/dist/` to `.gitignore`, remove from git tracking with `git rm -r --cached`, and add a build step to the deployment pipeline (OpenClaw gateway spawns `node dist/index.js` so dist must exist at runtime -- ensure `npm run build` runs before deploy).

**Duplicated Error Formatting Functions Across Tool Files:**
- Issue: `formatErrorResponse()` is copy-pasted across 5 tool files (`listings.ts`, `rate-plans.ts`, `neighborhood.ts`, `reservations.ts`, `snapshots.ts`) with identical logic. `formatWriteErrorResponse()` is duplicated across `listings.ts` and `sync.ts`.
- Files: `mcp-servers/pricelabs/src/tools/listings.ts` (lines 226-278), `mcp-servers/pricelabs/src/tools/rate-plans.ts` (lines 83-106), `mcp-servers/pricelabs/src/tools/neighborhood.ts` (lines 106-129), `mcp-servers/pricelabs/src/tools/reservations.ts` (lines 94-117), `mcp-servers/pricelabs/src/tools/snapshots.ts` (lines 379-395), `mcp-servers/pricelabs/src/tools/sync.ts` (lines 178-204)
- Impact: Any error message change must be repeated in 5+ files. Risk of divergence between tool files (different error messages for the same error type). Current implementations are already slightly inconsistent -- `snapshots.ts` returns JSON-wrapped errors while `listings.ts` returns plain text errors.
- Fix approach: Extract shared `formatErrorResponse()` and `formatWriteErrorResponse()` into a `mcp-servers/pricelabs/src/utils/error-format.ts` module. Import in each tool file. Decide on a single error response format (JSON-wrapped vs plain text).

**Inconsistent Tool Registration API Usage:**
- Issue: Some tools use `server.registerTool()` (newer API) while others use `server.tool()` (older convenience API). For example, `overrides.ts` and `prices.ts` use `server.tool()`, while `listings.ts`, `snapshots.ts`, `monitoring.ts`, `analysis.ts`, `scale.ts`, `optimization.ts`, `audit.ts`, `status.ts`, `rate-plans.ts`, and `reservations.ts` use `server.registerTool()`.
- Files: `mcp-servers/pricelabs/src/tools/overrides.ts` (line 60), `mcp-servers/pricelabs/src/tools/prices.ts` (line 43) vs all other tool files
- Impact: The two APIs have different parameter signatures: `server.tool()` takes positional args (name, description, schema, annotations, handler) while `server.registerTool()` takes (name, options, handler). This makes the codebase inconsistent and harder to maintain.
- Fix approach: Standardize on `server.registerTool()` throughout. Update `overrides.ts` and `prices.ts` to match the pattern used in all other tool files.

**No Linting or Formatting Tooling Configured:**
- Issue: No ESLint, Prettier, Biome, or any other linting/formatting tool is configured anywhere in the project. The only code quality enforcement is TypeScript's `strict: true` mode.
- Files: `mcp-servers/pricelabs/tsconfig.json`, `mcp-servers/pricelabs/package.json` (no lint/format scripts)
- Impact: No automated enforcement of code style, import order, or common error patterns. Relies entirely on the developer (or AI agent) to maintain consistency manually.
- Fix approach: Add ESLint + Prettier or Biome to `mcp-servers/pricelabs/package.json` devDependencies. Add `lint` and `format` npm scripts. Consider adding a pre-commit hook.

**Module-Level Mutable Outage Tracking State:**
- Issue: `fetch-with-fallback.ts` uses a module-level mutable variable `let firstFailureAt: number | null = null` for outage tracking. This state persists across the entire process lifetime and is shared across all concurrent calls.
- Files: `mcp-servers/pricelabs/src/services/fetch-with-fallback.ts` (line 20)
- Impact: In theory, a single transient failure on one endpoint sets the outage clock for all endpoints. The outage timer only resets when any single call succeeds. This is a reasonable simplification for a single-process MCP server but would become a bug if the server were ever scaled to handle multiple independent API contexts.
- Fix approach: Acceptable for current architecture (single process, single API key). Document the assumption. If multi-tenant support is ever needed, move outage tracking into a per-context structure.

## Known Bugs

**OpenClaw Cron Skip Bug #17852:**
- Symptoms: Cron jobs occasionally skip a scheduled run with no error logged. The daily health check or weekly optimization report simply does not fire.
- Files: `openclaw/cron/jobs.json` (all 4 cron jobs potentially affected), `.planning/STATE.md` (line 87, tracked as accumulated TODO)
- Trigger: Unknown root cause, appears to be an OpenClaw platform bug. Manifests as occasional skipped runs, not a configuration error.
- Workaround: Monitor cron runs with `openclaw cron runs --id <jobId> --limit 10`. If skips are detected, restart the gateway. This is a known issue tracked in STATE.md.

## Security Considerations

**Write Safety Gate Missing on `push_prices` and `add_listing` Tools:**
- Risk: The `pricelabs_push_prices` and `pricelabs_add_listing` tools in `sync.ts` do NOT check `PRICELABS_WRITES_ENABLED` before executing. These are destructive operations (triggering price pushes to OTAs, adding new listings) that bypass the safety gate present in `listings.ts` and `overrides.ts`.
- Files: `mcp-servers/pricelabs/src/tools/sync.ts` (entire file -- no `PRICELABS_WRITES_ENABLED` check)
- Current mitigation: The OpenClaw gateway config sets `PRICELABS_WRITES_ENABLED=false` by default in `openclaw/openclaw.json` (line 69), and the tools are sandboxed via OpenClaw agent tool permissions. However, the MCP server itself does not enforce the gate for these two tools.
- Recommendations: Add the same `PRICELABS_WRITES_ENABLED` check to `pricelabs_push_prices` and `pricelabs_add_listing` handlers in `sync.ts`, matching the pattern in `listings.ts` (line 166-177) and `overrides.ts` (lines 125-136, 341-352).

**API Key Passed in Header Without Encryption:**
- Risk: The PriceLabs API key is sent as a plain `X-API-Key` header on every HTTP request. This is standard for API key auth, but the key value is stored in the `PriceLabsApiClient` instance for the entire process lifetime.
- Files: `mcp-servers/pricelabs/src/services/api-client.ts` (lines 39-43)
- Current mitigation: API key is loaded from environment variable only (never hardcoded), never logged or included in error messages, and redacted in OpenClaw logging config (`openclaw/openclaw.json` lines 97-103). The `secrets/` directory exists in `.gitignore`.
- Recommendations: Current approach is adequate. Ensure `PRICELABS_API_KEY` is rotated periodically and never committed to git.

**Untyped `unknown` Response Bodies in Some Tools:**
- Risk: Several tools use `unknown` as the response type from `apiClient.get<unknown>()` or `apiClient.post<unknown>()`, meaning the API response body is not validated. If the PriceLabs API changes its response format, the server will silently pass through malformed data.
- Files: `mcp-servers/pricelabs/src/tools/rate-plans.ts` (line 61 -- `apiClient.get<unknown>`), `mcp-servers/pricelabs/src/tools/sync.ts` (lines 59, 130 -- `apiClient.post<unknown>`)
- Current mitigation: Zod schemas exist for most response types in `mcp-servers/pricelabs/src/schemas/common.ts`, but they are only used for type inference, not runtime validation of API responses.
- Recommendations: Apply Zod `.parse()` or `.safeParse()` to API responses at the boundary. Start with write tool responses (`sync.ts`) since incorrect data there has the highest impact.

## Performance Bottlenecks

**In-Memory Cache Without Size Bounds:**
- Problem: The `TtlCache` class uses an unbounded `Map<string, CacheEntry>`. There is no maximum size limit, and expired entries are only cleaned on access (lazy eviction) or when `getStats()` is called.
- Files: `mcp-servers/pricelabs/src/services/cache.ts` (entire class)
- Cause: The cache grows with every unique cache key. For example, `prices:${listing_id}:${pms}:${start_date}:${end_date}` creates a new key for every unique date range query. Over time, this can lead to memory growth.
- Improvement path: Add a `maxEntries` constructor parameter. When the limit is hit, evict the oldest or least recently used entry. For the current small portfolio use case (a handful of listings), this is unlikely to be a problem, but it becomes an issue if the portfolio scales to hundreds of listings.

**Unbounded Database Growth -- No Data Retention Policy:**
- Problem: Snapshot tables (`listing_snapshots`, `price_snapshots`, `market_snapshots`), `audit_log`, `change_tracking`, and `reservations` grow indefinitely. There is no cleanup, archival, or retention limit.
- Files: `mcp-servers/pricelabs/src/db/migrations.ts` (all table definitions), all query modules in `mcp-servers/pricelabs/src/db/queries/`
- Cause: Daily snapshots insert rows per listing per day. With 5 listings and 365 days of price data per listing per day, `price_snapshots` grows by ~1,825 rows/day. After a year, that is ~666,000 rows. The audit log grows with every agent action.
- Improvement path: Add a migration (v8) that creates a scheduled cleanup mechanism -- either a `DELETE FROM price_snapshots WHERE snapshot_date < date('now', '-90 days')` style query exposed as an MCP tool, or an automatic cleanup in `runMigrations()`. Consider 90-day retention for snapshots and 365-day for audit logs.

**`data_json` TEXT Columns Store Full API Response Blobs:**
- Problem: `listing_snapshots.data_json`, `market_snapshots.data_json`, and `reservations.data_json` store the full raw API response as JSON text. This duplicates all the extracted structured columns AND stores additional nested data.
- Files: `mcp-servers/pricelabs/src/db/migrations.ts` (lines 55, 114, 166)
- Cause: Design decision for maximum flexibility -- keeps the full response for future analysis without needing new migrations.
- Improvement path: Acceptable for small portfolios. For scale, consider compressing `data_json` with zlib before storage, or dropping it entirely since the extracted columns already capture the important fields. This would reduce database size by approximately 60-70%.

**Market Position Query Uses Correlated Subquery:**
- Problem: `getMarketPosition` in `analysis.ts` uses a correlated subquery `WHERE m.snapshot_date = (SELECT MAX(snapshot_date) FROM market_snapshots WHERE listing_id = l.listing_id AND pms = l.pms)` which executes a subquery per listing.
- Files: `mcp-servers/pricelabs/src/db/queries/analysis.ts` (lines 159-182)
- Cause: Finding the latest market snapshot per listing requires per-listing max lookup.
- Improvement path: For a handful of listings this is fine (SQLite handles it in microseconds). If the portfolio grows, pre-compute the latest snapshot_date per listing using a CTE or a materialized view.

## Fragile Areas

**Demand Color Hex-to-Label Mapping:**
- Files: `mcp-servers/pricelabs/src/computed-fields.ts` (lines 5-16)
- Why fragile: The `DEMAND_COLOR_MAP` is a hardcoded mapping of 5 hex color values to demand labels. If PriceLabs adds, changes, or removes demand colors, the mapping silently returns `null` (falls back to `demand_desc`). The ARGB handling (9-char hex, line 140-142) was added as a patch after discovering the API sometimes returns alpha-prefixed hex values.
- Safe modification: Add new colors to `DEMAND_COLOR_MAP`. The fallback to `demand_desc` is robust. Test with real API data after any color changes.
- Test coverage: None -- no automated tests exist in this codebase.

**Reservation Cancellation Detection Logic:**
- Files: `mcp-servers/pricelabs/src/db/queries/reservations.ts` (lines 97-113), `mcp-servers/pricelabs/src/tools/snapshots.ts` (lines 214-217)
- Why fragile: Cancellation detection compares `booking_status` changes during upsert using SQL CASE expressions. The string comparison `excluded.booking_status = 'cancelled' AND reservations.booking_status != 'cancelled'` is case-sensitive and exact-match. If PriceLabs returns "Cancelled" (capitalized) or "CANCELLED", the detection silently fails.
- Safe modification: Normalize `booking_status` to lowercase before upsert. Add a `COLLATE NOCASE` clause to the SQL comparison.
- Test coverage: None.

**PriceLabs API Response Shape Assumptions:**
- Files: `mcp-servers/pricelabs/src/tools/listings.ts` (lines 77-81, 125-132), `mcp-servers/pricelabs/src/tools/prices.ts` (lines 78-83), `mcp-servers/pricelabs/src/tools/overrides.ts` (lines 83-88)
- Why fragile: All API tool handlers assume specific response wrapping patterns: `{ listings: [...] }`, `{ overrides: [...] }`, or array responses. These assumptions are based on the current PriceLabs API v1 spec but are not validated at runtime. If the API adds a top-level `error` key or changes its wrapper, the destructuring will return `undefined` and the tool will fail with an opaque error.
- Safe modification: Add Zod runtime validation at the API response boundary. The schemas in `mcp-servers/pricelabs/src/schemas/common.ts` already define the expected shapes but are only used for TypeScript types, not runtime checks.
- Test coverage: None.

**Schema Passthrough for `max` Field:**
- Files: `mcp-servers/pricelabs/src/schemas/common.ts` (line 78)
- Why fragile: `max: z.unknown().nullable().optional()` uses `z.unknown()` because PriceLabs returns `max` as either a number or an object depending on the listing configuration. This means the field bypasses all type checking and could be anything.
- Safe modification: Investigate actual API responses to determine the discriminated union shape, then use `z.union([z.number(), z.object({...})])` with the real shape.
- Test coverage: None.

## Scaling Limits

**In-Process Rate Limiter (Single Process Only):**
- Current capacity: 1000 API calls per hour per process.
- Limit: The `TokenBucketRateLimiter` is in-process memory only (`mcp-servers/pricelabs/src/services/rate-limiter.ts`). If multiple MCP server instances run concurrently (e.g., multiple OpenClaw agents), each maintains its own token bucket and the aggregate could exceed the PriceLabs API limit.
- Scaling path: For multi-instance deployments, move rate limiting to a shared store (Redis) or use a distributed token bucket. The current single-instance OpenClaw deployment makes this a non-issue.

**SQLite Single-Writer Bottleneck:**
- Current capacity: Single-process writes are fast (WAL mode, busy_timeout = 5000ms).
- Limit: SQLite allows only one writer at a time. If multiple MCP tool calls attempt concurrent writes (e.g., storing snapshots for multiple listings simultaneously), they will serialize on the write lock.
- Scaling path: For the current use case (cron-triggered daily snapshots), this is not a bottleneck. For real-time high-throughput scenarios, consider PostgreSQL. The `better-sqlite3` library is synchronous, which actually simplifies this -- Node.js single-thread means writes are already serialized.

**PriceLabs API Pagination Not Handled:**
- Current capacity: Works for portfolios where a single API call returns all data.
- Limit: The `pricelabs_get_reservations` tool response includes a `next_page: boolean` field (`mcp-servers/pricelabs/src/schemas/common.ts` line 201), but no tool implements automatic pagination. If the reservation dataset exceeds a single page, data is silently truncated.
- Scaling path: Implement pagination loop in `mcp-servers/pricelabs/src/tools/reservations.ts` -- check `next_page` flag and issue follow-up requests with `offset` parameter. This is tracked as an accumulated TODO in `.planning/STATE.md` (line 88).

## Dependencies at Risk

**`better-sqlite3` Native Add-on:**
- Risk: Native Node.js add-on requiring compilation during `npm install`. Sensitive to Node.js major version upgrades (prebuild binaries may not exist for new Node versions).
- Impact: Build failures on deployment if Node.js is upgraded without verifying `better-sqlite3` compatibility. Currently on `^12.6.2` with Node 22.
- Migration plan: None needed currently -- `better-sqlite3` is actively maintained and supports Node 22. Monitor for breaking changes on Node.js major version bumps.

**`@modelcontextprotocol/sdk` Version Pinning:**
- Risk: Using `^1.26.0` (caret range). The MCP SDK is still evolving rapidly. The codebase already shows API inconsistency between `server.tool()` and `server.registerTool()` which likely reflects SDK API changes across versions.
- Impact: A patch/minor update could change tool registration behavior or type signatures.
- Migration plan: Consider pinning to an exact version in `package.json`. Test SDK upgrades explicitly before deploying.

## Missing Critical Features

**Zero Automated Tests:**
- Problem: The entire MCP server codebase (6,469 lines of TypeScript across 42 source files) has zero test files. No unit tests, no integration tests, no end-to-end tests. No test framework (Jest, Vitest, etc.) is configured.
- Blocks: Cannot safely refactor any code, cannot verify behavior after dependency upgrades, cannot catch regressions. Any change to computed fields, error handling, cache logic, or database queries must be verified manually.
- Files: All files in `mcp-servers/pricelabs/src/` are untested.
- Priority: **High**. The most impactful areas to test first: (1) `computed-fields.ts` -- pure functions, easy to unit test, high business value; (2) `services/cache.ts` -- TTL logic, eviction behavior; (3) `services/rate-limiter.ts` -- token bucket math; (4) `db/queries/*.ts` -- SQL correctness with in-memory SQLite.

**No Database Backup or Recovery Mechanism:**
- Problem: The SQLite database at `~/.pricelabs-agent/data.sqlite` stores all historical snapshots, reservations, audit logs, and user configuration. There is no backup mechanism, no export tool, and no documented recovery procedure.
- Blocks: Data loss from disk failure, accidental deletion, or database corruption is unrecoverable.
- Files: `mcp-servers/pricelabs/src/services/database.ts`
- Priority: Medium. Add a periodic backup (e.g., `sqlite3 .backup` via cron or an MCP tool).

**No Health Check Endpoint:**
- Problem: The MCP server runs as a stdio process spawned by the OpenClaw gateway. There is no way to check if the server is healthy, responsive, or has a valid database connection without sending an MCP tool call.
- Blocks: Cannot implement proactive monitoring of the MCP server process health.
- Files: `mcp-servers/pricelabs/src/index.ts`
- Priority: Low. The `pricelabs_get_api_status` tool serves as a health check proxy, but it requires an active MCP session.

## Test Coverage Gaps

**Entire Codebase Is Untested:**
- What's not tested: Every module, every function, every query, every tool handler. Zero test coverage.
- Files: All 42 files in `mcp-servers/pricelabs/src/`
- Risk: Any change to business logic (computed fields, API response parsing, database queries, rate limiting, cache behavior) could introduce silent regressions. The only verification has been manual testing against the live PriceLabs API during development phases.
- Priority: **High**. Recommended test priority order:
  1. `mcp-servers/pricelabs/src/computed-fields.ts` -- Pure functions, highest ROI for testing
  2. `mcp-servers/pricelabs/src/services/rate-limiter.ts` -- Token bucket math, edge cases around refill timing
  3. `mcp-servers/pricelabs/src/services/cache.ts` -- TTL expiration, lazy cleanup, hit/miss tracking
  4. `mcp-servers/pricelabs/src/services/fetch-with-fallback.ts` -- Cache fallback paths, outage detection logic
  5. `mcp-servers/pricelabs/src/db/queries/*.ts` -- SQL correctness with in-memory SQLite fixture
  6. `mcp-servers/pricelabs/src/errors.ts` -- `isRetryable()` classification
  7. `mcp-servers/pricelabs/src/services/api-client.ts` -- Retry logic, backoff calculation, response handling

---

*Concerns audit: 2026-03-12*
