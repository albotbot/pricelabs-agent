---
phase: 09-openclaw-deployment
plan: 01
subsystem: agent-skills
tags: [openclaw, agent-instructions, skill-files, protocols, monitoring, optimization, analysis]

# Dependency graph
requires:
  - phase: 08-snapshot-persistence
    provides: "Snapshot storage tools referenced in skill protocols (store_daily_snapshots, store_reservations, get_snapshots)"
provides:
  - "4 standalone skill files with protocol instructions the agent follows during cron-triggered workflows"
  - "openclaw.json instructions array wiring skills into agent config"
  - "7 named protocols matching cron job message references"
affects: [09-02-openclaw-deployment, 10-messaging-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [skill-file-as-agent-instruction, protocol-name-matching-cron-references]

key-files:
  created:
    - openclaw/skills/domain-knowledge.md
    - openclaw/skills/monitoring-protocols.md
    - openclaw/skills/analysis-playbook.md
    - openclaw/skills/optimization-playbook.md
  modified:
    - openclaw/openclaw.json

key-decisions:
  - "Used 'instructions' field (not 'skills') in openclaw.json for agent system prompt loading"
  - "Protocol section titles match cron job message references exactly for agent discoverability"
  - "Write safety prominently documented in domain-knowledge.md as agent guardrail"

patterns-established:
  - "Protocol-name matching: cron job messages reference protocol names that appear as exact section headings in skill files"
  - "Skill files are self-contained -- agent can follow any protocol without additional context"

requirements-completed: [DEPLOY-03]

# Metrics
duration: 9min
completed: 2026-02-26
---

# Phase 9 Plan 1: Agent Skills & Instructions Summary

**4 self-contained skill files with 7 named protocols wired into openclaw.json agent instructions for cron-driven monitoring and optimization workflows**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-26T01:46:15Z
- **Completed:** 2026-02-26T01:55:06Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created 4 agent skill files (560 lines total) with step-by-step protocols the agent follows autonomously
- All 7 protocol names match exactly what cron job messages reference (Daily Health Check, Weekly Optimization Report, Orphan Day Detection, Demand Spike Detection, Base Price Calibration Check, Recommendation Prioritization, Cancellation Fill Strategy)
- Wired instructions array into openclaw.json agent config preserving all existing configuration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 4 agent skill files** - `9b4a00f` (feat)
2. **Task 2: Add skills reference to openclaw.json** - `40f23a2` (feat)

## Files Created/Modified
- `openclaw/skills/domain-knowledge.md` - PriceLabs concepts, terminology, 28 MCP tools, rate budget, write safety (94 lines)
- `openclaw/skills/monitoring-protocols.md` - Daily Health Check Protocol with 7 steps, alert thresholds, stale sync handling, revenue impact assessment (117 lines)
- `openclaw/skills/analysis-playbook.md` - Weekly Optimization Report Protocol with 6 steps, KPI formulas, STLY comparisons, underperformance detection (123 lines)
- `openclaw/skills/optimization-playbook.md` - Orphan Day Detection, Demand Spike Detection, Base Price Calibration Check, Recommendation Prioritization, Cancellation Fill Strategy Protocol (226 lines)
- `openclaw/openclaw.json` - Added instructions array referencing all 4 skill files

## Decisions Made
- Used `instructions` field name (not `skills`) in openclaw.json -- more standard for agent system prompt configuration
- Protocol section titles use exact `## Protocol Name` format matching cron job message references so the agent can locate them when instructed
- Write safety is the most prominent section in domain-knowledge.md to reinforce the agent's core guardrail
- Included all 28 MCP tools in domain-knowledge.md organized by category (read, store, analysis, write, audit, config) so the agent knows its full toolkit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 skill files exist and are referenced in openclaw.json
- Ready for Plan 2 (Docker deployment validation) which will verify these files are accessible inside the container
- Cron jobs in jobs.json already reference the correct protocol names

## Self-Check: PASSED

All 6 files verified on disk. Both task commits (9b4a00f, 40f23a2) verified in git log.

---
*Phase: 09-openclaw-deployment*
*Completed: 2026-02-26*
