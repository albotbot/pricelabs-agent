# Technology Stack

**Project:** PriceLabs AI Revenue Management Agent
**Researched:** 2026-02-22
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Stack Decision

This agent runs **entirely within the OpenClaw runtime**. There is no standalone application server, no separate Node.js process to deploy, and no custom web framework. OpenClaw IS the runtime. The stack decisions below center on how to structure content within OpenClaw's skill/MCP/cron/channel architecture, not on choosing between web frameworks.

---

## Recommended Stack

### Core Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| OpenClaw Gateway | 2026.2.x | Agent runtime, scheduling, channel routing | The entire agent runs here. Skills define behavior, cron drives automation, channels deliver output. No alternative -- this is the project constraint. | HIGH |
| Claude Opus 4.6 | Current | LLM backbone for reasoning and analysis | OpenClaw's configured model. Handles revenue analysis, alert generation, natural language interaction. | HIGH |

**Rationale:** OpenClaw is not a library we are importing -- it is the operating environment. Every component below plugs into OpenClaw's extension points: skills, MCP servers, cron jobs, and channel adapters. This distinction matters because it means we do NOT need Express, Fastify, or any web server. We do NOT need a separate process manager. OpenClaw's Gateway handles lifecycle, scheduling, and message routing.

### Skill Architecture: Multi-Skill with Shared MCP

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Workspace Skills | N/A | Agent behavior definitions | Skills in `~/.openclaw/workspace/skills/` define what the agent can do. Each skill is a SKILL.md with YAML frontmatter and natural language instructions. | HIGH |
| Multi-skill design | N/A | Separation of concerns | One monolithic skill would be unwieldy. Separate skills for monitoring, analysis, pricing actions, and onboarding keep instructions focused and avoid prompt bloat (each skill costs ~97 chars + field lengths in context). | HIGH |

**Skill breakdown (5 skills recommended):**

| Skill Name | Trigger | Responsibility |
|------------|---------|----------------|
| `pricelabs-monitor` | Cron (daily/weekly) | Health checks, occupancy alerts, sync freshness, daily/weekly summaries |
| `pricelabs-analyze` | User-invoked | Interactive queries -- "How is listing X performing?", market analysis, pricing breakdowns |
| `pricelabs-optimize` | User-invoked + cron | Base price recommendations, DSO management, orphan gap detection |
| `pricelabs-action` | User-invoked (human-in-loop) | Execute pricing changes (base price updates, DSO creation/deletion, push sync). Always requires confirmation. |
| `pricelabs-report` | Cron (monthly) | Portfolio KPI reports, monthly strategy reviews, booking pace analysis |

**Why multi-skill over single-skill:**
- Token economy: Only relevant skills load into context for a given interaction. A single skill with all 7 workflows would consume ~2000+ tokens of instructions on every turn.
- Separation of read vs write: `pricelabs-action` is the only skill that mutates data. It can have stricter guardrails (confirmation prompts, logging) without cluttering read-only skills.
- Cron targeting: Different cron jobs invoke different skills. The daily monitor does not need optimization logic in context.

**Why NOT more granular skills (e.g., one per workflow):**
- Diminishing returns. OpenClaw loads all workspace skills into the prompt preamble as an XML list. More skills = more baseline token cost even when not invoked. Five is the sweet spot for this domain.

### MCP Server: Custom PriceLabs MCP

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@modelcontextprotocol/sdk` | 1.26.x | MCP server framework | Official TypeScript SDK for building MCP servers. Mature (26,000+ dependents), well-documented. | HIGH |
| Custom `pricelabs-mcp` server | N/A | PriceLabs API wrapper as MCP tools | Exposes all 12 Customer API endpoints as structured MCP tools with input validation, rate limiting, and caching built in. | HIGH |
| `zod` | 3.25+ | Input/output schema validation | Required peer dependency of MCP SDK. Also validates PriceLabs API payloads before sending. | HIGH |
| `stdio` transport | N/A | MCP communication channel | OpenClaw spawns MCP servers as child processes communicating over stdin/stdout via JSON-RPC 2.0. Simplest setup, no network overhead, no port management. | HIGH |

**Why a custom MCP server instead of direct API calls from skills:**

This is the critical architectural decision. Two approaches exist:

1. **Skills with bash/curl calls** -- Skills instruct the agent to call the PriceLabs API via `curl` or a script. Simple but fragile: no type safety, no rate limiting, no caching, error handling in natural language is unreliable.

2. **Custom MCP server** (recommended) -- A TypeScript process that exposes PriceLabs endpoints as typed MCP tools. The agent calls `mcp__pricelabs__getListings()` instead of constructing HTTP requests. Benefits:
   - **Rate limiting built into the server** -- The MCP server tracks request counts and blocks/queues calls exceeding 1000/hr. The agent never needs to worry about rate limits.
   - **Response caching** -- Listings cached for 1hr, prices for 6hr, neighborhood data for 24hr. Prevents redundant API calls across cron runs.
   - **Input validation** -- Zod schemas reject invalid DSO percentages (must be -75 to 500), bad date formats, missing required fields before hitting the API.
   - **Structured responses** -- MCP tools return typed JSON, not raw HTTP responses. The agent gets clean data to reason about.
   - **Error normalization** -- HTTP 429, 400, 401, 500 all become structured MCP error responses with appropriate retry guidance.

**MCP server configuration in openclaw.json:**

```json5
{
  agents: {
    list: [{
      id: "pricelabs",
      mcp: {
        servers: [{
          name: "pricelabs",
          transport: "stdio",
          command: "node",
          args: ["~/.openclaw/workspace/mcp-servers/pricelabs/dist/index.js"],
          env: {
            PRICELABS_API_KEY: "${PRICELABS_API_KEY}",
            PRICELABS_BASE_URL: "https://api.pricelabs.co"
          }
        }]
      }
    }]
  }
}
```

**MCP Tools to expose (12 tools mapping to 12 API endpoints):**

| MCP Tool | API Endpoint | Input Schema | Caching |
|----------|-------------|--------------|---------|
| `getListings` | GET /v1/listings | `{ skipHidden?: bool, onlySyncing?: bool }` | 1hr |
| `getListing` | GET /v1/listings/{id} | `{ listingId: string }` | 1hr |
| `updateListings` | POST /v1/listings | `{ listings: [{ id, pms, min?, base?, max?, tags? }] }` | Invalidates cache |
| `getPrices` | POST /v1/listing_prices | `{ listings: [{ id, pms, dateFrom?, dateTo?, reason?: bool }] }` | 6hr |
| `getOverrides` | GET /v1/listings/{id}/overrides | `{ listingId: string, pms: string }` | 6hr |
| `setOverrides` | POST /v1/listings/{id}/overrides | `{ listingId, pms, overrides: Override[] }` | Invalidates cache |
| `deleteOverrides` | DELETE /v1/listings/{id}/overrides | `{ listingId, pms, dates: string[] }` | Invalidates cache |
| `getNeighborhoodData` | GET /v1/neighborhood_data | `{ listingId: string, pms: string }` | 24hr |
| `getReservations` | GET /v1/reservation_data | `{ startDate, endDate, pms?, limit?, offset? }` | 1hr |
| `pushPrices` | POST /v1/push_prices | `{ listingId: string, pmsName: string }` | No cache |
| `getRatePlans` | GET /v1/fetch_rate_plans | `{ listingId: string, pmsName: string }` | 6hr |
| `getPortfolioSummary` | Composite | `{}` | 1hr |

The last tool (`getPortfolioSummary`) is a composite that calls `getListings` then enriches with occupancy/health summaries. This saves the agent from needing multi-step reasoning for the most common query.

### Data Persistence

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| SQLite (via MCP server) | Built-in Node.js | Historical data, trend tracking, alert state | Lightweight, zero-ops, ACID-compliant. OpenClaw already uses SQLite for its own memory index. No external DB to provision. | HIGH |
| OpenClaw Memory (Markdown) | Built-in | Agent working memory, decisions, preferences | OpenClaw's native memory system: `MEMORY.md` for durable facts, `memory/YYYY-MM-DD.md` for daily logs. The agent writes here naturally. | HIGH |
| MCP server in-process cache | N/A | API response caching | In-memory TTL cache inside the MCP server process. Survives within a session but not across Gateway restarts. Good enough -- SQLite handles durable storage. | MEDIUM |

**Data persistence architecture:**

```
Layer 1: OpenClaw Memory (Markdown files)
  - MEMORY.md: Portfolio configuration, user preferences, listing metadata
  - memory/YYYY-MM-DD.md: Daily monitoring results, alerts triggered, actions taken

Layer 2: SQLite Database (inside MCP server)
  - Historical snapshots: occupancy, pricing, revenue at daily granularity
  - Alert history: what was flagged, when, resolution
  - Comparison baselines: STLY metrics for trend analysis

Layer 3: In-Memory Cache (inside MCP server)
  - API response cache with TTL per endpoint
  - Rate limiter state (sliding window counter)
```

**Why SQLite over file-based JSON storage:**
- Need to query historical trends: "What was occupancy for listing X over the last 30 days?" JSON files require loading entire files and filtering in code. SQLite handles this with indexed queries.
- Need atomic writes: Concurrent cron jobs (monitor + optimize) could corrupt a shared JSON file. SQLite provides ACID transactions.
- Need aggregate queries: Portfolio-level KPIs (avg ADR, total RevPAR) across all listings are trivial SQL but painful JSON manipulation.

**Why SQLite over PostgreSQL/external DB:**
- Single-user agent. No concurrent write contention requiring a server-based DB.
- Zero ops: No database server to provision, monitor, back up separately. SQLite file lives alongside the MCP server.
- OpenClaw already demonstrates SQLite is the right choice for this scale -- it uses SQLite for its own memory indexing.

**SQLite location:** `~/.openclaw/workspace/data/pricelabs.db`

**Schema tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `listing_snapshots` | Daily listing state | `listing_id, date, occupancy_30, market_occ_30, health_7, base_price, recommended_base` |
| `price_snapshots` | Price tracking | `listing_id, date, price, uncustomized_price, demand_desc, adr, adr_stly` |
| `reservation_events` | Booking history | `reservation_id, listing_id, check_in, check_out, booked_date, status, revenue` |
| `alerts` | Alert log | `id, listing_id, type, severity, message, created_at, resolved_at` |
| `actions` | Change audit trail | `id, listing_id, action_type, old_value, new_value, approved_by, executed_at` |

### Scheduling (Cron)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| OpenClaw Cron | Built-in | Recurring automated workflows | Native to OpenClaw Gateway. Jobs persist in `~/.openclaw/cron/jobs.json`. Supports cron expressions with timezone, session isolation, and channel delivery. No external scheduler needed. | HIGH |

**Cron job schedule:**

| Job Name | Schedule | Session | Delivery | Skill Invoked |
|----------|----------|---------|----------|--------------|
| Daily Health Check | `0 8 * * *` (8am daily) | Isolated | Announce to Slack + Telegram | `pricelabs-monitor` |
| Price Optimization Scan | `0 9 * * 1,4` (Mon+Thu 9am) | Isolated | Announce to Slack | `pricelabs-optimize` |
| Weekly Market Analysis | `0 10 * * 1` (Mon 10am) | Isolated | Announce to Slack + Telegram | `pricelabs-analyze` |
| Monthly Strategy Review | `0 9 1 * *` (1st of month 9am) | Isolated | Announce to Slack + Telegram | `pricelabs-report` |
| Stale Sync Check | `0 */4 * * *` (every 4 hours) | Isolated | Announce to Slack (critical only) | `pricelabs-monitor` |

**Why isolated sessions for cron:**
- Prevents cron output from polluting the main chat session history.
- Each cron run gets fresh context with `[cron:<jobId> <job name>]` prefix for traceability.
- Cron output delivers directly to messaging channels via `delivery.mode: "announce"`.

**Known issue (2026.2.x):** There is a reported bug where daily cron jobs can skip days (48hr jumps instead of 24hr). Mitigation: Use `0 */4 * * *` for critical monitoring instead of daily-only schedules, and monitor cron run history via `openclaw cron runs --id <jobId>`.

**Example cron job configuration (tool call format):**

```json5
{
  "name": "PriceLabs Daily Health Check",
  "schedule": { "kind": "cron", "expr": "0 8 * * *", "tz": "America/Chicago" },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Run the daily PriceLabs health check. Fetch all listings, check health scores, compare occupancy vs market, flag stale syncs, and generate alert summary. Deliver results as a formatted daily report.",
    "model": "anthropic/claude-opus-4-6",
    "timeoutSeconds": 300
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C_PRICELABS_ALERTS",
    "bestEffort": true
  }
}
```

### Messaging Channels

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Slack (via OpenClaw channel) | Bolt SDK (built-in) | Primary interactive channel | OpenClaw's Slack integration uses Bolt SDK with Socket Mode. No custom Slack app to build -- configure in openclaw.json. Thread support for interactive queries, slash commands for quick actions. | HIGH |
| Telegram (via OpenClaw channel) | grammY (built-in) | Secondary channel, mobile alerts | OpenClaw's Telegram integration uses grammY library. Long polling by default. Forum topic support for organizing by listing group. Good for on-the-go alerts. | HIGH |

**Why NOT build separate Slack/Telegram bots:**
- OpenClaw already has production-ready channel adapters for both platforms. Building custom bots with `@slack/bolt` or `grammy` directly would duplicate functionality that already exists.
- Cron job delivery integrates natively with channel adapters -- `delivery.mode: "announce"` routes cron output directly to Slack channels or Telegram chats.
- Thread management, message chunking (4000 char limit), streaming, and reaction handling are all built in.

**Slack configuration in openclaw.json:**

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      appToken: "${SLACK_APP_TOKEN}",
      botToken: "${SLACK_BOT_TOKEN}",
      dm: {
        enabled: true,
        policy: "allowlist",
        allowFrom: ["U_OWNER_ID"]
      },
      channels: {
        "#pricelabs-alerts": {
          allow: true,
          requireMention: false
        },
        "#pricelabs-reports": {
          allow: true,
          requireMention: true
        }
      },
      slashCommand: {
        enabled: true,
        name: "pricelabs"
      }
    }
  }
}
```

**Telegram configuration in openclaw.json:**

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",
      dmPolicy: "allowlist",
      allowFrom: [OWNER_TELEGRAM_ID],
      groups: {
        "-100PRICELABS_GROUP": {
          groupPolicy: "allowlist",
          requireMention: false,
          allowFrom: [OWNER_TELEGRAM_ID]
        }
      }
    }
  }
}
```

### Supporting Libraries (inside MCP server)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@modelcontextprotocol/sdk` | 1.26.x | MCP server framework | Always -- core of the MCP server |
| `zod` | 3.25+ | Schema validation | Always -- validates all API inputs/outputs |
| `better-sqlite3` | 11.x | SQLite driver for Node.js | Historical data persistence, trend queries |
| `node-fetch` or built-in `fetch` | Node 22+ built-in | HTTP client for PriceLabs API | All API calls from MCP server to PriceLabs |
| `typescript` | 5.7+ | Type safety for MCP server | Development-time only |

**Why `better-sqlite3` over `sql.js` or `sqlite3`:**
- Synchronous API matches MCP tool execution model (tools are request/response, not streaming).
- Best performance for read-heavy workloads (which this is -- mostly querying historical data).
- No WASM overhead (unlike sql.js).
- Well-maintained, widely used.

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| VPS (any Linux provider) | Ubuntu 22.04+ | Host OpenClaw Gateway | OpenClaw needs a persistent process for cron jobs and channel monitors. A $10-15/mo VPS (DigitalOcean, Hetzner, etc.) is sufficient. | HIGH |
| Node.js | 22.x LTS | MCP server runtime | Required for OpenClaw and MCP TypeScript SDK. Use LTS for stability. | HIGH |
| systemd | N/A | Process management | Run OpenClaw Gateway as a systemd service for auto-restart on crash. | MEDIUM |
| Git | N/A | Version control for skills and MCP server | Track SKILL.md changes, MCP server code, configuration. | HIGH |

**Why a VPS over serverless/local:**
- OpenClaw's cron system requires the Gateway to be running persistently. Lambda/Cloud Functions cannot host a long-running WebSocket process.
- Channel monitors (Slack Socket Mode, Telegram long polling) need persistent connections.
- A $10-15/mo VPS handles everything: OpenClaw Gateway, MCP server, SQLite, cron.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| API Integration | Custom MCP server | Skills with bash/curl | No type safety, no built-in caching, no rate limiting. Agent would need to reason about HTTP errors in natural language. |
| API Integration | Custom MCP server | Generic REST MCP (dkmaker/mcp-rest-api) | Too generic -- no PriceLabs-specific validation (DSO ranges, currency matching), no domain-aware caching TTLs. |
| Data Persistence | SQLite (via better-sqlite3) | JSON files in workspace | No indexed queries for historical trends. Concurrent cron writes risk corruption. Aggregate queries are painful. |
| Data Persistence | SQLite (via better-sqlite3) | PostgreSQL | Over-engineered for single-user agent. Adds ops burden (DB server to maintain). SQLite handles this workload trivially. |
| Data Persistence | SQLite (via better-sqlite3) | OpenClaw Memory only | Memory is Markdown-based, not queryable for trend analysis. Good for agent working memory, bad for time-series data. |
| Scheduling | OpenClaw Cron | External cron (system crontab) | Would need to shell out to `openclaw` CLI. Loses session isolation, delivery routing, retry backoff. Reinvents what already exists. |
| Scheduling | OpenClaw Cron | node-cron in MCP server | MCP servers are stateless tool providers. They should not have their own scheduling. Scheduling belongs in the orchestration layer (OpenClaw). |
| Messaging | OpenClaw Channels | Custom Slack/Telegram bots | Duplicate effort. OpenClaw already handles auth, message routing, threading, chunking, streaming. Building custom bots adds code to maintain with no benefit. |
| Skill Design | 5 focused skills | 1 monolithic skill | Token bloat: all instructions load on every turn. No way to target cron to specific behavior subsets. |
| Skill Design | 5 focused skills | 10+ micro-skills | Diminishing returns. More skills = more baseline token cost in prompt preamble. Five is the right granularity for this domain. |
| LLM | Claude Opus 4.6 | GPT-5-mini, Gemini 3 | OpenClaw supports model fallbacks, but Opus 4.6 is the best choice for complex revenue analysis reasoning. Could configure fallbacks for cost-sensitive cron jobs. |

---

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| Express/Fastify/Hono web server | OpenClaw IS the server. Do not build a separate web application. |
| Separate Slack Bolt app | OpenClaw has built-in Slack support via Bolt SDK. A separate app duplicates functionality. |
| Separate grammY Telegram bot | Same -- OpenClaw has built-in Telegram support via grammY. |
| Redis for caching | Overkill. In-memory TTL cache in the MCP server process handles API response caching. If the process restarts, a few cache misses are fine -- the API is called again. |
| Docker/Kubernetes | A single OpenClaw instance with one MCP server does not need container orchestration. systemd on a VPS is simpler and cheaper. |
| Prisma/TypeORM/Drizzle | For 5 simple SQLite tables with straightforward queries, raw SQL via better-sqlite3 is cleaner. ORM overhead adds complexity without benefit at this scale. |
| LangChain/LangGraph | OpenClaw IS the agent orchestration framework. LangChain would add an unnecessary abstraction layer between the agent and its tools. |
| Supabase/Firebase | External hosted databases add latency, cost, and complexity. SQLite file on the same machine has zero network overhead. |
| cron npm package | OpenClaw has native cron. Using a library-level scheduler inside the MCP server would fight against OpenClaw's architecture. |

---

## Installation & Setup

### Prerequisites

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# OpenClaw (follow official install for your platform)
# https://docs.openclaw.ai/getting-started/installation
```

### MCP Server Setup

```bash
# Create MCP server directory
mkdir -p ~/.openclaw/workspace/mcp-servers/pricelabs
cd ~/.openclaw/workspace/mcp-servers/pricelabs

# Initialize project
npm init -y
npm install @modelcontextprotocol/sdk zod better-sqlite3
npm install -D typescript @types/node @types/better-sqlite3

# Build
npx tsc

# MCP server entry point: dist/index.js
```

### Skills Setup

```bash
# Create skill directories
mkdir -p ~/.openclaw/workspace/skills/pricelabs-monitor
mkdir -p ~/.openclaw/workspace/skills/pricelabs-analyze
mkdir -p ~/.openclaw/workspace/skills/pricelabs-optimize
mkdir -p ~/.openclaw/workspace/skills/pricelabs-action
mkdir -p ~/.openclaw/workspace/skills/pricelabs-report

# Each directory gets a SKILL.md file
```

### Environment Variables

```bash
# Required
export PRICELABS_API_KEY="your-pricelabs-api-key"
export SLACK_APP_TOKEN="xapp-..."
export SLACK_BOT_TOKEN="xoxb-..."
export TELEGRAM_BOT_TOKEN="123:abc..."

# Optional
export ANTHROPIC_API_KEY="sk-ant-..."  # If using Anthropic directly
```

### OpenClaw Configuration

The main `~/.openclaw/openclaw.json` ties everything together: agent definition, MCP server, channels, and cron jobs. See the configuration examples in the sections above.

---

## File/Directory Map

```
~/.openclaw/
  openclaw.json                          # Main configuration
  workspace/
    MEMORY.md                            # Durable agent memory
    memory/                              # Daily logs
      YYYY-MM-DD.md
    skills/
      pricelabs-monitor/SKILL.md         # Monitoring skill
      pricelabs-analyze/SKILL.md         # Analysis skill
      pricelabs-optimize/SKILL.md        # Optimization skill
      pricelabs-action/SKILL.md          # Action skill (write ops)
      pricelabs-report/SKILL.md          # Reporting skill
    mcp-servers/
      pricelabs/
        src/
          index.ts                       # MCP server entry point
          tools/                         # Tool implementations
            listings.ts
            prices.ts
            overrides.ts
            neighborhoods.ts
            reservations.ts
            sync.ts
          services/
            api-client.ts               # PriceLabs HTTP client
            rate-limiter.ts             # Sliding window rate limiter
            cache.ts                    # In-memory TTL cache
            db.ts                       # SQLite connection + migrations
          schemas/                       # Zod schemas
            listing.ts
            price.ts
            override.ts
        dist/                            # Compiled JS
        package.json
        tsconfig.json
    data/
      pricelabs.db                       # SQLite database
  cron/
    jobs.json                            # Persisted cron jobs
    runs/                                # Cron execution history
  memory/
    pricelabs.sqlite                     # OpenClaw memory index
```

---

## API Rate Budget Verification

With 1000 requests/hour from PriceLabs:

| Operation | Requests | Frequency | Monthly Total |
|-----------|----------|-----------|--------------|
| Get all listings | 1 | 6x/day (cron + interactive) | ~180 |
| Get prices (batch) | 1 per batch | 2x/week + interactive | ~50 |
| Get neighborhood data | 1 per listing | 1x/week (50 listings) | ~200 |
| Get reservations | 1-5 (paginated) | 1x/day | ~150 |
| Get/Set DSOs | 2 per listing | 1x/week (subset) | ~100 |
| Push prices | 1 per listing | As needed | ~50 |
| Interactive queries | Variable | ~10/day | ~300 |

**Total estimated: ~1,030 requests/month.** Well within the 1000/hour limit. Even the busiest hour (weekly analysis of 50 listings) uses ~55 requests, leaving 945 requests of headroom. The MCP server's caching layer further reduces actual API calls.

---

## Sources

### OpenClaw (Official Docs) -- HIGH Confidence
- [Skills Documentation](https://docs.openclaw.ai/tools/skills) -- Skill format, YAML frontmatter, loading hierarchy
- [Cron Jobs](https://docs.openclaw.ai/automation/cron-jobs) -- Scheduling, session isolation, delivery modes
- [Memory System](https://docs.openclaw.ai/concepts/memory) -- SQLite indexing, FTS5, persistence architecture
- [Telegram Channel](https://docs.openclaw.ai/channels/telegram) -- grammY integration, access control, topic support
- [Slack Channel](https://docs.openclaw.ai/channels/slack) -- Bolt SDK, Socket Mode, slash commands
- [Configuration Reference](https://docs.openclaw.ai/gateway/configuration) -- openclaw.json structure

### OpenClaw (Community/Third-Party) -- MEDIUM Confidence
- [OpenClaw Configuration Guide 2026](https://moltfounders.com/openclaw-configuration) -- Annotated config reference
- [Custom Skill Creation Guide](https://zenvanriel.nl/ai-engineer-blog/openclaw-custom-skill-creation-guide/) -- Skill design patterns
- [OpenClaw Cron Jobs Guide](https://zenvanriel.nl/ai-engineer-blog/openclaw-cron-jobs-proactive-ai-guide/) -- Practical cron patterns
- [My OpenClaw Production Stack](https://medium.com/@rentierdigital/the-complete-openclaw-architecture-that-actually-scales-memory-cron-jobs-dashboard-and-the-c96e00ab3f35) -- Real-world deployment reference
- [Channel Architecture Deep Dive](https://deepwiki.com/openclaw/openclaw/8-channels) -- Channel monitor pattern

### MCP Protocol -- HIGH Confidence
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.26.0, 26,000+ dependents
- [Build an MCP Server (Official)](https://modelcontextprotocol.io/docs/develop/build-server) -- TypeScript server guide
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- Source, examples, transport docs

### PriceLabs API -- HIGH Confidence
- [Customer API SwaggerHub](https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3) -- Endpoint reference
- [Postman Collection](https://documenter.getpostman.com/view/507656/SVSEurQC) -- Request/response examples
- [PriceLabs API Help](https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api) -- Auth, rate limits, setup

### SQLite -- HIGH Confidence
- [Local-First RAG: SQLite for AI Agent Memory](https://www.pingcap.com/blog/local-first-rag-using-sqlite-ai-agent-memory-openclaw/) -- SQLite in OpenClaw context
- [better-sqlite3 on npm](https://www.npmjs.com/package/better-sqlite3) -- Synchronous SQLite driver

### OpenClaw GitHub -- HIGH Confidence
- [openclaw/openclaw](https://github.com/openclaw/openclaw) -- Main repository (100k+ stars)
- [MCP Support Issue #4834](https://github.com/openclaw/openclaw/issues/4834) -- Native MCP support tracking
- [Cron Skip Bug #17852](https://github.com/openclaw/openclaw/issues/17852) -- Known daily cron skip issue
