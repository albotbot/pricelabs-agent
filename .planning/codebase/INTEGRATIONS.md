# External Integrations

**Analysis Date:** 2026-03-12

## APIs & External Services

**PriceLabs Customer API:**
- Purpose: Core data source for all rental pricing, listing management, and market intelligence
- Base URL: `https://api.pricelabs.co`
- Auth: `X-API-Key` header (env var: `PRICELABS_API_KEY`)
- Rate limit: 1000 requests/hour per API key
- Client timeout: 300 seconds (5 minutes)
- SDK/Client: Custom `PriceLabsApiClient` class at `mcp-servers/pricelabs/src/services/api-client.ts`
- Uses Node.js built-in `fetch` (no external HTTP library)
- Retry: Exponential backoff with jitter, max 3 retries for 429/5xx; never retries 401

**PriceLabs API Endpoints Used:**

| Endpoint | Method | Tool | Purpose |
|----------|--------|------|---------|
| `/v1/listings` | GET | `pricelabs_get_listings` | Fetch all listings with health/occupancy |
| `/v1/listings/{id}` | GET | `pricelabs_get_listing` | Fetch single listing details |
| `/v1/listings` | POST | `pricelabs_update_listings` | Update base/min/max prices (write) |
| `/v1/listing_prices` | POST | `pricelabs_get_prices` | Fetch daily pricing data (read despite POST) |
| `/v1/listings/{id}/overrides` | GET | `pricelabs_get_overrides` | Fetch date-specific overrides |
| `/v1/listings/{id}/overrides` | POST | `pricelabs_set_overrides` | Create/update DSOs (write) |
| `/v1/listings/{id}/overrides` | DELETE | `pricelabs_delete_overrides` | Remove DSOs (write) |
| `/v1/neighborhood_data` | GET | `pricelabs_get_neighborhood_data` | Market percentile data |
| `/v1/reservation_data` | GET | `pricelabs_get_reservations` | Booking/reservation data |
| `/v1/push_prices` | POST | `pricelabs_push_prices` | Trigger price sync to PMS |
| `/v1/rate_plans` | GET | `pricelabs_get_rate_plans` | Fetch rate plan configurations |

**API Client Architecture:**
- `PriceLabsApiClient` (`mcp-servers/pricelabs/src/services/api-client.ts`) - HTTP client with rate limiting and retry
- `TokenBucketRateLimiter` (`mcp-servers/pricelabs/src/services/rate-limiter.ts`) - Local token bucket (1000 tokens/hour)
- `TtlCache` (`mcp-servers/pricelabs/src/services/cache.ts`) - In-memory TTL cache with hit/miss tracking
- `fetchWithFallback` (`mcp-servers/pricelabs/src/services/fetch-with-fallback.ts`) - Cache-first degradation pattern

**Cache TTLs by Data Type:**
- Listings: 60 minutes (`LISTING_CACHE_TTL_MS` in `mcp-servers/pricelabs/src/tools/listings.ts`)
- Prices: 6 hours (`PRICES_CACHE_TTL_MS` in `mcp-servers/pricelabs/src/tools/prices.ts`)
- Overrides: 6 hours (`OVERRIDES_CACHE_TTL_MS` in `mcp-servers/pricelabs/src/tools/overrides.ts`)
- Snapshot data: 5 minutes (`SNAPSHOT_CACHE_TTL_MS` in `mcp-servers/pricelabs/src/tools/optimization.ts`)

## Data Storage

**Database:**
- SQLite via `better-sqlite3` ^12.6.2
- Connection: env var `PRICELABS_DB_PATH` (default: `~/.pricelabs-agent/data.sqlite`)
- Client: `better-sqlite3` (synchronous API, no ORM)
- Database initialization: `mcp-servers/pricelabs/src/services/database.ts`
- Migrations: `mcp-servers/pricelabs/src/db/migrations.ts` (versioned via `user_version` pragma, 7 migrations)
- WAL mode, busy timeout 5000ms, foreign keys enabled, synchronous NORMAL

**Database Tables (7 total):**

| Table | Migration | Purpose | Key File |
|-------|-----------|---------|----------|
| `listing_snapshots` | v1 | Daily listing state snapshots | `src/db/queries/listing-snapshots.ts` |
| `price_snapshots` | v2 | Daily price data with demand signals | `src/db/queries/price-snapshots.ts` |
| `reservations` | v3 | Booking/reservation tracking with upsert | `src/db/queries/reservations.ts` |
| `audit_log` | v4 | All write actions with timestamps | `src/db/queries/audit-log.ts` |
| `market_snapshots` | v5 | Neighborhood/market percentile data | `src/db/queries/market-snapshots.ts` |
| `change_tracking` | v6 | Revenue impact follow-ups (7/14/30d checks) | `src/db/queries/change-tracking.ts` |
| `user_config` | v7 | Configurable alert thresholds (global + per-listing) | `src/db/queries/user-config.ts` |

**File Storage:**
- Local filesystem only (SQLite database file)
- Docker: `/data/pricelabs.sqlite` (mounted volume for persistence)

**Caching:**
- In-memory `TtlCache` (`mcp-servers/pricelabs/src/services/cache.ts`)
- No external cache service (Redis, Memcached, etc.)
- Cache is per-process, not shared across instances
- Prefix-based invalidation for write operations

## Authentication & Identity

**PriceLabs API Auth:**
- API key authentication via `X-API-Key` header
- Key sourced from `PRICELABS_API_KEY` environment variable
- Key never logged or exposed in error messages (INFRA-04)
- 401 responses cause immediate `AuthError` -- never retried

**OpenClaw Gateway Auth:**
- Token-based authentication (`OPENCLAW_GATEWAY_TOKEN`)
- Gateway binds to loopback only (`"bind": "loopback"`)
- Mode: local (no remote access)

**No end-user authentication** -- the agent operates as a single-tenant system using one PriceLabs API key.

## Messaging Channels

**Slack:**
- Socket Mode connection (no public webhook URL needed)
- Auth: `SLACK_APP_TOKEN` (xapp-*) for Socket Mode, `SLACK_BOT_TOKEN` (xoxb-*) for API calls
- Configured in `openclaw/openclaw.json` under `channels.slack`
- DM policy: pairing mode
- Thread replies enabled
- Target channel ID: `C0AH8TSNNKH` (in `openclaw/cron/jobs.json`)

**Telegram:**
- Bot API integration
- Auth: `TELEGRAM_BOT_TOKEN` (from BotFather)
- Configured in `openclaw/openclaw.json` under `channels.telegram`
- DM policy: pairing mode
- Groups require @mention
- Target chat ID: `8283515561` (in `openclaw/cron/jobs.json`)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar)
- Process-level crash handlers in `mcp-servers/pricelabs/src/index.ts` (uncaughtException, unhandledRejection)

**Logs:**
- `console.error` for fatal errors and process crashes
- OpenClaw gateway logging with sensitive data redaction (`openclaw/openclaw.json` -> `logging.redactPatterns`)
- Redacted patterns: `X-API-Key`, `api[_-]?key`, `PRICELABS`
- No structured logging library (no winston, pino, etc.)

**Health Metrics:**
- `pricelabs_get_api_status` tool exposes rate limiter status and cache stats
- Token bucket utilization percentage tracked in `TokenBucketRateLimiter.getStatus()`
- Cache hit rate tracked in `TtlCache.getStats()`

**API Outage Detection:**
- Module-level outage tracking in `mcp-servers/pricelabs/src/services/fetch-with-fallback.ts`
- Silent retry for brief outages (< 30 minutes)
- Critical alert after 30 minutes of continuous failure

## CI/CD & Deployment

**Hosting:**
- Docker container (multi-stage build in `Dockerfile`)
- Stage 1: Build (node:20-slim, `npm ci`, `tsc`)
- Stage 2: Runtime (node:20-slim + sqlite3 system package)
- No EXPOSE -- MCP server uses stdio, spawned as subprocess by OpenClaw

**CI Pipeline:**
- None detected (no GitHub Actions, CircleCI, GitLab CI config files)
- Validation scripts exist but are run manually (`scripts/validate-*.mjs`)

**Deployment:**
- OpenClaw Gateway spawns MCP server as child process
- `openclaw/openclaw.json` defines the agent with MCP server command
- Install script for OpenClaw plugin: `scripts/install-openclaw-plugin.sh`

## Scheduled Jobs (Cron)

**Configured in `openclaw/cron/jobs.json`:**

| Job | Schedule | Channel | Purpose |
|-----|----------|---------|---------|
| `daily-health-slack` | `0 7 * * *` (7am CT) | Slack | Portfolio health dashboard |
| `daily-health-telegram` | `0 7 * * *` + 30s stagger | Telegram | Same dashboard to Telegram |
| `weekly-optimization-slack` | `0 8 * * 1` (Mon 8am CT) | Slack | Weekly pricing optimization report |
| `weekly-optimization-telegram` | `0 8 * * 1` + 30s stagger | Telegram | Same report to Telegram |

All cron jobs use:
- `sessionTarget: "isolated"` (fresh session per run)
- `wakeMode: "next-heartbeat"`
- `model: "opus"` with `thinking: "high"`
- `bestEffort: true` delivery

## Environment Configuration

**Required env vars (for MCP server):**
- `PRICELABS_API_KEY` - PriceLabs API authentication (fatal if missing)

**Optional env vars (for MCP server):**
- `PRICELABS_BASE_URL` - API base URL (default: `https://api.pricelabs.co`)
- `PRICELABS_DB_PATH` - SQLite database path (default: `~/.pricelabs-agent/data.sqlite`)
- `PRICELABS_WRITES_ENABLED` - Enable destructive operations (default: `"false"`)

**Required env vars (for OpenClaw gateway):**
- `OPENCLAW_GATEWAY_TOKEN` - Gateway authentication token
- `SLACK_APP_TOKEN` - Slack Socket Mode app token
- `SLACK_BOT_TOKEN` - Slack Bot OAuth token
- `TELEGRAM_BOT_TOKEN` - Telegram Bot API token

**Secrets location:**
- `~/.openclaw/.env` - Runtime secrets for OpenClaw gateway
- `openclaw/env.example` - Template with placeholder values
- `.env` file exists at project root (gitignored, contains secrets)
- `secrets/` directory exists at project root (appears empty/placeholder)
- No secrets management service (Vault, AWS Secrets Manager, etc.)

## Webhooks & Callbacks

**Incoming:**
- Slack events via Socket Mode (WebSocket connection, not webhook URL)
- Telegram updates via Bot API (polling or webhook, configured by OpenClaw)

**Outgoing:**
- PriceLabs API calls (REST, not webhooks)
- Slack message delivery (via Slack Bot API)
- Telegram message delivery (via Telegram Bot API)
- No outgoing webhooks to third parties

## MCP Protocol

**Transport:** stdio (JSON-RPC over stdin/stdout)
- Server: `StdioServerTransport` from `@modelcontextprotocol/sdk`
- Client: OpenClaw gateway spawns MCP server as child process

**OpenClaw Plugin Bridge:**
- `openclaw/extensions/pricelabs/index.ts` - Bridges MCP tools into OpenClaw agent tools
- Spawns MCP server via `child_process.spawn`
- Communicates via newline-delimited JSON-RPC over stdio
- 28 tool definitions in `openclaw/extensions/pricelabs/tool-definitions.json`
- RPC timeout: 30s for init, 60s for tool calls
- Lazy initialization (server spawned on first tool call)

**Protocol Version:** `2024-11-05` (sent during MCP initialize handshake)

---

*Integration audit: 2026-03-12*
