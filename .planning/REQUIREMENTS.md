# Requirements: PriceLabs Agent

**Defined:** 2026-02-25
**Core Value:** Reliably monitor portfolio health and surface actionable pricing recommendations via messaging -- never making a pricing change without explicit owner approval.

## v1.1 Requirements

Requirements for Integration & Validation milestone. Proves v1.0 works end-to-end with real services.

### Server Startup (BOOT)

- [ ] **BOOT-01**: MCP server builds clean with `npm run build` and starts with `node dist/index.js`
- [ ] **BOOT-02**: SQLite database is created on first run with all 7 tables via migrations
- [ ] **BOOT-03**: All 28 MCP tools register and respond to tool/list requests

### Live API (LIVE)

- [ ] **LIVE-01**: pricelabs_get_listings returns real portfolio data through MCP protocol
- [ ] **LIVE-02**: pricelabs_get_prices returns real pricing data for a listing
- [ ] **LIVE-03**: pricelabs_get_neighborhood returns real market comparison data
- [ ] **LIVE-04**: pricelabs_get_reservations returns real reservation data
- [ ] **LIVE-05**: Rate limiter and cache function correctly under real API load
- [ ] **LIVE-06**: Computed fields produce correct values from real API response shapes

### Persistence (STORE)

- [ ] **STORE-01**: pricelabs_store_daily_snapshots persists real listing data and reads back correctly
- [ ] **STORE-02**: pricelabs_store_price_snapshots persists real price data
- [ ] **STORE-03**: pricelabs_store_reservations persists real reservation data with cancellation detection
- [ ] **STORE-04**: pricelabs_store_market_snapshot persists real neighborhood data

### Deployment (DEPLOY)

- [ ] **DEPLOY-01**: MCP server runs inside OpenClaw Docker sandbox
- [ ] **DEPLOY-02**: Environment variables (API key, DB path) properly configured in OpenClaw
- [ ] **DEPLOY-03**: All 4 skills load and agent references them during conversations
- [ ] **DEPLOY-04**: Daily health check cron jobs fire on schedule
- [ ] **DEPLOY-05**: Weekly optimization cron jobs fire on schedule

### Messaging (MSG)

- [ ] **MSG-01**: Agent sends formatted health summaries to Slack channel
- [ ] **MSG-02**: User can ask portfolio questions in Slack and receive live data answers
- [ ] **MSG-03**: User can approve/reject pricing recommendations via Slack replies
- [ ] **MSG-04**: Agent sends formatted health summaries to Telegram
- [ ] **MSG-05**: User can ask portfolio questions in Telegram and receive live data answers

### Safety (SAFE)

- [ ] **SAFE-01**: Write tools (set_overrides, update_listings, delete_overrides) are disabled by default -- no pricing changes possible until user explicitly enables them
- [ ] **SAFE-02**: Pre-write snapshot is captured before any write operation (verified ready for when writes are enabled)
- [ ] **SAFE-03**: Bug fixes discovered during validation are committed and tested

## v2.0 Requirements

Deferred to future release. Not in current roadmap.

### Multi-User

- **MULTI-01**: Support multiple PriceLabs accounts/portfolios
- **MULTI-02**: Per-user configuration and preferences
- **MULTI-03**: Account isolation in database and messaging

### Automation

- **AUTO-01**: Auto-approval for low-risk changes below user-defined thresholds
- **AUTO-02**: Seasonal profile management via agent
- **AUTO-03**: Monthly strategy report with portfolio-level KPI forecasting

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web dashboard UI | OpenClaw messaging is the interface |
| Mobile app | Messaging platforms handle mobile access |
| Direct OTA integrations | PriceLabs handles channel connections |
| Payment processing | Future product concern |
| PriceLabs Integration API (IAPI) | For PMS partners, not end users |
| Fully autonomous pricing | Core value requires human-in-the-loop |
| Custom pricing algorithm | PriceLabs HLP algorithm is the engine |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOOT-01 | — | Pending |
| BOOT-02 | — | Pending |
| BOOT-03 | — | Pending |
| LIVE-01 | — | Pending |
| LIVE-02 | — | Pending |
| LIVE-03 | — | Pending |
| LIVE-04 | — | Pending |
| LIVE-05 | — | Pending |
| LIVE-06 | — | Pending |
| STORE-01 | — | Pending |
| STORE-02 | — | Pending |
| STORE-03 | — | Pending |
| STORE-04 | — | Pending |
| DEPLOY-01 | — | Pending |
| DEPLOY-02 | — | Pending |
| DEPLOY-03 | — | Pending |
| DEPLOY-04 | — | Pending |
| DEPLOY-05 | — | Pending |
| MSG-01 | — | Pending |
| MSG-02 | — | Pending |
| MSG-03 | — | Pending |
| MSG-04 | — | Pending |
| MSG-05 | — | Pending |
| SAFE-01 | — | Pending |
| SAFE-02 | — | Pending |
| SAFE-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 26 total
- Mapped to phases: 0
- Unmapped: 26 (awaiting roadmap)

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after initial definition*
