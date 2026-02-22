# Phase 1: MCP Server Foundation + Infrastructure Security - Research

**Researched:** 2026-02-22
**Domain:** MCP Server (TypeScript), PriceLabs REST API integration, OpenClaw Gateway security, token bucket rate limiting, in-memory caching, Zod validation, domain knowledge skills
**Confidence:** HIGH

## Summary

Phase 1 delivers the foundational infrastructure layer: a custom TypeScript MCP server wrapping all 12 PriceLabs Customer API endpoints, protected by a token bucket rate limiter (1000 req/hr), an in-memory TTL cache with per-endpoint configurability, strict credential isolation, and OpenClaw Gateway hardening. Additionally, a domain knowledge skill provides always-on PriceLabs optimization reference. No user-facing workflows yet -- this is pure plumbing.

The MCP TypeScript SDK (`@modelcontextprotocol/sdk` v1.26.x, stable branch) provides a clean `McpServer` class with `server.tool()` registration using Zod schemas. Tools support annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) that distinguish read vs write operations. The server communicates with OpenClaw via stdio transport (JSON-RPC 2.0 over stdin/stdout). The PriceLabs API uses simple `X-API-Key` header auth with 1000 requests/hour rate limit and a recommended 300-second timeout.

**Primary recommendation:** Build the MCP server as a single TypeScript process with three internal service layers (HTTP client, token bucket rate limiter, TTL cache), expose 12 API tools plus a `get_api_status` self-awareness tool, annotate write tools as destructive, configure OpenClaw Gateway with loopback binding + token auth + Docker sandbox + tool allowlists, and create a comprehensive domain knowledge skill as a SKILL.md with `always: true` metadata.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Hybrid raw + computed fields:** Return raw PriceLabs JSON PLUS computed fields (e.g., `occupancy_gap_pct`, `revenue_vs_stly_pct`, `days_since_sync`). Agent gets both raw data for edge-case reasoning and ready-to-use metrics for common queries
- Every tool response must include `cache_age_seconds` and `data_source` ("live" or "cached") metadata
- **Rate limit hit -> serve cached + inform:** When rate budget is low/exhausted, return cached data with a note: "Using cached data (X min old). Fresh data available in Y minutes." Never block the agent completely
- **Always show data freshness:** Every response to the user includes data age
- **Error tone: Plain and direct.** Include what happened, why, and suggest next step
- **API outage: Silent retry for 30 minutes, alert if prolonged.**
- **Always offer alternatives** when a request can't be fulfilled
- **Auth/credential errors: Critical -- immediate alert** on both Slack AND Telegram
- **Domain knowledge skill:** Framework + reasoning approach (not rigid rules), all 4 knowledge domains (optimization playbook, algorithm internals, common mistakes, API field reference), include portfolio-specific context, adaptable agent persona
- **Agent persona: Adaptable** -- matches user's communication style

### Claude's Discretion
- MCP tool mapping strategy (1:1 vs consolidated -- design optimal surface)
- Write tool interface design (require rationale parameter for audit)
- Self-awareness tool (`get_api_status`) design
- Rate budget allocation algorithm (priority-based recommended)
- Cache TTL values per endpoint
- Retry strategy specifics (exponential backoff, jitter)
- OpenClaw Gateway security configuration details (Docker sandbox, tool allowlists, loopback binding)
- Domain skill markdown structure and formatting

### Deferred Ideas (OUT OF SCOPE)
- LLM rate limit handling / fallback to local models -- OpenClaw Gateway configuration, not Phase 1 scope
- Portfolio-specific onboarding flow to populate domain skill context -- Phase 2
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.26.x (v1.x stable branch) | MCP server framework | Official TypeScript SDK. 26,000+ npm dependents. Provides `McpServer` class, `server.tool()` with Zod schemas, stdio transport, tool annotations. v2 is pre-alpha -- use v1.x for production. |
| `zod` | 3.25+ | Input/output schema validation | Required peer dependency of MCP SDK. SDK internally imports from `zod/v4` but maintains backwards compatibility with Zod 3.25+. Validates all PriceLabs API payloads. |
| `typescript` | 5.7+ | Type safety | Development-time only. Target ES2022, module NodeNext. |
| Node.js | 22.x LTS | Runtime | Project constraint. Built-in `fetch` API eliminates need for `node-fetch` or `axios`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/node` | 22.x | Node.js type definitions | Development-time only |

### What NOT to Install

| Library | Why Not |
|---------|---------|
| `node-fetch` / `axios` / `got` | Node 22 has built-in global `fetch`. No external HTTP client needed. |
| `better-sqlite3` | Phase 2 concern. Phase 1 uses in-memory cache only. |
| `express` / `fastify` | MCP uses stdio transport, not HTTP. No web server needed. |
| `rate-limiter-flexible` / `limiter` | Token bucket is ~40 lines of code. No library needed for single-process in-memory limiting. |
| `node-cache` / `lru-cache` | TTL cache is ~60 lines of code. In-memory Map with timestamps. No library needed. |
| `dotenv` | OpenClaw passes env vars through `openclaw.json` MCP server `env` config. No `.env` file loading in the MCP server process. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom MCP server | Generic REST MCP (`dkmaker/mcp-rest-api`) | Too generic -- no PriceLabs-specific validation (DSO ranges, currency matching), no domain-aware caching TTLs |
| In-memory TTL cache | Redis | Overkill for single-process. Process restart means a few cache misses -- acceptable. Redis adds ops burden. |
| Hand-rolled token bucket | `rate-limiter-flexible` | Library supports Redis/cluster but adds unnecessary dependency for single-process in-memory use case |
| `@modelcontextprotocol/sdk` v1.x | v2.x (pre-alpha) | v2 is not stable yet (Q1 2026 target). v1.x receives bug fixes and security updates for 6+ months after v2 ships. |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
```

## Architecture Patterns

### Recommended Project Structure

```
mcp-servers/pricelabs/
  package.json
  tsconfig.json
  src/
    index.ts                  # McpServer setup, tool registration, stdio transport
    tools/
      listings.ts             # getListings, getListing, updateListings
      prices.ts               # getPrices
      overrides.ts            # getOverrides, setOverrides, deleteOverrides
      neighborhood.ts         # getNeighborhoodData
      reservations.ts         # getReservations
      sync.ts                 # pushPrices
      rate-plans.ts           # getRatePlans
      status.ts               # getApiStatus (self-awareness)
    services/
      api-client.ts           # PriceLabs HTTP client (fetch-based)
      rate-limiter.ts         # Token bucket (1000/hr)
      cache.ts                # In-memory TTL cache
    schemas/
      common.ts               # Shared Zod schemas (listing ID, PMS name, date formats)
      listings.ts             # Listing input/output schemas
      prices.ts               # Price input/output schemas
      overrides.ts            # Override input/output schemas
      neighborhoods.ts        # Neighborhood data schemas
      reservations.ts         # Reservation data schemas
    types.ts                  # TypeScript interfaces derived from Zod schemas
    computed-fields.ts        # Computed field calculations (occupancy_gap_pct, etc.)
    errors.ts                 # Error classification (retryable vs fatal)
  dist/                       # Compiled JS output
```

### Pattern 1: McpServer Tool Registration with Annotations

**What:** Use `server.tool()` with Zod schemas for input validation and tool annotations to distinguish read vs write operations.
**When to use:** Every tool registration.

```typescript
// Source: MCP TypeScript SDK v1.x docs + MCP Protocol specification
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "pricelabs",
  version: "1.0.0",
});

// Read-only tool with annotations
server.tool(
  "pricelabs_get_listings",
  "Fetch all PriceLabs listings with health, occupancy, and revenue data",
  {
    skip_hidden: z.boolean().optional().describe("Filter out hidden listings"),
    only_syncing: z.boolean().optional().describe("Only return actively syncing listings"),
  },
  async (params) => {
    // ... implementation
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

// Write tool marked as destructive
server.tool(
  "pricelabs_update_listings",
  "Update base/min/max prices or tags for one or more listings. REQUIRES reason for audit trail.",
  {
    listings: z.array(z.object({
      id: z.string().describe("PriceLabs listing ID"),
      pms: z.string().describe("PMS identifier (e.g., 'airbnb')"),
      min: z.number().optional().describe("Minimum nightly price"),
      base: z.number().optional().describe("Base price anchor"),
      max: z.number().optional().describe("Maximum nightly price"),
      tags: z.array(z.string()).max(10).optional().describe("Listing tags (max 10)"),
    })),
    reason: z.string().min(10).describe("Rationale for this change (required for audit trail)"),
  },
  async (params) => {
    // ... implementation with pre-write validation
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Note on annotations:** The MCP protocol supports `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` on tool definitions. The v1.x SDK's `server.tool()` convenience method may not directly expose an annotations parameter in all overloads. If annotations cannot be passed via `server.tool()`, use the lower-level `server.setRequestHandler(ListToolsRequestSchema, ...)` to include them in tool definitions. Alternatively, the `server.registerTool()` method (available in newer SDK builds) accepts an `annotations` property:

```typescript
server.registerTool(
  "pricelabs_get_listings",
  {
    description: "Fetch all PriceLabs listings",
    inputSchema: z.object({ skip_hidden: z.boolean().optional() }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async (params) => {
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);
```

### Pattern 2: Token Bucket Rate Limiter (In-Memory)

**What:** Timer-free token bucket that calculates available tokens on demand. 1000 tokens/hour, refilling at ~16.67 tokens/minute.
**When to use:** Every outbound PriceLabs API call.

```typescript
// Source: Standard algorithm, adapted for PriceLabs 1000/hr limit
class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(maxTokens: number = 1000, refillWindowMs: number = 3600000) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.lastRefillTime = Date.now();
    this.refillRate = maxTokens / refillWindowMs;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefillTime = now;
  }

  tryConsume(count: number = 1): { allowed: boolean; retryAfterMs?: number } {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return { allowed: true };
    }
    const deficit = count - this.tokens;
    const retryAfterMs = Math.ceil(deficit / this.refillRate);
    return { allowed: false, retryAfterMs };
  }

  getStatus(): { remaining: number; max: number; resetMs: number } {
    this.refill();
    return {
      remaining: Math.floor(this.tokens),
      max: this.maxTokens,
      resetMs: Math.ceil((this.maxTokens - this.tokens) / this.refillRate),
    };
  }
}
```

**Key design choice:** Timer-free approach (no `setInterval`). Tokens are calculated lazily on each `tryConsume()` call based on elapsed time. This avoids timer drift and is simpler to test.

### Pattern 3: In-Memory TTL Cache

**What:** Simple Map-based cache with per-key TTL and cache metadata in responses.
**When to use:** All read-only API calls. Write operations invalidate relevant cache entries.

```typescript
interface CacheEntry<T> {
  data: T;
  cachedAt: number;  // Date.now() timestamp
  ttlMs: number;
}

class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): { data: T; cacheAgeSeconds: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.cachedAt;
    if (age > entry.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return {
      data: entry.data as T,
      cacheAgeSeconds: Math.round(age / 1000),
    };
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, cachedAt: Date.now(), ttlMs });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }

  getStats(): { entries: number; hitRate: string; oldestEntryAge: number } {
    // Implementation for get_api_status tool
  }
}
```

### Pattern 4: Enriched Tool Response Envelope

**What:** Every tool response wraps raw API data with metadata and computed fields.
**When to use:** All tool responses (locked decision from CONTEXT.md).

```typescript
interface ToolResponse<T> {
  data: T;                    // Raw PriceLabs API response
  computed: Record<string, unknown>;  // Computed fields
  meta: {
    cache_age_seconds: number;  // 0 if live
    data_source: "live" | "cached";
    api_calls_remaining: number;
    fetched_at: string;         // ISO timestamp
  };
}

// Example computed fields for listings:
// occupancy_gap_pct = (market_occupancy_next_30 - occupancy_next_30) / market_occupancy_next_30 * 100
// revenue_vs_stly_pct = (revenue_past_7 - stly_revenue_past_7) / stly_revenue_past_7 * 100
// days_since_sync = (Date.now() - Date.parse(last_date_pushed)) / 86400000
```

### Pattern 5: Graceful Degradation on Rate Limit

**What:** When rate budget is exhausted, serve cached data with freshness notice. Never return empty-handed.
**When to use:** Every tool call that hits the rate limiter.

```typescript
async function fetchWithFallback<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<ToolResponse<T>> {
  const cached = cache.get<T>(cacheKey);
  const rateStatus = rateLimiter.tryConsume();

  if (rateStatus.allowed) {
    try {
      const data = await fetcher();
      cache.set(cacheKey, data, ttlMs);
      return {
        data,
        computed: computeFields(data),
        meta: {
          cache_age_seconds: 0,
          data_source: "live",
          api_calls_remaining: rateLimiter.getStatus().remaining,
          fetched_at: new Date().toISOString(),
        },
      };
    } catch (err) {
      if (cached) {
        return {
          data: cached.data,
          computed: computeFields(cached.data),
          meta: {
            cache_age_seconds: cached.cacheAgeSeconds,
            data_source: "cached",
            api_calls_remaining: rateLimiter.getStatus().remaining,
            fetched_at: new Date().toISOString(),
          },
        };
      }
      throw err;
    }
  }

  // Rate limited -- serve cached if available
  if (cached) {
    return {
      data: cached.data,
      computed: computeFields(cached.data),
      meta: {
        cache_age_seconds: cached.cacheAgeSeconds,
        data_source: "cached",
        api_calls_remaining: 0,
        fetched_at: new Date().toISOString(),
      },
    };
  }

  return {
    content: [{
      type: "text",
      text: `Rate limit reached. No cached data available. Fresh data available in ${Math.ceil(rateStatus.retryAfterMs! / 60000)} minutes.`,
    }],
    isError: true,
  };
}
```

### Anti-Patterns to Avoid

- **Agent-side rate limiting:** Never implement rate limiting logic in skill instructions. The agent cannot reliably count API calls. Rate limiting is a systems concern owned by the MCP server.
- **Hardcoding API key:** Never put the API key in source code, skill files, or logs. It lives exclusively in `openclaw.json` -> `agents.list[].mcp.servers[].env.PRICELABS_API_KEY` which reads from `~/.openclaw/.env`.
- **Logging API responses with keys:** Redact any request headers that contain `X-API-Key` before logging.
- **Building a web server:** MCP uses stdio transport. There is no HTTP server, no ports to manage.
- **Installing an ORM:** No database in Phase 1. In-memory cache only. SQLite comes in Phase 2.

## Recommended Tool Mapping (Claude's Discretion)

### Tool Inventory: 13 Tools (12 API + 1 Status)

Based on analysis of the PriceLabs API structure and agent workflow needs, a 1:1 mapping is recommended with one composite status tool. The API endpoints are sufficiently distinct that consolidation would hide important parameters, and workflow grouping would create tools with confusing multi-modal behavior.

| MCP Tool Name | API Endpoint | Read/Write | Annotations | Cache TTL |
|---------------|-------------|------------|-------------|-----------|
| `pricelabs_get_listings` | GET /v1/listings | Read | readOnly, openWorld | 60 min |
| `pricelabs_get_listing` | GET /v1/listings/{id} | Read | readOnly, openWorld | 60 min |
| `pricelabs_update_listings` | POST /v1/listings | **Write** | destructive, openWorld | Invalidates |
| `pricelabs_get_prices` | POST /v1/listing_prices | Read | readOnly, openWorld | 6 hr |
| `pricelabs_get_overrides` | GET /v1/listings/{id}/overrides | Read | readOnly, openWorld | 6 hr |
| `pricelabs_set_overrides` | POST /v1/listings/{id}/overrides | **Write** | destructive, openWorld | Invalidates |
| `pricelabs_delete_overrides` | DELETE /v1/listings/{id}/overrides | **Write** | destructive, openWorld | Invalidates |
| `pricelabs_get_neighborhood` | GET /v1/neighborhood_data | Read | readOnly, openWorld | 24 hr |
| `pricelabs_get_reservations` | GET /v1/reservation_data | Read | readOnly, openWorld | 60 min |
| `pricelabs_push_prices` | POST /v1/push_prices | **Write** | destructive, openWorld | No cache |
| `pricelabs_get_rate_plans` | GET /v1/fetch_rate_plans | Read | readOnly, openWorld | 6 hr |
| `pricelabs_add_listing` | POST /v1/add_listing_data | **Write** | destructive, openWorld | No cache |
| `pricelabs_get_api_status` | (Internal) | Read | readOnly | No cache |

**Why 1:1 and not consolidated:**
- Each endpoint has distinct parameters and return shapes
- Agent can call exactly what it needs without over-fetching
- Cache invalidation is precise (write to overrides invalidates override cache, not listings cache)
- Tool names are self-documenting for the LLM

**Write tools require a `reason` parameter** (string, min 10 chars) for automatic audit trail logging. Every pricing change must be traceable.

**The `pricelabs_get_api_status` tool** exposes: rate budget remaining, cache hit rates, cache entry count, oldest cache entry age, and time until rate limit reset. The agent calls this for self-awareness at 1000 req/hr.

### Cache TTL Rationale (Claude's Discretion)

| Endpoint | TTL | Rationale |
|----------|-----|-----------|
| Listings (get all/single) | 60 min | Listing metadata changes infrequently. Health scores update daily. |
| Prices | 6 hr | Prices recalculate on sync cycle (nightly 6pm-6am CT). Safe to cache for half a cycle. |
| Overrides | 6 hr | DSOs change only when explicitly written. Cache until next write. |
| Neighborhood data | 24 hr | Market data updates daily. Once-per-day freshness is sufficient. |
| Reservations | 60 min | Bookings can arrive at any time. Balance freshness vs budget. |
| Rate plans | 6 hr | Rate plan adjustments are rare. |
| Push prices | No cache | Action, not data. No caching. |
| API status | No cache | Real-time internal state. |

### Retry Strategy (Claude's Discretion)

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503, 504],
  nonRetryableStatuses: [400, 401, 403, 404],
};

function getRetryDelay(attempt: number): number {
  // Exponential backoff with jitter
  const exponential = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * RETRY_CONFIG.baseDelayMs;
  return Math.min(exponential + jitter, RETRY_CONFIG.maxDelayMs);
}
```

For 429 (rate limited): respect the `Retry-After` header if present, otherwise use the token bucket's `retryAfterMs` estimate.

For auth errors (401): do NOT retry. Return immediately as critical error with instructions to check API key configuration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol compliance | Custom JSON-RPC handler | `@modelcontextprotocol/sdk` McpServer | Protocol is complex (capabilities negotiation, notifications, streaming). SDK handles it. |
| Input validation | Custom validators | Zod schemas | SDK requires Zod. Consistent validation + TypeScript inference + auto-generated JSON Schema for tool discovery. |
| stdio transport | Custom stdin/stdout parsing | `StdioServerTransport` from SDK | Handles message framing, newline-delimited JSON, buffering edge cases. |
| HTTP client | Custom fetch wrapper with retry | Still hand-roll, but simple | Node 22 global `fetch` is clean. Add retry loop + rate limiter integration. ~80 lines total. |
| Token bucket | N/A (hand-roll is correct) | ~40 lines of code | Algorithm is trivially simple. No library needed for single-process use case. |
| TTL cache | N/A (hand-roll is correct) | ~60 lines of code | Map + timestamps. No eviction policy needed (small dataset). |
| Domain knowledge | Code-based knowledge graph | SKILL.md markdown file | OpenClaw skills are markdown. Domain knowledge is text, not code. |

**Key insight:** The MCP SDK handles the hard protocol stuff. Everything else in Phase 1 (rate limiter, cache, HTTP client) is simple enough to hand-roll in <100 lines each. No library dependencies beyond the SDK and Zod.

## Common Pitfalls

### Pitfall 1: DSO Overwrites Min Price Floor

**What goes wrong:** Date-Specific Overrides have the highest priority in PriceLabs. A DSO with `price_type: "fixed"` at $50 on a listing with min=$150 will push $50 to Airbnb. No server-side guard exists.
**Why it happens:** The API treats DSOs as explicit operator intent. The `-75` to `500` percent range allows dramatic price changes.
**How to avoid:** Build a pre-write validation layer in the MCP server. Before every DSO write: (1) fetch the listing's current `min` price, (2) compute effective nightly rate, (3) reject if below min. The `reason` parameter must explain the pricing rationale.
**Warning signs:** DSO effective price < listing min price. Log and reject before API call.
**Phase 1 action:** Implement validation in `setOverrides` tool handler.

### Pitfall 2: Silently Dropped DSO Dates

**What goes wrong:** Invalid DSO dates (past dates, malformed, outside sync window) are silently omitted from the API response. 200 OK returns with fewer dates than requested.
**Why it happens:** PriceLabs favors partial success for bulk operations.
**How to avoid:** After every DSO POST, immediately GET overrides for the same listing/date range. Compare requested vs confirmed dates. Report discrepancies to the agent.
**Warning signs:** Response date count < request date count.
**Phase 1 action:** Implement post-write verification in `setOverrides` tool handler.

### Pitfall 3: Currency Mismatch in Fixed DSOs

**What goes wrong:** Fixed-price DSOs require `currency` to exactly match the PMS listing's currency. Mismatches silently fail or apply wrong values.
**How to avoid:** Always fetch listing currency before writing fixed-price DSOs. Enforce currency matching as a hard validation rule.
**Phase 1 action:** Implement in `setOverrides` tool handler Zod schema + pre-write check.

### Pitfall 4: API Key Exposure via Skills/Logs

**What goes wrong:** API key enters LLM context window through skills, gets logged in chat history, or leaks through filesystem access. Snyk found 283 skills (7.1% of ClawHub registry) with credential leaks.
**How to avoid:** API key lives ONLY in `openclaw.json` -> MCP server `env` -> `process.env.PRICELABS_API_KEY` inside the MCP server process. Never in skill files, never logged.
**Warning signs:** API key string appearing in any log, memory file, or chat transcript.
**Phase 1 action:** (1) Set env in openclaw.json, (2) enable `logging.redactSensitive: "tools"`, (3) add `redactPatterns` for API key patterns, (4) `chmod 600 ~/.openclaw/openclaw.json`.

### Pitfall 5: Gateway Exposed Without Auth

**What goes wrong:** Default OpenClaw config can expose the WebSocket gateway to the network without authentication. CVE-2026-25253 exploited this in versions before 2026.1.29.
**How to avoid:** `gateway.bind: "loopback"`, `gateway.auth.mode: "token"`, Docker sandbox enabled.
**Phase 1 action:** Security configuration must be the FIRST thing set up, before MCP server is connected.

### Pitfall 6: Rate Limit Exhaustion During Development

**What goes wrong:** During testing, rapid iteration can burn through the 1000/hr limit. Once at 429, all operations fail for the remainder of the hour, including time-sensitive price updates.
**How to avoid:** Use the token bucket from the first line of code. During development, consider setting a lower burst limit (e.g., 500) to leave headroom. Implement aggressive caching from day one.
**Warning signs:** 429 responses in logs.

### Pitfall 7: MCP Server Process Runs With Full System Access

**What goes wrong:** By default, MCP servers execute with the same permissions as the OpenClaw process. A prompt injection or malicious skill could instruct the server to perform unintended operations.
**How to avoid:** Docker sandbox mode, tool allowlists, deny shell execution, disable elevated mode.
**Phase 1 action:** Configure in openclaw.json before first run.

## Code Examples

### Complete MCP Server Entry Point

```typescript
// src/index.ts
// Source: MCP TypeScript SDK v1.x docs, adapted for PriceLabs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerListingTools } from "./tools/listings.js";
import { registerPriceTools } from "./tools/prices.js";
import { registerOverrideTools } from "./tools/overrides.js";
import { registerNeighborhoodTools } from "./tools/neighborhood.js";
import { registerReservationTools } from "./tools/reservations.js";
import { registerSyncTools } from "./tools/sync.js";
import { registerRatePlanTools } from "./tools/rate-plans.js";
import { registerStatusTools } from "./tools/status.js";
import { PriceLabsApiClient } from "./services/api-client.js";
import { TokenBucketRateLimiter } from "./services/rate-limiter.js";
import { TtlCache } from "./services/cache.js";

const apiKey = process.env.PRICELABS_API_KEY;
if (!apiKey) {
  console.error("PRICELABS_API_KEY environment variable is required");
  process.exit(1);
}

const baseUrl = process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co";

// Initialize services
const rateLimiter = new TokenBucketRateLimiter(1000, 3600000);
const cache = new TtlCache();
const apiClient = new PriceLabsApiClient(apiKey, baseUrl, rateLimiter);

// Create MCP server
const server = new McpServer({
  name: "pricelabs",
  version: "1.0.0",
});

// Register all tools
registerListingTools(server, apiClient, cache, rateLimiter);
registerPriceTools(server, apiClient, cache, rateLimiter);
registerOverrideTools(server, apiClient, cache, rateLimiter);
registerNeighborhoodTools(server, apiClient, cache, rateLimiter);
registerReservationTools(server, apiClient, cache, rateLimiter);
registerSyncTools(server, apiClient, cache, rateLimiter);
registerRatePlanTools(server, apiClient, cache, rateLimiter);
registerStatusTools(server, rateLimiter, cache);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
```

### PriceLabs API Client

```typescript
// src/services/api-client.ts
// Source: PriceLabs API docs (SwaggerHub + Postman collection)
import { TokenBucketRateLimiter } from "./rate-limiter.js";

interface ApiResponse<T> {
  data: T;
  status: number;
}

export class PriceLabsApiClient {
  private readonly headers: Record<string, string>;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly rateLimiter: TokenBucketRateLimiter,
    private readonly timeoutMs: number = 300000, // PriceLabs recommended: 300s
  ) {
    this.headers = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryCount: number = 0,
  ): Promise<ApiResponse<T>> {
    const rateResult = this.rateLimiter.tryConsume();
    if (!rateResult.allowed) {
      throw new RateLimitError(rateResult.retryAfterMs!);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
        if (retryCount < 3) {
          await this.sleep(waitMs);
          return this.request<T>(method, path, body, retryCount + 1);
        }
        throw new RateLimitError(waitMs);
      }

      if (response.status === 401) {
        throw new AuthError("Invalid API key. Check PRICELABS_API_KEY configuration.");
      }

      if (response.status >= 500 && retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 30000);
        await this.sleep(delay);
        return this.request<T>(method, path, body, retryCount + 1);
      }

      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }

      // 204 No Content (successful delete)
      if (response.status === 204) {
        return { data: null as T, status: 204 };
      }

      return { data: await response.json() as T, status: response.status };
    } finally {
      clearTimeout(timeout);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### Tool Error Response Pattern

```typescript
// Source: MCP Protocol specification - error handling
// Errors returned inside tool result (visible to LLM), NOT as protocol errors
function toolError(message: string): { content: { type: string; text: string }[]; isError: true } {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

// Usage in a tool handler:
if (error instanceof AuthError) {
  return toolError(
    "Authentication failed. The PriceLabs API key is invalid or expired. " +
    "This is a critical error -- the agent cannot function without a valid key. " +
    "Please check the PRICELABS_API_KEY environment variable."
  );
}

if (error instanceof RateLimitError) {
  // Graceful degradation: serve cached if available
  const cached = cache.get(cacheKey);
  if (cached) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          data: cached.data,
          meta: {
            cache_age_seconds: cached.cacheAgeSeconds,
            data_source: "cached",
            api_calls_remaining: 0,
            note: `Using cached data (${Math.round(cached.cacheAgeSeconds / 60)} min old). Fresh data available in ${Math.ceil(error.retryAfterMs / 60000)} minutes.`,
          },
        }),
      }],
    };
  }
  return toolError(
    `Rate limit reached (1000 requests/hour). No cached data available. ` +
    `Try again in ${Math.ceil(error.retryAfterMs / 60000)} minutes.`
  );
}
```

### OpenClaw Configuration (Security + MCP)

```json5
// ~/.openclaw/openclaw.json
{
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    }
  },
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all",
        "scope": "agent",
        "workspaceAccess": "ro"
      }
    },
    "list": [
      {
        "id": "pricelabs",
        "name": "PriceLabs Revenue Agent",
        "workspace": "~/.openclaw/workspace",
        "model": "anthropic/claude-opus-4-6",
        "mcp": {
          "servers": [
            {
              "name": "pricelabs",
              "command": "node",
              "args": ["~/.openclaw/workspace/mcp-servers/pricelabs/dist/index.js"],
              "env": {
                "PRICELABS_API_KEY": "${PRICELABS_API_KEY}",
                "PRICELABS_BASE_URL": "https://api.pricelabs.co"
              }
            }
          ]
        }
      }
    ]
  },
  "tools": {
    "profile": "messaging",
    "deny": [
      "group:automation",
      "group:runtime",
      "exec",
      "write",
      "edit",
      "apply_patch",
      "process",
      "sessions_spawn",
      "sessions_send",
      "gateway",
      "cron"
    ],
    "fs": {
      "workspaceOnly": true
    },
    "exec": {
      "security": "deny",
      "ask": "always"
    },
    "elevated": {
      "enabled": false
    }
  },
  "channels": {
    "slack": {
      "enabled": true,
      "mode": "socket",
      "appToken": "${SLACK_APP_TOKEN}",
      "botToken": "${SLACK_BOT_TOKEN}",
      "dmPolicy": "pairing",
      "threadReply": true
    },
    "telegram": {
      "enabled": true,
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "dmPolicy": "pairing",
      "groups": {
        "*": {
          "requireMention": true
        }
      }
    }
  },
  "session": {
    "dmScope": "per-channel-peer"
  },
  "logging": {
    "redactSensitive": "tools",
    "redactPatterns": [
      "X-API-Key",
      "api[_-]?key",
      "PRICELABS"
    ]
  }
}
```

### Domain Knowledge Skill Structure

```markdown
<!-- ~/.openclaw/workspace/skills/pricelabs-domain/SKILL.md -->
---
name: pricelabs-domain
description: >
  PriceLabs domain knowledge -- optimization strategies, algorithm internals,
  common mistakes, and API field reference. Provides the analytical framework
  for revenue management decisions.
user-invocable: false
metadata: {"openclaw":{"always":true}}
---

# PriceLabs Domain Knowledge

You are a short-term rental revenue management expert with deep knowledge of
PriceLabs' dynamic pricing platform. Use this knowledge as an analytical
framework -- adapt your reasoning to each specific listing and situation.

## 1. Optimization Playbook

### The Weekly Review Loop
[12 strategies from research/03-optimization-playbook.md]
...

### Base Price Calibration
[Rules: 50th percentile anchor, adjust only after 30+ days of consistent data]
...

### DSO Strategy
[Percentage range -75 to 500, currency matching, orphan day awareness]
...

## 2. Algorithm Internals

### How HLP (Hyper Local Pulse) Works
[Demand colors: Red(high) > Orange > Yellow > Green > Blue(low)]
...

### Customization Hierarchy
[Listing > Group > Account level. Largest discount wins. Premiums stack.]
...

### Health Scores
[health_7_day, health_30_day, health_60_day interpretation]
...

## 3. Common Mistakes

### The DO NOT List
[14 common mistakes from research/07-common-mistakes.md]
...

## 4. API Field Reference

### Non-Obvious Fields
- `recommended_base_price`: String, not number. Parse carefully.
- `demand_color`: Hex color code (e.g., "#FF0000"). Map to demand level.
- `demand_desc`: Human-readable demand level string.
- `booking_status` / `booking_status_STLY`: Compare for pace analysis.
- `ADR` / `ADR_STLY`: -1 means unavailable data.
- `unbookable`: "0" or "1" as string, not boolean.
- `last_date_pushed` / `last_refreshed_at`: ISO timestamps for sync health.
- `health_7_day`, `health_30_day`, `health_60_day`: String health indicators.

### DSO Business Rules
- Percentage range: -75 to 500
- Fixed price currency MUST match PMS currency
- min_stay must be integer > 0
- check_in/check_out: 7-char binary string representing Mon-Sun (e.g., "1111100")
- Erroneous dates silently omitted from response
- DSO overrides ALL other settings including min price

## 5. Portfolio Context
[Placeholder -- populated during Phase 2 onboarding]
- Market type: [urban/beach/mountain/luxury]
- Property count: [N]
- PMS: [name]
- Seasonal patterns: [high/shoulder/low periods]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MCP SDK v1 `server.tool()` only | `server.registerTool()` with annotations | SDK v1.25+ | Tool annotations (destructive, readOnly) now properly exposed |
| MCP SDK single package | v2 splits into `@modelcontextprotocol/server` + `/client` | v2 pre-alpha (Q1 2026) | Use v1.x `@modelcontextprotocol/sdk` for now. Migration path exists. |
| Zod v3 only | Zod v4 internally (v3.25+ compat) | MCP SDK v1.25+ | Install `zod` 3.25+ or higher. SDK handles v4 import internally. |
| OpenClaw `auth: none` allowed | `auth: none` removed (CVE-2026-25253) | v2026.1.29 | Must use `token` or `password` auth mode. No unauthenticated gateway. |
| Open DM policy default | Pairing/allowlist recommended default | 2026 security guidance | `dmPolicy: "pairing"` or `"allowlist"` for all channels |

**Deprecated/outdated:**
- `node-fetch`: Replaced by Node 22 built-in `fetch`. Do not install.
- `auth: none` in OpenClaw: Removed in v2026.1.29. CVE-2026-25253.
- MCP SDK v2 for production: Still pre-alpha. Use v1.x stable branch.
- Zod v3 `.describe()` propagation issue: Fixed in v3.25+ with SDK v1.26.x. Ensure minimum versions.

## Open Questions

1. **MCP SDK `server.tool()` annotations overload**
   - What we know: The MCP protocol spec defines tool annotations. `server.registerTool()` accepts annotations. The `server.tool()` convenience method may have an overload with annotations.
   - What's unclear: The exact `server.tool()` overload signature for passing annotations in v1.26.x. Docs show `registerTool()` but many examples use `server.tool()`.
   - Recommendation: Use `server.registerTool()` if `server.tool()` does not expose annotations. Both are supported. Verify at implementation time by checking SDK types.

2. **OpenClaw MCP server `env` variable syntax**
   - What we know: OpenClaw's `agents.list[].mcp.servers[].env` accepts key-value pairs. `${VAR_NAME}` syntax references values from `~/.openclaw/.env`.
   - What's unclear: Whether env vars are interpolated at gateway startup or at server spawn time. Whether the MCP server process inherits the full parent env or only the explicit `env` block.
   - Recommendation: Be explicit -- list all needed env vars in the `env` block. Do not rely on inherited env. Test at implementation time.

3. **OpenClaw tool deny lists vs MCP tools**
   - What we know: OpenClaw's `tools.deny` controls built-in tools. MCP server tools are namespaced (e.g., `mcp_pricelabs_get_listings`).
   - What's unclear: Whether `tools.deny` can also deny specific MCP tools, or if MCP tools bypass tool access control.
   - Recommendation: Test at implementation time. If MCP tools bypass deny lists, tool-level authorization must be handled within the MCP server itself.

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK v1.x GitHub](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x) -- McpServer class, server.tool(), stdio transport
- [MCP Protocol Specification - Tools](https://modelcontextprotocol.io/legacy/concepts/tools) -- Tool annotations, error handling, security considerations
- [MCP TypeScript SDK docs/server.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- registerTool(), logging, structured output
- [OpenClaw Security Documentation](https://docs.openclaw.ai/gateway/security) -- Gateway auth, binding, tool profiles, sandbox, redaction
- [PriceLabs Customer API SwaggerHub](https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3) -- All 12 endpoint specifications
- [PriceLabs API Postman Collection](https://documenter.getpostman.com/view/507656/SVSEurQC) -- Request/response examples
- Project research files: `research/02-api-reference.md`, `research/03-optimization-playbook.md`, `research/05-algorithm-and-settings.md`, `research/07-common-mistakes.md`
- Project architecture files: `agent/api-client-spec.md`, `agent/architecture.md`
- Project planning files: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`

### Secondary (MEDIUM confidence)
- [OpenClaw Configuration Guide (MoltFounders)](https://moltfounders.com/openclaw-configuration) -- openclaw.json annotated reference
- [OpenClaw Docker Hardening Guide](https://advenboost.com/en/openclaw-docker-hardening-your-ai-sandbox-for-production-2026/) -- Docker sandbox production patterns
- [OpenClaw Security Hardening Guide (aimaker)](https://aimaker.substack.com/p/openclaw-security-hardening-guide) -- 3-tier security implementation
- [MCPcat Building MCP Server TypeScript Guide](https://mcpcat.io/guides/building-mcp-server-typescript/) -- Practical server patterns
- [FreeCodeCamp MCP Server Handbook](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/) -- server.tool() examples
- [Snyk: Leaky Skills Research](https://snyk.io/blog/openclaw-skills-credential-leaks-research/) -- Credential leak patterns
- [OpenClaw MCP Support Issue #4834](https://github.com/openclaw/openclaw/issues/4834) -- MCP configuration format

### Tertiary (LOW confidence)
- [Token Bucket Algorithm (Medium)](https://medium.com/@surajshende247/token-bucket-algorithm-rate-limiting-db4c69502283) -- General algorithm reference
- [DeepWiki: Tool Security and Sandboxing](https://deepwiki.com/openclaw/openclaw/6.2-tool-security-and-sandboxing) -- Community analysis of sandbox defaults

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- MCP SDK v1.26.x is well-documented and widely used. Zod peer dependency confirmed. Node 22 LTS confirmed as project constraint.
- Architecture: HIGH -- MCP server patterns are well-established. Tool registration, stdio transport, and error handling patterns verified against official docs and multiple sources.
- PriceLabs API: HIGH -- All 12 endpoints documented from SwaggerHub + Postman + project research. Business rules (DSO ranges, currency matching, silent omission) verified.
- OpenClaw Security: HIGH -- Gateway auth, binding, tool profiles, sandbox, and redaction all documented in official OpenClaw security docs. CVE-2026-25253 confirmed.
- Rate Limiting: HIGH -- Token bucket algorithm is well-understood. PriceLabs 1000/hr limit confirmed. Implementation is trivially simple.
- Cache Strategy: MEDIUM -- TTL values are recommendations based on data change frequency analysis. No official PriceLabs guidance on optimal cache durations.
- Tool Annotations: MEDIUM -- Protocol spec is clear on annotations. SDK surface for passing them via convenience methods needs verification at implementation time.
- Domain Skill: MEDIUM -- Structure is recommended based on OpenClaw skill documentation and project research. Actual content effectiveness needs validation with real agent interaction.

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days -- stable domain, unlikely to change significantly)
