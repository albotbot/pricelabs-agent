# PriceLabs Agent

## What This Is

A dedicated OpenClaw agent ("Prism") that connects to PriceLabs' API to monitor short-term rental portfolios, provide interactive analytics via Slack and Telegram, and optimize pricing with human-in-the-loop approval. Prism is a first-class peer in the multi-agent ecosystem with its own workspace brain, persona, messaging channels, and permanent cron jobs. It acts as a 24/7 revenue manager — detecting underperformance, recommending pricing changes, executing approved changes, and tracking their impact over time.

## Core Value

The agent must reliably monitor portfolio health and surface actionable pricing recommendations via messaging — never making a pricing change without explicit owner approval.

## Requirements

### Validated

- ✓ MCP server wraps all 12 PriceLabs Customer API endpoints with Zod validation, rate limiting, and caching — v1.0
- ✓ Agent sends daily portfolio health summaries via Slack and Telegram — v1.0
- ✓ Agent detects underperforming listings and alerts with specific recommendations — v1.0
- ✓ User can ask natural language questions about portfolio and get live data — v1.0
- ✓ Agent recommends base price adjustments based on neighborhood data percentile analysis — v1.0
- ✓ Agent recommends date-specific overrides for demand spikes and orphan days — v1.0
- ✓ All pricing changes require explicit user approval before execution — v1.0
- ✓ Agent executes approved changes via PriceLabs API with pre-write snapshots and post-write verification — v1.0
- ✓ Agent tracks booking pace vs STLY and alerts on significant deviations — v1.0
- ✓ Agent provides weekly optimization reports with RevPAR/ADR/occupancy trends — v1.0
- ✓ Agent runs as OpenClaw skills with MCP integration for PriceLabs API — v1.0
- ✓ Agent supports batch approve/reject for multi-listing recommendations — v1.0
- ✓ Agent tracks revenue impact of changes at 7/14/30 day intervals — v1.0
- ✓ Agent detects cancellations and suggests reactive fill strategies — v1.0
- ✓ User can configure alert thresholds per listing or globally — v1.0
- ✓ MCP server boots, connects to SQLite, runs migrations, and serves 28 tools end-to-end — v1.1
- ✓ Live PriceLabs API calls succeed through all read-path MCP tool handlers with real portfolio data — v1.1
- ✓ Snapshot storage persists real listing, price, market, and reservation data correctly with cancellation detection — v1.1
- ✓ OpenClaw deployment runs MCP server in Docker sandbox with skills loaded and cron jobs validated — v1.1
- ✓ Slack and Telegram deliver health summaries, answer questions, and handle approval flow with live data — v1.1
- ✓ Write safety gate (PRICELABS_WRITES_ENABLED=false) blocks all pricing changes by default — v1.1
- ✓ OpenClaw plugin bridge registers all 28 MCP tools in the agent's tool namespace — v1.1
- ✓ Prism workspace brain authored with 7 bootstrap files + 4 skills under 2K token budget — v1.2
- ✓ Agent registered in OpenClaw with dedicated sandbox, auth profiles, and 28 MCP tools — v1.2
- ✓ Telegram migrated to multi-account format with dedicated Prism bot and routing bindings — v1.2
- ✓ Slack peer-channel routing set up for dedicated #pricelabs channel — v1.2
- ✓ 4 permanent cron jobs delivering daily health + weekly optimization to dedicated channels — v1.2
- ✓ Full E2E validation with zero cross-talk and complete workspace separation — v1.2

### Active

(None yet — planning next milestone)

### Deferred to v2.0

- [ ] Multi-user support for scaling to other hosts/PMs (MULTI-01..03)
- [ ] Auto-approval for low-risk changes below user-defined thresholds (AUTO-01)
- [ ] Seasonal profile management via agent (AUTO-02)
- [ ] Monthly strategy report with portfolio-level KPI forecasting (AUTO-03)
- [ ] Interactive button-based approval (replace reply-text) (UX-01)
- [ ] Per-agent model selection (cheaper for cron, premium for interactive) (UX-02)

### Out of Scope

- Building a web dashboard UI — OpenClaw messaging is the interface
- Mobile app — messaging platforms handle mobile access
- Direct OTA integrations (Airbnb/Vrbo) — PriceLabs handles the channel connections
- Payment processing or subscription billing — future product concern
- PriceLabs Integration API (IAPI) — that's for PMS partners, not end users
- Fully autonomous pricing (no approval) — core value requires human-in-the-loop; trust must be earned
- Custom pricing algorithm — PriceLabs HLP algorithm is the pricing engine; agent enhances, not replaces

## Context

### Current State (v1.2 shipped 2026-02-28)

**Tech Stack:** TypeScript MCP server (28 tools), SQLite persistence (7 tables), OpenClaw Prism agent (dedicated workspace, 7 bootstrap files, 4 skills), OpenClaw plugin bridge, permanent cron jobs (4), validation scripts (5)

**Code:** ~6,469 TypeScript LOC (MCP server) + OpenClaw config/plugin + validation scripts + workspace files

**Architecture:**
- MCP server (`mcp-servers/pricelabs/`) — API client, rate limiter, cache, 28 tools across 14 registration functions
- OpenClaw plugin (`openclaw/extensions/pricelabs/`) — bridges all 28 MCP tools into OpenClaw via stdio JSON-RPC
- Prism workspace (`~/.openclaw/workspace-pricelabs/`) — AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, BOOT.md, MEMORY.md + 4 skills
- OpenClaw config (`openclaw/`) — gateway security, agent registration, channel bindings, cron jobs
- SQLite — listing_snapshots, price_snapshots, reservations, market_snapshots, audit_log, change_tracking, user_config
- Validation (`scripts/`) — boot, API, persistence, deployment, messaging validation scripts

**Deployment:**
- Prism agent registered in OpenClaw with dedicated sandbox, auth profiles, and 28 MCP tools
- Dedicated Telegram bot (@Prism_Price_Bot) and #pricelabs Slack channel with routing bindings
- 4 permanent cron jobs: daily health + weekly optimization to both Slack and Telegram
- Multi-agent system with zero cross-talk between Prism and main agent (AlBot)
- Write safety gate active (PRICELABS_WRITES_ENABLED=false)

**Known issues / tech debt:**
- OpenClaw cron skip bug #17852 may affect scheduled job reliability
- Reply-based approval UX — could be improved with interactive buttons in future (UX-01)
- PriceLabs reservation_data pagination limits not tested with real large datasets
- Global-only thresholds in detect_underperformers batch query (per-listing thresholds via config tool only)

### PriceLabs API (Customer API)
- Base URL: `https://api.pricelabs.co`
- Auth: `X-API-Key` header
- Rate limit: 1000 requests/hour
- Cost: $1/listing/month for API access
- Key endpoints: `/v1/listings`, `/v1/listing_prices`, `/v1/neighborhood_data`, `/v1/reservation_data`, `/v1/listings/{id}/overrides`
- Full API documentation in `research/02-api-reference.md`

### OpenClaw Runtime
- Skills: markdown files loaded via `instructions` field in `openclaw.json`
- MCP: via plugin bridge (`openclaw/extensions/pricelabs/`) — NOT native mcp.servers config
- Model: openai-codex/gpt-5.3-codex (OpenClaw default; works with PriceLabs tools)
- Messaging: Slack (socket mode) and Telegram (bot token) channels
- Sandbox: `agents.defaults.sandbox.mode: "all"` with explicit `tools.sandbox.tools.allow` for pricelabs_*
- Cron: Gateway-managed jobs in `~/.openclaw/cron/jobs.json`, CLI via `openclaw cron add`

### Research Completed
- Platform overview, all 5 products, pricing tiers (`research/01-platform-overview.md`)
- Complete API documentation with 12 endpoints (`research/02-api-reference.md`)
- 12 optimization strategies with ROI benchmarks (`research/03-optimization-playbook.md`)
- 152 PMS integrations cataloged (`research/04-integrations-ecosystem.md`)
- HLP algorithm internals and all settings (`research/05-algorithm-and-settings.md`)
- Competitor analysis vs Beyond/Wheelhouse/DPGO (`research/06-competitor-analysis.md`)
- Common mistakes and community workarounds (`research/07-common-mistakes.md`)

## Constraints

- **Runtime**: OpenClaw — all agent logic must work as OpenClaw skills/plugin tools
- **API Rate**: 1000 requests/hour — agent must budget requests across workflows
- **Approval**: All pricing changes require explicit user approval via messaging
- **Model**: openai-codex/gpt-5.3-codex via OpenClaw agent runtime (model-agnostic tool design)
- **Channels**: Slack and Telegram as primary interfaces
- **Data**: PriceLabs Customer API only (not Integration API)
- **Safety**: PRICELABS_WRITES_ENABLED must be explicitly set to "true" to enable any pricing changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenClaw as runtime | User's chosen platform; skills are markdown, MCP native | ✓ Good — 4 skills, 28 MCP tools work well |
| Human-in-the-loop for all pricing changes | Safety first; user approves every change before API writes | ✓ Good — batch approval added in v1.0 |
| Slack + Telegram dual channel | User's preferred messaging platforms | ✓ Good — independent cron jobs per channel |
| Customer API (not IAPI) | Building for end users, not PMS partners | ✓ Good — 12 endpoints sufficient |
| MCP for PriceLabs API access | OpenClaw natively supports MCP; clean integration | ✓ Good — 28 tools, typed schemas |
| Zod schemas as single source of truth for types | No manual interface duplication; z.infer prevents type drift | ✓ Good — consistent across all 28 tools |
| SQLite with user_version pragma migrations | Simpler than migration tables; atomic with schema changes | ✓ Good — 7 migrations, clean upgrades |
| Reply-based approval over interactive buttons | Cross-channel compatible (Slack + Telegram); simpler v1 | ⚠️ Revisit — may want buttons for v2 UX |
| Agent-driven change tracking | Agent calls pricelabs_record_change explicitly; matches audit pattern | ✓ Good — flexible, not auto-tracking |
| 5-phase read-before-write progression | Agent proves analytical value before trusted with pricing changes | ✓ Good — trust established progressively |
| PRICELABS_WRITES_ENABLED env var gate | Strict string equality ("true") with per-call check, not startup-time | ✓ Good — runtime toggling, dual safety layer |
| OpenClaw plugin bridge over native MCP | OpenClaw doesn't have native mcp.servers config; plugin system required | ✓ Good — all 28 tools registered via stdio JSON-RPC |
| Sandbox tool allow glob (pricelabs_*) | OpenClaw sandbox.mode="all" hardcodes 13 core tools only | ✓ Good — explicit glob pattern in config |
| One-shot cron for delivery testing | Verifiable, auto-deleting test jobs vs permanent cron | ✓ Good — clean testing pattern |
| Dedicated Prism workspace brain | Agent needs distinct persona, tools ref, and domain skills | ✓ Good — 7 files under 2K token budget |
| Telegram multi-account migration | Flat config can't route to multiple agents | ✓ Good — two-phase migration, zero downtime |
| Slack peer-channel routing | Separate channel per agent, no cross-talk | ✓ Good — requireMention: false for clean UX |
| Permanent cron jobs with --agent flag | One-shot was only for testing; production needs persistent jobs | ✓ Good — 4 jobs survive gateway restarts |
| Zero new TypeScript for v1.2 | v1.2 is entirely config + markdown — proves agent identity is purely declarative | ✓ Good — separation of concerns |
| AlBot retains PriceLabs skills | User decided main agent should keep read access to PriceLabs data | ✓ Good — flexible routing |

---
*Last updated: 2026-03-12 after v1.2 milestone completion*
