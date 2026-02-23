# Phase 4: Write Operations + Approval Workflow - Research

**Researched:** 2026-02-23
**Domain:** Pricing optimization recommendations, approval workflows, pre-write snapshotting, orphan day detection, demand spike detection, base price calibration, audit trail with before/after values
**Confidence:** HIGH

## Summary

Phase 4 transforms the PriceLabs agent from an analytical observer into an active optimizer -- recommending specific pricing changes and executing them only after explicit user approval. The critical architectural insight is that **the vast majority of Phase 4's infrastructure already exists**. The MCP server already has: DSO write tools with defense-in-depth safety validation (OPT-08, OPT-09 are already delivered by `pricelabs_set_overrides`), post-write verification (OPT-04 is already delivered), listing update tools, and a full audit log system. The monitoring skill already defines a basic approval flow protocol (Section 6). What Phase 4 must add is: (1) an optimization skill that teaches the agent HOW to detect optimization opportunities (orphan days, demand spikes, base price drift) and formulate specific recommendations with rationale, (2) an enhanced audit log entry structure that captures before/after values with the approving user, (3) a pre-write snapshot tool or protocol for rollback capability, and (4) a weekly optimization scan cron job that triggers the recommendation workflow.

The second key insight is that Phase 4 follows the same "skill as playbook" pattern established in Phases 2 and 3. The agent is the optimization engine; the skill provides the detection protocols, recommendation frameworks, and approval flow procedures. The MCP tools provide data access and write execution. No new complex application logic is needed in TypeScript -- the intelligence lives in skill instructions that guide the LLM's reasoning over existing tool outputs.

The third insight is about what Phase 4 does NOT need to build. OPT-08 (min price floor validation) and OPT-09 (currency matching) are already enforced in the MCP server's `pricelabs_set_overrides` handler with defense-in-depth (Zod schema + runtime handler validation). OPT-04 (post-write verification) is already implemented. These requirements are already met by existing Phase 1 infrastructure. Phase 4 plans should verify these capabilities exist but should not rebuild them.

**Primary recommendation:** Create a comprehensive optimization skill (SKILL.md) with protocols for orphan day detection, demand spike detection, base price calibration, and approval flow. Enhance the audit log to store structured before/after snapshots in `details_json`. Add a new `pricelabs_snapshot_before_write` MCP tool that captures current listing state and overrides for rollback capability. Add a weekly optimization scan cron job. No new npm dependencies needed.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.6.x | Existing. Audit log and snapshot storage for before/after values | Already installed Phase 2. Enhanced queries for write tracking. |
| `@modelcontextprotocol/sdk` | 1.26.x | Existing. Possible new snapshot tool on existing server | Already installed Phase 1. Same `registerTool` pattern. |
| `zod` | 3.25+ | Existing. Schemas for any new tool inputs | Already installed Phase 1. Same schema pattern. |

### Supporting

No new npm dependencies required for Phase 4. All optimization is performed through:
- Existing MCP write tools (`pricelabs_set_overrides`, `pricelabs_update_listings`, `pricelabs_delete_overrides`)
- Existing read tools (`pricelabs_get_prices`, `pricelabs_get_listings`, `pricelabs_get_neighborhood`, `pricelabs_get_overrides`)
- Existing audit tools (`pricelabs_log_action`, `pricelabs_get_audit_log`)
- New optimization skill (SKILL.md)
- Possible new pre-write snapshot MCP tool (1 tool)
- OpenClaw cron configuration (JSON)

### What NOT to Install

| Library | Why Not |
|---------|---------|
| Any workflow/state machine library | Approval flow is conversational (user replies in chat). OpenClaw handles message routing. No workflow engine needed. |
| Any diff/patch library | Before/after tracking is simple JSON comparison stored in `details_json`. No structured diff needed. |
| Any scheduling library | OpenClaw cron handles scan scheduling. Already proven in Phases 2 and 3. |
| Any rollback/transaction library | Rollback is implemented by re-writing old values via existing write tools. No transaction manager needed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Skill-based recommendation logic | TypeScript recommendation engine | Skill is more flexible, easier to tune thresholds, aligned with "framework + reasoning" decision. Engine adds rigid code for logic the LLM handles well. |
| Storing before/after in existing `details_json` | New dedicated `write_snapshots` table | New table adds migration complexity. The `details_json` field on audit_log already supports structured JSON and is purpose-built for this. Keep it simple. |
| Agent-driven pre-write snapshot (in skill instructions) | New `pricelabs_snapshot_before_write` MCP tool | A dedicated tool ensures snapshots are always captured (tool call is explicit, not dependent on agent following instructions). Prefer the tool for safety-critical operations. |

**Installation:**
```bash
# No new packages needed. Phase 4 is skill + possibly 1 new tool.
```

## Architecture Patterns

### Recommended Project Structure (Phase 4 additions)

```
skills/
  pricelabs-optimization/
    SKILL.md                     # NEW: Optimization skill (detection, recommendations, approval)

mcp-servers/pricelabs/
  src/
    schemas/
      optimization.ts            # NEW (if new tool): Zod schema for snapshot tool input
    tools/
      optimization.ts            # NEW (if new tool): Pre-write snapshot tool
    db/
      queries/
        optimization.ts          # NEW (if new tool): Snapshot queries for rollback

openclaw/
  cron/
    jobs.json                    # UPDATED: Add optimization scan cron jobs
```

### Pattern 1: Pre-Write Snapshot for Rollback (OPT-03)

**What:** Before any write operation, capture the current state of the listing (base/min/max prices) and any existing overrides for the affected date range. Store in the audit log's `details_json` as a structured "before" snapshot. After the write completes, store the "after" values. This enables rollback by re-writing the "before" values.

**When to use:** Every time the agent executes `pricelabs_set_overrides`, `pricelabs_update_listings`, or `pricelabs_delete_overrides`.

**Implementation approach -- two options:**

Option A (recommended): New MCP tool `pricelabs_snapshot_before_write`
```typescript
// The agent calls this tool BEFORE any write operation.
// It fetches current state and returns a structured snapshot.
server.registerTool(
  "pricelabs_snapshot_before_write",
  {
    description:
      "Capture current listing state and overrides before a write operation. " +
      "MUST be called before every pricelabs_set_overrides, pricelabs_update_listings, " +
      "or pricelabs_delete_overrides call. Returns a snapshot for rollback capability.",
    inputSchema: SnapshotBeforeWriteInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  async (params) => {
    // 1. Fetch current listing data (base, min, max, currency)
    const listing = await apiClient.get(`/v1/listings/${params.listing_id}?pms=${params.pms}`);

    // 2. If date range provided, fetch current overrides for those dates
    let currentOverrides = [];
    if (params.start_date && params.end_date) {
      const overridesResp = await apiClient.get(
        `/v1/listings/${params.listing_id}/overrides?pms=${params.pms}` +
        `&start_date=${params.start_date}&end_date=${params.end_date}`
      );
      currentOverrides = overridesResp.data;
    }

    // 3. Build snapshot object
    const snapshot = {
      snapshot_type: params.operation_type, // 'set_overrides' | 'update_listing' | 'delete_overrides'
      listing_id: params.listing_id,
      pms: params.pms,
      captured_at: new Date().toISOString(),
      listing_state: {
        base_price: listing.data.base,
        min_price: listing.data.min,
        max_price: listing.data.max,
        currency: listing.data.currency,
      },
      existing_overrides: currentOverrides,
    };

    // 4. Store in audit log as a 'snapshot' action
    auditQueries.insertEntry.run({
      action_type: 'snapshot',
      listing_id: params.listing_id,
      pms: params.pms,
      description: `Pre-write snapshot before ${params.operation_type}`,
      details_json: JSON.stringify(snapshot),
      channel: params.channel ?? null,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
    };
  }
);
```

Option B (simpler): Skill instruction tells the agent to fetch + log before writing
```markdown
## Pre-Write Protocol
Before EVERY write operation:
1. Call pricelabs_get_listing to capture current base/min/max
2. If setting overrides, call pricelabs_get_overrides for the date range
3. Call pricelabs_log_action with action_type='snapshot' and details_json containing the captured values
4. Only then proceed with the write
```

**Recommendation:** Use Option A (dedicated tool). It ensures the snapshot is always captured atomically and cannot be skipped by the agent forgetting a step. The tool also serves as a natural "checkpoint" in the conversation flow.

### Pattern 2: Structured Audit Trail with Before/After (OPT-10)

**What:** Enhance the audit log usage to capture structured before/after values for every executed change. The existing `details_json` field already supports arbitrary JSON. Phase 4 establishes a convention for what goes in it.

**When to use:** After every approved and executed pricing change.

**Structured `details_json` format for execution entries:**
```json
{
  "change_type": "set_overrides",
  "listing_id": "12345",
  "pms": "airbnb",
  "approved_by": "user",
  "approved_at": "2026-02-23T10:15:00Z",
  "before": {
    "base_price": 185,
    "min_price": 111,
    "overrides": [
      { "date": "2026-03-15", "price": "200", "price_type": "fixed" }
    ]
  },
  "after": {
    "overrides": [
      { "date": "2026-03-15", "price": "250", "price_type": "fixed", "currency": "USD" },
      { "date": "2026-03-16", "price": "250", "price_type": "fixed", "currency": "USD" }
    ]
  },
  "rationale": "Demand spike detected for local event. Red demand dates March 15-16.",
  "verification": "verified",
  "dropped_dates": []
}
```

**Key fields the planner must ensure the agent logs:**
- `before` -- pre-write snapshot values (from the snapshot tool or pre-fetch)
- `after` -- post-write confirmed values (from post-write verification)
- `approved_by` -- always "user" (no auto-approval in v1)
- `approved_at` -- timestamp of when the user approved
- `rationale` -- why this change was recommended
- `verification` -- "verified", "partial", or "unverified" (from set_overrides response)
- `dropped_dates` -- any dates silently dropped by PriceLabs

### Pattern 3: Optimization Detection Protocols (Skill-Based)

**What:** The optimization skill teaches the agent three detection protocols: orphan day detection, demand spike detection, and base price calibration. Each protocol uses existing MCP tools to gather data, then formulates specific recommendations.

**Orphan Day Detection (OPT-05):**
```markdown
## Orphan Day Detection Protocol

1. For each listing, call pricelabs_get_prices for the next 30 days
2. Scan booking_status for each date:
   - Map dates to: booked, available, blocked
3. Identify gaps: consecutive available dates surrounded by booked/blocked dates
   - 1-night gap: highest priority (single night between bookings)
   - 2-night gap: high priority
   - 3-night gap: moderate priority (may book normally)
4. For each orphan gap found:
   - Check current min_stay for those dates (if min_stay > gap length, that's the cause)
   - Check if orphan day rules are already handling it
   - Calculate recommended fill price: current price * 0.80 (20% orphan discount)
   - Formulate recommendation with specific dates, current price, recommended price
5. Present all orphan gaps grouped by listing with specific recommended DSOs
```

**Demand Spike Detection (OPT-06):**
```markdown
## Demand Spike Detection Protocol

1. For each listing, call pricelabs_get_prices for the next 90 days
2. Identify demand spikes: dates with demand_color = "#FF0000" (red/high demand)
3. Group consecutive high-demand dates into events
4. For each demand spike:
   - Check if DSOs already exist for those dates (call pricelabs_get_overrides)
   - If no DSOs: recommend event-based percentage DSO (+15% to +30%)
   - If DSOs exist but price seems low relative to demand: recommend adjustment
5. Cross-reference with neighborhood data for market validation
6. Present recommendations with: dates, current price, demand level, recommended DSO
```

**Base Price Calibration (OPT-07):**
```markdown
## Monthly Base Price Calibration Protocol

1. Call pricelabs_get_neighborhood for market percentile data
2. Call pricelabs_get_listing for current base price
3. Compare base price to market percentiles:
   - Below p25 with high occupancy: recommend increase to p50
   - Above p75 with low occupancy: recommend decrease to p50
   - Within p25-p75 with normal metrics: no change recommended
4. Cross-reference with recommended_base_price from PriceLabs
5. Check audit log for last base price change (enforce 30-day minimum interval)
6. If change recommended, include: current base, recommended base, market percentiles,
   listing occupancy vs market occupancy, and expected min/max price impact
```

### Pattern 4: Approval Flow (Enhanced from Monitoring Skill Section 6)

**What:** The existing monitoring skill Section 6 defines a basic approval flow. Phase 4 enhances it with structured before/after presentation, explicit audit logging at each stage, and sync timing awareness.

**Enhanced approval flow for Phase 4:**
```markdown
## Write Operation Approval Flow

When executing a pricing change:

### Step 1: Pre-Write Snapshot
Call pricelabs_snapshot_before_write to capture current state.

### Step 2: Present Recommendation
Format the recommendation with ALL of:
- What will change (specific field: base price, DSO, min-stay)
- Current value (from snapshot)
- Proposed new value
- Rationale (which detection protocol triggered this, with specific metrics)
- Impact (how min/max prices change for base price updates, which dates affected for DSOs)

### Step 3: Log Recommendation
Call pricelabs_log_action with action_type='recommendation', including the full
recommendation details in details_json.

### Step 4: Wait for Approval
Present: "Reply 'approve' to proceed or 'reject' to skip."
Do NOT proceed without explicit approval. Do NOT interpret ambiguous responses as approval.

### Step 5: On Approval
1. Log: pricelabs_log_action with action_type='approval'
2. Execute: call the appropriate write tool (pricelabs_set_overrides or pricelabs_update_listings)
3. Verify: the write tool already does post-write verification (set_overrides)
4. Log: pricelabs_log_action with action_type='execution', including before/after/verification

### Step 6: On Rejection
1. Log: pricelabs_log_action with action_type='approval' (with rejection noted)
2. Acknowledge: "Got it, skipping this change."

### Step 7: Post-Execution Report
After a successful write:
- Confirm what changed with before/after values
- Note sync timing: "Changes saved to PriceLabs. They will sync to [PMS] during
  the next nightly cycle (6pm-6am CT). For immediate sync, I can trigger a manual push."
- Offer push_prices for urgent changes
```

### Pattern 5: Optimization Scan Cron Job

**What:** A new cron job (or enhancement to existing weekly report) that triggers the optimization scan on a regular schedule. Runs the orphan day detection, demand spike detection, and monthly base price calibration protocols.

**When to run:** Align with existing cron pattern. Two options:
1. Add to existing weekly Monday 10am report (most efficient -- report already runs analysis)
2. Separate scan on Monday/Thursday at 9am (per agent/workflows.md Workflow 2 design)

**Recommendation:** Enhance the existing weekly Monday 10am cron job prompt to include optimization scanning. This avoids additional cron jobs and rate limit consumption. The weekly report already fetches the data needed for orphan and demand detection.

```json
{
  "name": "weekly-optimization-report-slack",
  "payload": {
    "kind": "agentTurn",
    "message": "Generate the weekly optimization report with pricing recommendations. Follow the Weekly Optimization Report Protocol from your analysis skill. Then run the Optimization Scan Protocol from your optimization skill: detect orphan days in the next 30 days, detect demand spikes in the next 90 days, and check if any listings need base price calibration. Present any recommendations that require approval.",
    "model": "opus",
    "thinking": "high"
  }
}
```

### Anti-Patterns to Avoid

- **Auto-executing without approval:** Even when the agent is "sure" a recommendation is correct, it MUST wait for explicit user approval. This is the most critical safety constraint.
- **Recommending base price changes more than monthly:** The 30-day minimum interval between base price changes is a hard rule. Check the audit log before recommending.
- **Building a rollback "undo button" tool:** Rollback is re-writing old values via existing tools, guided by the snapshot. No separate undo API exists. Don't build one -- just re-execute the old values.
- **Storing snapshots in a new table:** The existing `audit_log.details_json` field is sufficient. Adding a dedicated table increases migration complexity for marginal benefit.
- **Panic pricing (race to bottom):** Never recommend more than one base price decrease per listing without an intervening review period. The optimization skill must include guardrails against successive decreases.
- **Ignoring already-booked dates:** Before recommending price changes, always check `booking_status`. Booked dates cannot have their prices changed -- DSOs on booked dates are ineffective.

## Existing Infrastructure Inventory (Phase 4 Already Has)

This is critical for the planner to understand what does NOT need to be built.

| Requirement | Already Exists | Where | What Phase 4 Adds |
|-------------|---------------|-------|-------------------|
| OPT-04: Post-write verification | YES | `tools/overrides.ts` lines 246-271 | Nothing. Already implemented. Verify in E2E. |
| OPT-08: DSO min price floor validation | YES | `tools/overrides.ts` lines 206-221, `schemas/overrides.ts` lines 35-55 | Nothing. Already implemented with defense-in-depth (Zod + handler). |
| OPT-09: DSO currency matching | YES | `tools/overrides.ts` lines 143-203 | Nothing. Already implemented with fail-safe on missing data. |
| OPT-02: Basic approval protocol | PARTIAL | `skills/pricelabs-monitoring/SKILL.md` Section 6 | Enhanced protocol with structured before/after, sync timing, audit logging at each stage. |
| OPT-10: Audit log infrastructure | PARTIAL | `tools/audit.ts`, `db/queries/audit-log.ts` | Enhanced `details_json` convention with before/after values. Possible new `snapshot` action_type. |
| Write tools (DSOs) | YES | `tools/overrides.ts` (set, delete) | Nothing. Existing tools are used by the agent. |
| Write tools (listings) | YES | `tools/listings.ts` (update_listings) | Nothing. Existing tool is used by the agent. |
| Demand color data | YES | `tools/prices.ts`, `computed-fields.ts` | Optimization skill teaches agent to interpret demand_color for spike detection. |
| Neighborhood percentiles | YES | `tools/neighborhood.ts`, `computed-fields.ts` | Optimization skill teaches agent to use percentiles for base price calibration. |
| Booking status data | YES | `tools/prices.ts` (booking_status field) | Optimization skill teaches agent to use booking_status for orphan detection. |

## New Additions Needed for Phase 4

| Addition | Type | Purpose | Requirement |
|----------|------|---------|-------------|
| Optimization skill (SKILL.md) | Skill | Detection protocols, recommendation frameworks, approval flow | OPT-01, OPT-02, OPT-05, OPT-06, OPT-07 |
| `pricelabs_snapshot_before_write` tool | MCP Tool | Pre-write state capture for rollback | OPT-03 |
| Snapshot schema + queries | TypeScript | Input validation and DB queries for new tool | OPT-03 |
| Enhanced audit_log action_type enum | Schema update | Add 'snapshot' to action_type enum | OPT-03, OPT-10 |
| Cron job enhancement | Config | Add optimization scan to weekly report prompt | OPT-05, OPT-06, OPT-07 |
| Server wiring | index.ts | Register new optimization tool | OPT-03 |

**Total new MCP tools:** 1 (`pricelabs_snapshot_before_write`)
**Total tools after Phase 4:** 23 (existing) + 1 (new) = 24 tools

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Orphan day detection | Custom calendar engine with gap analysis | Agent skill protocol using `pricelabs_get_prices` booking_status | Agent can reason about consecutive available dates between booked dates. Skill provides the protocol. |
| Demand spike detection | Event detection ML model | Agent skill protocol using `pricelabs_get_prices` demand_color | Red demand_color IS the demand spike signal. Agent groups consecutive reds. No ML needed. |
| Base price recommendation | Statistical pricing model | Agent skill protocol using `pricelabs_get_neighborhood` percentiles + `recommended_base_price` | PriceLabs already provides the recommended base price and market percentiles. Agent compares and recommends. |
| Approval workflow state machine | Workflow engine with state persistence | Conversational approval via OpenClaw messaging | OpenClaw manages the conversation. Agent asks, user replies, agent acts. No state machine needed. |
| Rollback mechanism | Undo/transaction system | Re-write old values from audit log snapshot | No undo API exists. "Rollback" = write the old values back using existing tools. |
| DSO safety validation | New validation layer | Existing `pricelabs_set_overrides` validation | Already has defense-in-depth: Zod + runtime handler + currency check + price floor + post-write verification. |

**Key insight:** Phase 4 is primarily a **skill design** phase, not an infrastructure phase. The write infrastructure exists. The safety validation exists. The audit log exists. What's new is teaching the agent WHEN to recommend changes, HOW to present them, and WHAT to log.

## Common Pitfalls

### Pitfall 1: Agent Skips Pre-Write Snapshot

**What goes wrong:** Agent goes directly to the write tool without capturing current state. Rollback becomes impossible because there's no "before" to roll back to.
**Why it happens:** Agent follows the shortest path to the user's request. Without a hard gate, the snapshot step gets skipped.
**How to avoid:** Use a dedicated MCP tool for snapshotting (not just skill instructions). The optimization skill must instruct the agent that calling `pricelabs_snapshot_before_write` is MANDATORY before any write. The skill should state: "NEVER call pricelabs_set_overrides or pricelabs_update_listings without first calling pricelabs_snapshot_before_write."
**Warning signs:** Audit log entries with `action_type='execution'` that have no preceding `action_type='snapshot'` entry for the same listing.

### Pitfall 2: Orphan Day False Positives from Owner Blocks

**What goes wrong:** Agent detects a 2-night "gap" between bookings and recommends filling it. But the gap is actually an owner block (maintenance, personal use) where `unbookable = "1"`. The recommendation is impossible to execute.
**Why it happens:** The agent looks at `booking_status` but doesn't check `unbookable`. An owner block shows as "available" in some contexts but "unbookable" in others.
**How to avoid:** The optimization skill must instruct the agent to always check the `unbookable` field for gap dates. If `unbookable = "1"` for any date in the gap, exclude it from orphan day recommendations. The PriceEntry schema already includes `unbookable` as a field.
**Warning signs:** Orphan day recommendations for dates that are actually owner-blocked. User rejects recommendations because dates are intentionally blocked.

### Pitfall 3: Demand Spike DSOs Conflicting with Algorithm

**What goes wrong:** Agent sets DSOs for high-demand dates, but PriceLabs' HLP algorithm was already pricing those dates higher through its event detection. The DSO overrides the algorithm's more nuanced pricing, potentially pricing too high or too low.
**Why it happens:** DSOs have the HIGHEST priority and override everything. The algorithm's event pricing is smarter (considers historical booking pace, competitor pricing, hotel rates). A flat percentage DSO is cruder.
**How to avoid:** The optimization skill must instruct the agent to check the CURRENT algorithm-computed price before recommending a DSO. If the algorithm already has the price elevated (price significantly above base), the agent should note this and only recommend a DSO if the agent's analysis suggests the algorithm is under-pricing for a specific event it may have missed.
**Warning signs:** DSOs set on dates where the algorithm already computed elevated prices. The DSO doesn't actually change the price much because the algorithm was already there.

### Pitfall 4: Approval Fatigue from Over-Scanning

**What goes wrong:** Weekly optimization scan generates 15+ recommendations across a portfolio. User gets overwhelmed and stops responding. Recommendations go stale.
**Why it happens:** Scanning all listings for all opportunity types (orphan days + demand spikes + base price) at once generates too many low-priority recommendations.
**How to avoid:** The optimization skill must prioritize recommendations:
1. **High priority:** Orphan days in next 14 days (imminent revenue loss)
2. **Medium priority:** Demand spikes with no DSOs in next 30 days
3. **Low priority:** Base price calibration (monthly check)
Present high-priority first, then ask "Want to see medium/low priority recommendations?" Only show the top 3-5 recommendations per scan. Set a 48-hour expiry on recommendations -- if unapproved, recalculate next scan.
**Warning signs:** More than 5 recommendations per scan. User approval rate drops. Response time exceeds 24 hours.

### Pitfall 5: Base Price Changes Triggering Cascading Min/Max Issues

**What goes wrong:** Agent recommends raising base price from $185 to $210. User approves. But the listing's min price is set as a percentage of base (e.g., 60%), so min price jumps from $111 to $126. The listing's max price is also percentage-based, jumping from $555 to $630. These cascading changes weren't presented in the recommendation.
**Why it happens:** PriceLabs min/max can be configured as fixed values OR percentages of base. The agent must account for both configurations when presenting impact.
**How to avoid:** The optimization skill must instruct the agent to always show the full impact of a base price change: "Current base: $185, min: $111 (60%), max: $555 (300%). Proposed base: $210. New min: $126, new max: $630." Fetch the listing's min/max configuration to determine if they are fixed or percentage-based.
**Warning signs:** User surprises about min/max changes they didn't expect.

### Pitfall 6: Stale Snapshot Used for Rollback

**What goes wrong:** Agent snapshots current state at 10am. User approves change at 3pm. Between snapshot and execution, the host made manual changes in PriceLabs dashboard. Agent writes the approved change. Later, user wants rollback. Agent rolls back to the 10am snapshot, losing the host's manual changes.
**Why it happens:** Snapshot was taken hours before execution. PriceLabs has no webhook to notify of intermediate changes.
**How to avoid:** The optimization skill must instruct the agent to re-fetch current state immediately before executing an approved change (not rely on an old snapshot). The snapshot tool should be called right before the write, not at recommendation time. The approval flow should include: "I'll capture the latest state right before making the change."
**Warning signs:** Time gap > 30 minutes between snapshot and execution.

### Pitfall 7: Recommending Changes for Booked Dates

**What goes wrong:** Agent recommends a DSO price increase for March 15, but March 15 is already booked. The DSO has no effect (price is locked at booking rate), but the recommendation wastes user attention and erodes trust.
**Why it happens:** Agent doesn't check booking_status before formulating recommendations.
**How to avoid:** The optimization skill must instruct: "Before recommending any DSO, verify that the target dates are available (booking_status != 'booked'). Never recommend price changes for already-booked dates."
**Warning signs:** DSO recommendations for dates that are already booked.

## Code Examples

### Pre-Write Snapshot Schema (if using dedicated tool)

```typescript
// src/schemas/optimization.ts
import { z } from "zod";

/** Input for pricelabs_snapshot_before_write */
export const SnapshotBeforeWriteInputSchema = z.object({
  listing_id: z.string().describe("Listing ID to snapshot"),
  pms: z.string().describe("PMS identifier"),
  operation_type: z
    .enum(["set_overrides", "update_listing", "delete_overrides"])
    .describe("Type of write operation about to be performed"),
  start_date: z
    .string()
    .optional()
    .describe("Start date for override range (YYYY-MM-DD). Required for override operations."),
  end_date: z
    .string()
    .optional()
    .describe("End date for override range (YYYY-MM-DD). Required for override operations."),
  channel: z
    .string()
    .optional()
    .describe("Channel context: 'slack', 'telegram', 'interactive'"),
});
```

### Enhanced Audit Log Action Types

```typescript
// Update src/schemas/monitoring.ts -- extend action_type enum
export const LogActionInputSchema = z.object({
  action_type: z
    .enum([
      "recommendation",  // Agent formulated a recommendation
      "approval",        // User approved or rejected
      "execution",       // Write operation executed
      "snapshot",        // Pre-write state capture (NEW)
      "rollback",        // Rollback to previous state (NEW)
      "alert",           // Monitoring alert
      "report",          // Report generation
    ])
    .describe("Type of agent action"),
  // ... rest of schema unchanged
});
```

### Optimization Skill Structure (SKILL.md outline)

```markdown
---
name: pricelabs-optimization
description: >
  Pricing optimization protocols: orphan day detection, demand spike
  detection, base price calibration, approval workflow, and write
  operation safety procedures.
user-invocable: false
metadata: {"openclaw":{"always":true}}
---

## 1. Orphan Day Detection Protocol (OPT-05)
[Steps for detecting 1-3 night gaps in next 30 days]
[Fill strategy: 20% discount DSO, min-stay reduction]
[Exclude owner blocks (unbookable dates)]
[Recommendation format with specific dates and prices]

## 2. Demand Spike Detection Protocol (OPT-06)
[Steps for detecting red demand_color clusters]
[Event-based DSO recommendation: +15% to +30%]
[Check if algorithm already elevated pricing]
[Cross-reference with neighborhood data]

## 3. Monthly Base Price Calibration Protocol (OPT-07)
[Compare base to market percentiles]
[Check recommended_base_price from PriceLabs]
[Enforce 30-day minimum interval via audit log check]
[Show full impact including min/max cascade]

## 4. Write Operation Safety Protocol
[Pre-write snapshot (MANDATORY)]
[Never write without approval]
[Post-write verification interpretation]
[Sync timing caveat]

## 5. Approval Flow Protocol (OPT-01, OPT-02)
[Enhanced from monitoring skill Section 6]
[Structured recommendation format with before/after]
[Approval/rejection logging]
[Execution and verification]

## 6. Recommendation Prioritization
[High/Medium/Low priority classification]
[Max 5 recommendations per scan]
[48-hour expiry on stale recommendations]

## 7. Rollback Protocol
[How to use audit log snapshots for rollback]
[Re-fetch before rollback to avoid overwriting manual changes]
[Log rollback as separate action]
```

### Cron Job Enhancement

```json
{
  "name": "weekly-optimization-report-slack",
  "payload": {
    "kind": "agentTurn",
    "message": "Generate the weekly optimization report with pricing recommendations. Follow these protocols in order:\n\n1. Weekly Optimization Report Protocol (analysis skill): Compute portfolio KPIs with WoW and STLY comparisons. Detect underperforming listings with specific recommended actions.\n\n2. Orphan Day Detection Protocol (optimization skill): For each listing, scan the next 30 days for 1-3 night unbookable gaps between bookings. Present specific fill strategies with recommended DSOs.\n\n3. Demand Spike Detection Protocol (optimization skill): Scan the next 90 days for clusters of red demand dates without existing DSOs. Recommend event-based percentage overrides.\n\n4. Base Price Calibration Check (optimization skill): If it has been 30+ days since the last base price review, compare each listing's base price to neighborhood percentiles and recommended_base_price.\n\nPresent the top 3-5 recommendations that require approval. Log the report when complete.",
    "model": "opus",
    "thinking": "high"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual approval buttons (Slack blocks) | Reply-based approval ("reply 'approve'") | 2026 (OpenClaw chat paradigm) | Simpler, works in all channels, no custom UI. TODO from STATE.md deferred prototype. |
| Separate rollback infrastructure | Audit log snapshots + re-write | 2026 | No additional storage layer. Rollback uses existing write tools. |
| Rule engine for opportunity detection | LLM + skill protocols | 2026 (framework+reasoning decision) | More flexible, easier to tune, adapts to context |
| Per-change individual approval | Batched recommendations with priority | 2026 (approval fatigue mitigation) | Reduces user burden while maintaining safety |

**Deprecated/outdated:**
- Building Slack interactive buttons for approval -- OpenClaw handles channel formatting; reply-based is simpler and cross-channel
- Separate undo/rollback API -- re-writing old values via existing tools is sufficient
- Auto-approval for "low-risk" changes -- out of scope for v1 (deferred to AUTO-01 in v2)

## Open Questions

1. **Approval UX: buttons vs reply-based**
   - What we know: STATE.md accumulated TODO says "Prototype approval UX in Slack/Telegram -- buttons vs reply-based (Phase 4)". The monitoring skill Section 6 currently uses reply-based ("Reply 'approve' to proceed").
   - What's unclear: Whether OpenClaw supports interactive Slack blocks or Telegram inline keyboards that would allow button-based approval.
   - Recommendation: Start with reply-based (already works in the current skill). It is cross-channel compatible. If OpenClaw adds interactive element support, buttons can be added later. Do not block Phase 4 on this UX question.

2. **Optimization scan frequency**
   - What we know: The agent/workflows.md Workflow 2 suggests Monday and Thursday at 9am. The existing weekly report runs Monday at 10am.
   - What's unclear: Whether scanning twice per week generates too many or too few recommendations.
   - Recommendation: Start with enhancing the existing Monday 10am weekly report to include optimization scanning. Avoid adding a second scan until user feedback confirms frequency is insufficient. This minimizes rate limit consumption and avoids adding more cron jobs.

3. **Rollback confirmation delay**
   - What we know: The PITFALLS.md Pitfall 7 suggests a 5-minute confirmation delay after approval, with cancel option.
   - What's unclear: Whether a 5-minute delay is practical in a chat context (user may have moved on).
   - Recommendation: Do not implement a confirmation delay for v1. The pre-write snapshot + post-write verification is sufficient. Immediate execution after approval with clear sync timing caveat. Users can request rollback interactively if needed.

4. **When to recommend push_prices after DSO writes**
   - What we know: PriceLabs syncs nightly 6pm-6am CT. DSO writes are saved but not pushed to OTAs until the next sync. `push_prices` API can trigger an immediate push.
   - What's unclear: Whether triggering push_prices after every DSO write is appropriate (it uses rate limit budget) or only for urgent changes.
   - Recommendation: The optimization skill should tell the agent to mention sync timing after every write and offer push_prices only when the user indicates urgency. Do not auto-push. Let the user decide.

## Sources

### Primary (HIGH confidence)
- Existing codebase: All source files in `mcp-servers/pricelabs/src/` -- tool implementations, schemas, query modules, computed fields verified by reading source
- Existing skills: `skills/pricelabs-monitoring/SKILL.md` (Section 6 approval flow), `skills/pricelabs-domain/SKILL.md` (optimization playbook, DSO business rules), `skills/pricelabs-analysis/SKILL.md` (underperformance detection, recommendation framework)
- Existing config: `openclaw/cron/jobs.json` (cron patterns), `openclaw/openclaw.json` (tool deny list, agent config)
- Project planning: `.planning/STATE.md` (all locked decisions, accumulated TODOs), `.planning/ROADMAP.md` (Phase 4 requirements), `.planning/REQUIREMENTS.md` (OPT-01 through OPT-10 definitions)
- Database migrations: `src/db/migrations.ts` (audit_log schema, all table structures)
- Domain pitfalls: `.planning/research/PITFALLS.md` (pre-flight checklist for write operations, DSO safety)
- Agent workflows: `agent/workflows.md` (price optimization scan, event detection, monthly strategy review)

### Secondary (MEDIUM confidence)
- Phase 3 research: `.planning/phases/03-analysis-layer-smart-alerting/03-RESEARCH.md` -- analysis patterns, skill architecture verified by Phase 3 execution
- PriceLabs domain knowledge from skill: Orphan day ROI (7% revenue increase), base price calibration rules, demand color interpretation, sync timing (6pm-6am CT)

### Tertiary (LOW confidence)
- Approval UX (buttons vs reply): STATE.md TODO. OpenClaw interactive element support not verified with current docs. Defaulting to reply-based.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries needed. All infrastructure exists from Phases 1-3.
- Architecture: HIGH -- Extends proven patterns (skills, MCP tools, audit log). Write tools already validated. Safety validation already implemented.
- Optimization protocols: HIGH -- Orphan detection uses existing booking_status data. Demand spike uses existing demand_color data. Base price calibration uses existing neighborhood percentiles and recommended_base_price. All data sources are proven Phase 1 tools.
- Approval flow: HIGH -- Extends existing monitoring skill Section 6 pattern. Reply-based approval is cross-channel compatible.
- Pitfalls: HIGH -- Derived from concrete analysis of existing tool behavior (silently dropped dates, DSO priority override), domain knowledge (base price frequency rules, sync timing), and approval fatigue research.
- Audit trail: HIGH -- Existing `details_json` field supports structured JSON. Schema update to add action types is trivial.

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days -- stable domain, no external dependency changes expected)
