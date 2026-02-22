---
phase: 01-mcp-server-foundation
plan: 07
subsystem: remaining-tools
tags: [neighborhood, reservations, rate-plans, price-push, add-listing, status, self-awareness]
dependency_graph:
  requires: [01-01-rate-limiter, 01-02-schemas, 01-04-api-client]
  provides: [neighborhood-tool, reservation-tool, rate-plan-tool, sync-tools, status-tool]
  affects: [server-wiring, phase-2-pace-tracking, phase-3-competitive-positioning]
tech_stack:
  added: []
  patterns: [registerTool-api, module-level-timestamp, z-literal-constraint]
key_files:
  created:
    - mcp-servers/pricelabs/src/tools/neighborhood.ts
    - mcp-servers/pricelabs/src/tools/reservations.ts
    - mcp-servers/pricelabs/src/tools/rate-plans.ts
    - mcp-servers/pricelabs/src/tools/sync.ts
    - mcp-servers/pricelabs/src/tools/status.ts
  modified: []
decisions:
  - Status tool captures serverStartTime at module level for uptime calculation
  - add_listing uses z.literal("bookingsync") to enforce PMS restriction at schema level
  - Neighborhood computed fields skip when listing not cached (avoids extra API call)
  - push_prices sends listing field as single string per API spec (not array)
metrics:
  duration: 11min
  completed: 2026-02-22T21:09:00Z
---

# Phase 1 Plan 7: Remaining Tools (Neighborhood, Reservations, Rate Plans, Sync, Status) Summary

Six tools registered across five files: neighborhood percentile data, reservation booking data, rate plan configs, price push, add listing, and self-awareness status endpoint

## What Was Built

### Neighborhood Tool (`neighborhood.ts`)

**pricelabs_get_neighborhood** -- Fetches market percentile data (ADR, occupancy, revenue at 25th/50th/75th/90th) for competitive positioning.

- Cache TTL: 24 hours (market data updates daily)
- Computed field: `price_percentile_position` -- where listing base_price falls relative to market percentiles
- Computed field requires listing data from cache; skips if not cached (avoids burning a rate token just for computed fields)
- Uses `fetchWithFallback` for cache-first degradation

### Reservation Tool (`reservations.ts`)

**pricelabs_get_reservations** -- Fetches reservation data including guest info, dates, revenue, source, and booking timestamps.

- Cache TTL: 60 minutes (bookings can arrive anytime)
- No computed fields (pace tracking is Phase 2)
- Supports pagination via `limit` and `offset` parameters
- Uses `fetchWithFallback` for cache-first degradation

### Rate Plan Tool (`rate-plans.ts`)

**pricelabs_get_rate_plans** -- Fetches available rate plan configurations for a listing.

- Cache TTL: 6 hours (rate plan changes are rare)
- Uses `pms_name` (not `pms`) in query string per PriceLabs API spec
- Uses `fetchWithFallback` for cache-first degradation

### Sync Tools (`sync.ts`)

**pricelabs_push_prices** -- Triggers price recalculation and push to connected OTAs.
- Destructive: annotated with `destructiveHint: true`
- Requires `reason` parameter (min 10 chars) for audit trail
- Sends single listing per call per API spec
- No cache (action, not retrieval)

**pricelabs_add_listing** -- Adds a new listing to PriceLabs (BookingSync PMS only).
- Destructive: annotated with `destructiveHint: true`
- PMS restricted via `z.literal("bookingsync")` -- schema-level enforcement
- Requires `reason` parameter (min 10 chars) for audit trail
- Invalidates listings cache on success
- No `fetchWithFallback` -- writes go directly to live API

### Status Tool (`status.ts`)

**pricelabs_get_api_status** -- Self-awareness tool for the agent to check internal health before expensive operations.

- Reports: rate limit remaining/max/utilization, cache entries/hit-rate/oldest-age, server uptime/version
- Zero API calls consumed -- reads only internal state from `rateLimiter.getStatus()` and `cache.getStats()`
- `serverStartTime` captured at module level for uptime calculation
- Different function signature: `(server, rateLimiter, cache)` -- no apiClient needed

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `1c3f161` | feat(01-07): register neighborhood, reservation, and rate plan read tools |
| 2 | `d9edffc` | feat(01-07): register sync tools and API status self-awareness tool |

## Verification Results

- `npx tsc --noEmit`: PASSED (zero errors)
- 6 tools registered across 5 files: get_neighborhood, get_reservations, get_rate_plans, push_prices, add_listing, get_api_status -- CONFIRMED
- Write tools (push_prices, add_listing) require reason parameter -- CONFIRMED
- get_api_status reads internal state without API calls -- CONFIRMED (uses rateLimiter.getStatus() and cache.getStats() only)
- Cache TTLs: neighborhood 24hr, reservations 60min, rate plans 6hr -- CONFIRMED
- All read tools use fetchWithFallback -- CONFIRMED
- Write tools bypass cache and go directly to live API -- CONFIRMED

## Deviations from Plan

None -- plan executed exactly as written.

## Must-Have Truths Verification

| Truth | Status |
|-------|--------|
| pricelabs_get_neighborhood returns market percentile data with competitive positioning | VERIFIED - price_percentile_position computed field |
| pricelabs_get_reservations returns booking data for pace tracking | VERIFIED - fetches reservation_data with pagination |
| pricelabs_get_rate_plans returns available rate plan configurations | VERIFIED - fetches from /v1/fetch_rate_plans |
| pricelabs_push_prices triggers a price sync and requires reason for audit | VERIFIED - reason param via PushPricesInputSchema |
| pricelabs_add_listing adds a new listing and requires reason for audit | VERIFIED - reason param with min 10 chars |
| pricelabs_get_api_status exposes rate budget, cache stats, and system health | VERIFIED - three sections in status response |

## Self-Check: PASSED

All 5 created files exist. All 2 commit hashes verified in git log.
