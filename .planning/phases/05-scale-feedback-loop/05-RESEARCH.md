# Phase 5: Scale + Feedback Loop - Research

**Researched:** 2026-02-24
**Domain:** Batch approval workflows, revenue impact tracking, cancellation detection, configurable alert thresholds, SQLite persistence extensions
**Confidence:** HIGH

## Summary

Phase 5 is the final phase (4 requirements, SCALE-01 through SCALE-04), closing the feedback loop between agent recommendations, user approvals, and measurable revenue outcomes. The critical architectural insight is that **most of the infrastructure Phase 5 needs already exists**. The key additions are: (1) a new `change_tracking` table for SCALE-02's revenue impact follow-ups at 7/14/30 days, (2) a new `user_config` table for SCALE-04's configurable alert thresholds, (3) skill protocol enhancements for batch approval (SCALE-01) and cancellation fill strategies (SCALE-03), and (4) a cron job enhancement for periodic impact checks and cancellation detection.

The second insight is that SCALE-01 (batch approval) is already **partially implemented** in the optimization skill. Section 6 "Recommendation Prioritization" already describes batch approval UX: "approve all", "approve 1 and 3, reject 2", cherry-picking, etc. Phase 5 needs to formalize this into a concrete protocol, add batch-specific audit logging, and ensure the agent handles the multi-listing sequential write safety correctly (one snapshot-write-verify cycle per listing, even in batch mode).

The third insight concerns SCALE-03 (cancellation detection). The `pricelabs_store_reservations` tool already detects new cancellations automatically via SQL-level upsert logic (`cancelled_on` set on status transition). The `getRecentCancellations` query already exists. What Phase 5 adds is the *reactive fill strategy* -- teaching the agent what to do when a cancellation is detected (check the freed dates, assess demand, recommend fill strategies). This is a skill protocol addition, not a new tool.

**Primary recommendation:** Add two new SQLite tables via migration (change_tracking for revenue impact, user_config for alert thresholds). Create two new MCP tools (pricelabs_get_change_impact for impact queries, pricelabs_get_user_config / pricelabs_set_user_config for threshold management). Enhance the optimization skill with batch approval protocol and cancellation fill strategy protocol. Add a daily cron check for pending impact assessments. No new npm dependencies needed.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.6.x | Existing. Two new tables (change_tracking, user_config). New queries. | Already installed Phase 2. Same migration pattern. |
| `@modelcontextprotocol/sdk` | 1.26.x | Existing. 2-3 new tools on existing server. | Already installed Phase 1. Same registerTool pattern. |
| `zod` | 3.25+ | Existing. Schemas for new tool inputs. | Already installed Phase 1. Same schema pattern. |

### Supporting

No new npm dependencies required for Phase 5. All additions use:
- Existing MCP tool registration pattern
- Existing SQLite migration framework
- Existing audit log infrastructure
- Existing skill architecture (SKILL.md)
- Existing cron job configuration (jobs.json)

### What NOT to Install

| Library | Why Not |
|---------|---------|
| Any scheduling/timer library | Cron jobs handle periodic checks. No in-process timers needed. |
| Any notification queue | OpenClaw delivers messages. No queue infrastructure needed. |
| Any analytics/reporting library | Agent computes revenue impact from existing snapshot data. No analytics engine needed. |
| Any configuration management library | User config is simple key-value in SQLite. No complex config system needed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `change_tracking` table | Store tracking in audit_log details_json | Audit log lacks structured querying for "find all executions needing 7-day check". Dedicated table enables targeted queries with indexed due dates. |
| New `user_config` table | JSON file for user preferences | JSON file does not survive container restarts without volume mounts. SQLite is already the persistence layer and supports per-listing configs naturally. |
| Skill-based batch protocol | New batch MCP tool that wraps multiple writes | A batch tool would hide individual write failures. Sequential agent-driven writes with per-write verification is safer. The skill protocol already exists in Section 6. |

**Installation:**
```bash
# No new packages needed. Phase 5 is migrations + tools + skill enhancement + cron.
```

## Architecture Patterns

### Recommended Project Structure (Phase 5 additions)

```
mcp-servers/pricelabs/
  src/
    schemas/
      scale.ts                       # NEW: Schemas for change tracking and user config tools
    tools/
      scale.ts                       # NEW: Change impact tracking and user config tools
    db/
      queries/
        change-tracking.ts           # NEW: Queries for change_tracking table
        user-config.ts               # NEW: Queries for user_config table
      migrations.ts                  # UPDATED: Add migrations 6 and 7

skills/
  pricelabs-optimization/
    SKILL.md                         # UPDATED: Add batch approval protocol and cancellation fill strategy

openclaw/
  cron/
    jobs.json                        # UPDATED: Add impact check instructions to daily health check
```

### Pattern 1: Change Tracking Table for Revenue Impact (SCALE-02)

**What:** A new `change_tracking` table that records each executed pricing change and its scheduled follow-up dates. Links to the audit_log execution entry. The daily cron checks for due follow-ups and triggers the agent to assess revenue impact.

**When to use:** After every approved and executed pricing change.

**Table design:**
```sql
CREATE TABLE change_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_log_id INTEGER NOT NULL,         -- FK to audit_log.id for the execution entry
  listing_id TEXT NOT NULL,
  pms TEXT NOT NULL,
  change_type TEXT NOT NULL,             -- 'set_overrides', 'update_listing', 'delete_overrides'
  change_date TEXT NOT NULL,             -- When the change was executed (YYYY-MM-DD)
  affected_dates_start TEXT,             -- Start of affected date range (for DSOs)
  affected_dates_end TEXT,               -- End of affected date range (for DSOs)
  before_json TEXT NOT NULL,             -- Snapshot of before values
  after_json TEXT NOT NULL,              -- What was changed to
  check_7d_due TEXT NOT NULL,            -- Date when 7-day check is due (YYYY-MM-DD)
  check_7d_done INTEGER DEFAULT 0,      -- 1 when 7-day check completed
  check_7d_result_json TEXT,            -- JSON with 7-day impact assessment
  check_14d_due TEXT NOT NULL,           -- Date when 14-day check is due
  check_14d_done INTEGER DEFAULT 0,
  check_14d_result_json TEXT,
  check_30d_due TEXT NOT NULL,           -- Date when 30-day check is due
  check_30d_done INTEGER DEFAULT 0,
  check_30d_result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ct_listing ON change_tracking(listing_id, pms);
CREATE INDEX idx_ct_due ON change_tracking(check_7d_due, check_14d_due, check_30d_due);
CREATE INDEX idx_ct_pending ON change_tracking(check_7d_done, check_14d_done, check_30d_done);
```

**Why a separate table rather than using audit_log:** The audit_log is an append-only event stream. Change tracking requires mutable state (marking checks as done, storing assessment results). The `change_tracking` table links back to audit_log via `audit_log_id` but adds structured due dates and completion tracking that the audit_log's flat schema cannot support.

**Revenue impact assessment protocol:**
```
For each due follow-up check:
1. Fetch current listing snapshot data (occupancy, revenue, booking pace)
2. Compare to snapshot data from the change_date
3. For DSO changes: check if the affected dates booked after the price change
4. For base price changes: compare occupancy and revenue trends before/after
5. Compute metrics:
   - Occupancy change (percentage points)
   - Revenue change (dollars and %)
   - Booking pace change vs STLY
   - Whether affected dates booked (for DSOs)
6. Store assessment in check_Xd_result_json
7. Present findings to user
```

### Pattern 2: User Config Table for Alert Thresholds (SCALE-04)

**What:** A `user_config` table storing configurable alert thresholds. Supports both global defaults and per-listing overrides. The underperformer detection tool and skill protocols read these thresholds instead of using hardcoded defaults.

**Table design:**
```sql
CREATE TABLE user_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL,              -- e.g., 'occupancy_gap_threshold', 'revenue_drop_threshold', 'pace_lag_threshold'
  config_value TEXT NOT NULL,            -- JSON value (number, string, object)
  listing_id TEXT,                       -- NULL for global, specific listing_id for per-listing
  pms TEXT,                              -- NULL for global, specific pms for per-listing
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(config_key, listing_id, pms)    -- One value per config per scope
);
CREATE INDEX idx_uc_key ON user_config(config_key);
CREATE INDEX idx_uc_listing ON user_config(listing_id, pms);
```

**Config keys and defaults:**

| Config Key | Default | Unit | Description |
|-----------|---------|------|-------------|
| `occupancy_gap_threshold` | 20 | % | Alert when listing occupancy exceeds this gap below market |
| `revenue_drop_threshold` | -25 | % | Alert when revenue vs STLY drops below this |
| `pace_lag_threshold` | -20 | % | Alert when booking pace falls behind STLY by this much |
| `health_score_threshold` | 50 | score | Alert when health scores (7d AND 30d) fall below this |
| `stale_sync_hours` | 48 | hours | Alert when sync is stale beyond this many hours |

**Lookup logic (per-listing overrides global):**
```typescript
// Query: get config value with per-listing override fallback to global
const getConfigValue = db.prepare(`
  SELECT config_value FROM user_config
  WHERE config_key = @config_key
    AND (
      (listing_id = @listing_id AND pms = @pms)
      OR (listing_id IS NULL AND pms IS NULL)
    )
  ORDER BY
    CASE WHEN listing_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1
`);
```

This returns the per-listing value if it exists, falling back to the global value, falling back to null (use code default).

### Pattern 3: Batch Approval Protocol (SCALE-01)

**What:** Extend the existing optimization skill Section 6 "Recommendation Prioritization" with a formalized batch approval protocol that handles multi-listing batch operations safely.

**What already exists:**
- Optimization skill Section 6 already defines batch approval UX: "approve all", "approve 1 and 3, reject 2", cherry-pick
- Optimization skill Section 4 Rule 5 already says "Execute write operations sequentially, not in parallel"
- Audit logging already exists for each step

**What Phase 5 adds:**
1. Formal batch state tracking in the conversation (numbered recommendations with status)
2. Batch summary audit log entry (single entry for the batch with individual results)
3. Error handling for partial batch failures (if write 2 of 5 fails, report and continue with 3-5)
4. Batch completion report with aggregated before/after values

**Batch approval flow:**
```
1. Agent presents N recommendations, numbered 1 through N, grouped by listing
2. User responds with one of:
   - "approve all" -> execute all sequentially
   - "approve 1, 3, 5" -> execute selected, skip others
   - "reject all" -> skip all, log rejections
   - "approve 1-3, reject 4-5" -> mixed approval
3. Agent executes approved changes sequentially:
   - For each approved recommendation: snapshot -> write -> verify -> log
   - If a write fails: log the failure, report to user, continue with remaining
4. Agent presents batch completion report:
   - "Executed 3 of 5 recommendations. 2 rejected."
   - Summary of changes made with before/after values
   - Any failures with error details
5. Agent logs batch summary in audit log with action_type='execution',
   details_json containing the batch context and individual results
```

### Pattern 4: Cancellation Fill Strategy Protocol (SCALE-03)

**What:** A skill protocol that teaches the agent how to detect cancellations and recommend reactive fill strategies for the freed dates.

**What already exists:**
- `pricelabs_store_reservations` already detects new cancellations (SQL-level upsert with `cancelled_on` auto-set)
- `getRecentCancellations` query already returns cancellations since a given date
- The store tool response already includes `new_cancellations` array with check_in, check_out, rental_revenue
- The daily health check cron already calls `pricelabs_store_reservations` for each listing

**What Phase 5 adds -- the reactive fill strategy protocol:**
```markdown
## Cancellation Fill Strategy Protocol (SCALE-03)

When new cancellations are detected during daily health checks or reservation syncs:

### Step 1: Assess the cancellation
For each newly cancelled reservation:
1. Check how far out the freed dates are:
   - < 7 days: URGENT -- very short booking window remaining
   - 7-14 days: HIGH priority -- still bookable but time-sensitive
   - 14-30 days: MODERATE -- normal fill window
   - > 30 days: LOW -- algorithm and organic demand will likely handle it
2. Check the freed revenue: how much revenue was lost
3. Check if the freed dates create an orphan gap with adjacent bookings

### Step 2: Formulate fill strategy based on urgency
- URGENT (< 7 days): Recommend aggressive DSO (-25% to -30%).
  Any revenue is better than $0 at this lead time.
- HIGH (7-14 days): Recommend moderate DSO (-15% to -20%).
  Enough time for a booking at a reasonable discount.
- MODERATE (14-30 days): Recommend mild DSO (-10% to -15%)
  OR no action if demand is healthy for those dates.
- LOW (> 30 days): No DSO recommended. Note the cancellation
  for monitoring. The algorithm will handle organic demand.

### Step 3: Check market context
Call pricelabs_get_prices for the freed dates to assess:
- Is there existing demand (demand_color = red/orange)?
  If so, less aggressive discounting needed.
- Are the freed dates already part of an orphan gap?
  If so, the orphan day protocol applies in addition.
- Are there existing DSOs for those dates? If so, note them.

### Step 4: Present recommendation
Format: "Cancellation detected for [listing name]: [guest name]
cancelled [check-in to check-out] ($[revenue] lost).
[Urgency level]. I recommend [specific DSO with dates and %].
This would price the dates at approximately $[price]
(down from $[current]) to maximize fill probability."

### Step 5: Track for follow-up
If a fill strategy is approved and executed, create a change_tracking
entry to follow up on whether the dates actually re-booked.
```

### Anti-Patterns to Avoid

- **Batch writes in parallel:** Even when approving 5 changes at once, writes MUST execute sequentially. Parallel writes can cause race conditions with rate limiting and cache invalidation. The existing Rule 5 in the safety protocol already mandates this.
- **Auto-creating change tracking entries:** Only create change_tracking entries for user-approved and successfully executed changes. Do not track recommendations that were rejected or writes that failed.
- **Configuring thresholds without validation:** Alert thresholds must have sensible bounds. Occupancy gap cannot be negative. Revenue drop threshold should be negative (it represents a decline). Pace lag threshold should be negative. Add Zod validation in the schema.
- **Computing impact for DSOs on dates that have already passed:** If the affected dates in a DSO change are already past when the 7-day check is due, the impact assessment should focus on whether those dates booked, not on ongoing revenue metrics.
- **Overriding all thresholds per-listing:** Start with global thresholds only. Per-listing overrides should be an explicit user action, not auto-generated. Most users will use global thresholds for their entire portfolio.

## Existing Infrastructure Inventory (Phase 5 Already Has)

This is critical for the planner to understand what does NOT need to be built.

| Requirement | Already Exists | Where | What Phase 5 Adds |
|-------------|---------------|-------|-------------------|
| SCALE-01: Batch approval UX | PARTIAL | `skills/pricelabs-optimization/SKILL.md` Section 6 (numbered recommendations, "approve all", cherry-pick) | Formalized batch protocol with batch audit logging, error handling for partial failures, batch completion report |
| SCALE-01: Sequential write safety | YES | `skills/pricelabs-optimization/SKILL.md` Section 4 Rule 5 | Nothing. Already says "Execute write operations sequentially." |
| SCALE-01: Audit logging | YES | `tools/audit.ts` (pricelabs_log_action) | Batch summary log entries with action_type='execution' |
| SCALE-02: Audit log with execution details | YES | `schemas/monitoring.ts` (action_type='execution'), audit log details_json with before/after | Nothing for the execution logging. Phase 5 adds the follow-up tracking. |
| SCALE-02: Listing snapshot data for comparison | YES | `db/queries/listing-snapshots.ts` (getSnapshotRange), `db/queries/price-snapshots.ts` | Nothing. Existing snapshot data is used for before/after comparison. |
| SCALE-03: Cancellation detection | YES | `db/queries/reservations.ts` (SQL-level cancelled_on detection, getRecentCancellations) | Nothing for detection. Phase 5 adds the fill strategy protocol. |
| SCALE-03: Reservation persistence | YES | `tools/snapshots.ts` (pricelabs_store_reservations with new_cancellations response) | Nothing. Store tool already detects and reports cancellations. |
| SCALE-03: Daily health check runs reservation sync | YES | `openclaw/cron/jobs.json` (daily-portfolio-health) + `skills/pricelabs-monitoring/SKILL.md` Step 7 | Enhance cron prompt to include cancellation fill strategy check. |
| SCALE-04: Underperformer thresholds | PARTIAL | `schemas/analysis.ts` (DetectUnderperformersInputSchema has occupancy_gap_threshold, revenue_stly_threshold as optional params) | These are already per-call params. Phase 5 adds persistent storage and per-listing override capability. |
| SCALE-04: Hardcoded defaults | YES | `tools/analysis.ts` (occGapThreshold defaults to 20, revenueStlyThreshold defaults to -25) | Phase 5 makes these configurable via user_config table lookup. |

## New Additions Needed for Phase 5

| Addition | Type | Purpose | Requirement |
|----------|------|---------|-------------|
| `change_tracking` table (migration 6) | DB Migration | Track executed changes with scheduled follow-up dates | SCALE-02 |
| `user_config` table (migration 7) | DB Migration | Store configurable alert thresholds per-listing or globally | SCALE-04 |
| Change tracking queries | TypeScript | Insert, query due checks, mark complete, get results | SCALE-02 |
| User config queries | TypeScript | Get/set config with per-listing fallback to global | SCALE-04 |
| Scale schemas | TypeScript | Zod schemas for new tool inputs | SCALE-02, SCALE-04 |
| `pricelabs_get_change_impact` tool | MCP Tool | Query pending and completed impact assessments | SCALE-02 |
| `pricelabs_get_user_config` tool | MCP Tool | Read alert thresholds (global and per-listing) | SCALE-04 |
| `pricelabs_set_user_config` tool | MCP Tool | Set/update alert thresholds | SCALE-04 |
| Batch approval protocol (skill update) | Skill | Formalized batch approve/reject flow with error handling | SCALE-01 |
| Cancellation fill strategy protocol (skill update) | Skill | Reactive fill strategy for cancelled reservations | SCALE-03 |
| Updated `pricelabs_detect_underperformers` | Tool update | Read thresholds from user_config before applying defaults | SCALE-04 |
| Cron job enhancement | Config | Add impact check + cancellation fill strategy to daily health check | SCALE-02, SCALE-03 |
| Scale tool registration | index.ts | Register new tools on the server | SCALE-02, SCALE-04 |

**Total new MCP tools:** 3 (`pricelabs_get_change_impact`, `pricelabs_get_user_config`, `pricelabs_set_user_config`)
**Total tools after Phase 5:** 24 (existing) + 3 (new) = 27 tools

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Revenue impact computation | Statistical impact analysis engine | Agent reasoning over snapshot deltas with skill protocol | The agent compares snapshot values at different points in time. Simple arithmetic (delta occupancy, delta revenue, booked/unbooked). No statistical model needed. |
| Batch approval state machine | Workflow engine with batch state tracking | Conversational batch flow via skill protocol | OpenClaw manages the conversation. Agent numbers recommendations, user cherry-picks, agent executes sequentially. No persistent batch state needed beyond the conversation. |
| Cancellation notification system | Event-driven notification pipeline | Existing store_reservations detection + daily cron | The reservation upsert already detects cancellations. The daily cron already syncs reservations. Adding a notification pipeline adds infrastructure complexity for no gain. |
| Config management UI | Settings page or config file editor | MCP tool + natural language ("set my occupancy alert to 15%") | Users configure via chat. Agent calls pricelabs_set_user_config. No UI needed. |
| Scheduled job runner | Task scheduler for 7/14/30 day follow-ups | Daily cron queries change_tracking for due checks | The daily health check already runs. Adding a SQL query for due impact checks is trivial. No separate scheduler needed. |

**Key insight:** Phase 5 follows the same pattern as Phases 2-4: the agent is the intelligence layer, MCP tools provide data access and persistence, skills provide protocols, and cron jobs trigger periodic operations. No new infrastructure paradigm is introduced.

## Common Pitfalls

### Pitfall 1: Impact Assessment on Stale or Missing Snapshot Data

**What goes wrong:** The 7-day impact check runs but no listing snapshot exists for the change_date (the "before" baseline). The agent cannot compute a meaningful delta without a baseline comparison point.
**Why it happens:** If the daily health check failed on the change_date, no snapshot was stored. Or if the change was executed mid-day and snapshots are stored at 8am, the "before" snapshot might be from the previous day.
**How to avoid:** When creating a change_tracking entry, store the current listing snapshot values inline in `before_json` (occupancy, revenue, base price, health scores) at execution time. Do not rely on finding the exact snapshot_date in listing_snapshots -- the data might not exist. The `before_json` is the authoritative baseline.
**Warning signs:** Impact assessments that report "baseline data unavailable" or show wildly inaccurate deltas because they used the wrong snapshot date.

### Pitfall 2: Batch Approval Confusion with Ambiguous Numbers

**What goes wrong:** Agent presents recommendations numbered 1-5. User says "approve the first three." Agent interprets this as "approve 1, 2, 3" but user meant the first three listings (which might be recommendations 1, 3, 5 if grouped by listing). Misalignment causes wrong changes.
**Why it happens:** Natural language ambiguity in multi-item interactions.
**How to avoid:** The batch protocol must use explicit, unambiguous numbering. After user's approval response, the agent MUST echo back exactly which recommendations it will execute: "I will execute recommendations 1, 2, and 3. Confirm?" Wait for confirmation before proceeding. This is the standard "confirm destructive batch" pattern.
**Warning signs:** User surprise ("that's not what I meant") after batch execution. Rollback requests following batch approvals.

### Pitfall 3: Cancellation Fill Strategy for Owner Blocks

**What goes wrong:** A reservation is cancelled, but the host immediately blocks those dates for personal use. The agent detects the cancellation and recommends a fill strategy for dates that are now owner-blocked.
**Why it happens:** The cancellation detection happens when reservations are synced. The owner block happens separately. There is a timing gap between detecting the cancellation and checking current date availability.
**How to avoid:** The fill strategy protocol MUST check current date availability (unbookable status) before recommending fill pricing. Call `pricelabs_get_prices` for the freed dates and verify `unbookable != "1"` for each date before including it in a fill recommendation.
**Warning signs:** Fill strategy recommendations for dates marked as owner-blocked.

### Pitfall 4: User Config Threshold Conflicts

**What goes wrong:** User sets a per-listing occupancy gap threshold of 10% for their best listing, but the global threshold is 20%. The daily report flags the listing at 12% gap (exceeds per-listing threshold) but other listings at 15% gap are not flagged (below global threshold). User is confused by inconsistent behavior.
**How to avoid:** When presenting alerts with per-listing thresholds, always note the threshold source: "Mountain View Cabin: occupancy gap 12% (exceeds your custom 10% threshold for this listing)" vs "Beach House: occupancy gap 15% (within your global 20% threshold)." Make the threshold being applied visible in every alert.
**Warning signs:** User asks "why was this flagged but not that one?" -- indicates threshold confusion.

### Pitfall 5: Impact Assessment for Base Price Changes vs DSO Changes

**What goes wrong:** The impact assessment treats a DSO change and a base price change the same way. But their impact timelines are fundamentally different. A DSO change affects specific dates (did those dates book?). A base price change affects all future pricing (how did overall metrics change?).
**Why it happens:** Using a single assessment protocol for fundamentally different change types.
**How to avoid:** The impact assessment protocol must branch by change_type:
- **DSO changes (set_overrides, delete_overrides):** Primary metric is whether the affected dates booked. Secondary is the revenue those dates generated vs the expected revenue at the old price.
- **Base price changes (update_listing):** Primary metrics are occupancy trend, revenue trend, and booking pace trend over the assessment window. No specific dates to check.
**Warning signs:** Impact reports for DSO changes that talk about "overall revenue trends" without checking if the specific dates booked.

### Pitfall 6: Excessive Change Tracking Data Growth

**What goes wrong:** Over months of operation, the change_tracking table grows large as every executed change creates a row that is never cleaned up. Impact assessments accumulate JSON blobs in result columns.
**Why it happens:** No data retention policy.
**How to avoid:** After the 30-day check is complete (all three checks done), the change_tracking row could be archived or summarized. However, for v1, this is likely premature optimization. The volume of executed changes per month is small (maybe 10-20 changes for a portfolio of 5-10 listings). At 1KB per row, a year of changes is roughly 250KB. SQLite handles this trivially. Defer archival to v2 if needed. BUT: add a note in the skill protocol about long-term data management.
**Warning signs:** Database size growing significantly (>50MB) from change_tracking alone. This is extremely unlikely for v1 portfolio sizes.

## Code Examples

### Migration 6: change_tracking table

```typescript
// Add to migrations array in src/db/migrations.ts
{
  version: 6,
  description: "Create change_tracking table for revenue impact follow-ups",
  up(db) {
    db.exec(`
      CREATE TABLE change_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        audit_log_id INTEGER NOT NULL,
        listing_id TEXT NOT NULL,
        pms TEXT NOT NULL,
        change_type TEXT NOT NULL,
        change_date TEXT NOT NULL,
        affected_dates_start TEXT,
        affected_dates_end TEXT,
        before_json TEXT NOT NULL,
        after_json TEXT NOT NULL,
        check_7d_due TEXT NOT NULL,
        check_7d_done INTEGER NOT NULL DEFAULT 0,
        check_7d_result_json TEXT,
        check_14d_due TEXT NOT NULL,
        check_14d_done INTEGER NOT NULL DEFAULT 0,
        check_14d_result_json TEXT,
        check_30d_due TEXT NOT NULL,
        check_30d_done INTEGER NOT NULL DEFAULT 0,
        check_30d_result_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_ct_listing ON change_tracking(listing_id, pms);
      CREATE INDEX idx_ct_pending ON change_tracking(check_7d_done, check_14d_done, check_30d_done);
    `);
  },
},
```

### Migration 7: user_config table

```typescript
{
  version: 7,
  description: "Create user_config table for configurable alert thresholds",
  up(db) {
    db.exec(`
      CREATE TABLE user_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT NOT NULL,
        config_value TEXT NOT NULL,
        listing_id TEXT,
        pms TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(config_key, COALESCE(listing_id, '__global__'), COALESCE(pms, '__global__'))
      );
      CREATE INDEX idx_uc_key ON user_config(config_key);
      CREATE INDEX idx_uc_listing ON user_config(listing_id, pms);
    `);
  },
},
```

**Note on UNIQUE constraint:** SQLite treats NULL as distinct for UNIQUE purposes, so `UNIQUE(config_key, listing_id, pms)` would allow multiple rows with the same key and NULL listing_id. The COALESCE sentinel pattern ensures true uniqueness: one global row per key, one per-listing row per key+listing.

### Change Tracking Queries

```typescript
// src/db/queries/change-tracking.ts

export function createChangeTrackingQueries(db: BetterSqlite3.Database) {
  const insertTracking = db.prepare(`
    INSERT INTO change_tracking (
      audit_log_id, listing_id, pms, change_type, change_date,
      affected_dates_start, affected_dates_end,
      before_json, after_json,
      check_7d_due, check_14d_due, check_30d_due
    ) VALUES (
      @audit_log_id, @listing_id, @pms, @change_type, @change_date,
      @affected_dates_start, @affected_dates_end,
      @before_json, @after_json,
      @check_7d_due, @check_14d_due, @check_30d_due
    )
  `);

  // Get all pending checks (any of the 3 intervals not yet done)
  const getPendingChecks = db.prepare(`
    SELECT * FROM change_tracking
    WHERE (
      (check_7d_done = 0 AND check_7d_due <= @today)
      OR (check_14d_done = 0 AND check_14d_due <= @today)
      OR (check_30d_done = 0 AND check_30d_due <= @today)
    )
    ORDER BY change_date ASC
  `);

  // Mark a specific check as done with results
  const markCheckDone = db.prepare(`
    UPDATE change_tracking
    SET check_7d_done = CASE WHEN @interval = 7 THEN 1 ELSE check_7d_done END,
        check_7d_result_json = CASE WHEN @interval = 7 THEN @result_json ELSE check_7d_result_json END,
        check_14d_done = CASE WHEN @interval = 14 THEN 1 ELSE check_14d_done END,
        check_14d_result_json = CASE WHEN @interval = 14 THEN @result_json ELSE check_14d_result_json END,
        check_30d_done = CASE WHEN @interval = 30 THEN 1 ELSE check_30d_done END,
        check_30d_result_json = CASE WHEN @interval = 30 THEN @result_json ELSE check_30d_result_json END
    WHERE id = @id
  `);

  // Get impact history for a listing
  const getByListing = db.prepare(`
    SELECT * FROM change_tracking
    WHERE listing_id = @listing_id AND pms = @pms
    ORDER BY change_date DESC
    LIMIT @limit
  `);

  return { insertTracking, getPendingChecks, markCheckDone, getByListing };
}
```

### User Config Queries

```typescript
// src/db/queries/user-config.ts

export function createUserConfigQueries(db: BetterSqlite3.Database) {
  // Get config value with per-listing fallback to global
  const getConfigValue = db.prepare(`
    SELECT config_value FROM user_config
    WHERE config_key = @config_key
      AND (
        (listing_id = @listing_id AND pms = @pms)
        OR (listing_id IS NULL AND pms IS NULL)
      )
    ORDER BY
      CASE WHEN listing_id IS NOT NULL THEN 0 ELSE 1 END
    LIMIT 1
  `);

  // Get all config for a listing (merged with globals)
  const getAllForListing = db.prepare(`
    SELECT uc1.config_key,
           COALESCE(uc2.config_value, uc1.config_value) as config_value,
           CASE WHEN uc2.id IS NOT NULL THEN 'listing' ELSE 'global' END as source
    FROM user_config uc1
    LEFT JOIN user_config uc2
      ON uc1.config_key = uc2.config_key
      AND uc2.listing_id = @listing_id AND uc2.pms = @pms
    WHERE uc1.listing_id IS NULL AND uc1.pms IS NULL
  `);

  // Get all global config
  const getAllGlobal = db.prepare(`
    SELECT config_key, config_value, updated_at
    FROM user_config
    WHERE listing_id IS NULL AND pms IS NULL
    ORDER BY config_key ASC
  `);

  // Upsert config value (works for both global and per-listing)
  const upsertConfig = db.prepare(`
    INSERT INTO user_config (config_key, config_value, listing_id, pms)
    VALUES (@config_key, @config_value, @listing_id, @pms)
    ON CONFLICT(config_key, COALESCE(listing_id, '__global__'), COALESCE(pms, '__global__'))
    DO UPDATE SET config_value = excluded.config_value, updated_at = datetime('now')
  `);

  // Delete a per-listing override (revert to global)
  const deleteListingOverride = db.prepare(`
    DELETE FROM user_config
    WHERE config_key = @config_key
      AND listing_id = @listing_id AND pms = @pms
  `);

  return { getConfigValue, getAllForListing, getAllGlobal, upsertConfig, deleteListingOverride };
}
```

### Scale Tool Schemas

```typescript
// src/schemas/scale.ts

import { z } from "zod";

/** Input for pricelabs_get_change_impact - query revenue impact tracking */
export const GetChangeImpactInputSchema = z.object({
  listing_id: z.string().optional()
    .describe("Filter by listing ID. Omit for all listings."),
  pms: z.string().optional()
    .describe("PMS name. Required if listing_id provided."),
  pending_only: z.boolean().optional()
    .describe("If true, return only changes with pending impact checks. Default: false."),
  limit: z.number().optional()
    .describe("Maximum entries to return. Default: 20."),
});

/** Input for pricelabs_get_user_config - read alert thresholds */
export const GetUserConfigInputSchema = z.object({
  listing_id: z.string().optional()
    .describe("Get config for a specific listing (merged with globals). Omit for global only."),
  pms: z.string().optional()
    .describe("PMS name. Required if listing_id provided."),
});

/** Input for pricelabs_set_user_config - set alert thresholds */
export const SetUserConfigInputSchema = z.object({
  config_key: z.enum([
    "occupancy_gap_threshold",
    "revenue_drop_threshold",
    "pace_lag_threshold",
    "health_score_threshold",
    "stale_sync_hours",
  ]).describe("Which alert threshold to configure"),
  config_value: z.number()
    .describe("Numeric threshold value"),
  listing_id: z.string().optional()
    .describe("Set for a specific listing. Omit for global default."),
  pms: z.string().optional()
    .describe("PMS name. Required if listing_id provided."),
});

/** Input for recording a change for impact tracking */
export const RecordChangeInputSchema = z.object({
  audit_log_id: z.number()
    .describe("ID of the audit_log entry for the execution"),
  listing_id: z.string()
    .describe("Listing that was changed"),
  pms: z.string()
    .describe("PMS name"),
  change_type: z.enum(["set_overrides", "update_listing", "delete_overrides"])
    .describe("Type of change that was executed"),
  affected_dates_start: z.string().optional()
    .describe("Start of affected date range for DSOs (YYYY-MM-DD)"),
  affected_dates_end: z.string().optional()
    .describe("End of affected date range for DSOs (YYYY-MM-DD)"),
  before_json: z.string()
    .describe("JSON snapshot of values before the change"),
  after_json: z.string()
    .describe("JSON of what was changed to"),
});
```

### Updating pricelabs_detect_underperformers to Use User Config

```typescript
// In tools/analysis.ts, modify the handler to check user_config first
// Before applying defaults, check user_config table:

const configQueries = createUserConfigQueries(db);

// Inside the handler:
const occGapThreshold = params.occupancy_gap_threshold ?? (() => {
  const userValue = configQueries.getConfigValue.get({
    config_key: 'occupancy_gap_threshold',
    listing_id: params.listing_id ?? null,
    pms: params.pms ?? null,
  });
  return userValue ? Number(userValue.config_value) : 20;
})();
```

**Note:** The existing `pricelabs_detect_underperformers` already accepts thresholds as optional parameters. The user_config lookup simply provides a persistent default instead of the hardcoded 20/25. The tool-level parameter still overrides everything (useful for ad-hoc analysis with different thresholds).

### Cron Job Enhancement for Impact Checks

```json
// Enhancement to the daily-portfolio-health cron job payload message:
// After the existing health check instructions, add:

"After completing the health check, also:\n\n
5. Check for pending revenue impact assessments. Call pricelabs_get_change_impact
with pending_only=true. For each due assessment, compare current listing metrics
(occupancy, revenue, booking pace) to the baseline stored in the change tracking
entry. Record the impact assessment result. If the impact is significant (positive
or negative), include it in today's health report.\n\n
6. Check for new cancellations detected during reservation sync (Step 7 above).
For each new cancellation, follow the Cancellation Fill Strategy Protocol from
your optimization skill. Assess urgency based on check-in proximity, check date
availability, and formulate a fill strategy recommendation if appropriate."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One-by-one approval (Phase 4) | Batch approve/reject with cherry-pick (Phase 5) | Phase 5 | Users manage larger portfolios without approval fatigue |
| Fire-and-forget pricing changes | 7/14/30 day impact tracking (Phase 5) | Phase 5 | Closes the feedback loop -- users see if changes worked |
| Cancellation as notification only | Cancellation + reactive fill strategy (Phase 5) | Phase 5 | Agent proactively recovers revenue from cancellations |
| Hardcoded alert thresholds (20%/25%) | User-configurable per-listing or global (Phase 5) | Phase 5 | Users tune sensitivity to match their risk tolerance |

**Deprecated/outdated:**
- Hardcoded threshold values in `tools/analysis.ts` -- these become fallback defaults, not primary values
- Single-recommendation approval flow -- still supported but batch flow is the primary path for optimization scans

## Open Questions

1. **Change tracking: when to create the entry**
   - What we know: The entry should be created after a successful write with before/after values.
   - What's unclear: Should the agent create the entry (via a skill instruction to call a tool), or should the write tools automatically create it? The agent-driven approach is more flexible (agent can choose not to track trivial changes) but risks forgetting. The automatic approach is more reliable but tracks everything.
   - Recommendation: Agent-driven via a new `pricelabs_record_change` tool. The optimization skill instructs the agent to call this tool after every successful execution. This aligns with the existing pattern where the agent logs actions via pricelabs_log_action. The alternative (auto-tracking in write tools) would require modifying existing working code and would track writes that happen outside the approval workflow.

2. **Impact assessment: should it auto-present or wait for user query?**
   - What we know: The daily cron will check for due assessments. The question is whether to include impact results in the daily health report automatically, or only present them when the user asks.
   - What's unclear: Whether daily impact reports add noise or value.
   - Recommendation: Include brief impact summaries in the daily health report only for assessments with significant findings (occupancy changed by more than 5 percentage points, or affected DSO dates booked/did not book). Present as a one-line note: "7-day impact check: Mountain View Cabin orphan fill on March 15 -- date booked at $156 (revenue recovered)." Full details available on user request.

3. **User config: seeding defaults**
   - What we know: The user_config table starts empty. The hardcoded defaults in tools/analysis.ts serve as fallbacks.
   - What's unclear: Should the system seed default rows into user_config at migration time, or use code-level fallbacks?
   - Recommendation: Code-level fallbacks (no seeding). This is simpler and means the user_config table only contains values the user has explicitly configured. An empty table means "use all defaults." The tool response should show both the active value and whether it came from user config or the system default.

4. **Batch approval: conversation scope**
   - What we know: Cron jobs run in isolated sessions. If a batch of recommendations is presented in a cron-triggered weekly report, the user's approval happens in the same session.
   - What's unclear: What happens if the user doesn't respond to the batch prompt until the next day? The session may have closed.
   - Recommendation: Follow the existing 48-hour expiry rule from the optimization skill. If the user responds within the session, proceed normally. If the session expires, the next weekly scan will regenerate fresh recommendations. Do not persist batch state across sessions -- it adds complexity and the recommendations may be stale anyway.

5. **Should pricelabs_record_change be a separate tool or a parameter on pricelabs_log_action?**
   - What we know: The audit log tool already handles execution logging. Adding change tracking is conceptually a "post-execution" step.
   - What's unclear: Whether a separate tool is cleaner than extending the existing one.
   - Recommendation: Use a separate `pricelabs_record_change` tool. The change_tracking table has a fundamentally different schema and purpose from the audit log. Mixing them into one tool would make the schema complex and the tool's purpose unclear. The agent calls pricelabs_log_action for the audit entry, then pricelabs_record_change for impact tracking -- two distinct concerns.

## Sources

### Primary (HIGH confidence)
- Existing codebase: All source files in `mcp-servers/pricelabs/src/` verified by reading source
  - `db/migrations.ts` -- 5 existing migrations, user_version pragma pattern
  - `db/queries/reservations.ts` -- SQL-level cancellation detection, getRecentCancellations query
  - `db/queries/audit-log.ts` -- Insert, query by listing/type/date
  - `db/queries/analysis.ts` -- Underperformer detection with configurable thresholds
  - `tools/analysis.ts` -- Hardcoded defaults (occGapThreshold=20, revenueStlyThreshold=-25)
  - `tools/snapshots.ts` -- pricelabs_store_reservations with new_cancellations detection
  - `tools/optimization.ts` -- pricelabs_snapshot_before_write pattern
  - `schemas/monitoring.ts` -- LogActionInputSchema with action_type enum
  - `schemas/analysis.ts` -- DetectUnderperformersInputSchema with optional thresholds
  - `index.ts` -- 24 tools, 13+1+1 registration functions pattern
- Existing skills:
  - `skills/pricelabs-optimization/SKILL.md` -- Section 6 already defines batch approval UX (numbered recommendations, approve all, cherry-pick, 48-hour expiry)
  - `skills/pricelabs-monitoring/SKILL.md` -- Daily health check protocol, alert dedup, stale sync detection
  - `skills/pricelabs-analysis/SKILL.md` -- Underperformance thresholds, action decision tree
  - `skills/pricelabs-domain/SKILL.md` -- Orphan day fill strategies, cancellation context
- Existing config: `openclaw/cron/jobs.json` -- 4 cron jobs (2 daily, 2 weekly), dual-channel pattern
- Project state: `.planning/STATE.md` -- 37/43 requirements delivered, Phase 4 COMPLETE

### Secondary (MEDIUM confidence)
- Phase 4 research: `.planning/phases/04-write-operations-approval-workflow/04-RESEARCH.md` -- Approval flow patterns, audit trail conventions, optimization protocols (verified by Phase 4 execution)
- SQLite UNIQUE constraint with NULL behavior -- well-documented SQLite behavior, COALESCE sentinel pattern is standard workaround

### Tertiary (LOW confidence)
- None. All findings are derived from direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries needed. All infrastructure patterns established in Phases 1-4.
- Architecture: HIGH -- Two new tables follow the same migration pattern. New tools follow the same registerTool pattern. Skill updates follow established protocol structure.
- Batch approval (SCALE-01): HIGH -- Already partially implemented in optimization skill Section 6. Phase 5 formalizes what exists.
- Revenue impact tracking (SCALE-02): HIGH -- New table + new tool + skill protocol. Conceptually simple (compare snapshots at different dates). The snapshot infrastructure from Phase 2 provides the comparison data.
- Cancellation detection (SCALE-03): HIGH -- Already fully implemented at the detection level. Phase 5 adds only the reactive fill strategy protocol.
- Configurable thresholds (SCALE-04): HIGH -- New table + new tools. The existing analysis tool already accepts threshold parameters; Phase 5 makes them persistent and per-listing.
- Pitfalls: HIGH -- Derived from concrete analysis of existing tool behavior, data flow, and conversation dynamics.

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days -- stable domain, no external dependency changes expected)
