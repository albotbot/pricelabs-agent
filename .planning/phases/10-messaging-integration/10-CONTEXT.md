# Phase 10: Messaging Integration - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users interact with the agent through Slack and Telegram -- receiving summaries, asking questions, and approving pricing recommendations. Requirements: MSG-01 through MSG-05, SAFE-03. This phase validates that OpenClaw's existing Slack and Telegram integrations work correctly with the PriceLabs MCP server and agent skills built in prior phases.

Key constraint: Slack and Telegram are already configured and working in OpenClaw. The agent has already sent test messages. This phase validates and documents the integration, not builds it from scratch.

</domain>

<decisions>
## Implementation Decisions

### Slack & Telegram Setup
- Both channels are already configured in OpenClaw (openclaw.json has slack and telegram sections)
- Environment variables (SLACK_APP_TOKEN, SLACK_BOT_TOKEN, TELEGRAM_BOT_TOKEN) are already set in OpenClaw's env
- Agent has already sent test messages in both channels -- connectivity is proven
- No new channel configuration code is needed
- Message formatting looks fine as-is -- no custom formatting changes required

### Health Summary Content
- Validate current MCP server capabilities only: occupancy rates, revenue metrics, health scores, pricing data from PriceLabs API
- Health summaries use data from existing tools: pricelabs_get_listings, pricelabs_get_prices, pricelabs_get_neighborhood, pricelabs_get_reservations, pricelabs_get_snapshots
- No new data sources, scrapers, or external integrations in this phase
- Summary formatting is handled by the agent following skill protocols (monitoring-protocols.md Daily Health Check Protocol)

### Approval Interaction Design
- Reply-based text interaction: user types "approve" or "reject" in the thread where the agent presented a recommendation
- Works identically in both Slack and Telegram (text replies in thread/reply context)
- No buttons, reactions, or special UI -- plain text replies only
- Agent acknowledges the decision and confirms action (or confirms writes are disabled in current safety mode)

### Validation Approach
- Hybrid validation: automated script validates config + cron + format checks; manual checklist for live interaction tests
- 3 standard test questions per channel:
  1. "How is my portfolio doing?" (tests MSG-02/MSG-05 -- portfolio overview with live data)
  2. "What are my prices for [listing] next week?" (tests specific listing data retrieval)
  3. "Any recommendations?" (tests recommendation surfacing)
- Dry-run approval test: agent presents recommendation, user replies "approve", agent acknowledges but confirms writes are disabled (PRICELABS_WRITES_ENABLED=false) -- proves interaction flow works safely
- SAFE-03 (bug fixes during validation) checked at end-of-phase: if any bugs were found and fixed during testing, they count; if no bugs found, passes trivially

### Claude's Discretion
- Exact structure of the automated validation script (config checks, cron schedule parsing, message format validation)
- Manual testing checklist format and documentation approach
- How to capture evidence of manual tests (logs, screenshots, or self-reported results)
- Error handling patterns for edge cases in message delivery

</decisions>

<specifics>
## Specific Ideas

- Cron jobs already defined in openclaw/cron/jobs.json with correct protocol references -- validation should confirm these match skill file protocol names
- Daily health check: 8am CT (America/Chicago), both Slack and Telegram, 30s Telegram stagger
- Weekly optimization: Monday 10am CT, both channels, 30s stagger
- The agent's skill files (monitoring-protocols.md, analysis-playbook.md, optimization-playbook.md) define exact protocols the agent follows -- these should be the basis for what gets validated in messaging output
- OpenClaw handles all message routing -- the MCP server just provides data tools, the agent decides what to say

</specifics>

<deferred>
## Deferred Ideas

- **Apify web scraping integration** -- competitor pricing, local events, seasonal trends research via scrapers (user wants this for enhanced pricing intelligence)
- **Hospitable (PMS) Agent coordination** -- cross-agent data sharing where PMS agent provides booking/property data and PriceLabs agent provides pricing optimization
- **Advanced pricing intelligence** -- trend analysis, seasonality detection, competitor benchmarking, local event impact assessment using external data sources beyond PriceLabs API
- **Enhanced summary formatting** -- richer formatting with charts, graphs, or custom Slack blocks (current plain text formatting is fine for v1.1)

These represent the user's broader vision for the pricing agent ecosystem. Each would be its own phase or milestone in a future roadmap.

</deferred>

---

*Phase: 10-messaging-integration*
*Context gathered: 2026-02-26*
