---
phase: 05-scale-feedback-loop
plan: 01
subsystem: database
tags: [sqlite, migrations, prepared-statements, change-tracking, user-config, generated-columns]

# Dependency graph
requires:
  - phase: 02-monitoring-persistence-interactive-delivery
    provides: "SQLite database layer, migration framework, query module factory pattern"
provides:
  - "change_tracking table (migration 6) for revenue impact follow-ups"
  - "user_config table (migration 7) with per-listing override support"
  - "createChangeTrackingQueries factory with 4 prepared statements"
  - "createUserConfigQueries factory with 5 prepared statements"
affects: [05-02, 05-03, scale-feedback-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "COALESCE generated stored columns for NULL-safe UNIQUE constraints"
    - "CASE-based interval dispatch in markCheckDone UPDATE"
    - "LEFT JOIN merge pattern for global + per-listing config overlay"

key-files:
  created:
    - "mcp-servers/pricelabs/src/db/queries/change-tracking.ts"
    - "mcp-servers/pricelabs/src/db/queries/user-config.ts"
  modified:
    - "mcp-servers/pricelabs/src/db/migrations.ts"

key-decisions:
  - "Generated stored columns (listing_id_key, pms_key) with COALESCE sentinel for NULL-safe UNIQUE constraints in user_config"
  - "CASE-expression-based interval dispatch for markCheckDone to update correct 7/14/30d check in single statement"

patterns-established:
  - "Generated stored column pattern: COALESCE(nullable_col, sentinel) for UNIQUE constraints involving NULLs"
  - "Multi-interval check pattern: composite index on done flags for efficient pending check queries"

# Metrics
duration: 5min
completed: 2026-02-25
---

# Phase 5 Plan 1: DB Schema for Change Tracking and User Config Summary

**SQLite change_tracking and user_config tables with migration v6/v7, plus typed query modules (4+5 prepared statements) following Phase 2 factory pattern**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T00:26:55Z
- **Completed:** 2026-02-25T00:32:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added migration 6 (change_tracking) with columns for audit_log linkage, change metadata, affected date range, before/after JSON, and three check intervals (7d/14d/30d) each with due date, done flag, and result JSON
- Added migration 7 (user_config) with COALESCE-based generated stored columns (listing_id_key, pms_key) mapping NULL to '__global__' sentinel, enabling UNIQUE(config_key, listing_id_key, pms_key) for global vs per-listing scoping
- Created change-tracking query module with insertTracking, getPendingChecks, markCheckDone (CASE-based interval dispatch), getByListing
- Created user-config query module with getConfigValue (per-listing fallback to global), getAllForListing (LEFT JOIN merge), getAllGlobal, upsertConfig (ON CONFLICT with generated columns), deleteListingOverride

## Task Commits

Each task was committed atomically:

1. **Task 1: Add migrations 6 and 7** - `cfb33f0` (feat)
2. **Task 2: Create change-tracking and user-config query modules** - `0bf1fdf` (feat)

## Files Created/Modified
- `mcp-servers/pricelabs/src/db/migrations.ts` - Added migration 6 (change_tracking) and 7 (user_config) with indexes and generated stored columns
- `mcp-servers/pricelabs/src/db/queries/change-tracking.ts` - Factory function returning 4 prepared statements for revenue impact tracking CRUD
- `mcp-servers/pricelabs/src/db/queries/user-config.ts` - Factory function returning 5 prepared statements for configurable thresholds with per-listing overrides

## Decisions Made
- Generated stored columns with COALESCE sentinel: SQLite treats NULL as distinct for UNIQUE purposes, so listing_id_key and pms_key map NULL to '__global__' to correctly prevent duplicate global entries for the same config_key
- CASE-expression dispatch in markCheckDone: Single UPDATE statement handles all three intervals (7/14/30) via @interval parameter, avoiding three separate prepared statements

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- change_tracking and user_config persistence layers ready for Phase 5 Plan 2 (revenue impact tracking service) and Plan 3 (configurable alert thresholds)
- Both query modules export factory functions consumable by the existing service initialization pattern
- Migrations integrate seamlessly with existing runMigrations loop (picked up by version > currentVersion filter)

## Self-Check: PASSED

All created files verified on disk. All commit hashes found in git log.

---
*Phase: 05-scale-feedback-loop*
*Completed: 2026-02-25*
