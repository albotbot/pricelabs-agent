# Phase 2: Monitoring + Persistence + Interactive Queries + Channel Delivery - Research

**Researched:** 2026-02-22
**Domain:** SQLite persistence (better-sqlite3), OpenClaw cron scheduling, OpenClaw channel delivery (Slack/Telegram), interactive query handling via MCP tools, daily snapshot architecture
**Confidence:** HIGH

## Summary

Phase 2 transforms the Phase 1 MCP server from a stateless API proxy into a stateful monitoring system with historical persistence, scheduled reporting, interactive natural-language queries, and dual-channel delivery (Slack + Telegram). The four sub-domains (monitoring, persistence, interactive queries, channel delivery) are tightly coupled: monitoring needs persistence for snapshots and delivery for output, interactive queries validate the entire stack, and delivery is the user-facing layer.

The critical architectural insight is that OpenClaw already provides the scheduling (cron), channel routing (Slack/Telegram), and interactive session infrastructure. The agent does NOT need Slack SDK, Telegram SDK, or its own scheduling library. OpenClaw's Gateway handles all messaging transport and cron execution. What Phase 2 must build is: (1) SQLite persistence in the MCP server for historical snapshots, (2) new MCP tools that the agent calls to store/retrieve snapshots and generate reports, (3) a monitoring skill that instructs the agent HOW to perform health checks and format reports, and (4) pre-configured OpenClaw cron jobs that trigger agent turns at the configured schedule.

The persistence layer uses `better-sqlite3` (v12.6.x) -- the de facto standard for synchronous SQLite in Node.js. The Node.js 22 built-in `node:sqlite` module is still experimental (stability level 1.1, requires `--experimental-sqlite` flag) and not recommended for production. better-sqlite3 provides synchronous APIs that integrate naturally with MCP tool handlers, WAL mode for concurrent read/write, and battle-tested production reliability.

**Primary recommendation:** Add better-sqlite3 to the MCP server for persistence. Create 5 new MCP tools for snapshot storage/retrieval (daily snapshots, price snapshots, reservation tracking, audit log, market data). Pre-configure OpenClaw cron jobs for daily health reports. Build a monitoring skill (SKILL.md) that teaches the agent how to perform health checks, format reports, and answer interactive queries. OpenClaw handles all channel delivery and scheduling natively -- do NOT build custom messaging or scheduling code.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.6.x | SQLite database for persistence | De facto standard. Synchronous API ideal for MCP tool handlers. 2000+ queries/sec. WAL mode for concurrent reads. Prebuilt binaries for Node 22 LTS. 10M+ weekly downloads. |
| `@types/better-sqlite3` | 7.6.x | TypeScript definitions | Community-maintained types. 231 npm dependents. Required since better-sqlite3 is not written in TypeScript. |
| `@modelcontextprotocol/sdk` | 1.26.x | MCP server framework (already installed) | Phase 1 dependency. New tools registered on existing server. |
| `zod` | 3.25+ | Schema validation (already installed) | Phase 1 dependency. New schemas for snapshot tools. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@blackglory/better-sqlite3-migrations` | latest | Schema version management | Manages schema upgrades via SQLite user_version pragma. Lightweight (~50 lines). |

### What NOT to Install

| Library | Why Not |
|---------|---------|
| `node:sqlite` (built-in) | Experimental (stability 1.1), requires `--experimental-sqlite` flag. Not production-ready. Maintainers of better-sqlite3 explicitly advise against it. |
| `@slack/bolt` / `@slack/web-api` | OpenClaw handles Slack transport natively. Agent communicates via chat; OpenClaw routes to Slack. |
| `grammy` / `telegraf` / `node-telegram-bot-api` | OpenClaw handles Telegram transport natively. Same reasoning as Slack. |
| `node-cron` / `croner` / `node-schedule` | OpenClaw's Gateway has built-in cron scheduling. Jobs are pre-configured in `~/.openclaw/cron/jobs.json`. No in-process scheduler needed. |
| `drizzle-orm` / `kysely` / `typeorm` | Overkill for 5 tables with simple schemas. Raw SQL with better-sqlite3 prepared statements is simpler and faster. No ORM abstraction needed. |
| `bullmq` / `agenda` | No job queue needed. OpenClaw cron triggers agent turns directly. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `better-sqlite3` | `node:sqlite` (built-in) | Zero dependencies but experimental, unstable API, production risk |
| `better-sqlite3` | `sql.js` (WASM) | No native addon but 5-10x slower, no WAL mode, 1MB WASM overhead |
| Raw SQL | `drizzle-orm` | Type-safe queries but adds abstraction layer, learning curve, build complexity for 5 simple tables |
| Pre-configured cron | Agent-managed cron (via `cron` tool) | More flexible but `cron` is in the tool deny list (correctly -- agent should not self-schedule) |

**Installation:**
```bash
cd mcp-servers/pricelabs
npm install better-sqlite3
npm install -D @types/better-sqlite3
npm install @blackglory/better-sqlite3-migrations
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
mcp-servers/pricelabs/
  src/
    services/
      database.ts              # Database singleton, WAL mode, migrations
    db/
      migrations.ts            # Versioned schema migrations (001..005)
      queries/
        listing-snapshots.ts   # Prepared statements for PERS-01
        price-snapshots.ts     # Prepared statements for PERS-02
        reservations.ts        # Prepared statements for PERS-03
        audit-log.ts           # Prepared statements for PERS-04
        market-snapshots.ts    # Prepared statements for PERS-05
    tools/
      snapshots.ts             # NEW: store/retrieve snapshot tools
      monitoring.ts            # NEW: health check + report generation tools
      audit.ts                 # NEW: audit log read/write tools
    schemas/
      snapshots.ts             # NEW: Zod schemas for snapshot tools
      monitoring.ts            # NEW: Zod schemas for monitoring tools

skills/
  pricelabs-monitoring/
    SKILL.md                   # NEW: Monitoring skill (daily health, reports, alerts)

openclaw/
  cron/
    jobs.json                  # NEW: Pre-configured cron jobs for daily reports
```

### Pattern 1: Database Singleton with WAL Mode

**What:** Single Database instance shared across all MCP tool handlers. WAL mode enabled on first open. Busy timeout prevents lock contention.
**When to use:** MCP server startup, passed to all tool registration functions.

```typescript
// Source: better-sqlite3 official docs + SQLite WAL best practices
import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = process.env.PRICELABS_DB_PATH
  || path.join(process.env.HOME || "/tmp", ".pricelabs-agent", "data.sqlite");

export function createDatabase(dbPath: string = DB_PATH): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  // fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);

  // WAL mode: concurrent reads + writes, better performance
  db.pragma("journal_mode = WAL");

  // Busy timeout: wait 5s for locks instead of failing immediately
  db.pragma("busy_timeout = 5000");

  // Foreign keys: enforce referential integrity
  db.pragma("foreign_keys = ON");

  // Synchronous NORMAL: good balance of safety and speed with WAL
  db.pragma("synchronous = NORMAL");

  return db;
}
```

### Pattern 2: Versioned Schema Migrations

**What:** Use SQLite `user_version` pragma to track schema version. Apply migrations sequentially on startup. Each migration is a function that runs inside a transaction.
**When to use:** Database initialization, before any tool registration.

```typescript
// Source: @blackglory/better-sqlite3-migrations pattern + SQLite user_version
import type Database from "better-sqlite3";

interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE listing_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,  -- YYYY-MM-DD
          data JSON NOT NULL,          -- Full listing JSON
          computed JSON,               -- Computed fields JSON
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, snapshot_date)
        );
        CREATE INDEX idx_listing_snapshots_date
          ON listing_snapshots(snapshot_date);
        CREATE INDEX idx_listing_snapshots_listing
          ON listing_snapshots(listing_id, pms);
      `);
    },
  },
  // ... more migrations
];

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.transaction(() => {
        migration.up(db);
        db.pragma(`user_version = ${migration.version}`);
      })();
    }
  }
}
```

### Pattern 3: Prepared Statement Modules

**What:** Group related prepared statements into modules. Create them once, reuse across calls. better-sqlite3 prepared statements are synchronous and fast.
**When to use:** All database access from MCP tools.

```typescript
// Source: better-sqlite3 prepared statement best practices
import type Database from "better-sqlite3";

export function createListingSnapshotQueries(db: Database.Database) {
  const insertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO listing_snapshots
      (listing_id, pms, snapshot_date, data, computed)
    VALUES (@listing_id, @pms, @snapshot_date, @data, @computed)
  `);

  const getLatestSnapshot = db.prepare(`
    SELECT * FROM listing_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY snapshot_date DESC LIMIT 1
  `);

  const getSnapshotRange = db.prepare(`
    SELECT * FROM listing_snapshots
    WHERE listing_id = @listing_id AND pms = @pms
      AND snapshot_date BETWEEN @start_date AND @end_date
    ORDER BY snapshot_date ASC
  `);

  // Batch insert with transaction for daily snapshot runs
  const insertMany = db.transaction(
    (snapshots: Array<{
      listing_id: string;
      pms: string;
      snapshot_date: string;
      data: string;
      computed: string;
    }>) => {
      for (const snapshot of snapshots) {
        insertSnapshot.run(snapshot);
      }
    }
  );

  return { insertSnapshot, getLatestSnapshot, getSnapshotRange, insertMany };
}
```

### Pattern 4: OpenClaw Cron Job Configuration

**What:** Pre-configure cron jobs in `~/.openclaw/cron/jobs.json` that trigger isolated agent turns with specific monitoring prompts. Delivery announces results to both Slack and Telegram.
**When to use:** Setup/configuration time. NOT runtime -- agent does not create cron jobs (cron tool is denied).

```json
[
  {
    "name": "daily-portfolio-health",
    "schedule": {
      "kind": "cron",
      "expr": "0 8 * * *",
      "tz": "America/Chicago",
      "staggerMs": 0
    },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Run the daily portfolio health check. Fetch all listings, compare health scores, occupancy vs market, sync status, and revenue vs STLY. Store today's snapshots in the database. Generate a portfolio health summary and deliver it.",
      "model": "opus",
      "thinking": "high"
    },
    "delivery": {
      "mode": "announce",
      "channel": "slack",
      "to": "channel:CXXXXXXXXX",
      "bestEffort": true
    }
  },
  {
    "name": "daily-portfolio-health-telegram",
    "schedule": {
      "kind": "cron",
      "expr": "0 8 * * *",
      "tz": "America/Chicago",
      "staggerMs": 0
    },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Run the daily portfolio health check. Fetch all listings, compare health scores, occupancy vs market, sync status, and revenue vs STLY. Store today's snapshots in the database. Generate a portfolio health summary and deliver it.",
      "model": "opus",
      "thinking": "high"
    },
    "delivery": {
      "mode": "announce",
      "channel": "telegram",
      "to": "-1001234567890",
      "bestEffort": true
    }
  }
]
```

**Note on dual-channel delivery:** OpenClaw cron delivery targets a single channel per job. To deliver to BOTH Slack and Telegram (DEL-01), create two cron jobs with identical schedules but different delivery targets. The isolated session runs once; the delivery mode announces the result to the specified channel.

**Alternative approach:** Use a single cron job with `delivery.mode: "none"`, and have the agent explicitly call messaging tools in its turn to post to both channels. This avoids duplicate agent runs but requires the agent to handle delivery explicitly. The dual-job approach is simpler and more reliable.

### Pattern 5: Monitoring Skill Architecture

**What:** A SKILL.md that teaches the agent HOW to perform health checks, format reports, track booking pace, and answer interactive queries. The skill provides the instruction template; the agent uses MCP tools for data access.
**When to use:** Always-on skill (like pricelabs-domain).

```markdown
---
name: pricelabs-monitoring
description: >
  Portfolio monitoring and reporting instructions. Teaches the agent
  how to perform daily health checks, generate reports, track booking
  pace, detect stale syncs, and answer interactive portfolio queries.
user-invocable: false
metadata: {"openclaw":{"always":true}}
---

## Daily Health Check Protocol

When triggered for a daily health check:
1. Call pricelabs_get_listings to fetch all active listings
2. For each listing, compute: health trend, occupancy vs market, sync freshness, revenue vs STLY
3. Call pricelabs_store_daily_snapshots to persist today's data
4. Identify alerts: stale syncs (>48h), pace behind STLY (>20%), health declining
5. Format the summary report and deliver

## Report Formatting
[structured output templates for Slack/Telegram]

## Interactive Query Protocol
When a user asks about portfolio performance:
1. Always fetch LIVE data first (pricelabs_get_listings, pricelabs_get_prices)
2. Cross-reference with historical snapshots (pricelabs_get_snapshots)
3. For comparative questions, rank all listings by the requested metric
4. Include data freshness in every response
```

### Pattern 6: Snapshot Storage MCP Tool

**What:** New MCP tools that the agent calls to persist and retrieve snapshots from SQLite. The MCP server owns the database; the agent calls tools to interact with it.
**When to use:** During daily health checks (store) and interactive queries (retrieve).

```typescript
// New tool: pricelabs_store_daily_snapshots
// Agent calls this after fetching all listings to persist the daily snapshot
server.registerTool(
  "pricelabs_store_daily_snapshots",
  {
    description: "Store today's listing snapshots in the database for historical tracking. Call this during daily health checks after fetching all listings.",
    inputSchema: StoreDailySnapshotsInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  async (params) => {
    // Insert snapshots into SQLite
    // Return count stored + any anomalies detected
  }
);

// New tool: pricelabs_get_snapshots
// Agent calls this to retrieve historical data for trend analysis
server.registerTool(
  "pricelabs_get_snapshots",
  {
    description: "Retrieve historical listing snapshots for trend analysis. Use for comparing current performance to past periods.",
    inputSchema: GetSnapshotsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async (params) => {
    // Query SQLite for snapshot range
    // Return snapshots with computed trends
  }
);
```

### Anti-Patterns to Avoid

- **Building a Slack/Telegram bot:** OpenClaw IS the bot. The agent communicates via natural language; OpenClaw handles all channel transport. Do NOT install @slack/bolt, grammy, or any messaging SDK.
- **In-process cron scheduling:** OpenClaw's Gateway has built-in cron. Do NOT use node-cron, croner, or setInterval for scheduling. Pre-configure jobs in `jobs.json`.
- **Agent self-scheduling:** The `cron` tool is correctly denied in openclaw.json. The agent must NOT create its own schedules. Cron jobs are infrastructure, not agent behavior.
- **Storing snapshots in the agent's conversation context:** Conversation context is ephemeral and token-limited. Use SQLite for ALL persistence. The agent queries the database via MCP tools.
- **ORM for 5 tables:** An ORM adds abstraction, dependencies, and build complexity for a schema that fits on one screen. Use raw SQL with prepared statements.
- **Async SQLite driver:** better-sqlite3's synchronous API is a feature, not a limitation. MCP tool handlers are async but each individual DB call is fast (<1ms). Async drivers add complexity without benefit for this use case.

## Database Schema Design

### Table: listing_snapshots (PERS-01)

Stores one row per listing per day. Full listing JSON preserved for future-proofing; computed fields stored separately for query efficiency.

```sql
CREATE TABLE listing_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,           -- YYYY-MM-DD
  name TEXT,                             -- Denormalized for query convenience
  health_7_day TEXT,
  health_30_day TEXT,
  health_60_day TEXT,
  occupancy_next_30 REAL,
  market_occupancy_next_30 REAL,
  occupancy_gap_pct REAL,               -- Computed: (market - listing) / market * 100
  revenue_past_7 REAL,
  stly_revenue_past_7 REAL,
  revenue_vs_stly_pct REAL,             -- Computed
  base_price REAL,
  recommended_base_price REAL,
  last_date_pushed TEXT,
  days_since_sync REAL,
  is_stale_sync INTEGER,                -- 0 or 1
  data_json TEXT NOT NULL,              -- Full listing JSON blob
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, pms, snapshot_date)
);
```

### Table: price_snapshots (PERS-02)

Stores daily price data with demand signals. One row per listing per date per snapshot day.

```sql
CREATE TABLE price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,           -- When snapshot was taken (YYYY-MM-DD)
  price_date TEXT NOT NULL,             -- The date this price is for
  price REAL NOT NULL,
  demand_level TEXT,                    -- Computed from demand_color
  booking_status TEXT,
  booking_status_stly TEXT,
  adr REAL,
  adr_stly REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, pms, snapshot_date, price_date)
);
```

### Table: reservations (PERS-03)

Stores reservation data for pace tracking and cancellation detection. Upserted by reservation_id.

```sql
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  booked_date TEXT,
  cancelled_on TEXT,                    -- NULL if active, ISO timestamp if cancelled
  booking_status TEXT,                  -- 'booked' or 'cancelled'
  rental_revenue REAL,
  total_cost REAL,
  no_of_days INTEGER,
  currency TEXT,
  first_seen_date TEXT NOT NULL,        -- When we first detected this reservation
  last_seen_date TEXT NOT NULL,         -- Most recent snapshot containing it
  data_json TEXT,                       -- Full reservation JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, pms, reservation_id)
);
```

### Table: audit_log (PERS-04)

Stores all agent actions for accountability and debugging.

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,            -- 'recommendation', 'approval', 'execution', 'alert', 'report'
  listing_id TEXT,                      -- NULL for portfolio-level actions
  pms TEXT,
  description TEXT NOT NULL,
  details_json TEXT,                    -- Action-specific details
  channel TEXT,                         -- 'slack', 'telegram', 'cron', 'interactive'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Table: market_snapshots (PERS-05)

Stores neighborhood/market data for trend analysis.

```sql
CREATE TABLE market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  listings_used INTEGER,
  p25_price REAL,
  p50_price REAL,
  p75_price REAL,
  p90_price REAL,
  market_occupancy REAL,
  data_json TEXT NOT NULL,              -- Full neighborhood JSON blob
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, pms, snapshot_date)
);
```

### Indexing Strategy

```sql
-- Listing snapshots: query by date range, by listing
CREATE INDEX idx_ls_date ON listing_snapshots(snapshot_date);
CREATE INDEX idx_ls_listing ON listing_snapshots(listing_id, pms);

-- Price snapshots: query by listing + price_date range
CREATE INDEX idx_ps_listing_date ON price_snapshots(listing_id, pms, price_date);
CREATE INDEX idx_ps_snapshot ON price_snapshots(snapshot_date);

-- Reservations: query by listing, detect new/cancelled
CREATE INDEX idx_res_listing ON reservations(listing_id, pms);
CREATE INDEX idx_res_checkin ON reservations(check_in);
CREATE INDEX idx_res_status ON reservations(booking_status);

-- Audit log: query by date range, by listing
CREATE INDEX idx_audit_date ON audit_log(created_at);
CREATE INDEX idx_audit_listing ON audit_log(listing_id);
CREATE INDEX idx_audit_type ON audit_log(action_type);

-- Market snapshots: query by listing + date
CREATE INDEX idx_ms_listing_date ON market_snapshots(listing_id, pms, snapshot_date);
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite database access | Custom bindings or WASM | `better-sqlite3` | Native C++ addon, 2000+ q/s, WAL mode, prebuilt binaries for Node 22. |
| Schema migrations | Manual `CREATE TABLE IF NOT EXISTS` | `user_version` pragma + migration array | Prevents schema drift, enables safe upgrades, tracks what version is deployed. |
| Slack messaging | Custom Slack API client | OpenClaw channel adapter | OpenClaw handles OAuth, Socket Mode, message formatting, threading, reactions, buttons. |
| Telegram messaging | Custom Bot API client | OpenClaw channel adapter | OpenClaw handles long polling/webhooks, message chunking, HTML formatting, inline buttons. |
| Cron scheduling | `node-cron` / `croner` / `setInterval` | OpenClaw Gateway cron | Persists across restarts, handles failures with exponential backoff, delivers to channels. |
| Message formatting for channels | Custom Slack Block Kit / Telegram HTML | Agent natural language | OpenClaw converts agent text to channel-native formats. Agent writes plain text with structure; OpenClaw formats. |
| Approval flow UI | Custom button handlers | OpenClaw ephemeral approval buttons | OpenClaw v2026.2.15+ supports native approval buttons across Slack, Telegram, Discord. |

**Key insight:** OpenClaw is the runtime, messaging layer, scheduler, and delivery system. Phase 2 should only build what OpenClaw cannot provide: domain-specific persistence (SQLite snapshots), domain-specific MCP tools (snapshot storage/retrieval, report generation), and domain-specific agent instructions (monitoring skill).

## Common Pitfalls

### Pitfall 1: SQLite Database File Location

**What goes wrong:** Database file created in the MCP server's working directory, which may be read-only (OpenClaw sandbox has `workspaceAccess: "ro"`).
**Why it happens:** Default path resolution uses `process.cwd()` or relative path.
**How to avoid:** Use an explicit absolute path via environment variable (`PRICELABS_DB_PATH`). Default to `~/.pricelabs-agent/data.sqlite` outside the workspace. Pass the path through `openclaw.json` MCP server env config.
**Warning signs:** `SQLITE_CANTOPEN` error on first tool call.

### Pitfall 2: better-sqlite3 Native Addon Build Failures

**What goes wrong:** `npm install` fails because prebuilt binaries are not available for the exact Node.js version + OS + architecture combination.
**Why it happens:** better-sqlite3 ships prebuilt binaries for common combinations but coverage is not exhaustive. Custom or bleeding-edge Node versions may need compilation from source, requiring `python3`, `make`, and a C++ compiler.
**How to avoid:** Use Node.js 22 LTS (prebuilt binaries available). If deploying to unusual architecture, test `npm install` early. Fallback: `npm install --build-from-source`.
**Warning signs:** Errors mentioning `prebuild-install`, `node-gyp`, or missing compiler.

### Pitfall 3: OpenClaw Cron Dual-Channel Delivery

**What goes wrong:** Cron job delivers to only one channel (Slack OR Telegram) because each cron job has a single delivery target.
**Why it happens:** OpenClaw cron `delivery.to` accepts one target per job.
**How to avoid:** Two approaches: (A) Create two cron jobs with identical schedules but different delivery targets. Each triggers an isolated agent turn; both deliver. Cost: 2x agent turns = 2x API cost. (B) Single cron job with `delivery.mode: "none"`, and have the monitoring skill instruct the agent to explicitly output for both channels. The agent's response in the isolated session is announced to the configured channel, but an additional agent-side message tool could post to the second channel.
**Warning signs:** Users report receiving health summaries in only one channel.
**Recommendation:** Start with approach (A) -- two jobs. It is simpler and more reliable. Optimize later if API cost is a concern.

### Pitfall 4: Snapshot Data Volume Growth

**What goes wrong:** price_snapshots table grows very large. A 50-listing portfolio with 365-day price windows generates 50 * 365 = 18,250 rows per daily snapshot. Over a year: 6.6M rows.
**Why it happens:** Storing every daily price for every listing every day.
**How to avoid:** (1) Only snapshot the next 90 days of prices (not 365) -- this covers the actionable window. (2) Implement retention policy: delete price snapshots older than 90 days, keep listing snapshots for 1 year, keep reservations indefinitely. (3) Use `INSERT OR REPLACE` with unique constraints to prevent duplicates.
**Warning signs:** Database file grows past 100MB, query times increase.

### Pitfall 5: Cron Skip Bug (OpenClaw Issue #17852)

**What goes wrong:** Daily cron jobs skip a day, running every 48 hours instead of 24.
**Why it happens:** Bug in `recomputeNextRuns()` that advanced past-due timestamps without executing them. Fixed in PR #17903, merged 2026-02-16.
**How to avoid:** Ensure OpenClaw is updated past v2026.2.12 (the affected version). The fix replaces `recomputeNextRuns()` with `recomputeNextRunsForMaintenance()` which never overwrites existing past-due timestamps.
**Warning signs:** Missing daily snapshots in the database. Check `~/.openclaw/cron/runs/` for execution history.

### Pitfall 6: Stale Sync Alert Flooding

**What goes wrong:** Agent sends repeated stale sync alerts for the same listing every time a health check runs.
**Why it happens:** No deduplication -- if a listing has been stale for 3 days, the agent alerts on day 1, 2, and 3.
**How to avoid:** Track alert state in the audit log. Before sending a stale sync alert, check if an unresolved alert already exists for that listing. Only alert again after a configurable cooldown (e.g., 24 hours) or when the sync resumes and then goes stale again.
**Warning signs:** Users muting the bot due to repetitive alerts.

### Pitfall 7: Interactive Query Without Cache Awareness

**What goes wrong:** Agent answers an interactive query with stale cached data without telling the user.
**Why it happens:** INT-04 requirement says "fetch live data for each query" but cache may serve old data when rate limited.
**How to avoid:** The existing `fetchWithFallback` pattern already includes `cache_age_seconds` and `data_source` metadata. The monitoring skill must instruct the agent to always include data freshness in responses. Example: "This data is from 15 minutes ago (cached). For real-time data, try again in 5 minutes."
**Warning signs:** User sees contradictory data between interactive queries and daily reports.

## Code Examples

### Complete Database Initialization

```typescript
// src/services/database.ts
import Database from "better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";

const DEFAULT_DB_DIR = path.join(
  process.env.HOME || "/tmp",
  ".pricelabs-agent",
);

export function initializeDatabase(
  dbPath?: string,
): Database.Database {
  const resolvedPath = dbPath
    || path.join(DEFAULT_DB_DIR, "data.sqlite");

  // Ensure directory exists
  mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);

  // Performance and safety pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");

  return db;
}
```

### Migration Runner

```typescript
// src/db/migrations.ts
import type Database from "better-sqlite3";

interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "Create listing_snapshots table",
    up: (db) => {
      db.exec(`
        CREATE TABLE listing_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          name TEXT,
          health_7_day TEXT,
          health_30_day TEXT,
          health_60_day TEXT,
          occupancy_next_30 REAL,
          market_occupancy_next_30 REAL,
          occupancy_gap_pct REAL,
          revenue_past_7 REAL,
          stly_revenue_past_7 REAL,
          revenue_vs_stly_pct REAL,
          base_price REAL,
          recommended_base_price REAL,
          last_date_pushed TEXT,
          days_since_sync REAL,
          is_stale_sync INTEGER,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, snapshot_date)
        );
        CREATE INDEX idx_ls_date ON listing_snapshots(snapshot_date);
        CREATE INDEX idx_ls_listing ON listing_snapshots(listing_id, pms);
      `);
    },
  },
  {
    version: 2,
    description: "Create price_snapshots table",
    up: (db) => {
      db.exec(`
        CREATE TABLE price_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          price_date TEXT NOT NULL,
          price REAL NOT NULL,
          demand_level TEXT,
          booking_status TEXT,
          booking_status_stly TEXT,
          adr REAL,
          adr_stly REAL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, snapshot_date, price_date)
        );
        CREATE INDEX idx_ps_listing_date ON price_snapshots(listing_id, pms, price_date);
        CREATE INDEX idx_ps_snapshot ON price_snapshots(snapshot_date);
      `);
    },
  },
  {
    version: 3,
    description: "Create reservations table",
    up: (db) => {
      db.exec(`
        CREATE TABLE reservations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          reservation_id TEXT NOT NULL,
          check_in TEXT,
          check_out TEXT,
          booked_date TEXT,
          cancelled_on TEXT,
          booking_status TEXT,
          rental_revenue REAL,
          total_cost REAL,
          no_of_days INTEGER,
          currency TEXT,
          first_seen_date TEXT NOT NULL,
          last_seen_date TEXT NOT NULL,
          data_json TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, reservation_id)
        );
        CREATE INDEX idx_res_listing ON reservations(listing_id, pms);
        CREATE INDEX idx_res_checkin ON reservations(check_in);
        CREATE INDEX idx_res_status ON reservations(booking_status);
      `);
    },
  },
  {
    version: 4,
    description: "Create audit_log table",
    up: (db) => {
      db.exec(`
        CREATE TABLE audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_type TEXT NOT NULL,
          listing_id TEXT,
          pms TEXT,
          description TEXT NOT NULL,
          details_json TEXT,
          channel TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_audit_date ON audit_log(created_at);
        CREATE INDEX idx_audit_listing ON audit_log(listing_id);
        CREATE INDEX idx_audit_type ON audit_log(action_type);
      `);
    },
  },
  {
    version: 5,
    description: "Create market_snapshots table",
    up: (db) => {
      db.exec(`
        CREATE TABLE market_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id TEXT NOT NULL,
          pms TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          listings_used INTEGER,
          p25_price REAL,
          p50_price REAL,
          p75_price REAL,
          p90_price REAL,
          market_occupancy REAL,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(listing_id, pms, snapshot_date)
        );
        CREATE INDEX idx_ms_listing_date ON market_snapshots(listing_id, pms, snapshot_date);
      `);
    },
  },
];

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  const pending = migrations.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}
```

### Booking Pace Calculation (MON-03, MON-04)

```typescript
// src/db/queries/pace-tracking.ts
// Booking pace: count of reservations with check-in within N days, compared to STLY

export function createPaceQueries(db: Database.Database) {
  const getBookingPace = db.prepare(`
    SELECT
      COUNT(*) as bookings,
      SUM(CASE WHEN no_of_days IS NOT NULL THEN no_of_days ELSE 0 END) as booked_nights,
      SUM(CASE WHEN rental_revenue IS NOT NULL THEN rental_revenue ELSE 0 END) as total_revenue
    FROM reservations
    WHERE listing_id = @listing_id AND pms = @pms
      AND booking_status = 'booked'
      AND check_in BETWEEN @start_date AND @end_date
  `);

  // Compare current pace to same-time-last-year
  // STLY dates: shift start_date and end_date back by 1 year
  const getStlyPace = db.prepare(`
    SELECT
      COUNT(*) as bookings,
      SUM(CASE WHEN no_of_days IS NOT NULL THEN no_of_days ELSE 0 END) as booked_nights,
      SUM(CASE WHEN rental_revenue IS NOT NULL THEN rental_revenue ELSE 0 END) as total_revenue
    FROM reservations
    WHERE listing_id = @listing_id AND pms = @pms
      AND booking_status = 'booked'
      AND check_in BETWEEN date(@start_date, '-1 year') AND date(@end_date, '-1 year')
  `);

  return { getBookingPace, getStlyPace };
}
```

### OpenClaw Environment Configuration Update

```json
{
  "name": "pricelabs",
  "command": "node",
  "args": ["mcp-servers/pricelabs/dist/index.js"],
  "env": {
    "PRICELABS_API_KEY": "${PRICELABS_API_KEY}",
    "PRICELABS_BASE_URL": "https://api.pricelabs.co",
    "PRICELABS_DB_PATH": "${HOME}/.pricelabs-agent/data.sqlite"
  }
}
```

## New MCP Tool Inventory (Phase 2 Additions)

| Tool Name | Purpose | Read/Write | Annotations |
|-----------|---------|------------|-------------|
| `pricelabs_store_daily_snapshots` | Store today's listing snapshots | Write (DB) | destructive: false |
| `pricelabs_store_price_snapshots` | Store price data with demand signals | Write (DB) | destructive: false |
| `pricelabs_store_reservations` | Upsert reservation data, detect cancellations | Write (DB) | destructive: false |
| `pricelabs_get_snapshots` | Retrieve historical snapshots for trend analysis | Read (DB) | readOnly: true |
| `pricelabs_get_booking_pace` | Calculate booking pace at 7/30/60/90 day cutoffs vs STLY | Read (DB) | readOnly: true |
| `pricelabs_log_action` | Record agent action in audit log | Write (DB) | destructive: false |
| `pricelabs_get_audit_log` | Retrieve audit trail entries | Read (DB) | readOnly: true |
| `pricelabs_store_market_snapshot` | Store neighborhood/market data snapshot | Write (DB) | destructive: false |

**Total tool count after Phase 2:** 13 (existing) + 8 (new) = 21 tools.

## Interactive Query Architecture (INT-01 through INT-04)

Interactive queries require NO additional infrastructure beyond what Phase 1 + Phase 2 persistence provides. Here is how the flow works:

1. **User sends message** in Slack or Telegram (e.g., "How is my Beach House performing?")
2. **OpenClaw routes** the message to the PriceLabs agent (existing channel config)
3. **Agent receives** the message as a normal conversational turn
4. **Agent uses MCP tools** to fetch live data (`pricelabs_get_listings`, `pricelabs_get_prices`) and historical data (`pricelabs_get_snapshots`)
5. **Agent uses domain knowledge** from pricelabs-domain skill to interpret the data
6. **Agent uses monitoring knowledge** from pricelabs-monitoring skill for report formatting
7. **Agent responds** with analysis; OpenClaw delivers to the originating channel

**Key insight for INT-02 (listing by name/location):** The agent matches user-provided names against the `name`, `city_name`, `state`, and `tags` fields from the listing data. This is LLM-native fuzzy matching -- no custom NLP pipeline needed. The agent fetches all listings, finds the best match, then drills into that listing's details.

**Key insight for INT-03 (comparative questions):** The agent fetches all listings, ranks them by the requested metric (occupancy, revenue, health score), and presents the ranked results. Again, LLM-native reasoning -- no custom ranking code needed.

**Key insight for INT-04 (live data, not stale context):** Each agent turn in OpenClaw is stateless (no conversation carryover for isolated sessions). The agent MUST call MCP tools to get data for every question. The `fetchWithFallback` pattern ensures cache-aware responses with data freshness metadata.

## Approval Flow Architecture (DEL-03)

For Phase 2, the approval flow is lightweight -- the agent presents information and asks for confirmation in natural language. OpenClaw's v2026.2.15 ephemeral approval buttons provide native UI support:

1. Agent presents a recommendation with reasoning
2. User replies "approve" / "reject" (or clicks approval button if available)
3. Agent reads the reply as a normal message
4. Agent acts (or doesn't) based on the reply

No custom button/callback infrastructure needed. OpenClaw handles the UI layer.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node:sqlite` experimental | `better-sqlite3` production | Ongoing (node:sqlite still experimental in Node 22) | Use better-sqlite3 for production SQLite |
| Custom Slack/Telegram bots | OpenClaw native channel adapters | 2026 | No bot SDK needed; OpenClaw handles transport |
| In-process cron (node-cron) | OpenClaw Gateway cron | 2026 | Persistent, restart-safe, channel-aware scheduling |
| Manual approval text parsing | OpenClaw ephemeral approval buttons | v2026.2.15 | Native approve/reject UI in Slack, Telegram, Discord |
| OpenClaw cron skip bug | Fixed in PR #17903 | 2026-02-16 | Must run OpenClaw > v2026.2.12 for reliable daily cron |

**Deprecated/outdated:**
- `node:sqlite` for production use: Still experimental (stability 1.1), requires `--experimental-sqlite` flag
- Manual `setInterval` for scheduled tasks: OpenClaw cron is more reliable (persists across restarts, exponential backoff on failure)
- `node-cron` for OpenClaw agents: Unnecessary; Gateway provides scheduling natively

## Open Questions

1. **Sandbox write access for SQLite database file**
   - What we know: OpenClaw sandbox has `workspaceAccess: "ro"`. The MCP server runs inside the sandbox.
   - What's unclear: Whether the MCP server process can write to paths OUTSIDE the workspace (e.g., `~/.pricelabs-agent/data.sqlite`). The `env` config passes the path, but the sandbox may restrict file I/O.
   - Recommendation: Test at implementation time. If sandbox blocks writes outside workspace, either (a) adjust sandbox config to allow writes to a specific data directory, or (b) place the SQLite file within a writable sandbox mount.

2. **better-sqlite3 native addon in OpenClaw's Docker sandbox**
   - What we know: better-sqlite3 requires a native C++ addon (`.node` file). OpenClaw's Docker sandbox may restrict execution of native addons.
   - What's unclear: Whether the Docker sandbox allows loading native `.node` binaries. The `sandbox.mode: "all"` setting may be restrictive.
   - Recommendation: Test during initial setup. If blocked, may need to adjust sandbox scope to allow native addon loading, or use `sandbox.mode: "network"` (network-only sandbox) for the MCP server process.

3. **Optimal price snapshot window**
   - What we know: Storing all 365 days of prices for all listings daily creates large data volumes (6.6M rows/year for 50 listings).
   - What's unclear: How far out do users actually query prices for trend analysis? 30 days? 90 days?
   - Recommendation: Start with 90-day window. Add retention policy (delete price snapshots > 90 days old). Listing snapshots kept for 1 year since they are one-row-per-listing.

4. **Dual-channel cron delivery cost**
   - What we know: Two cron jobs (Slack + Telegram) means two isolated agent turns, each consuming API calls and model tokens.
   - What's unclear: Whether OpenClaw supports multi-target delivery from a single cron job, or if there is a "fan-out" mechanism.
   - Recommendation: Start with two jobs. If cost is concern, investigate single-job approach with agent-side dual posting.

5. **PriceLabs reservation_data pagination limits**
   - What we know: The accumulated TODO says "Test PriceLabs reservation_data pagination limits with real data (Phase 2)".
   - What's unclear: Maximum page size, total record limits, behavior with large booking histories.
   - Recommendation: Test during implementation. Default to paginating with `limit: 100, offset: 0` and iterate until `next_page: false`.

## Sources

### Primary (HIGH confidence)
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) -- v12.6.2, installation, features, Node.js compatibility
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) -- API documentation, WAL mode, prepared statements
- [better-sqlite3 API docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) -- Complete API reference
- [OpenClaw Cron Jobs docs](https://docs.openclaw.ai/automation/cron-jobs) -- Schedule types, delivery modes, execution modes, JSON schema
- [OpenClaw Telegram docs](https://docs.openclaw.ai/channels/telegram) -- Message flow, proactive messaging, inline buttons, approval UX
- [OpenClaw Cron Skip Bug #17852](https://github.com/openclaw/openclaw/issues/17852) -- Root cause, fix in PR #17903, affected versions
- [better-sqlite3 vs node:sqlite discussion](https://github.com/WiseLibs/better-sqlite3/discussions/1245) -- Production readiness comparison
- Phase 1 codebase: `mcp-servers/pricelabs/src/` -- Existing architecture, tool registration patterns, service layer
- Phase 1 research: `.planning/phases/01-mcp-server-foundation/01-RESEARCH.md` -- Prior decisions, patterns
- OpenClaw config: `openclaw/openclaw.json` -- Current gateway config, tool deny list (cron denied), channel config

### Secondary (MEDIUM confidence)
- [OpenClaw Production Stack (Medium)](https://medium.com/@rentierdigital/the-complete-openclaw-architecture-that-actually-scales-memory-cron-jobs-dashboard-and-the-c96e00ab3f35) -- Architecture patterns for cron + memory
- [OpenClaw v2026.2.15 Release](https://openclaws.io/blog/openclaw-v2026-2-15-release/) -- Ephemeral approval buttons, Discord CV2
- [BetterStack Node.js Schedulers Comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) -- Croner vs node-cron comparison
- [Local-First RAG with SQLite for OpenClaw](https://www.pingcap.com/blog/local-first-rag-using-sqlite-ai-agent-memory-openclaw/) -- SQLite + OpenClaw patterns
- [@blackglory/better-sqlite3-migrations](https://github.com/BlackGlory/better-sqlite3-migrations) -- Migration utility using user_version

### Tertiary (LOW confidence)
- [SQLite Time Series Best Practices (MoldStud)](https://moldstud.com/articles/p-handling-time-series-data-in-sqlite-best-practices) -- General SQLite snapshot patterns
- [OpenClaw Agent Can't Create Cron Jobs (community)](https://www.answeroverflow.com/m/1470323434067198105) -- Confirms cron tool requires explicit permission

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- better-sqlite3 is the established choice for Node.js SQLite. 10M+ weekly downloads. Production-proven. OpenClaw cron and channels are documented with official docs.
- Architecture: HIGH -- Patterns follow naturally from Phase 1 MCP architecture. New tools use identical registration patterns. Database is a new service layer alongside existing cache, rate limiter, and API client.
- Database schema: HIGH -- Schema design follows standard time-series snapshot patterns. Tested against all 17 Phase 2 requirements. Unique constraints prevent duplicates. Indexes target expected query patterns.
- OpenClaw integration: MEDIUM -- Cron and channel delivery patterns documented but some edge cases (sandbox write access, dual-channel delivery) need validation during implementation.
- Pitfalls: HIGH -- Identified from real OpenClaw bugs (#17852), community discussions, and database volume calculations.

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days -- stable domain, better-sqlite3 is mature, OpenClaw cron API is stabilizing)
