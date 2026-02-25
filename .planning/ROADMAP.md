# Roadmap: PriceLabs Agent

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-5, 43 requirements (shipped 2026-02-25)
- 🚧 **v1.1 Integration & Validation** -- Phases 6-10, 26 requirements (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) -- SHIPPED 2026-02-25</summary>

- [x] Phase 1: MCP Server Foundation + Infrastructure Security (9 plans) -- 6 requirements
- [x] Phase 2: Monitoring + Persistence + Interactive + Delivery (6 plans) -- 17 requirements
- [x] Phase 3: Analysis Layer + Smart Alerting (3 plans) -- 6 requirements
- [x] Phase 4: Write Operations + Approval Workflow (3 plans) -- 10 requirements
- [x] Phase 5: Scale + Feedback Loop (3 plans) -- 4 requirements

**Total:** 24 plans, 43 requirements, 28 MCP tools, 4 skills, 7 SQLite tables

See `.planning/milestones/v1.0-ROADMAP.md` for full phase details.

</details>

### v1.1 Integration & Validation (In Progress)

**Milestone Goal:** Prove v1.0 code works end-to-end with real PriceLabs API, OpenClaw deployment, and Slack/Telegram delivery. Every tool, every table, every cron job -- validated against real services.

- [x] **Phase 6: Server Boot + Safety Gate** - MCP server builds, boots, creates database, registers all tools, and write tools are confirmed disabled (completed 2026-02-25)
- [ ] **Phase 7: Live API Validation** - Real PriceLabs API calls succeed through MCP tool handlers with correct data shapes
- [ ] **Phase 8: Snapshot Persistence** - Real portfolio data stored in SQLite and reads back correctly with pre-write safety verified
- [ ] **Phase 9: OpenClaw Deployment** - MCP server runs in Docker sandbox with skills loaded and cron jobs firing
- [ ] **Phase 10: Messaging Integration** - Slack and Telegram deliver summaries, answer questions, and handle approval flow

## Phase Details

### Phase 6: Server Boot + Safety Gate
**Goal**: MCP server is running locally with a working database, all tools registered, and write operations confirmed disabled by default
**Depends on**: Nothing (first phase of v1.1; v1.0 code is the starting point)
**Requirements**: BOOT-01, BOOT-02, BOOT-03, SAFE-01
**Success Criteria** (what must be TRUE):
  1. Running `npm run build` produces zero errors and `node dist/index.js` starts the MCP server
  2. On first start, SQLite database file exists on disk with all 7 tables (listing_snapshots, price_snapshots, reservations, market_snapshots, audit_log, change_tracking, user_config)
  3. Sending a `tools/list` request returns all 28 registered tools with correct schemas
  4. Calling `pricelabs_set_overrides`, `pricelabs_update_listings`, or `pricelabs_delete_overrides` returns an error indicating writes are disabled
**Plans:** 2/2 plans complete
Plans:
- [ ] 06-01-PLAN.md -- Write safety gate (env var gating for write tools, openclaw config, skill instruction)
- [ ] 06-02-PLAN.md -- Boot validation (automated script proving all 4 requirements)

### Phase 7: Live API Validation
**Goal**: Every read-path MCP tool successfully calls the real PriceLabs API and returns correctly shaped data for the user's actual portfolio
**Depends on**: Phase 6
**Requirements**: LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05, LIVE-06
**Success Criteria** (what must be TRUE):
  1. `pricelabs_get_listings` returns the user's real listings with valid listing IDs, names, and PMS data
  2. `pricelabs_get_prices`, `pricelabs_get_neighborhood`, and `pricelabs_get_reservations` each return real data for a known listing ID
  3. Rate limiter correctly tracks request count and cache returns cached responses on repeated calls within TTL
  4. Computed fields (price_percentile_position, occupancy_rate, revenue_pace, etc.) produce non-null numeric values from real API response shapes
**Plans:** 2 plans
Plans:
- [ ] 07-01-PLAN.md -- Live API validation script (all read tools, rate limiter, cache verification)
- [ ] 07-02-PLAN.md -- Computed fields validation + Swagger API coverage report

### Phase 8: Snapshot Persistence
**Goal**: Real portfolio data flows through the store tools into SQLite and reads back correctly, with pre-write snapshot capture verified
**Depends on**: Phase 7
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04, SAFE-02
**Success Criteria** (what must be TRUE):
  1. After calling `pricelabs_store_daily_snapshots`, querying `listing_snapshots` returns rows matching the real listing data fetched in Phase 7
  2. `pricelabs_store_price_snapshots`, `pricelabs_store_reservations`, and `pricelabs_store_market_snapshot` each persist real data that can be queried back with correct values
  3. Reservation upsert correctly detects cancellation status changes (cancelled_on populated when a previously active reservation disappears)
  4. Calling the pre-write snapshot tool captures current state to audit_log with action_type='snapshot' and the full JSON payload is queryable
**Plans**: TBD

### Phase 9: OpenClaw Deployment
**Goal**: The complete agent runs inside OpenClaw's Docker sandbox with skills loaded, environment configured, and cron jobs executing on schedule
**Depends on**: Phase 8
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05
**Success Criteria** (what must be TRUE):
  1. OpenClaw Docker container starts with the MCP server process running and responding to tool calls
  2. PriceLabs API key and SQLite database path are correctly injected via environment variables and the server uses them
  3. All 4 skill files (domain knowledge, monitoring protocols, analysis playbook, optimization playbook) are loaded and the agent references skill content when answering portfolio questions
  4. Daily health check cron job fires at its scheduled time and the agent executes the monitoring workflow
  5. Weekly optimization cron job fires at its scheduled time and the agent executes the optimization workflow
**Plans**: TBD

### Phase 10: Messaging Integration
**Goal**: Users interact with the agent through Slack and Telegram -- receiving summaries, asking questions, and approving pricing recommendations
**Depends on**: Phase 9
**Requirements**: MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, SAFE-03
**Success Criteria** (what must be TRUE):
  1. Daily health summary appears in the configured Slack channel with formatted portfolio metrics
  2. User types a natural language question in Slack (e.g., "how is my Tahoe cabin performing?") and receives a response with live PriceLabs data
  3. User can approve or reject a pricing recommendation via Slack reply and the agent acknowledges the decision
  4. Daily health summary appears in Telegram with the same content as Slack
  5. User asks a portfolio question in Telegram and receives a live data answer
**Plans**: TBD

## Progress

**Execution Order:** 6 -> 7 -> 8 -> 9 -> 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. MCP Server Foundation | v1.0 | 9/9 | Complete | 2026-02-22 |
| 2. Monitoring + Persistence + Interactive + Delivery | v1.0 | 6/6 | Complete | 2026-02-22 |
| 3. Analysis Layer + Smart Alerting | v1.0 | 3/3 | Complete | 2026-02-23 |
| 4. Write Operations + Approval Workflow | v1.0 | 3/3 | Complete | 2026-02-23 |
| 5. Scale + Feedback Loop | v1.0 | 3/3 | Complete | 2026-02-25 |
| 6. Server Boot + Safety Gate | v1.1 | 2/2 | Complete | 2026-02-25 |
| 7. Live API Validation | v1.1 | 0/2 | Planned | - |
| 8. Snapshot Persistence | v1.1 | 0/? | Not started | - |
| 9. OpenClaw Deployment | v1.1 | 0/? | Not started | - |
| 10. Messaging Integration | v1.1 | 0/? | Not started | - |

---
*Roadmap created: 2026-02-22*
*Last updated: 2026-02-25 -- Phase 7 plans created*
