# Phase 7: Live API Validation - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove every read-path MCP tool successfully calls the real PriceLabs API and returns correctly shaped data. Also produce a Swagger API coverage report to identify which endpoints we're NOT using. If significant gaps are found, analyze whether to expand Phase 7 or defer to a new phase.

Write tools are NOT tested for real API calls here (writes are disabled via SAFE-01). This phase is read-only validation.

</domain>

<decisions>
## Implementation Decisions

### Validation Approach
- Build an automated script (`validate-api.mjs`) following the same pattern as `validate-boot.mjs`
- Script auto-discovers a real listing ID and PMS name from `pricelabs_get_listings` response (no hardcoded values)
- Test all existing MCP read tools against real API
- Produce a Swagger API coverage report — compare endpoints in https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3 against implemented MCP tools
- After coverage report: analyze whether missing endpoints should be added in Phase 7 or deferred to a new phase (decision point, not automatic expansion)
- Script communicates with MCP server via stdio JSON-RPC (same as validate-boot.mjs)

### Data Shape Handling
- When a mismatch is found: log it as WARN and continue (don't fail the whole run)
- Keep Zod schemas strict — accept only documented types, fix specifically when real data breaks them
- Fixes happen IN Phase 7 (discover + fix in same phase, not deferred)
- Cross-reference Swagger API docs against real API responses — report where they differ
- Real API response is the ultimate source of truth for schema updates

### API Key & Auth Setup
- Real API key provided via `PRICELABS_API_KEY` environment variable (standard MCP pattern)
- Script fails fast with clear message if key is missing: "Set PRICELABS_API_KEY to run API validation"
- Key never stored in code or committed to git

### Rate Limiting & Caching
- Conservative API budget: ~20 calls total per validation run
- Cache verification via timing comparison: call same tool twice, second should be significantly faster
- Check `pricelabs_get_api_status` before and after test run to verify rate limit tracking works
- 1000 req/hr PriceLabs limit — validation uses ~2% of budget

### Claude's Discretion
- Exact structure of the coverage report
- Which specific fields to validate per tool response
- Error message formatting and reporting detail level
- Whether to use shell wrapper script like validate-boot.sh

</decisions>

<specifics>
## Specific Ideas

- User shared Swagger API docs at https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3 — use as reference for coverage analysis
- User's PMS is "smartbnb" and listing IDs are UUID-style — but script should auto-detect, not hardcode
- Already found real data surprises: occupancy as "43 %" strings, revenue as "Fully Blocked", demand_color as 9-char ARGB hex — expect more
- User is not a developer — validation output should be clear and readable, not developer-focused

</specifics>

<deferred>
## Deferred Ideas

- Add MCP tools for missing PriceLabs API endpoints — future phase after coverage analysis
- Full stress test of rate limiter (100+ calls) — not needed for validation, could be done if performance concerns arise

</deferred>

---

*Phase: 07-live-api-validation*
*Context gathered: 2026-02-25*
