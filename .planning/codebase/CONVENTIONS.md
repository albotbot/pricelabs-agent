# Coding Conventions

**Analysis Date:** 2026-03-12

## Naming Patterns

**Files:**
- Use kebab-case for all file names: `api-client.ts`, `rate-limiter.ts`, `fetch-with-fallback.ts`, `listing-snapshots.ts`
- Schema files match their domain concept: `listings.ts`, `prices.ts`, `overrides.ts`, `analysis.ts`
- Tool files match their domain: `listings.ts`, `prices.ts`, `snapshots.ts`, `scale.ts`
- Database query modules match their table name: `listing-snapshots.ts`, `price-snapshots.ts`, `audit-log.ts`

**Functions:**
- Use camelCase for all functions: `computeListingFields`, `fetchWithFallback`, `registerListingTools`
- Tool registration functions follow the pattern `register{Domain}Tools`: `registerListingTools`, `registerPriceTools`, `registerOverrideTools`, `registerSnapshotTools`, `registerScaleTools`
- Database query factory functions follow the pattern `create{Table}Queries`: `createListingSnapshotQueries`, `createAuditLogQueries`, `createChangeTrackingQueries`
- Helper functions use descriptive verb-first names: `todayDate()`, `daysAgo(n)`, `toDateString(d)`, `addDays(base, days)`, `safeNumber(value)`, `safeJsonParse(str)`
- Error formatting helpers: `formatErrorResponse(error)`, `formatWriteErrorResponse(error)`

**Variables:**
- Use camelCase: `apiKey`, `baseUrl`, `rateLimiter`, `cacheKey`, `retryCount`
- Constants use UPPER_SNAKE_CASE: `LISTING_CACHE_TTL_MS`, `PRICES_CACHE_TTL_MS`, `RETRY_CONFIG`, `OUTAGE_ALERT_THRESHOLD_MS`, `STALE_SYNC_DAYS`
- Numeric separator underscore for large numbers: `3_600_000`, `60_000`, `300_000`

**Classes:**
- Use PascalCase: `PriceLabsApiClient`, `TokenBucketRateLimiter`, `TtlCache`
- Error classes use `{Category}Error`: `RateLimitError`, `AuthError`, `ApiError`

**Interfaces:**
- Use PascalCase with descriptive suffix: `CacheEntry<T>`, `ApiResponse<T>`, `ToolResponse<T>`
- Row interfaces: `ListingSnapshotRow`, `AuditLogRow`
- Param interfaces: `InsertListingSnapshotParams`, `InsertAuditLogParams`

**Zod Schemas:**
- PascalCase with `Schema` suffix: `GetListingsInputSchema`, `ListingResponseSchema`, `PriceEntrySchema`
- Input schemas: `{Action}{Domain}InputSchema` (e.g., `GetPricesInputSchema`, `SetOverridesInputSchema`)
- Response schemas: `{Domain}ResponseSchema` or `{Domain}EntrySchema`
- Shared primitives: `ListingIdSchema`, `PmsNameSchema`, `DateStringSchema`, `CheckInOutSchema`

**Types (inferred from Zod):**
- PascalCase without `Schema` suffix: `type GetListingsInput = z.infer<typeof GetListingsInputSchema>`
- This is a locked convention: types are always inferred from Zod schemas, never manually duplicated

**MCP Tool Names:**
- Prefix all tools with `pricelabs_`: `pricelabs_get_listings`, `pricelabs_set_overrides`, `pricelabs_store_daily_snapshots`
- Read tools: `pricelabs_get_{resource}` (e.g., `pricelabs_get_prices`, `pricelabs_get_api_status`)
- Write tools: `pricelabs_{action}_{resource}` (e.g., `pricelabs_update_listings`, `pricelabs_set_overrides`, `pricelabs_delete_overrides`)
- Store tools: `pricelabs_store_{resource}` (e.g., `pricelabs_store_daily_snapshots`, `pricelabs_store_reservations`)

## Code Style

**Formatting:**
- No explicit Prettier or ESLint config in the project root (only in node_modules)
- Consistent 2-space indentation throughout
- Trailing commas on multi-line parameter lists and array literals
- Semicolons always used
- Double quotes for strings (consistent throughout)

**Linting:**
- TypeScript strict mode enabled in `mcp-servers/pricelabs/tsconfig.json`: `"strict": true`
- No project-level ESLint config detected; relies on TypeScript compiler for type checking
- One eslint-disable comment observed for `@typescript-eslint/consistent-type-imports` in `db/queries/listing-snapshots.ts` (documented workaround for better-sqlite3 type declarations)

**TypeScript Configuration (`mcp-servers/pricelabs/tsconfig.json`):**
- Target: ES2022 (enables top-level await)
- Module: NodeNext
- Module resolution: NodeNext
- Strict: true
- esModuleInterop: true
- skipLibCheck: true

## Import Organization

**Order:**
1. External SDK imports (`@modelcontextprotocol/sdk/*`)
2. External library imports (`zod`, `better-sqlite3`, `node:*`)
3. Internal service imports (`./services/*`)
4. Internal schema/type imports (`./schemas/*`, `./types.js`, `./errors.js`)
5. Internal tool imports (`./tools/*`, `./computed-fields.js`)

**Path Conventions:**
- All internal imports use `.js` extension for ESM compatibility (even though source files are `.ts`): `import { TtlCache } from "./services/cache.js";`
- Use `type` imports when importing only types: `import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";`
- Node built-in imports use `node:` prefix: `import path from "node:path";`, `import { mkdirSync } from "node:fs";`
- better-sqlite3 uses namespace import (`import * as BetterSqlite3`) in query files due to TypeScript declaration emit requirement; documented with comment

**Path Aliases:**
- None configured. All imports use relative paths.

## Error Handling

**Custom Error Hierarchy (`mcp-servers/pricelabs/src/errors.ts`):**
- `RateLimitError extends Error` -- retryable, carries `retryAfterMs`
- `AuthError extends Error` -- NEVER retryable, immediate alert
- `ApiError extends Error` -- retryable for 5xx/429, carries `statusCode` and `body`
- Utility function `isRetryable(error)` classifies errors for retry decisions

**Tool Error Response Pattern:**
- Every tool handler wraps logic in try/catch
- Errors are formatted via local `formatErrorResponse(error)` functions (not shared -- each tool file has its own)
- Error responses return `{ content: [{ type: "text", text: message }], isError: true }`
- Read tool error messages include user-actionable next steps
- Write tool error messages confirm the write was NOT applied
- API key is NEVER exposed in error messages (security decision)

**Fallback Pattern (`mcp-servers/pricelabs/src/services/fetch-with-fallback.ts`):**
- On RateLimitError: serve cached data if available with freshness note
- On ApiError: serve cached data silently for brief outages (<30 min), alert for prolonged outages
- Module-level outage tracking via `firstFailureAt` timestamp

**Write Tool Safety Gates:**
- All write tools check `process.env.PRICELABS_WRITES_ENABLED === "true"` before executing
- If not enabled, return error: `"Write operations are disabled. Set PRICELABS_WRITES_ENABLED=true to enable."`
- This pattern is duplicated in each write tool handler (`listings.ts`, `overrides.ts`)

## Logging

**Framework:** `console.error` only (stderr)

**Patterns:**
- No logging framework; the MCP server communicates via stdio (stdout) and uses stderr only for fatal errors
- `console.error("FATAL: ...")` for environment validation failures at startup
- `console.error("Uncaught exception:", ...)` for process-level error handlers
- Tool-level errors are returned as structured JSON responses, not logged to console

## Comments

**When to Comment:**
- Every file starts with a JSDoc module comment explaining purpose and key behaviors
- Section separators use `// --- Section Name ---` format (triple dash)
- Inline comments explain WHY, not WHAT: `// API returns { listings: [listing] } wrapper even for single listing`
- Decision references use tags like `(locked decision)`, `(Pitfall 6)`, `(SAFE-01)`, `(PERS-01)`, `(INFRA-04)`
- Comments reference requirement IDs: `// Implements PERS-01 through PERS-05`

**JSDoc/TSDoc:**
- Full JSDoc on exported functions with `@param` and `@returns` tags
- `@module` tag on database query files: `@module db/queries/listing-snapshots`
- `.describe()` on every Zod schema field serves as inline documentation for MCP tool consumers
- Interface properties use `/** ... */` doc comments

## Function Design

**Size:**
- Functions are medium-sized (20-60 lines typical)
- Tool handler callbacks can be longer (50-100+ lines) when they include validation steps (e.g., `pricelabs_set_overrides` has 7 distinct steps)
- Complex logic is extracted into standalone utility functions: `computeListingFields`, `computePriceFields`, `fetchWithFallback`

**Parameters:**
- Service classes take dependencies via constructor injection: `new PriceLabsApiClient(apiKey, rateLimiter, baseUrl)`
- Tool registration functions receive all dependencies as parameters: `registerListingTools(server, apiClient, cache, rateLimiter)`
- Database query factories take a single `db` parameter: `createListingSnapshotQueries(db)`
- Default parameter values used where sensible: `tryConsume(count: number = 1)`, `request<T>(method, path, body?, retryCount = 0)`

**Return Values:**
- Tool handlers return `{ content: [{ type: "text", text: JSON.stringify(...) }] }` for success
- Tool handlers return `{ content: [...], isError: true }` for errors
- `fetchWithFallback` returns `ToolResponse<T>` with `data`, `computed`, and `meta` fields
- Database query factories return plain objects with named prepared statements
- Boolean predicates return simple booleans: `isRetryable(error): boolean`

## Module Design

**Exports:**
- Each module exports a focused set of related items
- Service classes are the default export pattern for services: `export class PriceLabsApiClient`
- Tool files export a single registration function: `export function registerListingTools(...)`
- Schema files export individual named schemas: `export const GetPricesInputSchema`
- Type files re-export inferred types: `export type GetListingsInput = z.infer<typeof GetListingsInputSchema>`
- Query files export a factory function: `export function createListingSnapshotQueries(db)`
- Error files export classes and utility functions

**Barrel Files:**
- None. Each module imports directly from the specific file it needs.

## Audit Trail Convention

**Write tools require a `reason` parameter:**
- Zod schema enforces minimum 10 characters: `reason: z.string().min(10).describe("...")`
- Applied to: `pricelabs_update_listings`, `pricelabs_set_overrides`, `pricelabs_delete_overrides`, `pricelabs_push_prices`
- The reason is included in the tool response `computed` field for visibility
- This is a "locked decision" referenced throughout the codebase

## Response Envelope Convention

**Every tool response includes metadata:**
- `cache_age_seconds`: 0 for live, N for cached
- `data_source`: `"live"` or `"cached"`
- `api_calls_remaining`: from rate limiter status
- `fetched_at`: ISO timestamp
- This is enforced by the `ToolResponse<T>` interface and `fetchWithFallback` helper

## Validation Patterns

**Zod schema validation:**
- Input validation at the schema level using Zod `.superRefine()` for cross-field validation (see `OverrideWriteEntrySchema`)
- Defense-in-depth: runtime validation in tool handlers re-checks critical constraints already in Zod schemas
- DSO overrides undergo multi-step validation: percentage range, currency match, price floor check, post-write verification

**Write safety:**
- Environment variable gate: `PRICELABS_WRITES_ENABLED=true`
- Pre-write snapshots via `pricelabs_snapshot_before_write` for rollback capability
- Post-write verification reads back written data to detect silently dropped entries

---

*Convention analysis: 2026-03-12*
