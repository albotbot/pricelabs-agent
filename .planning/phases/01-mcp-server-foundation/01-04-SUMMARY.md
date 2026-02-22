---
phase: 01-mcp-server-foundation
plan: 04
subsystem: api-client
tags: [http-client, rate-limiting, retry, cache-fallback, graceful-degradation]
dependency_graph:
  requires: [01-01-rate-limiter, 01-02-schemas]
  provides: [api-client, fetch-with-fallback]
  affects: [all-tool-handlers]
tech_stack:
  added: []
  patterns: [exponential-backoff-with-jitter, cache-first-fallback, outage-tracking]
key_files:
  created:
    - mcp-servers/pricelabs/src/services/api-client.ts
    - mcp-servers/pricelabs/src/services/fetch-with-fallback.ts
  modified: []
decisions:
  - Retry-After header parsed as seconds (PriceLabs convention), fallback 60s default
  - Network errors treated as retryable (same as 5xx), max 3 retries
  - Outage alert metadata uses type assertion to extend ToolResponse meta with note and outage_alert fields
metrics:
  duration: 4min
  completed: 2026-02-22T20:50:00Z
---

# Phase 1 Plan 4: API Client + Fetch-with-Fallback Summary

HTTP client with rate limiting, retry logic, and cache-first degradation using token bucket + exponential backoff with jitter

## What Was Built

### PriceLabsApiClient (`api-client.ts`)

Production HTTP client for PriceLabs API. Every outbound call consults the `TokenBucketRateLimiter` before sending. Response handling:

- **429**: Retry with `Retry-After` header (or 60s default), max 3 attempts
- **401**: Immediate `AuthError` throw -- never retried (locked decision)
- **5xx**: Exponential backoff with jitter (`min(1000 * 2^attempt + random(0,1000), 30000)`), max 3 attempts
- **4xx (non-429)**: Immediate `ApiError` throw -- non-retryable client errors
- **204**: Returns `{ data: null, status: 204 }` for successful deletes
- **2xx**: Parses JSON, returns typed `ApiResponse<T>`

Convenience methods: `get<T>`, `post<T>`, `delete<T>`.

API key stored privately, never interpolated into error messages or logs. Error messages reference "API key" conceptually but never include the actual value.

### fetchWithFallback (`fetch-with-fallback.ts`)

Cache-aware wrapper implementing the locked decision: "Rate limit hit -> serve cached + inform. Never block the agent completely."

**Flow:**
1. Try live fetch via API client
2. On success: cache result, reset outage state, return with `data_source: "live"`
3. On `RateLimitError`: serve cached data with freshness note ("Using cached data (X min old). Fresh data available in ~Y minutes.")
4. On other errors: track outage duration
   - Under 30 min: serve cached silently (brief hiccup)
   - Over 30 min: serve cached with CRITICAL note and `outage_alert: true` flag for agent to relay to Slack/Telegram

Every response includes: `cache_age_seconds`, `data_source`, `api_calls_remaining`, `fetched_at`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `ea0aa4a` | feat(01-04): implement PriceLabs API client with rate limiting and retry |
| 2 | `6f33f2e` | feat(01-04): implement fetch-with-fallback for graceful degradation |

## Verification Results

- `npx tsc --noEmit`: PASSED (zero errors)
- `rateLimiter.tryConsume()` called before every outbound request: CONFIRMED
- `cache.get()` used as fallback in fetch-with-fallback: CONFIRMED (2 call sites)
- `throw new RateLimitError|AuthError|ApiError` all present: CONFIRMED
- API key never interpolated in error messages: CONFIRMED (grep found zero matches)
- `fetchWithFallback` returns `ToolResponse<T>` with all required meta fields: CONFIRMED

## Deviations from Plan

None -- plan executed exactly as written.

## Must-Have Truths Verification

| Truth | Status |
|-------|--------|
| API client sends X-API-Key header on every request | VERIFIED - headers built in constructor |
| API client consults rate limiter before every outbound call | VERIFIED - tryConsume() at top of request() |
| API client retries 429/5xx with exponential backoff and jitter | VERIFIED - handleResponse + calculateBackoff |
| API client never retries 401 | VERIFIED - immediate AuthError throw |
| Fetch-with-fallback serves cached data when rate limited or API fails | VERIFIED - two fallback paths |
| API key never appears in logs or error messages | VERIFIED - grep confirmed |

## Self-Check: PASSED

All 2 created files exist. All 2 commit hashes verified in git log.
