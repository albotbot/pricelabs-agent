# Phase 1: MCP Server Foundation + Infrastructure Security - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A TypeScript MCP server wrapping all 12 PriceLabs Customer API endpoints as typed tools with Zod validation, rate limiting (1000 req/hr token bucket), configurable TTL caching, credential isolation, and OpenClaw Gateway security configuration. Plus a domain knowledge skill providing always-on PriceLabs optimization reference. No user-facing features yet — this is pure infrastructure that enables all downstream phases.

</domain>

<decisions>
## Implementation Decisions

### MCP Tool Granularity
- **Claude's Discretion:** Tool mapping strategy (1:1 vs consolidated vs workflow-grouped) — design the optimal tool surface based on API structure and agent workflow needs
- **Claude's Discretion:** Write tools should require a `reason` parameter for automatic audit trail logging — every pricing change must be traceable
- **Claude's Discretion:** Include a `get_api_status` tool exposing rate budget remaining, cache hit rates, and oldest cache entry — the agent needs self-awareness at 1000 req/hr

### Tool Output Design
- **Hybrid raw + computed fields:** Return raw PriceLabs JSON PLUS computed fields (e.g., `occupancy_gap_pct`, `revenue_vs_stly_pct`, `days_since_sync`). Agent gets both raw data for edge-case reasoning and ready-to-use metrics for common queries
- Every tool response must include `cache_age_seconds` and `data_source` ("live" or "cached") metadata

### Cache & Rate Limit Behavior
- **Rate limit hit → serve cached + inform:** When rate budget is low/exhausted, return cached data with a note: "Using cached data (X min old). Fresh data available in Y minutes." Never block the agent completely
- **Budget allocation → Claude's Discretion:** Priority-based recommended — reserve budget for critical workflows (daily health, write operations) first; interactive queries get remaining budget
- **Always show data freshness:** Every response to the user includes data age (e.g., "Data as of: 14 minutes ago" or "Live data (just fetched)")

### Error Handling & Agent Feedback
- **Error tone: Plain and direct.** Include what happened, why it likely happened, and suggest a concrete next step. Example: "I couldn't fetch pricing data for Mountain View Cabin. PriceLabs returned a 404 — the listing ID may be wrong. Want me to check your listings?"
- **API outage: Silent retry for 30 minutes, alert if prolonged.** Don't create noise for brief hiccups. If still down after 30 min, alert on both channels with estimated recovery
- **Always offer alternatives** when a request can't be fulfilled. Example: "I can't get hourly pricing data (API only provides daily). Want me to show daily pricing with demand signals instead?"
- **Auth/credential errors: Critical — immediate alert** on both Slack AND Telegram. Agent is non-functional without valid API key. Treat as P0 severity

### Domain Knowledge Skill
- **Framework + reasoning approach:** Domain skill provides the analytical framework (what to look at, what matters, what thresholds mean) but lets the agent reason about specifics for each listing/situation. Not rigid rules
- **All 4 knowledge domains included:**
  1. **Optimization playbook** — 12 strategies, weekly review loop, DO NOT list, ROI benchmarks. Structured as principles, not rigid rules
  2. **Algorithm internals** — HLP mechanics, demand colors (R/O/Y/G/B), health scores, customization hierarchy (Listing > Group > Account), stacking rules (largest discount wins, premiums stack)
  3. **Common mistakes** — 14 common host mistakes, warning signs, prevention strategies. Agent's defensive layer
  4. **API field reference** — What non-obvious fields mean (demand_color values, STLY calculation, health score thresholds, sync status interpretation). Lighter weight since MCP tools handle validation
- **Include portfolio-specific context:** Domain skill includes the user's market specifics, property types, and seasonal patterns. Populated during onboarding/first interaction
- **Agent persona: Adaptable** — matches the user's communication style. If user asks with industry jargon (RevPAR, ADR, STLY), respond in kind. If casual, respond casual. Default to professional but approachable

### Claude's Discretion
- MCP tool mapping strategy (1:1 vs consolidated — design optimal surface)
- Write tool interface design (require rationale parameter for audit)
- Self-awareness tool (`get_api_status`) design
- Rate budget allocation algorithm (priority-based recommended)
- Cache TTL values per endpoint
- Retry strategy specifics (exponential backoff, jitter)
- OpenClaw Gateway security configuration details (Docker sandbox, tool allowlists, loopback binding)
- Domain skill markdown structure and formatting

</decisions>

<specifics>
## Specific Ideas

- User wants "pricing perfection" — the domain knowledge should be comprehensive enough that the agent reasons like a top-tier revenue manager, not a generic assistant
- PriceLabs API rate limit is 1000 req/hr (not LLM rate limit) — the user initially confused these, so the agent should clearly distinguish between data freshness and model availability in error messages
- LLM fallback on model rate limits is an OpenClaw Gateway concern, not MCP server — noted but out of scope for this phase

</specifics>

<deferred>
## Deferred Ideas

- LLM rate limit handling / fallback to local models — OpenClaw Gateway configuration, not Phase 1 scope
- Portfolio-specific onboarding flow to populate domain skill context — will be addressed when monitoring skills are built (Phase 2)

</deferred>

---

*Phase: 01-mcp-server-foundation*
*Context gathered: 2026-02-22*
