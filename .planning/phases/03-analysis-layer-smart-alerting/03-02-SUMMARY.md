---
phase: 03-analysis-layer-smart-alerting
plan: 02
subsystem: skills
tags: [analysis, weekly-report, underperformance, competitive-positioning, demand-calendar, cron, skill-architecture]

# Dependency graph
requires:
  - phase: 02-monitoring-persistence-interactive-delivery
    provides: "21 MCP tools, 5 SQLite tables, monitoring skill, daily cron jobs, dual-channel delivery"
provides:
  - "Analysis skill (SKILL.md) with 6 protocol sections covering ANLY-01 through ANLY-06"
  - "Weekly optimization report protocol with WoW/STLY comparison steps"
  - "Underperformance action decision tree with specific numbers (ANLY-02)"
  - "Competitive position analysis protocol with market percentiles"
  - "Demand calendar text rendering protocol with HIGH/MED/LOW indicators"
  - "2 weekly cron jobs (Slack + Telegram) for Monday 10am delivery"
affects: [03-03, alert-delivery, weekly-reports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Analysis skill as analytical playbook (LLM is the engine, skill is the protocol)"
    - "Decision tree with specific number placeholders for actionable recommendations"
    - "Demand level mapping from demand_color hex to HIGH/MED/LOW descriptors"
    - "Weekly cron 2 hours after daily cron to leverage fresh snapshots"

key-files:
  created:
    - "skills/pricelabs-analysis/SKILL.md"
  modified:
    - "openclaw/cron/jobs.json"

key-decisions:
  - "Analysis skill as playbook, not code: LLM reasons over data using skill protocols rather than rigid TypeScript rule engine"
  - "Weekly cron at 10am Monday (2h after daily health check) to use fresh snapshots without redundant API calls"
  - "Text-based demand calendar with HIGH/MED/LOW indicators instead of image rendering"
  - "24h alert dedup extending monitoring skill pattern to prevent duplicate underperformance alerts"

patterns-established:
  - "Decision tree pattern: map underperformance types to specific actions with dollar amounts and percentages"
  - "Skill coordination pattern: clear monitoring vs analysis responsibility boundary with cross-reference rules"
  - "Demand calendar format: text table with date, day, price, demand level, booking status"

# Metrics
duration: 6min
completed: 2026-02-23
---

# Phase 3 Plan 2: Analysis Skill and Weekly Cron Summary

**Analysis skill with 6 protocol sections covering weekly optimization reports, underperformance detection with specific action decision tree, competitive positioning, and demand calendar rendering, plus dual-channel Monday 10am weekly cron delivery**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-23T03:50:46Z
- **Completed:** 2026-02-23T03:57:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created analysis skill (344 lines) with 6 protocol sections covering all ANLY-01 through ANLY-06 requirements
- Built comprehensive underperformance action decision tree with specific number placeholders ensuring every recommendation includes metrics, actions, and dollar amounts (ANLY-02 critical requirement)
- Added dual-channel weekly cron jobs (Slack + Telegram) firing at 10am Monday CT with 30s Telegram stagger
- Established clear monitoring vs analysis skill responsibility boundary with 24h alert dedup and cross-reference rules

## Task Commits

Each task was committed atomically:

1. **Task 1: Create analysis skill with 6 protocol sections** - `8ad9e91` (feat)
2. **Task 2: Add weekly optimization report cron jobs** - `9b382e8` (feat)

## Files Created/Modified

- `skills/pricelabs-analysis/SKILL.md` - Analysis skill with 6 sections: weekly report protocol, underperformance detection with action decision tree, competitive position analysis, demand calendar rendering, report templates, monitoring skill coordination
- `openclaw/cron/jobs.json` - Updated from 2 to 4 cron jobs: added weekly-optimization-report-slack and weekly-optimization-report-telegram

## Decisions Made

- **Analysis skill as playbook, not code:** The LLM is the analysis engine; the skill provides protocols, thresholds, decision frameworks, and templates. This follows the locked "framework + reasoning approach" decision from Phase 1.
- **Weekly cron at 10am Monday (2h after daily):** Ensures daily health check at 8am has stored fresh snapshots. Weekly report reads those snapshots rather than making redundant API calls, protecting rate limit budget.
- **Text-based demand calendar:** Works in all messaging channels (Slack, Telegram) without image rendering infrastructure. Uses HIGH/MED/LOW descriptors mapped from PriceLabs demand_color hex values.
- **24h alert dedup extending monitoring pattern:** Before any underperformance alert, check audit log for same signal within 24h. Prevents duplicate alerts when both daily monitoring and weekly analysis flag the same listing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Analysis skill is ready for use by the weekly cron job and interactive queries
- Plan 01 (analysis MCP tools) provides the data tools referenced by the skill protocols (`pricelabs_get_portfolio_kpis`, `pricelabs_detect_underperformers`)
- Plan 03 (E2E verification) can validate the complete analysis pipeline from cron trigger through report delivery
- The skill references 7 MCP tools by exact name, ensuring tight integration with the tool layer

## Self-Check: PASSED

- [x] `skills/pricelabs-analysis/SKILL.md` exists (344 lines, 6 sections)
- [x] `openclaw/cron/jobs.json` valid JSON with 4 jobs
- [x] Commit `8ad9e91` exists (Task 1: analysis skill)
- [x] Commit `9b382e8` exists (Task 2: weekly cron jobs)
- [x] `03-02-SUMMARY.md` exists

---
*Phase: 03-analysis-layer-smart-alerting*
*Completed: 2026-02-23*
