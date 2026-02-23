---
phase: 04-write-operations-approval-workflow
plan: 02
subsystem: skills
tags: [optimization, orphan-days, demand-spikes, base-price, approval-flow, rollback, dso, safety]

# Dependency graph
requires:
  - phase: 01-foundation-mcp-server
    provides: "MCP write tools (set_overrides, update_listings, delete_overrides), read tools (get_prices, get_overrides, get_neighborhood, get_listing), audit tools (log_action, get_audit_log)"
  - phase: 02-monitoring-persistence-delivery
    provides: "Monitoring skill with basic approval flow (Section 6), audit log infrastructure, snapshot storage"
  - phase: 03-analysis-layer-smart-alerting
    provides: "Analysis skill with underperformance detection, competitive positioning, demand calendar rendering"
provides:
  - "7-section optimization skill covering orphan day detection, demand spike detection, base price calibration, write safety, approval flow, recommendation prioritization, and rollback"
  - "Agent protocol for mandatory snapshot-before-write on all pricing changes"
  - "Recommendation prioritization framework limiting approval fatigue to 5 per scan"
  - "Structured audit logging conventions for recommendation, approval, execution, snapshot, and rollback action types"
affects: [04-01, 04-03, 05-deployment-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skill-as-playbook for optimization detection protocols"
    - "Mandatory snapshot-before-write safety gate"
    - "Structured details_json conventions for audit trail before/after values"
    - "Priority-based recommendation batching (HIGH/MEDIUM/LOW)"

key-files:
  created:
    - skills/pricelabs-optimization/SKILL.md
  modified: []

key-decisions:
  - "Reply-based approval (not buttons) -- cross-channel compatible, works in Slack and Telegram without custom UI"
  - "Percentage DSOs preferred over fixed-price for demand spikes -- works WITH algorithm rather than overriding it"
  - "30-day hard interval between base price changes to prevent panic pricing"
  - "Max 5 recommendations per scan with 48-hour expiry to prevent approval fatigue"
  - "30-minute snapshot freshness threshold -- re-capture before execution if stale"

patterns-established:
  - "Detection protocol pattern: fetch data, scan for signals, diagnose cause, formulate recommendation with specific numbers"
  - "Approval lifecycle: snapshot -> recommend -> log -> wait -> approve/reject -> execute -> verify -> log"
  - "Priority classification: HIGH (imminent revenue loss), MEDIUM (revenue upside), LOW (monthly calibration)"

# Metrics
duration: 9min
completed: 2026-02-23
---

# Phase 4 Plan 2: Optimization Skill Summary

**7-section pricing optimization skill covering orphan day detection, demand spike pricing, base price calibration, mandatory snapshot-before-write safety, structured approval flow with audit logging, recommendation prioritization (max 5 per scan), and rollback via audit log snapshots**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-23T17:34:46Z
- **Completed:** 2026-02-23T17:44:37Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments

- Created comprehensive optimization skill (383 lines) with 7 numbered sections covering all planned detection protocols, safety rules, and approval workflow
- All 3 detection protocols (orphan days, demand spikes, base price calibration) include specific thresholds, step-by-step instructions, guard rails for common pitfalls, and recommendation formatting templates
- Write safety protocol mandates `pricelabs_snapshot_before_write` before every write with explicit "NEVER" language and no-exceptions rules
- Approval flow covers full lifecycle from snapshot through execution to sync timing caveat, with structured `details_json` conventions for audit trail at every stage
- Recommendation prioritization caps at 5 per scan with HIGH/MEDIUM/LOW priority and 48-hour expiry to prevent approval fatigue
- Rollback protocol uses audit log snapshots with re-fetch before restore to prevent overwriting manual changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pricelabs-optimization skill directory and SKILL.md** - `5c80167` (feat)

## Files Created/Modified

- `skills/pricelabs-optimization/SKILL.md` - 7-section optimization skill with detection protocols, safety rules, approval flow, prioritization, and rollback procedures (383 lines)

## Decisions Made

- **Reply-based approval over buttons:** Cross-channel compatible. Works in Slack and Telegram without custom interactive UI. Aligns with existing monitoring skill Section 6 pattern.
- **Percentage DSOs for demand spikes:** Fixed-price DSOs override the algorithm entirely. Percentage DSOs layer on top of algorithm pricing, preserving its market-responsive behavior. Safer and more adaptive.
- **30-day hard interval for base price changes:** Prevents panic pricing spiral. Checked via audit log query, not in-memory state. Survives restarts.
- **Max 5 recommendations per scan:** Research Pitfall 4 identified approval fatigue as a real risk. Capping at 5 with priority ordering ensures the most impactful opportunities are presented first.
- **30-minute snapshot freshness:** Research Pitfall 6 identified stale snapshots as a rollback risk. Re-snapshotting before execution prevents restoring to outdated values.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Optimization skill is ready for agent use via OpenClaw always-on loading
- Phase 4 Plan 01 (snapshot tool) provides the `pricelabs_snapshot_before_write` MCP tool referenced throughout this skill
- Phase 4 Plan 03 (cron enhancement) will add the weekly optimization scan that triggers these detection protocols
- All 9 MCP tools referenced in the skill already exist from Phases 1-2

## Self-Check: PASSED

- [x] `skills/pricelabs-optimization/SKILL.md` exists (383 lines)
- [x] Commit `5c80167` exists in git log
- [x] `04-02-SUMMARY.md` exists

---
*Phase: 04-write-operations-approval-workflow*
*Completed: 2026-02-23*
