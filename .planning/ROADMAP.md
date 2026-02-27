# Roadmap: PriceLabs Agent

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-5, 43 requirements (shipped 2026-02-25)
- ✅ **v1.1 Integration & Validation** -- Phases 6-10, 26 requirements (shipped 2026-02-26)
- **v1.2 Agent Identity & Production Setup** -- Phases 11-15, 29 requirements

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) -- SHIPPED 2026-02-25</summary>

- [x] Phase 1: MCP Server Foundation + Infrastructure Security (9 plans) -- 6 requirements
- [x] Phase 2: Monitoring + Persistence + Interactive + Delivery (6 plans) -- 17 requirements
- [x] Phase 3: Analysis Layer + Smart Alerting (3 plans) -- 6 requirements
- [x] Phase 4: Write Operations + Approval Workflow (3 plans) -- 10 requirements
- [x] Phase 5: Scale + Feedback Loop (3 plans) -- 4 requirements

**Total:** 24 plans, 43 requirements, 28 MCP tools, 4 skills, 7 SQLite tables

See `.planning/milestones/v1.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v1.1 Integration & Validation (Phases 6-10) -- SHIPPED 2026-02-26</summary>

- [x] Phase 6: Server Boot + Safety Gate (2 plans) -- BOOT-01..03, SAFE-01
- [x] Phase 7: Live API Validation (2 plans) -- LIVE-01..06
- [x] Phase 8: Snapshot Persistence (1 plan) -- STORE-01..04, SAFE-02
- [x] Phase 9: OpenClaw Deployment (2 plans) -- DEPLOY-01..05
- [x] Phase 10: Messaging Integration (2 plans) -- MSG-01..05, SAFE-03

**Total:** 9 plans, 26 requirements, 5 validation scripts, OpenClaw plugin bridge, 11 live tests

See `.planning/milestones/v1.1-ROADMAP.md` for full phase details.

</details>

### v1.2 Agent Identity & Production Setup

**Milestone Goal:** Transform the PriceLabs integration into a dedicated OpenClaw agent with its own workspace brain, identity, messaging channels, and permanent cron jobs -- a first-class peer in the multi-agent ecosystem. Entirely config + markdown; zero new TypeScript code.

- [ ] **Phase 11: Workspace Brain** -- Author all workspace files and migrate skills to agent-scoped format
- [ ] **Phase 12: Agent Registration** -- Register agent in openclaw.json with sandbox, tools, and auth profiles
- [ ] **Phase 13: Channel Routing** -- Migrate Telegram to multi-account, create dedicated bot and Slack channel, bind routing
- [ ] **Phase 14: Permanent Cron Jobs** -- Register 4 permanent cron jobs targeting dedicated agent and channels
- [ ] **Phase 15: End-to-End Validation** -- Full routing test matrix, main agent regression, workspace cleanup

## Phase Details

### Phase 11: Workspace Brain
**Goal**: Agent has a complete workspace brain -- personality, instructions, tools reference, and domain skills -- that fits within the bootstrap token budget
**Depends on**: Phase 10 (v1.1 shipped; existing skills and MCP tools are the input)
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, WORK-07, WORK-08, WORK-09
**Research flag**: Needs phase research for token budgeting (~2,000 token target) and SKILL.md frontmatter format
**Success Criteria** (what must be TRUE):
  1. Workspace directory at `~/.openclaw/workspace-pricelabs/` contains AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, BOOT.md, and MEMORY.md -- each within its character budget
  2. All 4 existing skill files exist as `skills/<name>/SKILL.md` with valid YAML frontmatter in the workspace directory
  3. Combined bootstrap files (AGENTS.md + SOUL.md + USER.md + IDENTITY.md + TOOLS.md) total under ~2,000 tokens as measured by model tokenizer or 4-chars-per-token estimate
  4. SOUL.md persona reads as a professional revenue analyst distinct from the main agent (Albot) personality
  5. MEMORY.md is seeded with portfolio overview (5 listings, TN/NH markets) ready to grow with operational history
**Plans:** 2 plans

Plans:
- [ ] 11-01-PLAN.md -- Author bootstrap workspace files (AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, HEARTBEAT.md) and validate token budget
- [ ] 11-02-PLAN.md -- Create BOOT.md and MEMORY.md, migrate 4 skill files to SKILL.md format

### Phase 12: Agent Registration
**Goal**: Agent is registered in OpenClaw, can authenticate for LLM calls, sees all 28 PriceLabs tools, and responds with correct persona
**Depends on**: Phase 11 (workspace files must exist before agent activation)
**Requirements**: AGEN-01, AGEN-02, AGEN-03, AGEN-04, AGEN-05
**Key risk**: Sandbox tool allow list does NOT inherit from global -- must explicitly set `pricelabs_*` in per-agent config. Also: `agentDir` not `agentsDir` (typo crashed gateway 39 times in v1.1). Auth profiles must be copied immediately after directory creation.
**Success Criteria** (what must be TRUE):
  1. `openclaw.json` contains agent entry with id "pricelabs", correct `agentDir` path, and workspace pointing to workspace-pricelabs
  2. `openclaw sandbox explain --agent pricelabs` shows `pricelabs_*` in the tool allow list
  3. Auth profiles exist at `~/.openclaw/agents/pricelabs/agent/auth-profiles.json` and agent can make LLM calls
  4. Agent responds to "hello" with the SOUL.md revenue analyst persona, not the main agent personality
  5. Agent responds to "show me my listings" with real PriceLabs API data from all 28 MCP tools
**Plans**: TBD

### Phase 13: Channel Routing
**Goal**: Dedicated Telegram bot and Slack channel route exclusively to the PriceLabs agent while existing main agent messaging continues unaffected
**Depends on**: Phase 12 (agent must be registered before bindings can reference it)
**Requirements**: CHAN-01, CHAN-02, CHAN-03, CHAN-04, CHAN-05, CHAN-06
**Research flag**: Needs phase research for Telegram flat-to-multi-account migration behavior
**Key risk**: Telegram flat-to-multi-account migration is a BREAKING config change. Must migrate existing bot to multi-account format first, verify it still works, THEN add the PriceLabs bot. Rolling back is straightforward (revert channels.telegram config).
**Success Criteria** (what must be TRUE):
  1. Telegram config uses multi-account format (`channels.telegram.accounts`) with both main and pricelabs bots connected
  2. Messages sent to the PriceLabs Telegram bot route to the pricelabs agent and get domain-appropriate responses
  3. Messages sent to the existing main Telegram bot continue routing to the main agent (no disruption)
  4. Messages in the dedicated #pricelabs Slack channel route to the pricelabs agent
  5. Messages in existing Slack channels continue routing to the main agent (no cross-talk)
**Plans**: TBD

### Phase 14: Permanent Cron Jobs
**Goal**: Four permanent cron jobs deliver daily health summaries and weekly optimization reports to dedicated PriceLabs channels via the PriceLabs agent
**Depends on**: Phase 13 (channels must be routed before cron can deliver to them)
**Requirements**: CRON-01, CRON-02, CRON-03, CRON-04, CRON-05
**Key risk**: Cron jobs without `--agent pricelabs` flag silently default to main agent -- the job runs but with the wrong workspace and no PriceLabs skills. Telegram delivery requires explicit `--to <chatId>`. All jobs must be permanent (not `--delete-after-run`).
**Success Criteria** (what must be TRUE):
  1. `openclaw cron list` shows 4 jobs with `agentId: "pricelabs"` -- daily health (Slack), daily health (Telegram), weekly optimization (Slack), weekly optimization (Telegram)
  2. All 4 jobs persist across gateway restarts (permanent, no `--delete-after-run`)
  3. Manual trigger via `openclaw cron run <jobId>` delivers output to the correct dedicated channel (not main agent channels)
  4. Cron-delivered reports use the PriceLabs agent persona and reference real portfolio data
**Plans**: TBD

### Phase 15: End-to-End Validation
**Goal**: Multi-agent system verified end-to-end with no cross-talk, main agent fully regression-tested, and PriceLabs skills removed from main workspace to complete separation
**Depends on**: Phase 14 (all functional components must be in place)
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04
**Success Criteria** (what must be TRUE):
  1. Full routing test matrix passes -- each channel/bot tested with both domain-specific questions ("show my listings") and generic questions ("hello"), no cross-talk between agents
  2. Cron deliveries arrive in correct dedicated channels -- health summaries and optimization reports never appear in main agent channels
  3. Main agent functionality unaffected -- existing cron jobs, Slack channels, Telegram bot, and skills all work normally
  4. PriceLabs skill files removed from main agent workspace (`~/.openclaw/workspace/pricelabs-skills/` cleaned up), completing full agent separation
**Plans**: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. MCP Server Foundation | v1.0 | 9/9 | Complete | 2026-02-22 |
| 2. Monitoring + Persistence + Interactive + Delivery | v1.0 | 6/6 | Complete | 2026-02-22 |
| 3. Analysis Layer + Smart Alerting | v1.0 | 3/3 | Complete | 2026-02-23 |
| 4. Write Operations + Approval Workflow | v1.0 | 3/3 | Complete | 2026-02-23 |
| 5. Scale + Feedback Loop | v1.0 | 3/3 | Complete | 2026-02-25 |
| 6. Server Boot + Safety Gate | v1.1 | 2/2 | Complete | 2026-02-25 |
| 7. Live API Validation | v1.1 | 2/2 | Complete | 2026-02-25 |
| 8. Snapshot Persistence | v1.1 | 1/1 | Complete | 2026-02-26 |
| 9. OpenClaw Deployment | v1.1 | 2/2 | Complete | 2026-02-26 |
| 10. Messaging Integration | v1.1 | 2/2 | Complete | 2026-02-26 |
| 11. Workspace Brain | v1.2 | 0/2 | Planned | - |
| 12. Agent Registration | v1.2 | 0/? | Not started | - |
| 13. Channel Routing | v1.2 | 0/? | Not started | - |
| 14. Permanent Cron Jobs | v1.2 | 0/? | Not started | - |
| 15. End-to-End Validation | v1.2 | 0/? | Not started | - |

---
*Roadmap created: 2026-02-22*
*Last updated: 2026-02-26 -- v1.2 phases 11-15 added*
