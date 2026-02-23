# Phase 3: Analysis Layer + Smart Alerting - Research

**Researched:** 2026-02-22
**Domain:** Analysis computation (RevPAR/ADR/occupancy trends), underperformance detection, weekly reporting, competitive positioning, demand calendar rendering, OpenClaw cron scheduling, agent skill architecture
**Confidence:** HIGH

## Summary

Phase 3 transforms the PriceLabs agent from a monitoring/reporting system into an analytical intelligence engine. Where Phase 2 collected and persisted data, Phase 3 derives insights from that data: detecting underperformance, computing portfolio KPIs with week-over-week and STLY comparisons, positioning listings against market percentiles, and rendering demand calendars in chat. The phase delivers six requirements (ANLY-01 through ANLY-06) that collectively prove the agent's analytical value before Phase 4 grants write access.

The critical architectural insight is that Phase 3 requires **minimal new infrastructure**. The existing 21 MCP tools, 5 SQLite tables, and prepared statement query modules already provide all data access and persistence needed. What Phase 3 adds is: (1) a small number of new analysis-oriented MCP tools for portfolio-level KPI computation and underperformance detection, (2) new prepared SQL queries for week-over-week and STLY snapshot comparisons, (3) an analysis skill (SKILL.md) that teaches the agent HOW to perform competitive analysis, generate weekly reports, render demand calendars, and compose actionable alerts, and (4) weekly cron jobs for automated report delivery. The analysis layer lives primarily in agent skill instructions and SQL queries -- not in application code.

The second key insight is that **the agent itself is the analysis engine**. Rather than building a complex rule engine in TypeScript, the analysis skill provides the agent with analytical frameworks, threshold definitions, and output templates. The agent reasons over data from MCP tools using these frameworks. This aligns with the locked decision of "framework + reasoning approach" from Phase 1. The MCP tools provide raw data access; the skill provides the analytical playbook; the LLM connects the two. New MCP tools are only needed where SQL aggregation is required for efficiency (e.g., computing RevPAR from reservation data across a date range) or where the agent cannot feasibly compute something from raw tool outputs alone.

**Primary recommendation:** Add 2-3 new analysis MCP tools for portfolio KPI aggregation and underperformance scanning. Add new SQL queries for week-over-week and STLY snapshot comparisons. Create a comprehensive analysis skill (SKILL.md) with protocols for weekly reports, underperformance alerting, competitive positioning, and demand calendar rendering. Add weekly cron jobs (Monday, dual-channel). The vast majority of Phase 3's analytical intelligence lives in the skill instructions, not in application code.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.6.x | Existing. Analysis queries run against accumulated snapshot data | Already installed Phase 2. New prepared statements for aggregation queries. |
| `@modelcontextprotocol/sdk` | 1.26.x | Existing. New analysis tools registered on existing server | Already installed Phase 1. Same `registerTool` pattern. |
| `zod` | 3.25+ | Existing. Schemas for new analysis tool inputs | Already installed Phase 1. Same schema pattern. |

### Supporting

No new npm dependencies required for Phase 3. All analysis is performed through:
- New SQL queries against existing SQLite tables
- New MCP tools using existing patterns
- Agent skill instructions (SKILL.md)
- OpenClaw cron configuration (JSON)

### What NOT to Install

| Library | Why Not |
|---------|---------|
| `simple-statistics` / `mathjs` | RevPAR, ADR, occupancy are simple arithmetic (multiply, divide, percentage change). No statistical library needed. |
| `chart.js` / `d3` / `vega-lite` | No image rendering needed. Demand calendar is text-based in chat. OpenClaw channels render agent text directly. |
| `handlebars` / `mustache` / `ejs` | Report templates live in the analysis skill as agent instructions, not compiled templates. The LLM formats output. |
| `node-cron` / `croner` | OpenClaw Gateway cron handles scheduling. Already proven in Phase 2. |
| Any ML/scoring library | Underperformance detection uses threshold-based rules (occupancy gap > X%, revenue vs STLY < Y%), not ML scoring. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL aggregation in MCP tools | Agent computing from raw tool data | Agent would need to make N tool calls and do math in-context; SQL is faster and more token-efficient for portfolio-wide aggregations |
| Agent skill for analysis logic | TypeScript rule engine | Skill approach is more flexible, easier to tune, and aligned with the "framework + reasoning" decision; rule engine adds code complexity for rigid if/then logic the LLM can reason about |
| Text-based demand calendar | Image/chart generation | Text works in all channels (Slack, Telegram) without rendering infrastructure; emoji/unicode blocks provide visual differentiation |

**Installation:**
```bash
# No new packages needed. Phase 3 is skill + queries + tools.
```

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
mcp-servers/pricelabs/
  src/
    db/
      queries/
        analysis.ts              # NEW: Week-over-week, STLY, RevPAR aggregation queries
    tools/
      analysis.ts                # NEW: Portfolio KPI + underperformance detection tools
    schemas/
      analysis.ts                # NEW: Zod schemas for analysis tool inputs

skills/
  pricelabs-analysis/
    SKILL.md                     # NEW: Analysis skill (weekly report, alerts, demand cal)

openclaw/
  cron/
    jobs.json                    # UPDATED: Add weekly report cron jobs (Monday)
```

### Pattern 1: Analysis Query Module

**What:** A new prepared statement module (`analysis.ts`) that provides aggregation queries for portfolio KPIs. These queries compute RevPAR, ADR, occupancy trends from existing snapshot tables, and compare current period vs previous week and STLY.
**When to use:** Called by new analysis MCP tools to efficiently compute portfolio-wide metrics.

```typescript
// Source: Existing query module pattern from Phase 2
import * as BetterSqlite3 from "better-sqlite3";

export interface PortfolioKpiRow {
  listing_id: string;
  pms: string;
  name: string | null;
  // Current period
  occupancy_next_30: number | null;
  revenue_past_7: number | null;
  base_price: number | null;
  health_7_day: string | null;
  occupancy_gap_pct: number | null;
  revenue_vs_stly_pct: number | null;
  // Previous period (for comparison)
  prev_occupancy_next_30: number | null;
  prev_revenue_past_7: number | null;
  prev_base_price: number | null;
}

export function createAnalysisQueries(db: BetterSqlite3.Database) {
  // Current snapshot joined with previous week's snapshot for WoW comparison
  const getPortfolioWoW = db.prepare<
    { current_date: string; prev_date: string },
    PortfolioKpiRow
  >(`
    SELECT
      c.listing_id, c.pms, c.name,
      c.occupancy_next_30, c.revenue_past_7, c.base_price,
      c.health_7_day, c.occupancy_gap_pct, c.revenue_vs_stly_pct,
      p.occupancy_next_30 as prev_occupancy_next_30,
      p.revenue_past_7 as prev_revenue_past_7,
      p.base_price as prev_base_price
    FROM listing_snapshots c
    LEFT JOIN listing_snapshots p
      ON c.listing_id = p.listing_id AND c.pms = p.pms
      AND p.snapshot_date = @prev_date
    WHERE c.snapshot_date = @current_date
  `);

  // Underperformance detection: listings failing multiple health criteria
  const getUnderperformers = db.prepare<
    {
      snapshot_date: string;
      occ_gap_threshold: number;
      revenue_stly_threshold: number;
    },
    ListingSnapshotRow  // reuse existing type
  >(`
    SELECT * FROM listing_snapshots
    WHERE snapshot_date = @snapshot_date
      AND (
        occupancy_gap_pct > @occ_gap_threshold
        OR revenue_vs_stly_pct < @revenue_stly_threshold
        OR CAST(health_7_day AS REAL) < 50
      )
    ORDER BY occupancy_gap_pct DESC
  `);

  return { getPortfolioWoW, getUnderperformers };
}
```

### Pattern 2: Analysis MCP Tool (Skill-Assisted)

**What:** New MCP tools that provide efficient data access for analysis. The tools perform SQL aggregation; the agent skill provides the analytical interpretation. Tools return structured data; the skill teaches the agent how to interpret and present it.
**When to use:** Weekly report generation, underperformance alert detection, competitive position analysis.

```typescript
// New tool: pricelabs_get_portfolio_kpis
// Returns aggregated portfolio metrics with WoW and STLY comparisons
server.registerTool(
  "pricelabs_get_portfolio_kpis",
  {
    description:
      "Compute portfolio KPIs (RevPAR, ADR, occupancy) with week-over-week " +
      "and STLY comparisons. Use for weekly optimization reports (ANLY-03, ANLY-04).",
    inputSchema: GetPortfolioKpisInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async (params) => {
    // Compute from listing_snapshots + reservations
    // Returns per-listing and portfolio-level aggregates
  }
);

// New tool: pricelabs_detect_underperformers
// Scans for listings failing underperformance thresholds
server.registerTool(
  "pricelabs_detect_underperformers",
  {
    description:
      "Detect underperforming listings based on health scores, occupancy gaps, " +
      "and revenue drops. Returns flagged listings with specific recommended " +
      "actions (ANLY-01, ANLY-02).",
    inputSchema: DetectUnderperformersInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async (params) => {
    // Query listing_snapshots for listings exceeding thresholds
    // Cross-reference with market_snapshots for competitive context
    // Return structured underperformance data with action hints
  }
);
```

### Pattern 3: Analysis Skill Architecture

**What:** A new always-on skill (SKILL.md) that teaches the agent how to perform analysis, generate weekly reports, detect underperformance, render demand calendars, and compose competitive positioning. The skill provides protocols, templates, thresholds, and decision frameworks.
**When to use:** Always-on, consulted during weekly reports, interactive analysis queries, and alert generation.

```markdown
---
name: pricelabs-analysis
description: >
  Analysis protocols for weekly optimization reports, underperformance
  detection, competitive positioning, and demand calendar rendering.
user-invocable: false
metadata: {"openclaw":{"always":true}}
---

## 1. Weekly Optimization Report Protocol
[Steps for generating ANLY-03/ANLY-04 report]

## 2. Underperformance Detection Protocol
[Thresholds, decision tree, recommended actions for ANLY-01/ANLY-02]

## 3. Competitive Position Analysis Protocol
[Steps for ANLY-05 percentile positioning]

## 4. Demand Calendar Rendering Protocol
[Format template for ANLY-06 demand visualization]
```

### Pattern 4: Weekly Cron Job Configuration

**What:** Two new cron jobs (Slack + Telegram) for weekly optimization report delivery on Monday mornings, following the existing dual-channel pattern from Phase 2.
**When to use:** Automated weekly delivery.

```json
{
  "name": "weekly-optimization-report-slack",
  "schedule": {
    "kind": "cron",
    "expr": "0 9 * * 1",
    "tz": "America/Chicago",
    "staggerMs": 0
  },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Generate the weekly optimization report. Follow the Weekly Optimization Report Protocol from your analysis skill. Compute RevPAR, ADR, occupancy trends across the portfolio. Compare current metrics to previous week and STLY. Detect underperforming listings and provide specific recommended actions.",
    "model": "opus",
    "thinking": "high"
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "${SLACK_HEALTH_CHANNEL}",
    "bestEffort": true
  }
}
```

### Pattern 5: Demand Calendar Text Rendering

**What:** Agent renders a demand calendar in chat using text formatting with demand level indicators. No image generation needed -- text-based visualization works across all channels.
**When to use:** When user asks for a demand calendar (ANLY-06) or as part of weekly reports.

```
Demand Calendar -- Beach House (next 14 days)
---
Feb 23 Sun  $185  [LOW]     available
Feb 24 Mon  $165  [LOW]     available
Feb 25 Tue  $172  [LOW]     available
Feb 26 Wed  $178  [MED]     available
Feb 27 Thu  $195  [MED]     available
Feb 28 Fri  $245  [HIGH]    booked
Mar 01 Sat  $268  [HIGH]    booked
Mar 02 Sun  $198  [MED]     available
Mar 03 Mon  $175  [LOW]     available
...
---
Legend: [HIGH] = Red demand | [MED] = Yellow | [LOW] = Blue
```

### Anti-Patterns to Avoid

- **Building a TypeScript analysis engine with scoring/weighting:** The agent IS the analysis engine. Give it data + framework; let it reason. Don't encode rigid scoring logic that the LLM can reason about more flexibly.
- **Computing RevPAR in JavaScript when SQL can do it:** Portfolio-level aggregations belong in prepared SQL statements, not in tool handler loops. Minimize context-window data volume.
- **Image-based demand calendars:** No image rendering infrastructure exists. Text-based calendars work perfectly in Slack and Telegram. OpenClaw converts text to channel-native formatting.
- **Duplicating monitoring skill content in analysis skill:** The analysis skill complements the monitoring skill. Cross-reference where needed (e.g., "Use the Daily Health Check Protocol from monitoring skill for data collection"). Don't duplicate shared protocols.
- **Alerting without recommended actions (ANLY-02 trap):** The success criteria explicitly requires "specific recommended actions." An alert that says "listing X is underperforming" without saying "lower base price from $X to $Y" or "expand last-minute discount" fails ANLY-02. The skill MUST include a decision tree for action recommendations.

## New MCP Tool Inventory (Phase 3 Additions)

| Tool Name | Purpose | Req | Read/Write | Why New Tool |
|-----------|---------|-----|------------|-------------|
| `pricelabs_get_portfolio_kpis` | Aggregate RevPAR, ADR, occupancy with WoW + STLY | ANLY-03, ANLY-04 | Read (DB) | SQL aggregation across all listings is more efficient than N tool calls + in-context math |
| `pricelabs_detect_underperformers` | Scan for listings failing health/occupancy/revenue thresholds | ANLY-01, ANLY-02 | Read (DB) | Single query returns all flagged listings with context; more efficient than full portfolio fetch + agent filtering |

**Tools NOT needed (agent can compose from existing tools):**

| Capability | Existing Tools Used | Why No New Tool |
|------------|--------------------|-----------------|
| Competitive position (ANLY-05) | `pricelabs_get_neighborhood` + `pricelabs_get_listings` | Agent fetches neighborhood percentiles and listing base price, then computes position. Skill provides interpretation framework. |
| Demand calendar (ANLY-06) | `pricelabs_get_prices` | Agent fetches 14-90 days of prices with demand_color/demand_level, then formats per skill template. |
| Underperformance recommended actions (ANLY-02) | Detection tool + analysis skill | Actions are LLM-generated based on the specific underperformance pattern. Skill provides decision tree. |
| Weekly report formatting (ANLY-03) | KPI tool + analysis skill | Formatting is LLM-native. Skill provides the template. |

**Total tool count after Phase 3:** 21 (existing) + 2 (new) = 23 tools.

## New SQL Queries Needed

### Week-over-Week Listing Snapshot Comparison

```sql
-- Join current snapshot with previous week's snapshot
-- Used by pricelabs_get_portfolio_kpis
SELECT
  c.listing_id, c.pms, c.name,
  c.occupancy_next_30, c.revenue_past_7, c.base_price,
  c.health_7_day, c.health_30_day, c.occupancy_gap_pct, c.revenue_vs_stly_pct,
  c.market_occupancy_next_30, c.recommended_base_price,
  p.occupancy_next_30 as prev_occupancy_next_30,
  p.revenue_past_7 as prev_revenue_past_7,
  p.occupancy_gap_pct as prev_occupancy_gap_pct,
  p.revenue_vs_stly_pct as prev_revenue_vs_stly_pct
FROM listing_snapshots c
LEFT JOIN listing_snapshots p
  ON c.listing_id = p.listing_id AND c.pms = p.pms
  AND p.snapshot_date = @prev_date
WHERE c.snapshot_date = @current_date
```

### STLY Snapshot Comparison

```sql
-- Join current snapshot with same-date-last-year snapshot
SELECT
  c.listing_id, c.pms, c.name,
  c.occupancy_next_30 as current_occ,
  c.revenue_past_7 as current_rev,
  c.base_price as current_base,
  s.occupancy_next_30 as stly_occ,
  s.revenue_past_7 as stly_rev,
  s.base_price as stly_base
FROM listing_snapshots c
LEFT JOIN listing_snapshots s
  ON c.listing_id = s.listing_id AND c.pms = s.pms
  AND s.snapshot_date = date(@current_date, '-1 year')
WHERE c.snapshot_date = @current_date
```

### Underperformer Detection Query

```sql
-- Flag listings failing any underperformance threshold
-- occupancy_gap_pct > 20 means listing is 20%+ below market
-- revenue_vs_stly_pct < -20 means revenue dropped 20%+ vs STLY
SELECT *,
  CASE
    WHEN occupancy_gap_pct > @occ_gap_threshold THEN 'occupancy_gap'
    WHEN revenue_vs_stly_pct < @revenue_stly_threshold THEN 'revenue_drop'
    WHEN CAST(health_7_day AS REAL) < 50 AND CAST(health_30_day AS REAL) < 50 THEN 'health_decline'
    ELSE 'multiple'
  END as underperformance_type
FROM listing_snapshots
WHERE snapshot_date = @snapshot_date
  AND (
    occupancy_gap_pct > @occ_gap_threshold
    OR revenue_vs_stly_pct < @revenue_stly_threshold
    OR (CAST(health_7_day AS REAL) < 50 AND CAST(health_30_day AS REAL) < 50)
  )
ORDER BY
  CASE
    WHEN occupancy_gap_pct > @occ_gap_threshold AND revenue_vs_stly_pct < @revenue_stly_threshold THEN 0
    WHEN occupancy_gap_pct > @occ_gap_threshold THEN 1
    WHEN revenue_vs_stly_pct < @revenue_stly_threshold THEN 2
    ELSE 3
  END,
  occupancy_gap_pct DESC
```

### Market Position Comparison

```sql
-- Get latest market snapshot alongside listing snapshot for positioning
SELECT
  l.listing_id, l.pms, l.name, l.base_price,
  m.p25_price, m.p50_price, m.p75_price, m.p90_price,
  m.market_occupancy, m.listings_used,
  CASE
    WHEN l.base_price < m.p25_price THEN 'below_25th'
    WHEN l.base_price < m.p50_price THEN '25th_to_50th'
    WHEN l.base_price < m.p75_price THEN '50th_to_75th'
    WHEN l.base_price < m.p90_price THEN '75th_to_90th'
    ELSE 'above_90th'
  END as price_position
FROM listing_snapshots l
JOIN market_snapshots m
  ON l.listing_id = m.listing_id AND l.pms = m.pms
WHERE l.snapshot_date = (SELECT MAX(snapshot_date) FROM listing_snapshots)
  AND m.snapshot_date = (SELECT MAX(snapshot_date) FROM market_snapshots)
```

### RevPAR Calculation from Reservations

```sql
-- RevPAR = Total Revenue / Total Available Nights
-- For a date range, calculate realized RevPAR per listing
SELECT
  listing_id, pms,
  SUM(CASE WHEN booking_status = 'booked' THEN rental_revenue ELSE 0 END) as total_revenue,
  SUM(CASE WHEN booking_status = 'booked' THEN no_of_days ELSE 0 END) as booked_nights,
  COUNT(DISTINCT reservation_id) as total_bookings
FROM reservations
WHERE listing_id = @listing_id AND pms = @pms
  AND check_in BETWEEN @start_date AND @end_date
  AND booking_status = 'booked'
GROUP BY listing_id, pms
```

## KPI Calculation Formulas

These are the standard formulas the analysis tools and skill will use:

| KPI | Formula | Data Source |
|-----|---------|-------------|
| **RevPAR** | Total Revenue / Total Available Nights in Period | reservations table (revenue) + calendar days (available nights) |
| **ADR** | Total Revenue / Total Booked Nights | reservations table |
| **Occupancy Rate** | Booked Nights / Available Nights | listing_snapshots (occupancy_next_30) or reservation-derived |
| **WoW Change** | (Current - Previous) / Previous * 100 | listing_snapshots joined on prev_date |
| **vs STLY** | (Current - STLY) / STLY * 100 | listing_snapshots joined on date(-1 year) |
| **Occupancy Gap** | (Market Occ - Listing Occ) / Market Occ * 100 | Already computed in occupancy_gap_pct |
| **Revenue vs STLY** | (Revenue - STLY Revenue) / STLY Revenue * 100 | Already computed in revenue_vs_stly_pct |

**Note on RevPAR data availability:** True RevPAR requires knowing total available nights (not just booked nights). The listing_snapshots table stores occupancy_next_30 which can approximate available nights. For the weekly report, RevPAR can also be approximated as ADR * Occupancy Rate, which requires only listing-level data already in snapshots. The analysis skill should use this approximation when full reservation data is incomplete.

## Underperformance Detection Thresholds

These thresholds define when a listing is flagged as underperforming. They are used by the `pricelabs_detect_underperformers` tool and referenced by the analysis skill for recommended actions.

| Signal | Threshold | Severity | Recommended Actions |
|--------|-----------|----------|-------------------|
| Occupancy gap vs market | > 20% below market | Warning | Lower base price, expand last-minute discount curve, review min-stay settings |
| Revenue vs STLY | > 25% below STLY | Warning | Review base price vs recommended, check if min price is too high, verify sync health |
| Health score decline | health_7_day AND health_30_day both below 50 | Warning | Full listing audit -- check photos, reviews, amenity accuracy, competitive position |
| Booking pace behind STLY | > 20% behind at 30d+ cutoff | Alert | (Already handled by monitoring skill MON-04; analysis adds context with market data) |
| Base price drift | > 15% from recommended_base_price | Info | Suggest base price adjustment toward recommended, include market percentile context |
| Price position extreme | Below 25th percentile with high occupancy | Info | Raise base price -- capturing bookings but leaving revenue on table |
| Price position extreme | Above 90th percentile with low occupancy | Warning | Lower base price -- pricing out of market |

**Decision tree for recommended actions (ANLY-02):**

```
IF occupancy_gap_pct > 20%:
  IF base_price > p75_price: "Lower base price to $X (market 50th percentile)"
  ELIF base_price > p50_price: "Expand last-minute discount from X% to Y% over Z days"
  ELSE: "Review listing quality -- pricing is competitive but occupancy lags"

IF revenue_vs_stly_pct < -25%:
  IF occupancy is comparable to STLY: "ADR has dropped -- review base price alignment"
  ELIF occupancy is significantly lower: "Occupancy-driven revenue drop -- see occupancy gap actions"
  ELSE: "Check for cancelled reservations impacting revenue numbers"

IF health declining across all windows:
  "Comprehensive listing audit recommended: photos, description, amenities, review responses"
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KPI aggregation | Loop through tool responses in agent context | SQL prepared statements in analysis query module | Portfolio of 50 listings would require 50+ tool calls and massive context; SQL does it in one query |
| Report formatting | Handlebars/Mustache template engine | Agent skill template + LLM formatting | LLM adapts formatting to context; templates are rigid. Skill provides structure, LLM provides flexibility. |
| Chart/visualization rendering | chart.js, d3, image generation | Text-based demand calendar with level indicators | No image serving infrastructure; text works in all channels; OpenClaw converts to channel-native |
| Threshold alerting engine | Custom rule engine with configurable rules | SQL WHERE clause + agent skill decision tree | SQL handles detection; skill handles interpretation and action recommendation |
| Weekly scheduling | node-cron, custom scheduler | OpenClaw cron job (proven in Phase 2) | Persistent, restart-safe, channel-aware |

**Key insight:** Phase 3's "analysis layer" is not a software component -- it is a combination of SQL queries (data aggregation), MCP tools (data access), and agent skills (analytical reasoning). The LLM is the analysis engine. The skill is the playbook. The tools provide the data.

## Common Pitfalls

### Pitfall 1: Insufficient Historical Data for WoW/STLY Comparisons

**What goes wrong:** Weekly report attempts WoW comparison but only 3 days of snapshots exist. STLY comparison always returns null because no data from a year ago.
**Why it happens:** Phase 3 starts executing before Phase 2's daily snapshots have accumulated enough history.
**How to avoid:** The analysis skill must handle null/missing comparison data gracefully. WoW comparison requires at least 7 days of snapshots. STLY requires 365+ days. The report should clearly state when comparison data is unavailable: "WoW comparison: not yet available (need 7+ days of snapshots)" or "STLY: data collection began on [date], STLY comparison will be available after [date + 1 year]."
**Warning signs:** Weekly report shows null for all WoW and STLY fields. Agent omits comparison sections entirely.

### Pitfall 2: Alert Without Actionable Recommendations (ANLY-02 Violation)

**What goes wrong:** Underperformance alert says "listing X is underperforming" without specific recommended actions.
**Why it happens:** The skill instructions are vague about what constitutes a "specific recommended action." The agent generates generic advice.
**How to avoid:** The analysis skill must include a concrete decision tree mapping each underperformance signal to specific actions with actual numbers. Not "lower your base price" but "lower base price from $185 to $165 (market 50th percentile is $160, currently at 75th)." The skill must instruct the agent to always include: (1) the specific metric that triggered the alert, (2) the specific action recommended, (3) the specific numbers involved.
**Warning signs:** Alerts that use words like "consider", "may want to", or "look into" without specific dollar amounts, percentages, or settings to change.

### Pitfall 3: Weekly Cron Overlapping with Daily Cron

**What goes wrong:** Weekly report cron fires at 9am Monday while daily health check runs at 8am. The daily job is still running (fetching data for all listings), causing rate limit contention.
**Why it happens:** No buffer between daily and weekly schedules.
**How to avoid:** Schedule the weekly report at 10am (2 hours after daily health check) to ensure daily data collection is complete and fresh snapshots are available. The weekly report can then use the just-stored daily snapshots rather than making redundant API calls.
**Warning signs:** Weekly report fails with rate limit errors. Weekly report uses stale cached data instead of fresh daily snapshots.

### Pitfall 4: Demand Calendar Flooding Context Window

**What goes wrong:** User asks for demand calendar and agent renders 90 days of daily prices, consuming excessive context/tokens.
**Why it happens:** pricelabs_get_prices returns up to 90 days of data. Agent dumps all of it into the demand calendar.
**How to avoid:** The analysis skill must specify a default window for demand calendars (14-30 days ahead) and offer to expand if the user requests more. The skill should instruct the agent to summarize rather than enumerate when the range exceeds 30 days (e.g., "Next 90 days: 12 high-demand dates, 28 medium, 50 low" with top dates listed).
**Warning signs:** Demand calendar output exceeds 100 lines. User didn't specify a date range and got 90 days.

### Pitfall 5: Market Snapshot Staleness for Competitive Analysis

**What goes wrong:** Competitive position analysis uses market_snapshots data that is 5 days old because daily health check only stores market data if the agent chose to fetch neighborhood data.
**Why it happens:** Neighborhood data fetching (step 6 of daily health check) is rate-limit-constrained. Agent may skip it when rate budget is tight.
**How to avoid:** The analysis skill should instruct the agent to always check market_snapshots freshness before competitive analysis. If the latest market snapshot is older than 48 hours, fetch fresh neighborhood data before computing competitive position. The weekly report protocol should explicitly include a "refresh market data" step.
**Warning signs:** Competitive position analysis uses data with `snapshot_date` more than 2 days old.

### Pitfall 6: RevPAR Calculation Errors with Missing Reservation Data

**What goes wrong:** RevPAR calculation divides by zero or produces wildly inaccurate numbers.
**Why it happens:** New listings have no reservation history. Some listings have incomplete reservation data (rental_revenue is null). Available nights calculation requires knowing which dates are owner-blocked.
**How to avoid:** Use the approximation formula (ADR * Occupancy Rate) when full reservation data is incomplete. Always check for null/zero denominators. The analysis skill should explain which formula was used and note any data limitations.
**Warning signs:** RevPAR values that exceed ADR (impossible), or RevPAR of $0 for listings with active bookings.

### Pitfall 7: Dual Alert Paths (Analysis + Monitoring) Creating Duplicates

**What goes wrong:** Both the monitoring skill (daily health check) and the analysis skill (underperformance detection) flag the same listing issue, resulting in duplicate alerts.
**Why it happens:** Monitoring skill detects occupancy gaps and pace issues. Analysis skill also detects underperformance. Both may fire on the same listing.
**How to avoid:** Clear separation of responsibilities: monitoring skill handles real-time detection (stale syncs, pace alerts, cancellations). Analysis skill handles deeper analysis (underperformance with recommended actions, competitive positioning). The analysis skill should check the audit log for recent alerts before sending new ones, extending the existing 24h dedup pattern.
**Warning signs:** User receives "listing X occupancy is 20% below market" from daily health check AND "listing X is underperforming -- recommended actions: ..." from weekly report for the same issue.

## Code Examples

### Complete Analysis Query Module

```typescript
// src/db/queries/analysis.ts
import * as BetterSqlite3 from "better-sqlite3";

/** Row shape for portfolio KPI comparison. */
export interface PortfolioKpiRow {
  listing_id: string;
  pms: string;
  name: string | null;
  // Current period
  occupancy_next_30: number | null;
  market_occupancy_next_30: number | null;
  revenue_past_7: number | null;
  stly_revenue_past_7: number | null;
  base_price: number | null;
  recommended_base_price: number | null;
  health_7_day: string | null;
  health_30_day: string | null;
  occupancy_gap_pct: number | null;
  revenue_vs_stly_pct: number | null;
  // Previous week
  prev_occupancy_next_30: number | null;
  prev_revenue_past_7: number | null;
  prev_occupancy_gap_pct: number | null;
  prev_revenue_vs_stly_pct: number | null;
}

/** Row shape for underperformer detection. */
export interface UnderperformerRow {
  listing_id: string;
  pms: string;
  name: string | null;
  occupancy_next_30: number | null;
  market_occupancy_next_30: number | null;
  occupancy_gap_pct: number | null;
  revenue_past_7: number | null;
  stly_revenue_past_7: number | null;
  revenue_vs_stly_pct: number | null;
  health_7_day: string | null;
  health_30_day: string | null;
  base_price: number | null;
  recommended_base_price: number | null;
  underperformance_type: string;
}

/** Row shape for market position analysis. */
export interface MarketPositionRow {
  listing_id: string;
  pms: string;
  name: string | null;
  base_price: number | null;
  p25_price: number | null;
  p50_price: number | null;
  p75_price: number | null;
  p90_price: number | null;
  market_occupancy: number | null;
  listings_used: number | null;
  price_position: string;
}

export function createAnalysisQueries(db: BetterSqlite3.Database) {
  const getPortfolioWoW = db.prepare<
    { current_date: string; prev_date: string },
    PortfolioKpiRow
  >(`
    SELECT
      c.listing_id, c.pms, c.name,
      c.occupancy_next_30, c.market_occupancy_next_30,
      c.revenue_past_7, c.stly_revenue_past_7,
      c.base_price, c.recommended_base_price,
      c.health_7_day, c.health_30_day,
      c.occupancy_gap_pct, c.revenue_vs_stly_pct,
      p.occupancy_next_30 as prev_occupancy_next_30,
      p.revenue_past_7 as prev_revenue_past_7,
      p.occupancy_gap_pct as prev_occupancy_gap_pct,
      p.revenue_vs_stly_pct as prev_revenue_vs_stly_pct
    FROM listing_snapshots c
    LEFT JOIN listing_snapshots p
      ON c.listing_id = p.listing_id AND c.pms = p.pms
      AND p.snapshot_date = @prev_date
    WHERE c.snapshot_date = @current_date
  `);

  const getUnderperformers = db.prepare<
    { snapshot_date: string; occ_gap_threshold: number; revenue_stly_threshold: number },
    UnderperformerRow
  >(`
    SELECT *,
      CASE
        WHEN occupancy_gap_pct > @occ_gap_threshold
          AND revenue_vs_stly_pct < @revenue_stly_threshold THEN 'occupancy_and_revenue'
        WHEN occupancy_gap_pct > @occ_gap_threshold THEN 'occupancy_gap'
        WHEN revenue_vs_stly_pct < @revenue_stly_threshold THEN 'revenue_drop'
        WHEN CAST(health_7_day AS REAL) < 50
          AND CAST(health_30_day AS REAL) < 50 THEN 'health_decline'
        ELSE 'multiple'
      END as underperformance_type
    FROM listing_snapshots
    WHERE snapshot_date = @snapshot_date
      AND (
        occupancy_gap_pct > @occ_gap_threshold
        OR revenue_vs_stly_pct < @revenue_stly_threshold
        OR (CAST(health_7_day AS REAL) < 50 AND CAST(health_30_day AS REAL) < 50)
      )
    ORDER BY
      CASE
        WHEN occupancy_gap_pct > @occ_gap_threshold
          AND revenue_vs_stly_pct < @revenue_stly_threshold THEN 0
        WHEN occupancy_gap_pct > @occ_gap_threshold THEN 1
        WHEN revenue_vs_stly_pct < @revenue_stly_threshold THEN 2
        ELSE 3
      END,
      occupancy_gap_pct DESC
  `);

  const getMarketPosition = db.prepare<
    {},
    MarketPositionRow
  >(`
    SELECT
      l.listing_id, l.pms, l.name, l.base_price,
      m.p25_price, m.p50_price, m.p75_price, m.p90_price,
      m.market_occupancy, m.listings_used,
      CASE
        WHEN l.base_price < m.p25_price THEN 'below_25th'
        WHEN l.base_price < m.p50_price THEN '25th_to_50th'
        WHEN l.base_price < m.p75_price THEN '50th_to_75th'
        WHEN l.base_price < m.p90_price THEN '75th_to_90th'
        ELSE 'above_90th'
      END as price_position
    FROM listing_snapshots l
    JOIN market_snapshots m
      ON l.listing_id = m.listing_id AND l.pms = m.pms
    WHERE l.snapshot_date = (SELECT MAX(snapshot_date) FROM listing_snapshots)
      AND m.snapshot_date = (SELECT MAX(snapshot_date) FROM market_snapshots
        WHERE listing_id = l.listing_id AND pms = l.pms)
  `);

  return { getPortfolioWoW, getUnderperformers, getMarketPosition };
}
```

### Analysis Zod Schemas

```typescript
// src/schemas/analysis.ts
import { z } from "zod";

/** Input for pricelabs_get_portfolio_kpis */
export const GetPortfolioKpisInputSchema = z.object({
  current_date: z
    .string()
    .optional()
    .describe("Snapshot date for current period (YYYY-MM-DD). Defaults to latest."),
  compare_to: z
    .enum(["previous_week", "previous_month", "stly"])
    .optional()
    .describe("Comparison period. Default: previous_week."),
});

/** Input for pricelabs_detect_underperformers */
export const DetectUnderperformersInputSchema = z.object({
  snapshot_date: z
    .string()
    .optional()
    .describe("Snapshot date to analyze (YYYY-MM-DD). Defaults to latest."),
  occupancy_gap_threshold: z
    .number()
    .optional()
    .describe("Occupancy gap threshold (%). Default: 20."),
  revenue_stly_threshold: z
    .number()
    .optional()
    .describe("Revenue vs STLY threshold (%). Default: -25."),
});
```

### Weekly Cron Jobs Configuration

```json
[
  {
    "name": "weekly-optimization-report-slack",
    "schedule": {
      "kind": "cron",
      "expr": "0 10 * * 1",
      "tz": "America/Chicago",
      "staggerMs": 0
    },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Generate the weekly optimization report. Follow the Weekly Optimization Report Protocol from your analysis skill. Compute portfolio KPIs, compare to previous week and STLY. Detect underperforming listings and provide specific recommended actions with numbers. Include competitive market positioning for each listing.",
      "model": "opus",
      "thinking": "high"
    },
    "delivery": {
      "mode": "announce",
      "channel": "slack",
      "to": "${SLACK_HEALTH_CHANNEL}",
      "bestEffort": true
    }
  },
  {
    "name": "weekly-optimization-report-telegram",
    "schedule": {
      "kind": "cron",
      "expr": "0 10 * * 1",
      "tz": "America/Chicago",
      "staggerMs": 30000
    },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Generate the weekly optimization report. Follow the Weekly Optimization Report Protocol from your analysis skill. Compute portfolio KPIs, compare to previous week and STLY. Detect underperforming listings and provide specific recommended actions with numbers. Include competitive market positioning for each listing.",
      "model": "opus",
      "thinking": "high"
    },
    "delivery": {
      "mode": "announce",
      "channel": "telegram",
      "to": "${TELEGRAM_HEALTH_CHAT_ID}",
      "bestEffort": true
    }
  }
]
```

### Analysis Skill Excerpt (Weekly Report Protocol)

```markdown
## 1. Weekly Optimization Report Protocol

When triggered for a weekly optimization report (by cron or user request):

1. **Compute portfolio KPIs.** Call `pricelabs_get_portfolio_kpis` to retrieve
   aggregated RevPAR, ADR, occupancy for each listing with week-over-week
   and STLY comparisons.

2. **Detect underperformers.** Call `pricelabs_detect_underperformers` to identify
   listings that need attention. For each flagged listing, compose a specific
   recommended action using the Underperformance Action Decision Tree (Section 2).

3. **Compute competitive position.** For each listing, use the portfolio KPIs
   response (which includes market percentile data) to determine pricing position.
   Present as: "Listing X is priced at $185 (market 50th: $170, 75th: $210) --
   positioned at 50th-75th percentile."

4. **Format the report.** Use the Weekly Report Template (Section 5).
   - Lead with portfolio-level KPIs and WoW/STLY changes
   - Follow with underperformance alerts (each with specific recommended actions)
   - Close with competitive positioning summary
   - If WoW or STLY data is unavailable, state clearly why and when it will be

5. **Log the report.** Call `pricelabs_log_action` with `action_type='report'`.
```

## Analysis Skill Design (SKILL.md Outline)

The analysis skill should contain these sections:

### Section 1: Weekly Optimization Report Protocol
- Step-by-step execution flow
- Which tools to call and in what order
- How to handle missing comparison data (WoW, STLY)
- When to use approximate vs exact calculations

### Section 2: Underperformance Detection and Action Recommendations
- Threshold definitions with defaults
- Decision tree for each underperformance type
- Template for actionable recommendations with specific numbers
- Severity classification (warning, alert, info)

### Section 3: Competitive Position Analysis Protocol
- Step-by-step for fetching and comparing neighborhood data
- How to interpret percentile position
- Template for presenting competitive analysis
- Guidance on when to recommend base price changes

### Section 4: Demand Calendar Rendering Protocol
- Default date range (14 days, expandable)
- Text format specification with demand level indicators
- How to summarize long ranges (30-90 days)
- Demand color mapping (from existing computed-fields.ts)

### Section 5: Report Templates
- Weekly Optimization Report template
- Underperformance Alert template
- Competitive Position Analysis template
- Demand Calendar template

### Section 6: Coordination with Monitoring Skill
- Clear delineation: monitoring handles detection, analysis handles depth
- Alert dedup protocol (check audit log before sending)
- Cross-referencing between daily health data and weekly analysis

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom scoring/ML models for underperformance | LLM + threshold-based detection + decision tree | 2025-2026 (LLM agent era) | Simpler, more flexible, easier to tune than custom ML models |
| Chart-based visualizations in reports | Text-based demand calendars in chat | 2026 (chat-first agents) | Works in all messaging channels without rendering infrastructure |
| Rigid report templates (Handlebars/EJS) | Agent skill + LLM formatting | 2026 | LLM adapts report to context, data availability, and user communication style |
| Separate analysis service/microservice | SQL queries + MCP tools + skill | 2026 (MCP architecture) | Analysis lives in the same MCP server, no additional service to deploy |

**Deprecated/outdated:**
- Building separate "analysis microservice" -- MCP tools provide the same data access with less operational complexity
- Image-based charts for chat bots -- text rendering is sufficient and universally supported
- In-process cron for scheduled reports -- OpenClaw Gateway cron is more reliable (proven in Phase 2)

## Open Questions

1. **Optimal underperformance thresholds**
   - What we know: Occupancy gap > 20% and revenue vs STLY < -25% are reasonable starting points based on domain research (architecture.md thresholds). The domain skill references 20% pace threshold.
   - What's unclear: Whether these thresholds produce too many or too few alerts for the user's portfolio size. Different markets may need different thresholds.
   - Recommendation: Start with defaults (20% occupancy gap, -25% revenue STLY, health < 50). Allow threshold override via tool parameters. Monitor alert volume in first 2 weeks and adjust.

2. **RevPAR data completeness**
   - What we know: RevPAR = Revenue / Available Nights. Revenue comes from reservations table. Available nights is harder -- requires knowing owner blocks, maintenance days, etc.
   - What's unclear: Whether the reservations table has complete revenue data for all listings. Whether `occupancy_next_30` can reliably approximate availability.
   - Recommendation: Use approximate RevPAR (ADR * Occupancy Rate / 100) from listing_snapshots data. Note in the skill that this is approximate. When full reservation data is available, compute exact RevPAR.

3. **Analysis skill vs monitoring skill boundary**
   - What we know: Monitoring skill handles daily health checks and real-time alerts. Analysis skill handles weekly reports and deeper analysis.
   - What's unclear: Whether some daily alerts should include analysis-depth context (e.g., daily occupancy gap alert with market percentile positioning).
   - Recommendation: Keep the boundary clean. Daily alerts are monitoring-owned (detection + basic context). Weekly report is analysis-owned (deep analysis + recommendations). If a listing appears in both daily alerts and weekly analysis, the weekly report should note "this listing was flagged X times in daily health checks this week" for continuity.

4. **STLY comparison availability timeline**
   - What we know: STLY comparisons require data from the same date last year. If Phase 2 just started collecting snapshots, STLY will be unavailable for up to 12 months.
   - What's unclear: Whether the PriceLabs API fields `revenue_vs_stly_pct` and `stly_revenue_past_7` can provide STLY data even without historical snapshots (since PriceLabs has this data in their system).
   - Recommendation: For STLY, rely on the PriceLabs API fields (`revenue_vs_stly_pct`, `stly_revenue_past_7`) that already come from the API -- these are stored in listing_snapshots. For snapshot-based WoW comparisons, require 7+ days of accumulated data. Document both clearly in the skill.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `mcp-servers/pricelabs/src/` -- All tool implementations, schemas, query modules, computed fields verified by reading source
- Existing skills: `skills/pricelabs-monitoring/SKILL.md`, `skills/pricelabs-domain/SKILL.md` -- Current skill architecture and protocols
- Existing config: `openclaw/cron/jobs.json`, `openclaw/openclaw.json` -- Cron patterns, tool deny list
- Phase 2 research: `.planning/phases/02-monitoring-persistence-interactive-delivery/02-RESEARCH.md` -- Architecture patterns, database schema, cron configuration
- Database migrations: `src/db/migrations.ts` -- Exact table schemas with constraints and indexes
- Phase 1/2 State: `.planning/STATE.md` -- All locked decisions, patterns, lessons learned
- Agent workflows: `agent/workflows.md` -- Weekly report workflow, optimization scan workflow, monthly review workflow

### Secondary (MEDIUM confidence)
- [PriceLabs RevPAR Guide](https://hello.pricelabs.co/how-to-calculate-revpar/) -- RevPAR formula: ADR * Occupancy Rate or Total Revenue / Available Nights
- [Key Data RevPAR](https://www.keydatadashboard.com/blog/what-is-revpar-and-how-is-it-used) -- STR industry standard RevPAR calculation
- [OpenClaw Cron Jobs docs](https://docs.openclaw.ai/automation/cron-jobs) -- Weekly cron expression patterns
- [AltexSoft Hotel Metrics](https://www.altexsoft.com/blog/revpar-occupancy-rate-adr-hotel-metrics/) -- ADR, RevPAR, occupancy formulas and relationships

### Tertiary (LOW confidence)
- None. All Phase 3 research is grounded in existing codebase analysis and well-established industry metrics.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries needed. All infrastructure exists from Phases 1 and 2.
- Architecture: HIGH -- Extends proven patterns (MCP tools, SQL queries, skills, cron). New tools follow identical registration patterns as Phase 2.
- Analysis logic: HIGH -- RevPAR/ADR/occupancy are industry-standard formulas. Underperformance thresholds are well-defined. Decision tree for recommendations maps cleanly to existing data fields.
- Skill design: HIGH -- Follows established pricelabs-monitoring skill pattern. Protocols are concrete with specific steps and tool calls.
- Pitfalls: HIGH -- Derived from concrete analysis of data availability (STLY requires year of data), rate limit constraints (cron scheduling), and ANLY-02 requirement specificity.
- Cron configuration: HIGH -- Identical pattern to Phase 2 dual-channel delivery, verified working.

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days -- stable domain, no external dependency changes expected)
