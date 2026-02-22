---
phase: 01-mcp-server-foundation
plan: 05
subsystem: listing-tools
tags: [mcp-tools, listings, cache, computed-fields, audit-trail, destructive-write]
dependency_graph:
  requires: [01-01-rate-limiter, 01-02-schemas, 01-04-api-client]
  provides: [registerListingTools, pricelabs_get_listings, pricelabs_get_listing, pricelabs_update_listings]
  affects: [future-tool-index, server-initialization]
tech_stack:
  added: []
  patterns: [registerTool-with-annotations, cache-key-convention, write-cache-invalidation, audit-trail-via-reason-param]
key_files:
  created:
    - mcp-servers/pricelabs/src/tools/listings.ts
  modified: []
decisions:
  - Used registerTool API (not deprecated server.tool) with annotations config object for readOnlyHint/destructiveHint
  - Cache key convention: listings:all:{params_json} for collection, listing:{id}:{pms} for single
  - Write tool invalidates both cache prefixes (listings: and listing:) after success
  - Separate error formatters for read vs write operations (write never suggests cached data)
metrics:
  duration: 8min
  completed: 2026-02-22T21:06:00Z
---

# Phase 1 Plan 5: Listing Tools Summary

Three listing MCP tools with 60-min read cache, computed field enrichment, and destructive write requiring audit reason

## What Was Built

### Read Tools (`pricelabs_get_listings`, `pricelabs_get_listing`)

Both tools use `fetchWithFallback` for cache-first degradation with 60-minute TTL (3,600,000ms).

**pricelabs_get_listings** fetches all listings with optional `skip_hidden` and `only_syncing` query params. Computes per-listing fields via `computeListingFields`:
- `occupancy_gap_pct` -- gap between listing and market occupancy
- `revenue_vs_stly_pct` -- revenue compared to same time last year
- `days_since_sync` -- time since last PMS sync push

Returns computed fields in `computed.listings_computed` array (one entry per listing).

**pricelabs_get_listing** fetches a single listing by ID and PMS. Returns the same computed fields for the individual listing.

Both tools annotated with `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: true`.

### Write Tool (`pricelabs_update_listings`)

Destructive tool for updating base/min/max prices or tags. Key design decisions:

- **Reason parameter**: Required, minimum 10 characters. Included in the response `computed.reason` field for audit trail visibility. The MCP schema enforces the constraint via Zod `z.string().min(10)`.
- **No cache fallback**: Writes bypass `fetchWithFallback` entirely. If the API is down or rate limited, the error propagates directly -- stale data is never used to confirm a write.
- **Cache invalidation**: After successful write, invalidates all keys matching `listings:` and `listing:` prefixes. This ensures subsequent reads fetch fresh data.
- **Annotations**: `readOnlyHint: false`, `destructiveHint: true`, `openWorldHint: true`.

### Error Handling

Two separate error formatters:

- **Read errors** (`formatErrorResponse`): Rate limit with retry estimate, auth critical alert, API error with listing/PMS check suggestion.
- **Write errors** (`formatWriteErrorResponse`): Emphasizes that no cached data is used for writes. Auth errors marked CRITICAL. All write errors confirm "update was not applied" to avoid ambiguity.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `15232e5` | feat(01-05): register read-only listing tools (get_listings, get_listing) |
| 2 | `37620fe` | feat(01-05): register update_listings tool with audit trail and cache invalidation |

## Verification Results

- `npx tsc --noEmit`: PASSED (zero errors)
- `registerListingTools` exported: CONFIRMED
- 3 tools registered via `server.registerTool()`: CONFIRMED
- Read tools use `fetchWithFallback` with 60-min cache: CONFIRMED (2 call sites)
- Write tool requires `reason` parameter: CONFIRMED (via UpdateListingsInputSchema with z.string().min(10))
- Cache invalidation after write: CONFIRMED (`cache.invalidate("listings:")` and `cache.invalidate("listing:")`)
- All responses include `cache_age_seconds` and `data_source`: CONFIRMED (read via ToolResponse from fetchWithFallback, write via explicit meta)

## Deviations from Plan

None -- plan executed exactly as written.

## Must-Have Truths Verification

| Truth | Status |
|-------|--------|
| pricelabs_get_listings fetches all listings with health, occupancy, and revenue data | VERIFIED - fetches /v1/listings with computed fields |
| pricelabs_get_listing fetches a single listing by ID and PMS | VERIFIED - fetches /v1/listings/{id}?pms={pms} |
| pricelabs_update_listings requires a reason parameter (min 10 chars) for audit trail | VERIFIED - UpdateListingsInputSchema enforces z.string().min(10) |
| All listing tools return hybrid raw + computed fields | VERIFIED - computeListingFields computes occupancy_gap_pct, revenue_vs_stly_pct, days_since_sync |
| Update tool annotated as destructive; read tools annotated as readOnly | VERIFIED - destructiveHint: true/false set correctly |

## Self-Check: PASSED

All 1 created file exists. All 2 commit hashes verified in git log.
