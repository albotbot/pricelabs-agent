# Project Research Summary

**Project:** PriceLabs AI Revenue Management Agent
**Domain:** AI Agent for Short-Term Rental Revenue Management (OpenClaw + PriceLabs API)
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

This project builds an AI revenue management agent that runs entirely within the OpenClaw runtime, wrapping PriceLabs' 12-endpoint Customer API to deliver proactive portfolio monitoring, interactive analytics, and human-approved pricing optimization via Slack and Telegram. Experts build this type of system by treating the AI runtime (OpenClaw) as the orchestration layer, the external API (PriceLabs) as a typed tool surface via MCP, and the messaging channels as the sole user interface. The recommended approach is a multi-skill OpenClaw agent backed by a custom TypeScript MCP server that handles API authentication, rate limiting, input validation, and caching internally -- keeping the agent's reasoning clean and the API interactions safe.

The core architectural insight is that OpenClaw is not a library to import but the entire runtime environment. There is no web server, no custom Slack bot, no separate scheduler to build. Skills define agent behavior, MCP servers provide typed tools, cron handles automation, and channels handle delivery. The stack is narrow by design: TypeScript MCP server with `@modelcontextprotocol/sdk`, SQLite for persistence via `better-sqlite3`, and OpenClaw's native cron and channel systems. The agent decomposes into 5 focused skills (monitor, analyst, optimizer, reporter, domain knowledge) to balance token economy against behavioral specificity.

The primary risks are financial: DSO overrides bypass all PriceLabs safety rails including minimum price floors, erroneous DSO dates are silently dropped with no error, and there is no API undo mechanism. These risks demand a pre-write validation layer in the MCP server (not in skill instructions where the LLM cannot reliably enforce them) and a strict human-in-the-loop approval flow for every write operation. Secondary risks include API rate limit exhaustion from aggressive querying, API key exposure through skill or log leakage, and approval fatigue at portfolio scale. All critical pitfalls must be addressed in the MCP server foundation phase before any write operations are enabled.

## Key Findings

### Recommended Stack

The stack centers on OpenClaw as the sole runtime with no external web frameworks, schedulers, or bot frameworks. All infrastructure concerns (process lifecycle, scheduling, channel routing, session management) are handled by the OpenClaw Gateway. Development effort focuses on two custom artifacts: SKILL.md files defining agent behavior, and a TypeScript MCP server wrapping the PriceLabs API.

**Core technologies:**
- **OpenClaw Gateway** (2026.2.x): Agent runtime, scheduling, channel routing -- the entire operating environment
- **Claude Opus 4.6**: LLM backbone for revenue analysis reasoning and natural language interaction
- **Custom PriceLabs MCP Server** (`@modelcontextprotocol/sdk` 1.26.x + `zod` 3.25+): Wraps 12 API endpoints as typed MCP tools with built-in rate limiting, caching, and validation
- **SQLite** (`better-sqlite3` 11.x): Historical data persistence, trend tracking, audit logs -- zero-ops, ACID-compliant
- **OpenClaw Cron**: Native scheduling for daily/weekly/monthly automated workflows
- **Slack** (Bolt SDK via OpenClaw) + **Telegram** (grammY via OpenClaw): Primary interactive and delivery channels

**Critical version requirements:** Node.js 22 LTS (required for MCP server and built-in fetch), MCP SDK 1.26.x (stable stdio transport).

See [STACK.md](./STACK.md) for full details including configuration examples, directory structure, and alternatives considered.

### Expected Features

**Must have (table stakes) -- 7 features:**
1. **Daily Portfolio Health Summary** (TS-1) -- The heartbeat; push notifications replace manual dashboard checks
2. **Underperformance Detection and Alerting** (TS-2) -- Interpret health scores with context and recommended actions
3. **Natural Language Q&A** (TS-3) -- Conversational PriceLabs interface; replaces dashboard for routine checks
4. **Pricing Change Recommendations with Human Approval** (TS-4) -- Core agent promise; approval-gated write operations
5. **Orphan Day Detection and Fill Strategies** (TS-5) -- Highest-impact quick win (7% revenue increase in testing)
6. **Weekly Optimization Report** (TS-6) -- Automates PriceLabs' recommended 15-30 min weekly review loop
7. **Booking Pace vs STLY Tracking** (TS-7) -- Fundamental leading indicator for revenue management

**Should have (differentiators) -- 8 features:**
- **Event-Based Pricing Recommendations** (D-1) -- Detects demand spikes the algorithm may underweight
- **Contextual Base Price Calibration** (D-2) -- Monthly recommendation with full market context
- **Competitive Position Analysis** (D-3) -- Market percentile data translated to actionable prose
- **Multi-Listing Batch Operations** (D-4) -- Scales approval workflow for 10+ listing portfolios
- **Revenue Impact Tracking** (D-5) -- Unique differentiator; tracks outcomes of approved changes
- **Cancellation Impact Analysis** (D-6) -- Reactive fill strategies for newly open dates
- **Configurable Alert Thresholds** (D-7) -- Signal-to-noise tuning for different user profiles
- **Demand Calendar Visualization** (D-8) -- PriceLabs demand colors rendered in chat

**Defer indefinitely (anti-features):**
- Fully autonomous pricing (no approval gate)
- Custom pricing algorithm competing with PriceLabs HLP
- Web dashboard or mobile app
- Direct OTA integrations (Airbnb/Vrbo)
- Guest communication features
- Revenue forecasting engine
- Multi-pricing-tool support

**Critical feature dependency path:** TS-1 --> TS-2 --> TS-4 --> TS-5 (monitoring to actionable agent)

See [FEATURES.md](./FEATURES.md) for full feature specifications, complexity assessments, and competitive positioning.

### Architecture Approach

The system follows OpenClaw's native 4-layer architecture: Gateway (control plane + channels), Integration (MCP servers + skills), Execution (agent turns + cron jobs), and Intelligence (Claude Opus 4.6 reasoning). The PriceLabs agent maps cleanly onto this model with a custom MCP server as the integration layer, 5 focused skills as the behavior layer, SQLite (via Anthropic's official `@anthropic/mcp-sqlite`) as the persistence layer, and channel-native approval as the human-in-the-loop mechanism.

**Major components:**
1. **PriceLabs MCP Server** -- Custom TypeScript server exposing 11 tools (7 read, 4 write) with internal rate limiting, TTL caching, input validation, and error normalization
2. **SQLite MCP Server** -- Anthropic's official `@anthropic/mcp-sqlite` for 6 tables: listing_snapshots, price_snapshots, actions_log, market_snapshots, reservations, kpi_history
3. **5 Specialized Skills** -- pricelabs-monitor (cron health checks), pricelabs-analyst (interactive queries), pricelabs-optimizer (pricing recommendations with approval), pricelabs-reporter (weekly/monthly reports), pricelabs-domain (always-loaded reference knowledge)
4. **Cron Schedule** -- 5 jobs: daily health (8am), optimization scan (Mon+Thu 9am), neighborhood analysis (Mon 10am), monthly strategy (1st 9am), stale sync check (every 4hr)
5. **Channel-Native Approval** -- Recommendations announced to Slack/Telegram; user approves in-channel; pending_recommendations table tracks state

**Key architectural patterns:**
- Tool-Then-Reason: Always fetch data via MCP before analyzing; never hallucinate numbers
- Snapshot-Before-Compare: Store data in SQLite before every comparison for trend detection
- Announce-Then-Approve: Cron generates recommendations; interactive sessions execute them
- Batch API Calls: Use PriceLabs' batch endpoints to minimize request count

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full component diagrams, data flows, schema definitions, and cron configurations.

### Critical Pitfalls

The top 5 pitfalls that must be addressed architecturally (not just documented):

1. **DSO Overwrites All Safety Rails** -- Fixed-price DSOs bypass minimum price floors. A $50 DSO on a $150/night listing goes live. Prevention: MCP server must fetch listing min price and validate effective rate before every DSO write. This validation cannot live in skill instructions where the LLM cannot reliably enforce it.

2. **Erroneous DSO Dates Silently Omitted** -- API returns 200 OK but drops invalid dates without warning. Prevention: POST-then-GET verification after every DSO write; reconcile requested vs confirmed dates; report discrepancies to user.

3. **No Undo for API Writes** -- Price changes sync to live OTAs. No rollback endpoint exists. Prevention: Snapshot current values before every write; build rollback capability that re-writes old values; consider 5-minute execution delay with cancel option.

4. **API Key Exposure via Skills/Logs** -- 7.1% of ClawHub skills contain credential leaks (Snyk, Feb 2026). Prevention: Keep API key exclusively in MCP server env vars; never pass through skill instructions; enable log redaction; run `openclaw security audit --deep`.

5. **Rate Limit Exhaustion** -- 1000 req/hr; a "how is my portfolio doing?" query can trigger 100+ calls in seconds. Prevention: Token bucket rate limiter in MCP server; aggressive caching (listings 1hr, prices 6hr, neighborhood 24hr); budget allocation per workflow type.

See [PITFALLS.md](./PITFALLS.md) for all 18 pitfalls with full prevention strategies and phase-specific warnings.

## Implications for Roadmap

Based on the combined research, the project naturally decomposes into 5 phases driven by technical dependencies, risk ordering, and the read-before-write principle.

### Phase 1: MCP Server Foundation + Infrastructure Security

**Rationale:** Everything depends on the MCP server. No skill, cron job, or feature works without typed API access. Security hardening must happen before any credentials are configured -- not retrofitted later.

**Delivers:** A working PriceLabs MCP server with all read-only tools, rate limiting, caching, input validation. OpenClaw Gateway configured with Docker sandbox, tool allowlists, loopback binding, token auth. The `pricelabs-domain` skill providing always-on domain knowledge.

**Addresses features:** Foundation for all features (no user-facing features yet)

**Avoids pitfalls:** P4 (rate limit exhaustion -- rate limiter from day one), P5 (API key exposure -- credential isolation from day one), P6 (MCP system access -- Docker sandbox from day one), P18 (prompt injection -- channel security from day one)

**Estimated scope:** MCP server TypeScript project with 7 read tools, rate limiter, cache layer, Zod schemas. OpenClaw config with agent, MCP server, channel security, Docker sandbox. Domain knowledge skill.

### Phase 2: Monitoring + Persistence + Channel Delivery

**Rationale:** The daily health summary (TS-1) is the agent's heartbeat and the foundation for all other features. It requires SQLite for historical snapshots, cron for scheduling, and channel delivery for output. Booking pace (TS-7) and NL Q&A (TS-3) are read-only features that validate the entire stack end-to-end.

**Delivers:** Daily automated health reports delivered to Slack and Telegram. Interactive natural language queries about portfolio data. Booking pace vs STLY tracking with alerts. Historical data accumulating in SQLite.

**Addresses features:** TS-1 (Daily Health Summary), TS-3 (NL Q&A), TS-7 (Booking Pace vs STLY)

**Avoids pitfalls:** P11 (dual pricing conflicts -- PMS awareness in onboarding flow), P13 (stale cache -- cache-age awareness and refresh-before-recommend), P17 (sync timing -- always communicate sync caveats)

**Estimated scope:** SQLite schema creation (6 tables, indexes), pricelabs-monitor skill, pricelabs-analyst skill, pricelabs-reporter skill, Slack + Telegram channel config, 5 cron job definitions, binding rules.

### Phase 3: Analysis Layer + Smart Alerting

**Rationale:** With monitoring data accumulating (Phase 2), the agent can now interpret trends and surface insights. This phase adds intelligence to the read-only foundation without introducing write-operation risk. Underperformance detection (TS-2) is the bridge between monitoring and optimization.

**Delivers:** Smart underperformance alerts with context and recommended actions. Weekly optimization reports replacing the manual review loop. Competitive position analysis in natural language. Demand calendar visualization in chat.

**Addresses features:** TS-2 (Underperformance Detection), TS-6 (Weekly Optimization Report), D-3 (Competitive Position Analysis), D-8 (Demand Calendar Visualization)

**Avoids pitfalls:** P9 (panic pricing -- STLY context prevents knee-jerk recommendations), P16 (thin market data -- check Listings Used count and flag low-confidence markets)

**Estimated scope:** Enhanced monitoring logic with configurable alert thresholds, weekly report templates, neighborhood data interpretation, demand color rendering for Slack/Telegram.

### Phase 4: Write Operations + Approval Workflow

**Rationale:** Write operations are the highest-risk and highest-value capability. By this point, users trust the agent's analysis (Phases 2-3) and are ready to act on recommendations. The pre-write validation layer in the MCP server is the critical safety mechanism.

**Delivers:** Pricing change recommendations with one-tap approval. Orphan day detection and fill strategies. Event-based DSO recommendations. Base price calibration with market context. Full audit trail of all changes.

**Addresses features:** TS-4 (Pricing Recommendations + Approval), TS-5 (Orphan Day Detection), D-1 (Event-Based Recommendations), D-2 (Base Price Calibration)

**Avoids pitfalls:** P1 (DSO overrides min price -- pre-write validation against listing min), P2 (silent date omission -- POST-then-GET verification), P3 (currency mismatch -- enforce currency matching), P7 (no undo -- snapshot before every write), P8 (base price yo-yo -- 30-day minimum interval), P10 (orphan creation from DSO min-stay -- calendar-aware validation)

**Estimated scope:** 4 write tools in MCP server with validation layer, pricelabs-optimizer skill with approval protocol, pending_recommendations table, snapshot/rollback mechanism, actions audit log, pre-flight checklist enforcement.

### Phase 5: Scale + Feedback Loop

**Rationale:** Once the core agent works for a single portfolio, scale features make it viable for larger portfolios and build the trust feedback loop that makes the agent increasingly valuable over time.

**Delivers:** Batch operations for multi-listing portfolios. Revenue impact tracking for approved changes. Cancellation impact analysis. Configurable alert thresholds for different user profiles.

**Addresses features:** D-4 (Batch Operations), D-5 (Revenue Impact Tracking), D-6 (Cancellation Impact Analysis), D-7 (Configurable Thresholds)

**Avoids pitfalls:** P12 (approval fatigue -- batched recommendations with tiered approval), P15 (inconsistent weekly pricing -- market-type detection)

**Estimated scope:** Batch approval UX, change-outcome tracking (7/14/30 day follow-ups), reservation monitoring for cancellations, user preference configuration system.

### Phase Ordering Rationale

- **Security first, features second:** Phase 1 establishes Docker sandbox, tool allowlists, credential isolation, and rate limiting before any feature code runs. This is non-negotiable given the Snyk findings on skill credential leaks.
- **Read before write:** Phases 2-3 are entirely read-only. This lets the agent prove its analytical value before being trusted with pricing changes, and lets the operator validate data accuracy before granting write access.
- **Foundation dependency chain:** MCP server (Phase 1) --> SQLite + cron (Phase 2) --> analysis intelligence (Phase 3) --> write operations (Phase 4) --> scale features (Phase 5). Each phase builds on the prior; no phase can be meaningfully started without its predecessor.
- **Risk graduation:** Financial risk increases across phases. Phase 2-3 carry zero financial risk (read-only). Phase 4 introduces controlled financial risk behind approval gates. Phase 5 increases throughput of financial decisions.
- **Pitfall alignment:** Critical pitfalls (P1-P7) are addressed in Phases 1 and 4. Moderate pitfalls (P8-P13) are addressed in Phases 3-4. Minor pitfalls (P14-P18) are addressed across Phases 2-5.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 1 (MCP Server):** OpenClaw Docker sandbox configuration has limited community examples. The `sandbox.mode: "docker"` config and tool allowlists need validation against current OpenClaw 2026.2.x docs. Also: the reported cron skip bug (#17852) needs monitoring.
- **Phase 4 (Write Operations):** The approval UX in Slack/Telegram (interactive buttons vs reply-based) needs prototyping. Slack Block Kit interactive components for approve/reject flows need specific research. The `pending_recommendations` table and cron-to-interactive-session handoff pattern has no documented precedent in OpenClaw.

**Phases with standard, well-documented patterns (skip deep research):**
- **Phase 2 (Monitoring + Persistence):** SQLite schema, OpenClaw cron configuration, and channel delivery are all thoroughly documented in official OpenClaw docs and community guides. The Anthropic SQLite MCP server is a mature, documented component.
- **Phase 3 (Analysis):** PriceLabs' health scores, demand colors, neighborhood percentiles, and STLY fields are well-documented in the API. Interpretation logic is pure agent reasoning -- no platform research needed.
- **Phase 5 (Scale):** Batch operations use existing API batch endpoints. Impact tracking is internal SQLite logic. Configurable thresholds are a simple configuration concern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | OpenClaw official docs are comprehensive. MCP SDK is mature (26k+ dependents). PriceLabs API is fully documented on SwaggerHub. No speculative technology choices. |
| Features | HIGH | Feature map grounded in PriceLabs API capabilities, optimization playbook, competitor analysis (Guesty, DPGO), and industry benchmarks. All table-stakes features have verified API support. |
| Architecture | HIGH | Architecture follows OpenClaw's documented patterns (skills, MCP, cron, channels). MCP server design follows official TypeScript SDK guides. Schema design follows established SQLite patterns for agent memory. |
| Pitfalls | HIGH | Critical pitfalls sourced from PriceLabs API docs, Snyk security research (Feb 2026), OpenClaw security docs, and multiple security vendors (Cisco, CrowdStrike, Kaspersky). Domain pitfalls from PriceLabs optimization playbook and community. |

**Overall confidence:** HIGH

### Gaps to Address

- **OpenClaw Docker sandbox in production:** The sandbox configuration is documented but community production examples are sparse. Validate during Phase 1 implementation that `sandbox.mode: "docker"` works with stdio MCP server spawning.
- **Cron skip bug:** OpenClaw issue #17852 reports daily cron jobs skipping days (48hr jumps). Mitigation strategy (use 4-hourly checks for critical monitoring) is in place, but the underlying bug may be fixed in a future OpenClaw release. Monitor during Phase 2.
- **Approval UX across channels:** The channel-native approval pattern (reply-based "yes"/"no") works for Slack threads but Telegram's UX for this is less clear. Inline keyboard buttons via grammY may be needed. Research during Phase 4 planning.
- **PriceLabs API pagination limits:** The reservation_data endpoint supports `limit` and `offset` but maximum page sizes and total result caps are not documented. Test with real data during Phase 2.
- **Multi-user credential isolation:** For Phase 5+ scaling, each user needs their own PriceLabs API key. OpenClaw's `auth-profiles.json` per-agent credential system needs validation for multi-tenant scenarios.
- **In-memory cache persistence:** MCP server cache is lost on Gateway restart. For portfolios with expensive neighborhood data calls (24hr cache TTL), frequent restarts could spike API usage. Consider SQLite-backed cache if this becomes an issue.

## Sources

### Primary (HIGH confidence)
- [PriceLabs Customer API - SwaggerHub](https://app.swaggerhub.com/apis-docs/Customer_API/customer_api/1.0.0-oas3) -- 12 endpoints, request/response schemas
- [PriceLabs API Help](https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api) -- Auth, rate limits, setup
- [PriceLabs Postman Collection](https://documenter.getpostman.com/view/507656/SVSEurQC) -- Endpoint examples
- [OpenClaw Official Docs](https://docs.openclaw.ai/) -- Skills, cron, memory, channels, security, configuration
- [OpenClaw GitHub](https://github.com/openclaw/openclaw) -- 100k+ stars, issue tracker
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- v1.26.x, server guide
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- 26,000+ dependents
- [Snyk: Leaky Skills Research](https://snyk.io/blog/openclaw-skills-credential-leaks-research/) -- 283 leaky skills (7.1%)
- [Cisco: Personal AI Agent Security](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare) -- Attack vectors
- [Microsoft: Running OpenClaw Safely](https://www.microsoft.com/en-us/security/blog/2026/02/19/running-openclaw-safely-identity-isolation-runtime-risk/) -- Isolation patterns

### Secondary (MEDIUM confidence)
- [OpenClaw Configuration Guide 2026](https://moltfounders.com/openclaw-configuration) -- Annotated config reference
- [Custom Skill Creation Guide](https://zenvanriel.nl/ai-engineer-blog/openclaw-custom-skill-creation-guide/) -- Skill design patterns
- [How OpenClaw Works](https://bibek-poudel.medium.com/how-openclaw-works-understanding-ai-agents-through-a-real-architecture-5d59cc7a4764) -- 4-layer architecture
- [Guesty AI Agent for Revenue Management](https://www.prnewswire.com/news-releases/guesty-unveils-first-ai-agent-for-revenue-management-as-it-accelerates-multi-agent-ai-product-strategy-302630233.html) -- Competitor feature set
- [Hostaway 2026 STR Report](https://www.hostaway.com/blog/2026-short-term-rental-report/) -- 61% AI adoption in STR
- [PriceLabs Revenue Management Strategy 2026](https://hello.pricelabs.co/blog/revenue-management-strategy/) -- Optimization best practices
- Project research files: `research/01-07` covering platform, API, optimization, integrations, algorithm, competitors, mistakes

### Tertiary (LOW confidence)
- Jurny NIA conversational analytics -- single marketing source, needs validation
- DPGO's 200+ market parameters claim -- competitor marketing
- Key Data Dashboard's 40+ KPI tracking -- marketing claim, not verified

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
