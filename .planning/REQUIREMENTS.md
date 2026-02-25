# Requirements: PriceLabs Agent

**Defined:** 2026-02-22
**Core Value:** Reliably monitor portfolio health and surface actionable pricing recommendations via messaging — never making a pricing change without explicit owner approval.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: MCP server wraps all 12 PriceLabs Customer API endpoints as typed tools with Zod validation
- [ ] **INFRA-02**: MCP server enforces rate limiting (1000 req/hr) with token bucket algorithm
- [ ] **INFRA-03**: MCP server caches API responses with configurable TTLs per endpoint
- [ ] **INFRA-04**: API key stored exclusively in MCP server environment variables, never exposed to skills or logs
- [ ] **INFRA-05**: OpenClaw Gateway configured with channel security (pairing mode, allowlists)
- [ ] **INFRA-06**: Domain knowledge skill provides always-on PriceLabs optimization reference to the agent

### Monitoring

- [ ] **MON-01**: Agent sends daily portfolio health summary to Slack and Telegram at configurable time
- [ ] **MON-02**: Daily summary includes health scores, occupancy vs market, sync status, and revenue vs STLY for each listing
- [ ] **MON-03**: Agent tracks booking pace at 7/30/60/90 day cutoffs and compares to STLY
- [ ] **MON-04**: Agent alerts when booking pace falls behind STLY by configurable threshold (default 20%)
- [ ] **MON-05**: Agent detects stale syncs (>48 hours since last push) and alerts immediately

### Interactive

- [ ] **INT-01**: User can ask natural language questions about portfolio performance and get live API data
- [ ] **INT-02**: User can ask about specific listings by name or location
- [ ] **INT-03**: User can ask comparative questions (e.g., "which listing is performing best?")
- [ ] **INT-04**: Agent fetches live data for each query (with cache awareness) rather than relying on stale context

### Analysis

- [ ] **ANLY-01**: Agent detects underperforming listings using health scores, occupancy gaps, and revenue drops
- [ ] **ANLY-02**: Underperformance alerts include specific recommended actions (lower base, expand last-minute discount, etc.)
- [ ] **ANLY-03**: Agent generates weekly optimization report with RevPAR, ADR, occupancy trends across portfolio
- [ ] **ANLY-04**: Weekly report compares current metrics to previous week and STLY
- [ ] **ANLY-05**: Agent provides competitive position analysis showing listing pricing vs 25th/50th/75th/90th market percentiles
- [ ] **ANLY-06**: Agent renders demand calendar visualization in chat using demand color descriptions

### Optimization

- [ ] **OPT-01**: Agent recommends pricing changes (base price, DSOs, min-stay) with clear rationale
- [ ] **OPT-02**: All pricing recommendations require explicit user approval in messaging before execution
- [ ] **OPT-03**: Agent snapshots current values before every write operation for rollback capability
- [ ] **OPT-04**: Agent verifies write results by re-fetching after every API write (POST-then-GET verification)
- [ ] **OPT-05**: Agent detects orphan days (1-3 night unbookable gaps) in next 30 days and suggests fill strategies
- [ ] **OPT-06**: Agent detects demand spikes via demand_color signals and recommends event-based DSOs
- [ ] **OPT-07**: Agent recommends base price adjustments monthly based on neighborhood data percentile analysis
- [ ] **OPT-08**: DSO validation ensures price never falls below listing minimum price floor
- [ ] **OPT-09**: DSO validation ensures currency matches PMS currency for fixed-price overrides
- [ ] **OPT-10**: All executed changes logged in audit trail with before/after values, timestamp, and user who approved

### Scale

- [ ] **SCALE-01**: Agent supports batch approve/reject for multiple listing recommendations at once
- [ ] **SCALE-02**: Agent tracks revenue impact of approved changes at 7/14/30 day intervals after execution
- [ ] **SCALE-03**: Agent detects new cancellations and suggests reactive fill strategies for freed dates
- [ ] **SCALE-04**: User can configure alert thresholds (occupancy gap %, revenue drop %, pace lag %) per listing or globally

### Persistence

- [ ] **PERS-01**: SQLite database stores daily listing snapshots for historical comparison
- [ ] **PERS-02**: SQLite stores daily price snapshots with demand signals
- [ ] **PERS-03**: SQLite stores reservation data for pace tracking and cancellation detection
- [ ] **PERS-04**: SQLite stores all agent actions (recommendations, approvals, executions) in audit log
- [ ] **PERS-05**: SQLite stores market data snapshots for trend analysis

### Delivery

- [ ] **DEL-01**: Agent delivers all automated reports and alerts to both Slack and Telegram
- [ ] **DEL-02**: Agent supports interactive sessions in both Slack and Telegram
- [ ] **DEL-03**: Approval flow works in both channels (user replies to approve/reject)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-User

- **MULTI-01**: Support multiple PriceLabs accounts with separate API keys
- **MULTI-02**: Per-user configuration and alert preferences
- **MULTI-03**: Credential isolation between users

### Advanced Automation

- **AUTO-01**: Configurable auto-approval for low-risk changes below user-defined thresholds
- **AUTO-02**: Seasonal profile management via agent
- **AUTO-03**: Monthly strategy report with portfolio-level KPI forecasting

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fully autonomous pricing (no approval) | Core value requires human-in-the-loop; trust must be earned |
| Custom pricing algorithm | PriceLabs HLP algorithm is the pricing engine; agent enhances, not replaces |
| Web dashboard or mobile app | OpenClaw messaging is the interface; no web UI needed |
| Direct OTA integrations (Airbnb/Vrbo) | PriceLabs handles channel connections |
| Guest communication features | Out of domain; revenue management only |
| Revenue forecasting engine | PriceLabs provides forward-looking data; agent interprets, not predicts |
| Multi-pricing-tool support | PriceLabs only; no Beyond/Wheelhouse/DPGO integration |
| Payment processing / billing | Future product concern, not v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Delivered |
| INFRA-02 | Phase 1 | Delivered |
| INFRA-03 | Phase 1 | Delivered |
| INFRA-04 | Phase 1 | Delivered |
| INFRA-05 | Phase 1 | Delivered |
| INFRA-06 | Phase 1 | Delivered |
| MON-01 | Phase 2 | Delivered |
| MON-02 | Phase 2 | Delivered |
| MON-03 | Phase 2 | Delivered |
| MON-04 | Phase 2 | Delivered |
| MON-05 | Phase 2 | Delivered |
| INT-01 | Phase 2 | Delivered |
| INT-02 | Phase 2 | Delivered |
| INT-03 | Phase 2 | Delivered |
| INT-04 | Phase 2 | Delivered |
| PERS-01 | Phase 2 | Delivered |
| PERS-02 | Phase 2 | Delivered |
| PERS-03 | Phase 2 | Delivered |
| PERS-04 | Phase 2 | Delivered |
| PERS-05 | Phase 2 | Delivered |
| DEL-01 | Phase 2 | Delivered |
| DEL-02 | Phase 2 | Delivered |
| DEL-03 | Phase 2 | Delivered |
| ANLY-01 | Phase 3 | Delivered |
| ANLY-02 | Phase 3 | Delivered |
| ANLY-03 | Phase 3 | Delivered |
| ANLY-04 | Phase 3 | Delivered |
| ANLY-05 | Phase 3 | Delivered |
| ANLY-06 | Phase 3 | Delivered |
| OPT-01 | Phase 4 | Delivered |
| OPT-02 | Phase 4 | Delivered |
| OPT-03 | Phase 4 | Delivered |
| OPT-04 | Phase 4 | Delivered |
| OPT-05 | Phase 4 | Delivered |
| OPT-06 | Phase 4 | Delivered |
| OPT-07 | Phase 4 | Delivered |
| OPT-08 | Phase 4 | Delivered |
| OPT-09 | Phase 4 | Delivered |
| OPT-10 | Phase 4 | Delivered |
| SCALE-01 | Phase 5 | Delivered |
| SCALE-02 | Phase 5 | Delivered |
| SCALE-03 | Phase 5 | Delivered |
| SCALE-04 | Phase 5 | Delivered |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-25 — all 43 requirements delivered*
