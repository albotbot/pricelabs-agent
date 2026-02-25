# Phase 8: Snapshot Persistence - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Store real portfolio data (listings, prices, reservations, neighborhood) through MCP store tools into SQLite. Verify all data reads back correctly with matching values. Confirm pre-write snapshot capture works for future write safety. Does NOT enable writes or modify pricing data.

</domain>

<decisions>
## Implementation Decisions

### Validation approach
- Automated script (`validate-persistence.mjs`) following established project pattern (validate-boot.mjs, validate-api.mjs)
- Spawn MCP server via stdio JSON-RPC, exercise all store tools, verify results, report PASS/FAIL
- Shell wrapper (`validate-persistence.sh`) with same `set -euo pipefail` pattern as other scripts
- Requires `PRICELABS_API_KEY` env var — same pattern as Phase 7 validation
- Human checkpoint to run the script with real API key, same as Phases 6-7

### Data sourcing
- Live API calls to fetch fresh data, then store into SQLite — proves full end-to-end pipeline
- ~5 API calls (get_listings, get_prices, get_neighborhood, get_reservations, get_api_status) — well within 1000/hr budget
- Store operations are local SQLite writes, no additional API consumption
- Do NOT replay saved/cached data — the goal is proving the real flow works
- Validation flow: fetch via read tools → store via store tools → query back via SQLite → compare values

### Cancellation detection (STORE-03)
- First pass: store real reservations from API (whatever the current state is)
- Second pass: simulate cancellation by storing a modified batch with one reservation removed
- The upsert logic should detect the missing reservation and populate `cancelled_on` timestamp
- This is a controlled test — we can't depend on actual cancellations occurring in live data
- Verify: query reservations table, confirm `cancelled_on IS NOT NULL` for the simulated cancellation

### Pre-write snapshot (SAFE-02)
- Call the pre-write snapshot tool directly — it's a read+store operation independent of writes
- Writes do NOT need to be enabled for this test
- Verify audit_log has a row with `action_type = 'snapshot'` after the call
- Verify the JSON payload in audit_log is queryable and contains the captured listing state
- This proves the safety mechanism is wired and ready for when writes are eventually enabled

### Claude's Discretion
- Script structure and check numbering (STORE-01 through STORE-04, SAFE-02)
- SQLite query patterns for verification (direct SQL vs tool-based queries)
- Error handling and cleanup (delete test database between runs vs reuse)
- Level of detail in diagnostic output (match Phase 7 verbosity)

</decisions>

<specifics>
## Specific Ideas

- Follow the exact same validation script pattern as Phase 7 — user is comfortable with `bash scripts/validate-persistence.sh` workflow
- Each requirement (STORE-01 through STORE-04, SAFE-02) should be a clearly labeled section in the script output
- Cancellation simulation is the most complex test — make sure it's well-documented in output so user understands what happened
- Phase 7 proved all read tools work; Phase 8 should leverage that by fetching real data and immediately storing it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-snapshot-persistence*
*Context gathered: 2026-02-25*
