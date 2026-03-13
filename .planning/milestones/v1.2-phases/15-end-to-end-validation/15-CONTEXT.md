# Phase 15: End-to-End Validation - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Full system verification: routing matrix, cron delivery, main agent regression, and workspace separation confirmation. This is the acceptance testing phase for the entire v1.2 milestone. No new functionality is built — only verification that everything from Phases 11-14 works correctly together.

</domain>

<decisions>
## Implementation Decisions

### Test Coverage Depth
- Full routing matrix: test every channel/agent combo (Telegram Prism, Telegram AlBot, Slack Prism, Slack AlBot)
- Each path tested with both domain-specific questions ("show my listings") and generic questions ("hello")
- Pass criteria: correct persona AND real data — proves both routing and tool access work
- Cross-talk tested in both directions:
  - Ask AlBot "show my listings" → verify he does NOT use PriceLabs tools
  - Ask Prism a generic question → verify natural redirect to portfolio topics
- Cron delivery re-verified: manually trigger daily health cron to confirm it still delivers to #pricelabs after all changes

### Main Agent Regression Scope
- Verify: AlBot responds on Telegram, AlBot responds on Slack, existing AlBot cron jobs still registered, basic conversation works
- AlBot cron jobs: check registration only (`openclaw cron list`) — do NOT trigger them manually (avoids noise in his channels)
- Skills, memory, and advanced features: NOT explicitly tested (too broad, not impacted by v1.2 changes)

### Workspace Cleanup Approach
- **Do NOT remove PriceLabs skills from AlBot's workspace** — user decision to leave them in place
- E2E-04 requirement adjusted: verify separation without removal, not "skills removed"
- Verification instead of cleanup:
  - Confirm Prism's workspace has all needed files and skills independently (not sharing AlBot's)
  - Confirm agents don't share sessions, memory, or sandbox (complete isolation)
  - Check workspace paths, agent dirs, session keys, and sandbox scopes are separate

### Claude's Discretion
- Exact test message wording for each routing path
- Order of test execution (routing first vs cron first vs regression first)
- How to verify session/state isolation (CLI commands vs config inspection)
- Whether to restart gateway before final validation (fresh state)

</decisions>

<specifics>
## Specific Ideas

- This is the milestone sign-off — everything must be verified before v1.2 can be considered complete
- The routing matrix was already partially tested in Phase 13, but this is the comprehensive final pass with all components in place
- AlBot's PriceLabs skills staying in his workspace means "separation" is achieved by routing and workspace independence, not by removal

</specifics>

<deferred>
## Deferred Ideas

- AlBot PriceLabs skill removal — user chose to keep them. Can revisit in a future cleanup phase if they cause confusion.
- AlBot advanced feature regression — skills, memory, workshop features not tested. Out of scope for v1.2 validation.

</deferred>

---

*Phase: 15-end-to-end-validation*
*Context gathered: 2026-02-28*
