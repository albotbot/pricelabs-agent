# Architecture

**Analysis Date:** 2026-03-12

## Pattern Overview

**Overall:** MCP Server + AI Agent Gateway -- a tool-server architecture where an LLM agent (Prism) operates through 28 MCP tools exposed via stdio transport, backed by a PriceLabs REST API client and local SQLite persistence. The agent is orchestrated by OpenClaw Gateway which provides Slack/Telegram channels and cron scheduling.

**Key Characteristics:**
- MCP (Model Context Protocol) server pattern: tools are registered on a server and invoked by an LLM client via JSON-RPC over stdio
- Cache-first API access with graceful degradation -- never blocks the agent completely
- Layered tool architecture: API tools (Phase 1) -> Persistence tools (Phase 2) -> Analysis tools (Phase 3) -> Optimization tools (Phase 4) -> Scale tools (Phase 5)
- Write safety gates: all destructive operations require `PRICELABS_WRITES_ENABLED=true` env var and a `reason` parameter for audit trail
- Agent persona (Prism) defined via markdown skill files, not code -- behavior is prompt-engineered through OpenClaw workspace configuration

## Layers

**1. Transport Layer (MCP stdio):**
- Purpose: Connects the MCP server to the LLM client (OpenClaw Gateway) via stdin/stdout JSON-RPC
- Location: `mcp-servers/pricelabs/src/index.ts` (lines 99-100)
- Contains: `StdioServerTransport` from `@modelcontextprotocol/sdk`
- Depends on: MCP SDK
- Used by: OpenClaw Gateway spawns this as a child process

**2. Tool Layer (28 tools across 14 registration functions):**
- Purpose: Exposes PriceLabs domain operations as typed MCP tools with input validation
- Location: `mcp-servers/pricelabs/src/tools/`
- Contains: Tool registration functions that bind handler logic to the MCP server
- Depends on: Services layer (API client, cache, rate limiter, database), Schema layer
- Used by: LLM agent (Prism) via MCP protocol

**3. Schema Layer (Zod validation):**
- Purpose: Input/output validation and type inference for all tool parameters and API responses
- Location: `mcp-servers/pricelabs/src/schemas/`
- Contains: Zod schemas for every tool input and API response shape
- Depends on: Zod library
- Used by: Tool layer (input validation), Types module (type inference via `z.infer`)

**4. Services Layer:**
- Purpose: Core infrastructure services -- HTTP client, caching, rate limiting, database
- Location: `mcp-servers/pricelabs/src/services/`
- Contains: `PriceLabsApiClient`, `TtlCache`, `TokenBucketRateLimiter`, `fetchWithFallback`, `initializeDatabase`
- Depends on: Error types, Node built-in fetch
- Used by: Tool layer

**5. Data Access Layer (Prepared Statements):**
- Purpose: SQLite query abstraction via factory functions returning prepared statement objects
- Location: `mcp-servers/pricelabs/src/db/queries/`
- Contains: One query factory per table (`createListingSnapshotQueries`, `createAuditLogQueries`, etc.)
- Depends on: `better-sqlite3` database instance
- Used by: Persistence/analysis/audit tools (Phase 2-5)

**6. Migration Layer:**
- Purpose: Versioned schema migrations using SQLite `user_version` pragma
- Location: `mcp-servers/pricelabs/src/db/migrations.ts`
- Contains: 7 migrations (Phase 2: migrations 1-5, Phase 5: migrations 6-7)
- Depends on: `better-sqlite3`
- Used by: Entry point runs migrations on startup

**7. Computed Fields Layer:**
- Purpose: Derives analytical metrics from raw API data (occupancy gap, revenue vs STLY, demand level, etc.)
- Location: `mcp-servers/pricelabs/src/computed-fields.ts`
- Contains: `computeListingFields()`, `computePriceFields()`, `computeNeighborhoodFields()`
- Depends on: Type definitions
- Used by: Read tools pass these as `computeFields` callbacks to `fetchWithFallback`

**8. Agent Layer (OpenClaw workspace):**
- Purpose: Defines the AI agent's identity, behavior, skills, and scheduling
- Location: `openclaw/workspace-pricelabs/` and `openclaw/skills/`
- Contains: Markdown files (SOUL.md, AGENTS.md, BOOT.md, skill files) that constitute the agent's system prompt
- Depends on: OpenClaw Gateway runtime
- Used by: OpenClaw Gateway assembles these into the agent's context

## Data Flow

**Read Operation (e.g., get_listings):**

1. Agent invokes `pricelabs_get_listings` tool via MCP JSON-RPC
2. Tool handler builds cache key from parameters
3. `fetchWithFallback()` checks `TtlCache` for unexpired entry
4. On miss: `PriceLabsApiClient.get()` checks `TokenBucketRateLimiter.tryConsume()`
5. On allowed: sends HTTP request to `https://api.pricelabs.co/v1/listings` with `X-API-Key` header
6. On success: caches response, computes derived fields via `computeListingFields()`, returns `ToolResponse<T>` envelope
7. On rate limit: serves cached data with `data_source: "cached"` and `note` explaining staleness
8. On API error: serves cached data silently for <30 min, raises CRITICAL alert after 30 min

**Write Operation (e.g., set_overrides):**

1. Agent invokes `pricelabs_set_overrides` tool via MCP JSON-RPC
2. Safety gate checks `PRICELABS_WRITES_ENABLED=true` environment variable
3. Input validation: percentage range (-75 to 500), currency matching for fixed prices, price floor vs listing min
4. API call: `PriceLabsApiClient.post()` sends overrides to PriceLabs
5. Post-write verification: re-fetches overrides to detect silently dropped dates
6. Cache invalidation: clears all matching cache entries for that listing
7. Returns result with verification status and any warnings about dropped dates

**Persistence Flow (daily health check):**

1. Cron job (7am CT) triggers agent with daily health check prompt via Slack/Telegram
2. Agent reads monitoring-protocols skill, calls `pricelabs_get_listings`
3. Agent calls `pricelabs_store_daily_snapshots` with all listing data -> SQLite insert via prepared statement
4. Agent calls `pricelabs_get_prices` per listing, then `pricelabs_store_price_snapshots` -> SQLite insert
5. Agent calls `pricelabs_get_reservations`, then `pricelabs_store_reservations` -> SQLite upsert with cancellation detection
6. Agent formats dashboard report and sends to Slack/Telegram channels

**State Management:**
- In-memory TTL cache for API responses (per-process, not persisted)
- SQLite database at `~/.pricelabs-agent/data.sqlite` for historical snapshots, audit log, change tracking, user config
- Agent memory via OpenClaw workspace MEMORY.md files (markdown-based, human-readable)

## Key Abstractions

**ToolResponse<T> Envelope:**
- Purpose: Standardized response format for all tools, enforcing cache/rate-limit metadata
- Examples: `mcp-servers/pricelabs/src/types.ts` (lines 83-99)
- Pattern: Every response includes `data`, `computed` (derived fields), and `meta` (cache_age_seconds, data_source, api_calls_remaining, fetched_at)

**fetchWithFallback<T>:**
- Purpose: Cache-first fetch with graceful degradation -- the core resilience pattern
- Examples: `mcp-servers/pricelabs/src/services/fetch-with-fallback.ts`
- Pattern: Try live fetch -> on rate limit, serve cached with freshness note -> on API error, serve cached silently for 30 min, then alert -> on no cache available, throw

**Query Factory Pattern:**
- Purpose: Creates prepared statement objects from a database instance, avoiding global singletons
- Examples: `mcp-servers/pricelabs/src/db/queries/listing-snapshots.ts`, `mcp-servers/pricelabs/src/db/queries/audit-log.ts`
- Pattern: `createXxxQueries(db)` returns `{ insertMany, getLatestSnapshot, getSnapshotRange, ... }` -- all prepared statements created once, reused per tool invocation

**Tool Registration Functions:**
- Purpose: Groups related tools into a single registration function for clean entry point wiring
- Examples: `registerListingTools()`, `registerSnapshotTools()`, `registerAnalysisTools()`
- Pattern: `registerXxxTools(server, ...deps)` calls `server.registerTool()` or `server.tool()` for each tool in the group

**Error Classification:**
- Purpose: Three error types with distinct retry/severity semantics
- Examples: `mcp-servers/pricelabs/src/errors.ts`
- Pattern: `RateLimitError` (retryable after delay), `AuthError` (never retryable, immediate alert), `ApiError` (retryable for 5xx, not for 4xx)

## Entry Points

**MCP Server Entry:**
- Location: `mcp-servers/pricelabs/src/index.ts`
- Triggers: Spawned by OpenClaw Gateway as a child process (`node dist/index.js`)
- Responsibilities: Validate env vars, initialize services (rate limiter, cache, API client, database), run migrations, register all 28 tools, connect stdio transport, handle process signals

**OpenClaw Gateway Configuration:**
- Location: `openclaw/openclaw.json`
- Triggers: Gateway startup
- Responsibilities: Defines the `pricelabs` agent, its MCP server configuration, channel bindings (Slack socket mode, Telegram), sandbox restrictions, and logging/redaction rules

**Cron Job Definitions:**
- Location: `openclaw/cron/jobs.json`
- Triggers: Time-based (7am CT daily, 8am CT Monday weekly)
- Responsibilities: Triggers daily health checks and weekly optimization reports as agent turns, delivered to both Slack and Telegram channels

**Agent Boot Sequence:**
- Location: `openclaw/workspace-pricelabs/BOOT.md`
- Triggers: Agent session start
- Responsibilities: Call `pricelabs_get_api_status` to verify connectivity, send "Prism online" notification, read today's memory file

## Error Handling

**Strategy:** Classified error hierarchy with per-type retry and fallback behavior

**Patterns:**
- **Rate limit errors**: Serve cached data with freshness metadata; if no cache, throw with retry estimate in minutes
- **Auth errors (401)**: Never retry, immediately fatal, agent must alert user to check API key
- **Server errors (5xx)**: Exponential backoff with jitter, max 3 retries, then serve cached if available
- **Client errors (4xx except 429)**: Not retryable, surface error message to agent
- **Network errors / timeouts**: Retry with backoff, then throw with network error context
- **Outage detection**: Module-level `firstFailureAt` timestamp tracks outage duration; silent cached fallback for <30 min, CRITICAL alert after 30 min
- **Write errors**: Separate error formatter -- never suggests cached data, emphasizes that the operation was not applied
- **Tool-level try/catch**: Every tool handler wraps its logic in try/catch and returns structured error JSON with `isError: true`

## Cross-Cutting Concerns

**Logging:** Console.error for fatal startup errors and uncaught exceptions. No structured logging framework. Agent-level logging via `pricelabs_log_action` tool writing to `audit_log` SQLite table.

**Validation:** Zod schemas for all tool inputs (defense in depth with runtime validation in tool handlers for critical write safety checks like DSO percentage ranges and currency matching).

**Authentication:** API key passed via `X-API-Key` header. Key sourced from `PRICELABS_API_KEY` env var. Never exposed in error messages or logs. OpenClaw gateway redacts API key patterns in log output.

**Rate Limiting:** Token bucket (1000 tokens/hour, lazy refill) checked before every outbound API call. Self-awareness via `pricelabs_get_api_status` tool lets the agent check budget before expensive batch operations.

**Caching:** In-memory TTL cache with per-resource TTLs (listings: 60min, prices: 6hr, neighborhood: 24hr, reservations: 60min). Prefix-based invalidation on writes. Hit/miss tracking for diagnostics.

**Write Safety:** Three-layer protection: (1) `PRICELABS_WRITES_ENABLED` env var gate, (2) `reason` parameter required for audit trail, (3) `pricelabs_snapshot_before_write` tool captures pre-write state for rollback capability.

---

*Architecture analysis: 2026-03-12*
