---
phase: 03-analysis-layer-smart-alerting
plan: 01
subsystem: api, database
tags: [mcp-tools, sql-aggregation, zod, portfolio-kpis, underperformance-detection, market-position]

# Dependency graph
requires:
  - phase: 02-monitoring-persistence-interactive-delivery
    provides: listing_snapshots and market_snapshots tables, SQLite database, MCP server with 21 tools
provides:
  - pricelabs_get_portfolio_kpis MCP tool for WoW/month/STLY KPI comparison
  - pricelabs_detect_underperformers MCP tool with configurable thresholds and market enrichment
  - SQL aggregation queries for portfolio analysis (getPortfolioWoW, getUnderperformers, getMarketPosition)
  - Zod input schemas for analysis tools (GetPortfolioKpisInputSchema, DetectUnderperformersInputSchema)
affects: [03-02 (analysis skill will call these tools), 03-03 (cron jobs will trigger these tools)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Analysis query module with typed row interfaces and prepared statements"
    - "Market position enrichment pattern: detect underperformers then JOIN with market_snapshots"
    - "Parameterized comparison period (previous_week/previous_month/stly) via date arithmetic"

key-files:
  created:
    - mcp-servers/pricelabs/src/schemas/analysis.ts
    - mcp-servers/pricelabs/src/db/queries/analysis.ts
    - mcp-servers/pricelabs/src/tools/analysis.ts
  modified:
    - mcp-servers/pricelabs/src/index.ts

key-decisions:
  - "Record<string, never> for empty params type on getMarketPosition prepared statement"
  - "Underperformer results enriched with market position in tool handler (Map lookup) rather than SQL JOIN"
  - "getMarketPosition uses per-listing MAX(snapshot_date) subquery for market_snapshots to handle staggered data"

patterns-established:
  - "Analysis tool handler pattern: resolve date defaults from DB, compute comparison dates, query, enrich, return"
  - "Market enrichment via Map lookup: fetch all market positions once, index by listing_id:pms composite key"

# Metrics
duration: 8min
completed: 2026-02-23
---

# Phase 3 Plan 1: Analysis Data Layer and MCP Tools Summary

**2 new MCP tools (portfolio KPIs + underperformer detection) backed by 3 SQL aggregation queries with typed row interfaces, bringing server to 23 total tools**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-23T03:50:14Z
- **Completed:** 2026-02-23T03:58:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Portfolio KPI tool computes WoW, monthly, and STLY comparisons across all listings via a single MCP call
- Underperformer detection tool scans for occupancy gaps, revenue drops, and health declines with configurable thresholds
- Market position analysis query classifies each listing into price percentile bands (below_25th through above_90th)
- Underperformer results enriched with market position context for competitive analysis
- Server entry point updated from 21 to 23 total tools across 12 registration functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create analysis Zod schemas and SQL query module** - `4d40d75` (feat)
2. **Task 2: Create analysis MCP tools and wire into server** - `9efb2ec` (feat)

## Files Created/Modified
- `mcp-servers/pricelabs/src/schemas/analysis.ts` - Zod input schemas for GetPortfolioKpis and DetectUnderperformers
- `mcp-servers/pricelabs/src/db/queries/analysis.ts` - Prepared SQL statements for WoW comparison, underperformer detection, and market position
- `mcp-servers/pricelabs/src/tools/analysis.ts` - MCP tool registrations for pricelabs_get_portfolio_kpis and pricelabs_detect_underperformers
- `mcp-servers/pricelabs/src/index.ts` - Import and registration call for analysis tools, updated tool count comment

## Decisions Made
- Used `Record<string, never>` as the params type for the getMarketPosition prepared statement (no parameters needed, uses latest data via subquery)
- Enriched underperformer results with market position data via in-memory Map lookup in the tool handler rather than a complex SQL JOIN, keeping the SQL queries focused and composable
- Market position query uses per-listing `MAX(snapshot_date)` subquery for market_snapshots to handle cases where market data may be collected at different times per listing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Analysis tools are ready for the analysis skill (Plan 02) to call from its weekly report and underperformance detection protocols
- Market position data is included in both KPI and underperformer responses, supporting ANLY-05 competitive positioning without a dedicated tool
- All 23 tools compile cleanly and are wired into the server entry point

## Self-Check: PASSED

All 4 created/modified files verified on disk. Both task commits (4d40d75, 9efb2ec) verified in git log.

---
*Phase: 03-analysis-layer-smart-alerting*
*Completed: 2026-02-23*
