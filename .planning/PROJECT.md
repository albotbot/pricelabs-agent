# PriceLabs Agent

## What This Is

An AI-powered revenue management agent that runs on OpenClaw, connecting to PriceLabs' API to autonomously monitor short-term rental portfolios, provide interactive analytics via messaging, and optimize pricing with human-in-the-loop approval. Accessible through Slack and Telegram, it acts as a 24/7 revenue manager for STR hosts and property managers.

## Core Value

The agent must reliably monitor portfolio health and surface actionable pricing recommendations via messaging — never making a pricing change without explicit owner approval.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Agent connects to PriceLabs Customer API and fetches all listing data
- [ ] Agent sends daily portfolio health summaries via Slack and Telegram
- [ ] Agent detects underperforming listings and alerts with specific recommendations
- [ ] User can ask natural language questions about their portfolio and get live data
- [ ] Agent recommends base price adjustments based on neighborhood data analysis
- [ ] Agent recommends date-specific overrides for detected events/demand spikes
- [ ] Agent manages orphan day detection and suggests fill strategies
- [ ] All pricing change recommendations require explicit user approval before execution
- [ ] Agent executes approved changes via PriceLabs API (base price, DSOs, min-stay)
- [ ] Agent tracks booking pace vs STLY and alerts on significant deviations
- [ ] Agent provides weekly optimization reports with RevPAR/ADR/occupancy trends
- [ ] Agent runs as OpenClaw skill(s) with MCP integration for PriceLabs API
- [ ] Multi-user support for scaling to other hosts/PMs

### Out of Scope

- Building a web dashboard UI — OpenClaw messaging is the interface
- Mobile app — messaging platforms handle mobile access
- Direct OTA integrations (Airbnb/Vrbo) — PriceLabs handles the channel connections
- Payment processing or subscription billing — future product concern
- PriceLabs Integration API (IAPI) — that's for PMS partners, not end users

## Context

### PriceLabs API (Customer API)
- Base URL: `https://api.pricelabs.co`
- Auth: `X-API-Key` header
- Rate limit: 1000 requests/hour
- Cost: $1/listing/month for API access
- Key endpoints: `/v1/listings`, `/v1/listing_prices`, `/v1/neighborhood_data`, `/v1/reservation_data`, `/v1/listings/{id}/overrides`
- Full API documentation in `research/02-api-reference.md`

### OpenClaw Runtime
- Skills: markdown files (`SKILL.md`) with YAML front matter in `~/.openclaw/workspace/skills/`
- MCP: natively supported — configure servers in `openclaw.json`
- Model: Claude Opus 4.6 recommended
- Multi-agent routing supported for complex workflows
- Messaging: Slack (Bolt) and Telegram (grammY) channels

### Research Completed
- Platform overview, all 5 products, pricing tiers (`research/01-platform-overview.md`)
- Complete API documentation with 12 endpoints (`research/02-api-reference.md`)
- 12 optimization strategies with ROI benchmarks (`research/03-optimization-playbook.md`)
- 152 PMS integrations cataloged (`research/04-integrations-ecosystem.md`)
- HLP algorithm internals and all settings (`research/05-algorithm-and-settings.md`)
- Competitor analysis vs Beyond/Wheelhouse/DPGO (`research/06-competitor-analysis.md`)
- Common mistakes and community workarounds (`research/07-common-mistakes.md`)

### Key PriceLabs Optimization Insights
- 31.1% revenue increase in controlled 90-day test vs static pricing
- Orphan day management is highest-impact quick win (7% revenue increase alone)
- Weekly monitoring loop is essential — not "set and forget"
- Base price should be stable anchor at 50th market percentile; adjust monthly max
- Multiple discounts: largest wins. Multiple premiums: all stack.
- Demand colors (red/orange/yellow/green/blue) signal pricing opportunities

## Constraints

- **Runtime**: OpenClaw — all agent logic must work as OpenClaw skills/MCP tools
- **API Rate**: 1000 requests/hour — agent must budget requests across workflows
- **Approval**: All pricing changes require explicit user approval via messaging
- **Model**: Claude Opus 4.6 via OpenClaw agent runtime
- **Channels**: Slack and Telegram as primary interfaces
- **Data**: PriceLabs Customer API only (not Integration API)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenClaw as runtime | User's chosen platform; skills are markdown, MCP native | — Pending |
| Human-in-the-loop for all pricing changes | Safety first; user approves every change before API writes | — Pending |
| Slack + Telegram dual channel | User's preferred messaging platforms | — Pending |
| Customer API (not IAPI) | Building for end users, not PMS partners | — Pending |
| Start personal, scale to product | Build for own portfolio first, then generalize | — Pending |
| MCP for PriceLabs API access | OpenClaw natively supports MCP; clean integration | — Pending |

---
*Last updated: 2026-02-22 after initialization*
