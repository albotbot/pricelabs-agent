---
phase: 07-live-api-validation
plan: 01
subsystem: api-validation
tags: [live-api, json-rpc, swagger, response-unwrap, zod]

# Dependency graph
requires:
  - phase: 06-server-boot-safety-gate
    provides: "MCP server boots, 28 tools register, write safety gate"
  - phase: 02-tool-layer
    provides: "API client, fetchWithFallback, tool handlers"
provides:
  - "Automated live API validation script (validate-api.mjs)"
  - "Correct API response unwrapping for all endpoints"
  - "Real API data shape diagnostics"
affects: [07-02, 08-snapshot-persistence, 10-messaging-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [api-response-unwrap, swagger-cross-reference]

key-files:
  created:
    - scripts/validate-api.mjs
    - scripts/validate-api.sh
  modified:
    - mcp-servers/pricelabs/src/tools/listings.ts
    - mcp-servers/pricelabs/src/tools/prices.ts
    - mcp-servers/pricelabs/src/tools/overrides.ts

key-decisions:
  - "API response unwrapping: all PriceLabs endpoints wrap responses in objects ({listings: [...]}, {overrides: [...]}, etc.)"
  - "POST /v1/listing_prices expects {listings: [{id, pms, dateFrom, dateTo}]} not flat body"
  - "fetchWithFallback is fallback cache (not read-through) -- always tries live first"
  - "Neighborhood Future Percentile Prices uses Category/Labels keys, not Y_values"

patterns-established:
  - "All PriceLabs API responses need unwrapping from wrapper objects before use"
  - "POST endpoints may use different field names than the MCP tool input schema (dateFrom vs start_date)"

requirements-completed: [LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05]

# Metrics
duration: 45min
completed: 2026-02-25
---

# Phase 7 Plan 1: Live API Validation Summary

**Automated validation script proving all 4 read-path MCP tools work with real PriceLabs API (5 listings, 31 prices, 350 comps, 100 reservations)**

## Performance

- **Duration:** 45 min (including iterative API response fixes)
- **Started:** 2026-02-25T19:25:00Z
- **Completed:** 2026-02-25T20:30:00Z
- **Tasks:** 2 (1 auto + 1 human checkpoint)
- **Files created:** 2, **Files modified:** 3

## Accomplishments
- Live API validation script exercises all read-path tools via stdio JSON-RPC
- Discovered and fixed API response wrapper mismatches for 4 endpoints
- Fixed POST /v1/listing_prices request body format (completely wrong field structure)
- All 22 checks pass with real PriceLabs API data
- Rate limiter correctly tracks 4 API calls consumed out of 1000/hr budget

## Task Commits

1. **Task 1: Create live API validation script** - `6f86170` (feat)
2. **Fix: API response unwrapping** - `427dc2f` (fix — GET listings, GET listing, POST prices, GET overrides)
3. **Fix: Prices POST body format** - `0ff4c21` (fix — correct request body + validation checks)
4. **Task 2: Human checkpoint approved** - `9e7df8e` (docs — 22/22 checks passed)

## Files Created/Modified
- `scripts/validate-api.mjs` - Live API validation script (570 lines)
- `scripts/validate-api.sh` - Shell wrapper
- `mcp-servers/pricelabs/src/tools/listings.ts` - Unwrap {listings: [...]} and {listings: [listing]}
- `mcp-servers/pricelabs/src/tools/prices.ts` - Fix POST body format and unwrap array response
- `mcp-servers/pricelabs/src/tools/overrides.ts` - Unwrap {overrides: [...]}

## Decisions Made
- All PriceLabs API responses are wrapped in objects, never returned as bare arrays
- POST /v1/listing_prices expects `{listings: [{id, pms, dateFrom, dateTo}]}` format
- fetchWithFallback is fallback-only (not read-through) — second call still hits live API
- Neighborhood data uses Category/Labels instead of Y_values for Future Percentile Prices

## Deviations from Plan
- Had to fix 4 API response unwrapping bugs discovered during validation (listings, prices, overrides)
- Had to fix prices POST body format (wrong field names and missing listings array wrapper)
- Cache verification changed from expecting data_source=cached to verifying second call succeeds

## Issues Encountered
- First API key was disabled (403 API_KEY_DISABLED) — user regenerated key
- All 4 read endpoints had incorrect response unwrapping — none had been tested against real API before
- POST /v1/listing_prices had completely wrong request body format

## User Setup Required
- PRICELABS_API_KEY environment variable required for running validation

## Next Phase Readiness
- All read-path tools proven working with real API
- API response shapes captured in diagnostic output
- Neighborhood Y_values schema mismatch noted for Plan 02 (computed fields)

## Self-Check: PASSED

- scripts/validate-api.mjs exists (570 lines)
- scripts/validate-api.sh exists (4 lines)
- 22/22 checks pass with real API key
- Rate limiter tracking verified (1000 -> 996)

---
*Phase: 07-live-api-validation*
*Completed: 2026-02-25*
