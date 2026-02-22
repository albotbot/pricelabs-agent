# Architecture Patterns

**Domain:** AI Revenue Management Agent (OpenClaw + PriceLabs API)
**Researched:** 2026-02-22

## Recommended Architecture

### High-Level Overview

The system follows OpenClaw's native 4-layer architecture: **Gateway** (control plane + channels), **Integration** (MCP servers + skills), **Execution** (agent turns + cron jobs), and **Intelligence** (Claude Opus 4.6 reasoning). The PriceLabs agent maps cleanly onto this model by treating the PriceLabs REST API as a custom MCP server that the agent invokes through natural tool calls, with scheduling handled by OpenClaw's built-in cron system and human approval handled through the messaging channels themselves.

```
+------------------------------------------------------------------+
|                     OpenClaw Gateway                              |
|  ws://127.0.0.1:18789                                           |
|  ~/.openclaw/openclaw.json                                       |
+------------------------------------------------------------------+
        |                    |                    |
   +---------+        +-----------+        +------------+
   | Slack   |        | Telegram  |        | Cron       |
   | (Bolt)  |        | (grammY)  |        | Scheduler  |
   | Socket  |        | Long-Poll |        | jobs.json  |
   +---------+        +-----------+        +------------+
        |                    |                    |
        +--------------------+--------------------+
                             |
                    +------------------+
                    |   Agent Runtime  |
                    |  Claude Opus 4.6 |
                    +------------------+
                      |       |      |
              +-------+  +---+---+  +----------+
              |          |       |              |
   +------------------+  |  +----------+  +-----------+
   | PriceLabs MCP    |  |  | SQLite   |  | Approval  |
   | Server (custom)  |  |  | MCP      |  | Skill     |
   | stdio transport  |  |  | Server   |  | (channel) |
   +------------------+  |  +----------+  +-----------+
              |          |       |
   +------------------+  |  +-----------+
   | api.pricelabs.co |  |  | local DB  |
   | REST API         |  |  | .sqlite   |
   | X-API-Key auth   |  |  +-----------+
   +------------------+  |
                         |
              +------------------+
              | Skills           |
              | (SKILL.md files) |
              +------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **OpenClaw Gateway** | WebSocket control plane, channel management, session routing, cron scheduling, hot-reload config | All components (orchestrator) |
| **Slack Channel** | Bolt Socket Mode adapter; receives user messages, delivers agent responses and cron output | Gateway (inbound messages, outbound delivery) |
| **Telegram Channel** | grammY long-polling adapter; receives user messages, delivers agent responses and cron output | Gateway (inbound messages, outbound delivery) |
| **Cron Scheduler** | Persists jobs in `~/.openclaw/cron/jobs.json`; triggers daily/weekly/monthly workflows as isolated sessions | Gateway (session creation), agent runtime (turn execution) |
| **Agent Runtime (Claude Opus 4.6)** | Reasoning engine; interprets user queries, executes workflows, calls MCP tools, generates reports | MCP servers (tool calls), skills (instructions), channels (responses) |
| **PriceLabs MCP Server** | Custom TypeScript MCP server wrapping all 12 PriceLabs API endpoints as tools; handles auth, rate limiting, caching, error handling | Agent runtime (tool interface), PriceLabs REST API (HTTP) |
| **SQLite MCP Server** | Provides structured data persistence for historical tracking, snapshots, and trend analysis | Agent runtime (tool interface), local `.sqlite` file |
| **Skills (SKILL.md)** | Markdown instruction files teaching the agent domain knowledge, workflow procedures, and behavioral rules | Agent runtime (system prompt injection) |
| **Approval Flow** | Human-in-the-loop via channel messaging; agent proposes changes, waits for explicit user confirmation before executing writes | Agent runtime (pause/resume), channels (user interaction) |

### Data Flow

**Interactive Query (user asks a question):**
```
User (Slack/Telegram)
  -> Gateway routes to agent by binding
    -> Agent runtime loads skills + context
      -> Agent calls PriceLabs MCP tools (read-only)
      -> Agent calls SQLite MCP tools (read historical data)
    -> Agent formulates response
  -> Gateway delivers to originating channel
-> User sees answer
```

**Scheduled Monitoring (cron-triggered):**
```
Cron scheduler fires (e.g., "0 8 * * *")
  -> Gateway creates isolated session
    -> Agent runtime loads skills + HEARTBEAT.md
      -> Agent calls PriceLabs MCP tools (fetch listings, prices, etc.)
      -> Agent calls SQLite MCP tools (compare to yesterday's snapshot)
      -> Agent stores new snapshot in SQLite
      -> Agent generates health report
    -> Delivery: announce mode to Slack channel + Telegram group
  -> Users see daily summary in messaging
```

**Pricing Change (write with approval):**
```
Agent identifies optimization opportunity (from cron or interactive analysis)
  -> Agent formats recommendation with specifics:
     "Listing 'Beach House' base price: $180 -> $210 (+17%)
      Reason: Consistently above 75th percentile, booking pace 30% ahead of STLY
      Approve? (yes/no)"
  -> Message delivered to channel
  -> User replies "yes" or "approved"
  -> Agent receives approval in same session or new turn
    -> Agent calls PriceLabs MCP write tool (updateListings or setOverrides)
    -> Agent calls pushPrices tool to trigger sync
    -> Agent logs action in SQLite with timestamp + rationale
  -> Confirmation sent to user
```

---

## OpenClaw Skill Structure: Multiple Specialized Skills

**Recommendation: 5 focused skills, not 1 monolithic skill.** Each skill has a single domain of responsibility. This keeps system prompt token cost manageable (skills inject ~97 chars + content per skill) and lets you iterate on one workflow without touching others.

### Skill 1: `pricelabs-monitor`

**Purpose:** Daily health checks, sync monitoring, alert generation.
**Location:** `~/.openclaw/workspace/skills/pricelabs-monitor/SKILL.md`
**Model invocation:** Yes (agent uses for scheduled monitoring)
**User invocable:** No (triggered by cron, not slash command)

```yaml
---
name: pricelabs-monitor
description: Portfolio health monitoring - daily checks, sync alerts, occupancy tracking, revenue comparison vs STLY.
user-invocable: false
---
```

**Content covers:**
- How to interpret health scores (health_7_day, health_30_day, health_60_day)
- Alert thresholds (stale sync >48h, low occupancy <80% of market, revenue drop >30% vs STLY)
- Report format for daily summaries
- When to escalate vs. inform

### Skill 2: `pricelabs-analyst`

**Purpose:** Interactive pricing analysis, market intelligence, neighborhood comparisons.
**Location:** `~/.openclaw/workspace/skills/pricelabs-analyst/SKILL.md`
**Model invocation:** Yes
**User invocable:** Yes (slash command `/pricelabs-analyst`)

```yaml
---
name: pricelabs-analyst
description: Interactive pricing analysis - answer portfolio questions, compare listings to market, analyze demand signals and booking pace.
user-invocable: true
---
```

**Content covers:**
- How to interpret demand colors (red = high demand, blue = low)
- Market percentile positioning (25th/50th/75th/90th)
- STLY comparison methodology
- Orphan gap detection logic
- How to explain pricing breakdowns to users

### Skill 3: `pricelabs-optimizer`

**Purpose:** Generate pricing recommendations, manage DSOs, base price calibration.
**Location:** `~/.openclaw/workspace/skills/pricelabs-optimizer/SKILL.md`
**Model invocation:** Yes
**User invocable:** Yes (slash command `/pricelabs-optimizer`)

```yaml
---
name: pricelabs-optimizer
description: Pricing optimization - recommend base price changes, create event DSOs, manage overrides. ALL writes require explicit user approval.
user-invocable: true
---
```

**Content covers:**
- Base price calibration rules (drift >10% from recommended triggers review)
- DSO creation guidelines (percentage range -75 to 500, currency matching for fixed)
- Approval workflow: NEVER execute a write without explicit "yes"/"approved" from user
- How to format recommendations for user review
- Post-change verification (re-fetch and confirm)

### Skill 4: `pricelabs-reporter`

**Purpose:** Weekly/monthly report generation, KPI tracking, trend analysis.
**Location:** `~/.openclaw/workspace/skills/pricelabs-reporter/SKILL.md`
**Model invocation:** Yes
**User invocable:** Yes (slash command `/pricelabs-reporter`)

```yaml
---
name: pricelabs-reporter
description: Portfolio reporting - weekly optimization reports, monthly strategy reviews, KPI trends (ADR, RevPAR, occupancy, booking pace).
user-invocable: true
---
```

**Content covers:**
- KPI definitions and calculation methods
- Report templates (daily summary, weekly optimization, monthly strategy)
- How to pull and compare historical data from SQLite
- Trend interpretation guidelines

### Skill 5: `pricelabs-domain`

**Purpose:** Domain knowledge reference. Not a workflow skill -- pure knowledge injection.
**Location:** `~/.openclaw/workspace/skills/pricelabs-domain/SKILL.md`
**Model invocation:** Yes (always loaded for domain context)
**User invocable:** No

```yaml
---
name: pricelabs-domain
description: PriceLabs domain knowledge - API behaviors, optimization strategies, common pitfalls, STR revenue management best practices.
user-invocable: false
metadata: {"openclaw":{"always":true}}
---
```

**Content covers:**
- PriceLabs API quirks (erroneous DSO dates silently omitted, LISTING_NOT_PRESENT errors, etc.)
- The 12 optimization strategies from research
- Common mistakes (treating base price as nightly rate, ignoring orphan days, etc.)
- STR revenue management terminology glossary

---

## MCP Server Design: PriceLabs API

### Architecture Decision: Single Custom MCP Server

Build one MCP server (`pricelabs-mcp-server`) that wraps all 12 Customer API endpoints as MCP tools. Use the TypeScript SDK (`@modelcontextprotocol/sdk`) with stdio transport. This is the correct choice because:

1. **OpenClaw spawns stdio MCP servers as child processes** -- simplest integration path
2. **TypeScript SDK is the most mature** MCP SDK (v1.25.3+), with Zod schema validation
3. **One server = one rate limiter** -- centralizes the 1000 req/hr budget
4. **Environment variable for API key** -- `PRICELABS_API_KEY` passed through openclaw.json config

### MCP Server Tool Inventory

| Tool Name | PriceLabs Endpoint | Read/Write | Description |
|-----------|-------------------|------------|-------------|
| `pricelabs_get_listings` | GET /v1/listings | Read | Fetch all listings with health/occupancy data |
| `pricelabs_get_listing` | GET /v1/listings/{id} | Read | Fetch single listing details |
| `pricelabs_update_listings` | POST /v1/listings | **Write** | Update base/min/max prices, tags |
| `pricelabs_get_prices` | POST /v1/listing_prices | Read | Fetch calculated prices with reasons |
| `pricelabs_get_overrides` | GET /v1/listings/{id}/overrides | Read | Fetch DSOs for a listing |
| `pricelabs_set_overrides` | POST /v1/listings/{id}/overrides | **Write** | Create/update DSOs |
| `pricelabs_delete_overrides` | DELETE /v1/listings/{id}/overrides | **Write** | Remove DSOs |
| `pricelabs_get_neighborhood` | GET /v1/neighborhood_data | Read | Market comparison data |
| `pricelabs_get_reservations` | GET /v1/reservation_data | Read | Booking/cancellation data |
| `pricelabs_push_prices` | POST /v1/push_prices | **Write** | Trigger price sync to PMS |
| `pricelabs_get_rate_plans` | GET /v1/fetch_rate_plans | Read | Rate plan adjustments |

**Write tools are annotated as destructive** in MCP tool annotations so the agent (and any approval skill) can distinguish them from reads.

### MCP Server Internal Architecture

```
pricelabs-mcp-server/
  package.json
  tsconfig.json
  src/
    index.ts              # Entry point, McpServer setup, stdio transport
    tools/
      listings.ts         # getListings, getListing, updateListings tools
      prices.ts           # getPrices tool
      overrides.ts        # getOverrides, setOverrides, deleteOverrides tools
      neighborhood.ts     # getNeighborhood tool
      reservations.ts     # getReservations tool
      sync.ts             # pushPrices tool
      rate-plans.ts       # getRatePlans tool
    lib/
      client.ts           # HTTP client (fetch-based, wraps api.pricelabs.co)
      rate-limiter.ts     # Sliding window rate limiter (1000/hr)
      cache.ts            # In-memory TTL cache (listings: 1hr, prices: 6hr, neighborhood: 24hr)
      errors.ts           # Error classification (retryable vs fatal)
      types.ts            # Zod schemas for all API request/response shapes
```

### MCP Server Configuration in openclaw.json

```json5
{
  "agents": {
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
              "args": ["~/.openclaw/mcp-servers/pricelabs-mcp-server/dist/index.js"],
              "env": {
                "PRICELABS_API_KEY": "${PRICELABS_API_KEY}"
              }
            },
            {
              "name": "sqlite",
              "command": "npx",
              "args": ["-y", "@anthropic/mcp-sqlite", "~/.openclaw/data/pricelabs.sqlite"]
            }
          ]
        }
      }
    ]
  }
}
```

### Rate Limiter Design

The MCP server owns the rate limiter internally. The agent does not need to track API budget -- the server handles it transparently.

```typescript
// Sliding window: track timestamps of last 1000 requests
// If at limit, tool call returns an error with estimated wait time
// Agent sees: "Rate limited. Try again in ~45 seconds."
// This is better than silently queuing because the agent can
// decide to skip low-priority fetches or batch differently.
```

**Budget allocation per workflow:**

| Workflow | Est. Requests (50 listings) | Frequency | Budget Impact |
|----------|----------------------------|-----------|---------------|
| Daily health check | ~56 | Daily | 5.6% of hourly limit |
| Price optimization scan | ~52 | 2x/week | 5.2% of hourly limit |
| Weekly neighborhood analysis | ~150 | Weekly | 15% of hourly limit |
| Monthly strategy review | ~60 | Monthly | 6% of hourly limit |
| Interactive queries | ~5-20 | Ad-hoc | 0.5-2% per query |

Total daily steady-state: well under 300 requests/day. No rate limit concerns for portfolios under 200 listings.

---

## MCP Server Design: SQLite Data Store

### Architecture Decision: Use Anthropic's Official SQLite MCP Server

Use `@anthropic/mcp-sqlite` (the official Anthropic SQLite MCP server) rather than building a custom one. It exposes `sqlite_execute` and `sqlite_get_catalog` tools, letting the agent run arbitrary SQL. The agent uses skills to know what tables exist and how to query them.

### Database Schema

```sql
-- Listing snapshots (one row per listing per day)
CREATE TABLE listing_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id TEXT NOT NULL,
    pms TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    name TEXT,
    base_price REAL,
    min_price REAL,
    max_price REAL,
    recommended_base TEXT,
    occupancy_7 REAL,
    occupancy_30 REAL,
    occupancy_60 REAL,
    occupancy_90 REAL,
    market_occ_7 REAL,
    market_occ_30 REAL,
    market_occ_60 REAL,
    market_occ_90 REAL,
    health_7 TEXT,
    health_30 TEXT,
    health_60 TEXT,
    revenue_past_7 REAL,
    stly_revenue_past_7 REAL,
    last_pushed TEXT,
    last_refreshed TEXT,
    UNIQUE(listing_id, pms, snapshot_date)
);

-- Price snapshots (daily prices for trend tracking)
CREATE TABLE price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id TEXT NOT NULL,
    pms TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    future_date DATE NOT NULL,
    price REAL,
    uncustomized_price REAL,
    demand_color TEXT,
    demand_desc TEXT,
    booking_status TEXT,
    adr REAL,
    adr_stly REAL,
    UNIQUE(listing_id, pms, snapshot_date, future_date)
);

-- Actions log (audit trail of all agent-executed changes)
CREATE TABLE actions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    listing_id TEXT NOT NULL,
    pms TEXT NOT NULL,
    action_type TEXT NOT NULL,  -- 'base_price_change', 'dso_create', 'dso_delete', 'push_prices'
    old_value TEXT,
    new_value TEXT,
    rationale TEXT,
    approved_by TEXT,           -- 'user:slack:U12345' or 'user:telegram:67890'
    approval_timestamp TEXT,
    api_response TEXT
);

-- Market snapshots (weekly neighborhood data)
CREATE TABLE market_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id TEXT NOT NULL,
    pms TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    listings_used INTEGER,
    currency TEXT,
    source TEXT,
    p25_avg REAL,
    p50_avg REAL,
    p75_avg REAL,
    p90_avg REAL,
    market_occupancy_avg REAL,
    booking_window REAL,
    avg_los REAL,
    market_revenue REAL,
    UNIQUE(listing_id, pms, snapshot_date)
);

-- Reservation tracking
CREATE TABLE reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    pms TEXT NOT NULL,
    check_in DATE,
    check_out DATE,
    booked_date TEXT,
    cancelled_on TEXT,
    booking_status TEXT,
    rental_revenue REAL,
    total_cost REAL,
    num_nights INTEGER,
    currency TEXT,
    first_seen_date DATE NOT NULL,
    UNIQUE(reservation_id, listing_id, pms)
);

-- KPI history (computed by agent, stored for trending)
CREATE TABLE kpi_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type TEXT NOT NULL,  -- 'daily', 'weekly', 'monthly'
    listing_id TEXT,            -- NULL for portfolio-level
    adr REAL,
    revpar REAL,
    occupancy REAL,
    avg_los REAL,
    avg_lead_time REAL,
    total_revenue REAL,
    reservation_count INTEGER,
    UNIQUE(period_start, period_type, listing_id)
);

-- Indexes for common queries
CREATE INDEX idx_listing_snapshots_date ON listing_snapshots(snapshot_date);
CREATE INDEX idx_listing_snapshots_listing ON listing_snapshots(listing_id, pms);
CREATE INDEX idx_price_snapshots_listing_date ON price_snapshots(listing_id, snapshot_date);
CREATE INDEX idx_actions_log_listing ON actions_log(listing_id, action_type);
CREATE INDEX idx_actions_log_timestamp ON actions_log(action_timestamp);
CREATE INDEX idx_reservations_listing ON reservations(listing_id, pms);
CREATE INDEX idx_kpi_history_period ON kpi_history(period_type, period_start);
```

The agent uses SQL through the SQLite MCP server's `sqlite_execute` tool. Skills teach it the schema and common query patterns. This is simpler and more flexible than building custom data access tools.

---

## Cron Job Configuration

### Daily Health Check

```json
{
  "name": "pricelabs-daily-health",
  "schedule": { "kind": "cron", "expr": "0 8 * * *", "tz": "America/New_York" },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "Run the daily health check workflow. Fetch all listings, check health scores, compare occupancy to market, check sync freshness, compare revenue to STLY. Store snapshots in SQLite. Generate alert summary and deliver to all channels.",
    "model": "anthropic/claude-opus-4-6",
    "timeoutSeconds": 300
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C_PRICELABS_CHANNEL",
    "bestEffort": true
  },
  "agentId": "pricelabs"
}
```

### Weekly Optimization Scan (Monday + Thursday 9am)

```json
{
  "name": "pricelabs-optimization-scan",
  "schedule": { "kind": "cron", "expr": "0 9 * * 1,4", "tz": "America/New_York" },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "Run the price optimization scan. Fetch prices with reasons for all listings (next 90 days). Identify pricing anomalies, orphan gaps, demand mismatches. Compare to historical SQLite data. Generate optimization recommendations. Do NOT execute changes -- present recommendations for approval.",
    "timeoutSeconds": 600
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C_PRICELABS_CHANNEL"
  },
  "agentId": "pricelabs"
}
```

### Weekly Neighborhood Analysis (Monday 10am)

```json
{
  "name": "pricelabs-neighborhood-analysis",
  "schedule": { "kind": "cron", "expr": "0 10 * * 1", "tz": "America/New_York" },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "Run the weekly neighborhood analysis. Fetch neighborhood data for all listings. Calculate market position, compare base prices to recommended, analyze trends. Store market snapshots. Generate market intelligence report with base price adjustment recommendations.",
    "timeoutSeconds": 600
  },
  "delivery": { "mode": "announce", "channel": "slack", "to": "channel:C_PRICELABS_CHANNEL" },
  "agentId": "pricelabs"
}
```

### Monthly Strategy Review (1st of month, 9am)

```json
{
  "name": "pricelabs-monthly-review",
  "schedule": { "kind": "cron", "expr": "0 9 1 * *", "tz": "America/New_York" },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "Run the monthly strategy review. Fetch 90-day reservation history. Calculate portfolio KPIs (ADR, RevPAR, occupancy, LOS, lead time). Compare to previous period and STLY. Rank listings by performance. Propose base price recalibrations where drift > 10%. Clean up expired DSOs. Generate monthly strategy report.",
    "timeoutSeconds": 900
  },
  "delivery": { "mode": "announce", "channel": "slack", "to": "channel:C_PRICELABS_CHANNEL" },
  "agentId": "pricelabs"
}
```

---

## Human-in-the-Loop Approval Pattern

### Approach: Channel-Native Approval (Not External MCP)

Use the messaging channel itself for approvals rather than an external approval service like Preloop. Rationale:

1. The user is already in Slack/Telegram -- no context switch needed
2. The agent can present rich context inline (listing details, market comparison, impact estimate)
3. Reply-based approval is natural for 1-2 person operations (personal portfolio management)
4. No additional infrastructure dependency

### Approval Flow Implementation

The agent is instructed via the `pricelabs-optimizer` skill to **always** present changes as proposals and wait for confirmation. The skill content explicitly states:

```markdown
## CRITICAL: Approval Protocol

You MUST NEVER execute a write operation (updateListings, setOverrides, deleteOverrides,
pushPrices) without first:

1. Presenting the specific change to the user with:
   - Listing name and ID
   - Current value -> Proposed value
   - Rationale (market data, trend analysis)
   - Expected impact

2. Waiting for explicit approval ("yes", "approve", "do it", "confirmed")

3. If the user says "no", "cancel", "skip" -- acknowledge and do NOT execute

4. After execution, confirm the result with API response details

If operating in a cron/isolated session, present recommendations in the report
and mark them as "PENDING APPROVAL". The user can approve in a subsequent
interactive session.
```

### Cron Recommendations vs. Interactive Approval

**Cron sessions** (isolated) generate reports with recommendations marked "PENDING APPROVAL." These get announced to the channel. The user can then interact with the agent in a normal session to review and approve specific recommendations. The agent uses SQLite to track pending recommendations:

```sql
CREATE TABLE pending_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    listing_id TEXT NOT NULL,
    pms TEXT NOT NULL,
    recommendation_type TEXT NOT NULL,
    current_value TEXT,
    proposed_value TEXT,
    rationale TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'expired'
    resolved_at TEXT,
    resolved_by TEXT
);
```

---

## Channel Configuration

### Slack Setup

```json5
{
  "channels": {
    "slack": {
      "enabled": true,
      "mode": "socket",
      "appToken": "${SLACK_APP_TOKEN}",   // xapp-... from env
      "botToken": "${SLACK_BOT_TOKEN}",   // xoxb-... from env
      "dmPolicy": "allowlist",
      "allowFrom": ["U_YOUR_USER_ID"],
      "threadReply": true
    }
  }
}
```

### Telegram Setup

```json5
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "dmPolicy": "allowlist",
      "allowFrom": ["YOUR_NUMERIC_USER_ID"],
      "groups": {
        "groupPolicy": "allowlist",
        "allowFrom": ["-100YOUR_GROUP_ID"],
        "requireMention": true
      }
    }
  }
}
```

### Binding Configuration

Route both channels to the same agent:

```json5
{
  "bindings": [
    { "agentId": "pricelabs", "match": { "channel": "slack" } },
    { "agentId": "pricelabs", "match": { "channel": "telegram" } }
  ]
}
```

---

## Patterns to Follow

### Pattern 1: Tool-Then-Reason

**What:** Call MCP tools to fetch data first, then analyze. Never hallucinate data.
**When:** Every workflow step that requires PriceLabs data.
**Why:** The agent must never fabricate occupancy rates, prices, or market data. Every number in a report must come from an API call or SQLite query.

**Example in skill instruction:**
```markdown
When analyzing a listing's performance:
1. FIRST call pricelabs_get_listings to get current data
2. THEN call sqlite_execute to get yesterday's snapshot
3. ONLY THEN compare and draw conclusions
Never estimate or approximate API data -- always fetch it.
```

### Pattern 2: Snapshot-Before-Compare

**What:** Store a data snapshot in SQLite before performing any comparison or trend analysis.
**When:** Every cron-triggered workflow.
**Why:** Without historical snapshots, the agent cannot detect trends, calculate pace, or compare periods. The SQLite database is the agent's long-term memory for structured data.

```markdown
At the START of every scheduled workflow:
1. Fetch fresh data from PriceLabs API
2. INSERT snapshot into SQLite (listing_snapshots, price_snapshots, etc.)
3. SELECT previous snapshots for comparison
4. Generate analysis based on actual deltas
```

### Pattern 3: Announce-Then-Approve

**What:** Cron outputs generate recommendations; interactive sessions execute them.
**When:** Any workflow that identifies pricing changes to make.
**Why:** Cron runs in isolated sessions with no user present. Changes must wait for explicit human confirmation.

### Pattern 4: Batch API Calls

**What:** Use the PriceLabs API's batch capabilities (e.g., POST /v1/listing_prices accepts multiple listings in one request).
**When:** Fetching prices for the entire portfolio.
**Why:** Reduces API call count from N (one per listing) to 1 (batch request). Critical for staying within rate limits on larger portfolios.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Skill

**What:** Putting all domain knowledge, workflows, alert thresholds, report templates, and API documentation into a single SKILL.md.
**Why bad:** Token cost scales linearly with skill content injected into system prompt. A massive skill wastes context window on irrelevant instructions for simple queries. It also makes iteration painful -- changing a report template risks breaking alert logic.
**Instead:** 5 focused skills with clear boundaries. The `always: true` domain knowledge skill stays small (glossary + API quirks only). Workflow skills load their specific procedures.

### Anti-Pattern 2: Agent-Side Rate Limiting

**What:** Implementing rate limiting logic in the skill instructions ("only call the API X times per session").
**Why bad:** The agent cannot reliably count or track API calls across sessions. LLMs are bad at maintaining precise counts. Rate limiting is a systems concern, not an AI reasoning concern.
**Instead:** Rate limiter lives in the MCP server. The agent calls tools freely; the server returns rate-limit errors when needed.

### Anti-Pattern 3: Storing Data in Markdown Memory

**What:** Using OpenClaw's memory system (`memory/YYYY-MM-DD.md` or `MEMORY.md`) for structured portfolio data like price history or KPI trends.
**Why bad:** Markdown memory is optimized for conversation recall and facts, not structured time-series data. Semantic search over "listing X had $180 base price on 2026-01-15" is unreliable. You cannot run aggregations, joins, or range queries over markdown files.
**Instead:** SQLite for all structured data. Use OpenClaw memory only for agent behavioral learnings ("User prefers conservative pricing" or "User reviews reports on Monday mornings").

### Anti-Pattern 4: Auto-Executing Write Operations from Cron

**What:** Having cron jobs automatically apply pricing changes without user approval.
**Why bad:** One bad recommendation executed at scale could damage revenue across the entire portfolio. Automated pricing changes without human review violate the core design principle.
**Instead:** Cron generates recommendations with "PENDING APPROVAL" status. User reviews and approves interactively.

---

## Build Order (Dependency-Driven)

The following build order reflects actual technical dependencies. Each phase produces a working, testable increment.

### Phase 1: Foundation (MCP Server + Core Skill)

**Build first because everything depends on it.**

1. `pricelabs-mcp-server` -- TypeScript MCP server with read-only tools first (getListings, getPrices, getNeighborhood, getReservations, getOverrides, getRatePlans)
2. `pricelabs-domain` skill -- domain knowledge reference
3. Basic `openclaw.json` with agent definition and MCP server config
4. Manual testing: interactive queries via CLI/web console

**Validates:** API connectivity, MCP tool invocation, basic agent reasoning about STR data.

### Phase 2: Persistence + Monitoring

**Build second because scheduled workflows need historical data.**

1. SQLite MCP server configuration
2. Database schema creation (all tables above)
3. `pricelabs-monitor` skill
4. First cron job: daily health check
5. Snapshot storage logic (agent stores data in SQLite during monitoring)

**Validates:** Data persistence across sessions, cron execution, snapshot comparison logic.

### Phase 3: Channels + Delivery

**Build third because delivery needs working monitoring to be useful.**

1. Slack channel configuration
2. Telegram channel configuration
3. Binding rules
4. Cron delivery configuration (announce mode)
5. `pricelabs-reporter` skill
6. Weekly and monthly cron jobs

**Validates:** Multi-channel delivery, report formatting, cron-to-channel pipeline.

### Phase 4: Interactive Analysis

**Build fourth because interactive queries are most valuable with historical context.**

1. `pricelabs-analyst` skill (interactive analysis instructions)
2. User query patterns (natural language -> tool calls -> analysis)
3. Historical comparison queries (SQLite lookups from interactive sessions)

**Validates:** Natural language portfolio queries, on-demand market analysis.

### Phase 5: Write Operations + Approval

**Build last because writes are highest risk and need the most scaffolding.**

1. Write tools in MCP server (updateListings, setOverrides, deleteOverrides, pushPrices)
2. `pricelabs-optimizer` skill with approval protocol
3. `pending_recommendations` table and workflow
4. Approval flow testing (propose -> confirm -> execute -> verify)
5. Actions audit log

**Validates:** Human-in-the-loop approval, safe write execution, audit trail.

---

## Scalability Considerations

| Concern | 1 Portfolio (personal) | 5-10 Portfolios (small PM) | 50+ Portfolios (product) |
|---------|----------------------|---------------------------|------------------------|
| **API rate limits** | No concern (~300 req/day) | Manageable with batching (~1500 req/day) | Need separate API keys per portfolio or queuing |
| **SQLite database** | Single file, works fine | Single file still fine (SQLite handles concurrent reads) | Consider PostgreSQL migration |
| **OpenClaw agent** | Single agent, single gateway | Multi-agent with per-portfolio workspaces and bindings | Multi-gateway deployment, likely needs custom orchestration layer |
| **Cron scheduling** | 4-5 jobs | 20-50 jobs (stagger to avoid rate limits) | Need job queue with priority and rate-limit awareness |
| **Approval workflow** | Direct user reply in channel | Per-portfolio channels with designated approvers | Need structured approval system (Preloop or custom) |

**Recommendation:** Build for "1 Portfolio" first. The architecture supports growth to "5-10 Portfolios" with configuration changes only (new agents, new bindings, new API keys). The "50+ Portfolios" tier requires genuine product engineering beyond an OpenClaw agent.

---

## Sources

### OpenClaw Official Documentation (HIGH confidence)
- [Agent Workspace](https://docs.openclaw.ai/concepts/agent-workspace) -- workspace structure, bootstrap files, skill loading
- [Configuration](https://docs.openclaw.ai/gateway/configuration) -- openclaw.json format, agents, channels, cron
- [Cron Jobs](https://docs.openclaw.ai/automation/cron-jobs) -- scheduling, session modes, delivery options
- [Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent) -- agent isolation, binding rules, routing hierarchy
- [Skills Specification](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md) -- SKILL.md format, YAML frontmatter, tool exposure
- [Telegram Channel](https://docs.openclaw.ai/channels/telegram) -- grammY setup, DM policy, group config
- [Slack Channel](https://docs.openclaw.ai/channels/slack) -- Bolt setup, Socket Mode, token config
- [Memory System](https://docs.openclaw.ai/concepts/memory) -- daily logs, MEMORY.md, search capabilities

### MCP Protocol (HIGH confidence)
- [TypeScript SDK Server Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- McpServer, tool registration, transports
- [MCP Specification](https://modelcontextprotocol.io/docs/develop/build-server) -- official build guide
- [TypeScript SDK npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- package reference

### OpenClaw Community (MEDIUM confidence)
- [How OpenClaw Works](https://bibek-poudel.medium.com/how-openclaw-works-understanding-ai-agents-through-a-real-architecture-5d59cc7a4764) -- 4-layer architecture overview
- [Architecture Lessons](https://blog.agentailor.com/posts/openclaw-architecture-lessons-for-agent-builders) -- patterns for agent builders
- [Request Approval Skill](https://lobehub.com/skills/openclaw-skills-request-approval) -- Preloop approval integration pattern
- [SQLite Memory Pattern](https://www.pingcap.com/blog/local-first-rag-using-sqlite-ai-agent-memory-openclaw/) -- local-first data persistence

### PriceLabs API (HIGH confidence)
- [Customer API SwaggerHub](https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3) -- official API specification
- [Postman Collection](https://documenter.getpostman.com/view/507656/SVSEurQC) -- endpoint examples
- Existing project research: `research/02-api-reference.md`, `agent/api-client-spec.md`, `agent/architecture.md`
