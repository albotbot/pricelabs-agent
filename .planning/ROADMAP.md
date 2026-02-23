# Roadmap: PriceLabs Agent

**Created:** 2026-02-22
**Depth:** Comprehensive
**Phases:** 5
**Coverage:** 43/43 v1 requirements mapped

## Overview

This roadmap delivers an AI revenue management agent in 5 phases, progressing from foundational API infrastructure through read-only monitoring, analytical intelligence, human-approved write operations, and finally scale features. The phases follow a strict read-before-write principle: the agent proves its analytical value (Phases 1-3) before being trusted with pricing changes (Phase 4), and financial risk increases gradually across phases.

---

## Phase 1: MCP Server Foundation + Infrastructure Security

**Goal:** A working PriceLabs MCP server provides reliable, secure, rate-limited API access and the agent has domain knowledge loaded -- enabling all downstream features.

**Dependencies:** None (foundation phase)

**Plans:** 9 plans

Plans:
- [x] 01-01-PLAN.md -- Project scaffold + rate limiter + cache + error types
- [x] 01-02-PLAN.md -- Zod schemas + TypeScript types + computed fields
- [x] 01-03-PLAN.md -- Domain knowledge skill (always-on PriceLabs expertise)
- [x] 01-04-PLAN.md -- PriceLabs API client with retry and fallback
- [x] 01-05-PLAN.md -- Listing tools (get_listings, get_listing, update_listings)
- [x] 01-06-PLAN.md -- Price + override tools with DSO safety validation
- [x] 01-07-PLAN.md -- Remaining tools (neighborhood, reservations, rate plans, sync, status)
- [x] 01-08-PLAN.md -- Server entry point + OpenClaw Gateway security config
- [x] 01-09-PLAN.md -- End-to-end verification checkpoint

**Requirements:**
- INFRA-01: MCP server wraps all 12 PriceLabs Customer API endpoints as typed tools with Zod validation
- INFRA-02: MCP server enforces rate limiting (1000 req/hr) with token bucket algorithm
- INFRA-03: MCP server caches API responses with configurable TTLs per endpoint
- INFRA-04: API key stored exclusively in MCP server environment variables, never exposed to skills or logs
- INFRA-05: OpenClaw Gateway configured with channel security (pairing mode, allowlists)
- INFRA-06: Domain knowledge skill provides always-on PriceLabs optimization reference to the agent

**Success Criteria:**
1. Agent can fetch listing data from PriceLabs API through MCP tools and display results in a messaging channel
2. Rapid successive API calls are throttled by the rate limiter without errors reaching the agent (requests queue or return cached data)
3. Repeated identical queries within cache TTL return cached responses without hitting the PriceLabs API
4. API key does not appear in any skill file, agent log, or channel message
5. Unauthorized users cannot interact with the agent (channel security blocks unpaired devices)

---

## Phase 2: Monitoring + Persistence + Interactive Queries + Channel Delivery

**Goal:** Users receive daily automated portfolio health reports and can ask natural language questions about their portfolio -- with all data persisted for historical comparison.

**Dependencies:** Phase 1 (MCP server must be operational for all API access)

**Plans:** 6 plans

Plans:
- [x] 02-01-PLAN.md -- Install better-sqlite3 + database service + schema migrations
- [x] 02-02-PLAN.md -- Zod schemas for new tools + prepared statement query modules
- [x] 02-03-PLAN.md -- Snapshot storage/retrieval MCP tools (5 tools)
- [x] 02-04-PLAN.md -- Monitoring + audit MCP tools (3 tools) + server wiring
- [x] 02-05-PLAN.md -- Monitoring skill + OpenClaw cron config + env update
- [x] 02-06-PLAN.md -- End-to-end verification checkpoint

**Requirements:**
- MON-01: Agent sends daily portfolio health summary to Slack and Telegram at configurable time
- MON-02: Daily summary includes health scores, occupancy vs market, sync status, and revenue vs STLY for each listing
- MON-03: Agent tracks booking pace at 7/30/60/90 day cutoffs and compares to STLY
- MON-04: Agent alerts when booking pace falls behind STLY by configurable threshold (default 20%)
- MON-05: Agent detects stale syncs (>48 hours since last push) and alerts immediately
- INT-01: User can ask natural language questions about portfolio performance and get live API data
- INT-02: User can ask about specific listings by name or location
- INT-03: User can ask comparative questions (e.g., "which listing is performing best?")
- INT-04: Agent fetches live data for each query (with cache awareness) rather than relying on stale context
- PERS-01: SQLite database stores daily listing snapshots for historical comparison
- PERS-02: SQLite stores daily price snapshots with demand signals
- PERS-03: SQLite stores reservation data for pace tracking and cancellation detection
- PERS-04: SQLite stores all agent actions (recommendations, approvals, executions) in audit log
- PERS-05: SQLite stores market data snapshots for trend analysis
- DEL-01: Agent delivers all automated reports and alerts to both Slack and Telegram
- DEL-02: Agent supports interactive sessions in both Slack and Telegram
- DEL-03: Approval flow works in both channels (user replies to approve/reject)

**Success Criteria:**
1. User receives a daily portfolio health summary in both Slack and Telegram at the configured time, containing health scores, occupancy vs market, sync status, and revenue vs STLY for every listing
2. User can ask "how is my [listing name] performing?" in either channel and receive a response with live data from PriceLabs
3. User can ask comparative questions like "which listing has the highest occupancy?" and get an accurate ranked answer
4. Agent alerts the user when booking pace falls behind STLY by the configured threshold, with specific numbers
5. Historical snapshots accumulate in SQLite daily, and the agent references prior data when answering trend questions

---

## Phase 3: Analysis Layer + Smart Alerting

**Goal:** The agent proactively identifies underperformance, generates weekly optimization reports, and provides competitive market positioning -- transforming raw data into actionable intelligence.

**Dependencies:** Phase 2 (requires accumulated historical data in SQLite, working monitoring and delivery infrastructure)

**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md -- Analysis Zod schemas + SQL query module + MCP tools (2 tools) + server wiring
- [x] 03-02-PLAN.md -- Analysis skill (6-section analytical playbook) + weekly cron config
- [x] 03-03-PLAN.md -- End-to-end verification checkpoint

**Requirements:**
- ANLY-01: Agent detects underperforming listings using health scores, occupancy gaps, and revenue drops
- ANLY-02: Underperformance alerts include specific recommended actions (lower base, expand last-minute discount, etc.)
- ANLY-03: Agent generates weekly optimization report with RevPAR, ADR, occupancy trends across portfolio
- ANLY-04: Weekly report compares current metrics to previous week and STLY
- ANLY-05: Agent provides competitive position analysis showing listing pricing vs 25th/50th/75th/90th market percentiles
- ANLY-06: Agent renders demand calendar visualization in chat using demand color descriptions

**Success Criteria:**
1. When a listing's occupancy or revenue drops significantly below market or STLY, the agent sends an alert with specific recommended actions (not just "listing is underperforming")
2. User receives a weekly optimization report in both channels showing RevPAR, ADR, and occupancy trends compared to the previous week and the same time last year
3. User can ask "how is my pricing compared to the market?" and see their listing positioned against 25th/50th/75th/90th neighborhood percentiles
4. User can ask for a demand calendar and see upcoming dates described by demand level (high/medium/low using PriceLabs demand colors) in a readable chat format

---

## Phase 4: Write Operations + Approval Workflow

**Goal:** The agent recommends specific pricing changes with clear rationale, executes them only after explicit user approval, and maintains a complete audit trail with rollback capability.

**Dependencies:** Phase 3 (analysis layer provides the intelligence that drives recommendations; user trust established through read-only phases)

**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md -- Snapshot tool + audit enum extension + server wiring
- [x] 04-02-PLAN.md -- Optimization skill (7-section pricing optimization playbook)
- [x] 04-03-PLAN.md -- Cron enhancement + end-to-end verification

**Requirements:**
- OPT-01: Agent recommends pricing changes (base price, DSOs, min-stay) with clear rationale
- OPT-02: All pricing recommendations require explicit user approval in messaging before execution
- OPT-03: Agent snapshots current values before every write operation for rollback capability
- OPT-04: Agent verifies write results by re-fetching after every API write (POST-then-GET verification)
- OPT-05: Agent detects orphan days (1-3 night unbookable gaps) in next 30 days and suggests fill strategies
- OPT-06: Agent detects demand spikes via demand_color signals and recommends event-based DSOs
- OPT-07: Agent recommends base price adjustments monthly based on neighborhood data percentile analysis
- OPT-08: DSO validation ensures price never falls below listing minimum price floor
- OPT-09: DSO validation ensures currency matches PMS currency for fixed-price overrides
- OPT-10: All executed changes logged in audit trail with before/after values, timestamp, and user who approved

**Success Criteria:**
1. Agent identifies orphan days and demand spikes, then presents specific pricing recommendations with rationale -- the user sees exactly what will change, why, and what the current values are
2. No pricing change is ever executed without the user explicitly approving it in their messaging channel
3. After the user approves a change, the agent executes it via the API and confirms the result by re-fetching the updated values -- discrepancies are reported immediately
4. User can ask "what changes have been made?" and see a complete audit trail with before/after values, timestamps, and who approved each change
5. A DSO recommendation never sets a price below the listing's minimum price floor, and currency mismatches are caught before execution

---

## Phase 5: Scale + Feedback Loop

**Goal:** The agent handles larger portfolios efficiently with batch operations, tracks the revenue impact of its recommendations over time, and lets users tune alert sensitivity.

**Dependencies:** Phase 4 (requires working write operations and approval flow to scale; requires executed changes to track impact)

**Requirements:**
- SCALE-01: Agent supports batch approve/reject for multiple listing recommendations at once
- SCALE-02: Agent tracks revenue impact of approved changes at 7/14/30 day intervals after execution
- SCALE-03: Agent detects new cancellations and suggests reactive fill strategies for freed dates
- SCALE-04: User can configure alert thresholds (occupancy gap %, revenue drop %, pace lag %) per listing or globally

**Success Criteria:**
1. When the agent has recommendations for multiple listings, the user can approve or reject them in a single batch interaction rather than one-by-one
2. After a pricing change is executed, the agent follows up at 7, 14, and 30 days with a report on the revenue impact of that specific change
3. When a reservation is cancelled, the agent detects it and proactively suggests a fill strategy for the newly open dates
4. User can set custom alert thresholds (e.g., "only alert me if occupancy drops 15% below market") and those thresholds persist across sessions

---

## Progress

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | MCP Server Foundation + Infrastructure Security | 6 | Complete (9 plans) |
| 2 | Monitoring + Persistence + Interactive + Delivery | 17 | Complete (6 plans) |
| 3 | Analysis Layer + Smart Alerting | 6 | Complete (3 plans) |
| 4 | Write Operations + Approval Workflow | 10 | Complete (3 plans) |
| 5 | Scale + Feedback Loop | 4 | Not Started |

**Total:** 43 requirements across 5 phases

---
*Roadmap created: 2026-02-22*
*Last updated: 2026-02-23 — Phase 4 complete*
