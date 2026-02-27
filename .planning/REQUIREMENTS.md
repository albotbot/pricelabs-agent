# Requirements: PriceLabs Agent v1.2

**Defined:** 2026-02-26
**Core Value:** Reliably monitor portfolio health and surface actionable pricing recommendations via messaging -- never making a pricing change without explicit owner approval.

## v1.2 Requirements

Requirements for Agent Identity & Production Setup. Each maps to roadmap phases (11-15).

### Workspace Brain

- [x] **WORK-01**: Agent has AGENTS.md with operating instructions, safety rules, and tool usage protocol (under 4,000 chars)
- [x] **WORK-02**: Agent has SOUL.md with professional revenue analyst persona distinct from main agent personality (under 2,500 chars)
- [x] **WORK-03**: Agent has USER.md with owner profile, timezone (CST/EST), and STR business context (under 700 chars)
- [x] **WORK-04**: Agent has IDENTITY.md with unique name, emoji, and description distinct from main agent (under 400 chars)
- [x] **WORK-05**: Agent has TOOLS.md with quick reference for 28 MCP tools, rate limits, safety gate status, and skill pointers (under 1,500 chars)
- [ ] **WORK-06**: Agent has BOOT.md with startup health check and online notification procedure (under 500 chars)
- [ ] **WORK-07**: Agent has MEMORY.md seeded with portfolio overview (5 listings, TN/NH markets) that grows with operational history
- [ ] **WORK-08**: All 4 existing skill files migrated to workspace-scoped `skills/<name>/SKILL.md` format with YAML frontmatter
- [x] **WORK-09**: Combined bootstrap file token overhead (AGENTS.md + SOUL.md + USER.md + IDENTITY.md + TOOLS.md) stays under ~2,000 tokens

### Agent Registration

- [ ] **AGEN-01**: Agent registered in openclaw.json `agents.list[]` with id "pricelabs", correct `agentDir` (not `agentsDir`), and workspace path
- [ ] **AGEN-02**: Agent has per-agent sandbox config with `pricelabs_*` explicitly in `tools.sandbox.tools.allow` (not relying on global inheritance)
- [ ] **AGEN-03**: Auth profiles copied from main agent to `~/.openclaw/agents/pricelabs/agent/auth-profiles.json` enabling LLM calls
- [ ] **AGEN-04**: Agent responds to direct messages with correct persona (SOUL.md personality, not main agent)
- [ ] **AGEN-05**: Agent can access all 28 PriceLabs MCP tools and return real API data when queried

### Channel Routing

- [ ] **CHAN-01**: Telegram config migrated from flat `botToken` to multi-account format (`channels.telegram.accounts`) without breaking existing main agent bot
- [ ] **CHAN-02**: Dedicated PriceLabs Telegram bot created via BotFather and connected as second account in OpenClaw
- [ ] **CHAN-03**: Telegram binding routes messages from PriceLabs bot to pricelabs agent (accountId-based routing)
- [ ] **CHAN-04**: Dedicated #pricelabs Slack channel created and added to channel allowlist
- [ ] **CHAN-05**: Slack binding routes messages in #pricelabs channel to pricelabs agent (peer-channel routing)
- [ ] **CHAN-06**: Main agent messaging unaffected -- existing Telegram bot and Slack channels continue routing to main agent

### Permanent Cron Jobs

- [ ] **CRON-01**: Daily health summary cron job registered targeting pricelabs agent via `--agent pricelabs` flag, delivering to dedicated Slack channel
- [ ] **CRON-02**: Daily health summary cron job registered targeting pricelabs agent, delivering to dedicated Telegram bot
- [ ] **CRON-03**: Weekly optimization report cron job registered targeting pricelabs agent, delivering to dedicated Slack channel
- [ ] **CRON-04**: Weekly optimization report cron job registered targeting pricelabs agent, delivering to dedicated Telegram bot
- [ ] **CRON-05**: All 4 cron jobs persist across gateway restarts (permanent, not `--delete-after-run`)

### End-to-End Validation

- [ ] **E2E-01**: Full routing test matrix passes -- each channel/bot tested with domain-specific and generic questions, no cross-talk
- [ ] **E2E-02**: Cron deliveries arrive in correct dedicated channels, not main agent channels
- [ ] **E2E-03**: Main agent functionality unaffected -- existing cron jobs, channels, and skills work normally
- [ ] **E2E-04**: PriceLabs skills removed from main agent workspace (complete separation)

## v2.0 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-User

- **MULTI-01**: Support multiple hosts/PMs with separate portfolios
- **MULTI-02**: Per-user API key management
- **MULTI-03**: Per-user channel routing

### Automation

- **AUTO-01**: Auto-approval for low-risk changes below user-defined thresholds
- **AUTO-02**: Seasonal profile management via agent
- **AUTO-03**: Monthly strategy report with portfolio-level KPI forecasting

### UX Enhancement

- **UX-01**: Interactive button-based approval (replace reply-text)
- **UX-02**: Per-agent model selection (cheaper for cron, premium for interactive)

## Out of Scope

| Feature | Reason |
|---------|--------|
| HEARTBEAT.md | Cron handles all scheduled work; heartbeat adds unnecessary complexity |
| Agent-to-agent messaging | PriceLabs agent is self-contained; no inter-agent communication needed |
| Interactive bootstrap Q&A | Pre-seed workspace instead; set `skipBootstrap: true` |
| New TypeScript code | v1.2 is entirely config + markdown; MCP server unchanged |
| Write operations enabled | Keep PRICELABS_WRITES_ENABLED=false; trust earned progressively |
| Canvas UI / Voice / TTS | Future product concerns, not current milestone |
| Workspace git repo | Unnecessary overhead for config files managed via project repo |
| Multiple Slack apps | Single Slack app with peer-channel routing is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WORK-01 | Phase 11 | Complete |
| WORK-02 | Phase 11 | Complete |
| WORK-03 | Phase 11 | Complete |
| WORK-04 | Phase 11 | Complete |
| WORK-05 | Phase 11 | Complete |
| WORK-06 | Phase 11 | Pending |
| WORK-07 | Phase 11 | Pending |
| WORK-08 | Phase 11 | Pending |
| WORK-09 | Phase 11 | Complete |
| AGEN-01 | Phase 12 | Pending |
| AGEN-02 | Phase 12 | Pending |
| AGEN-03 | Phase 12 | Pending |
| AGEN-04 | Phase 12 | Pending |
| AGEN-05 | Phase 12 | Pending |
| CHAN-01 | Phase 13 | Pending |
| CHAN-02 | Phase 13 | Pending |
| CHAN-03 | Phase 13 | Pending |
| CHAN-04 | Phase 13 | Pending |
| CHAN-05 | Phase 13 | Pending |
| CHAN-06 | Phase 13 | Pending |
| CRON-01 | Phase 14 | Pending |
| CRON-02 | Phase 14 | Pending |
| CRON-03 | Phase 14 | Pending |
| CRON-04 | Phase 14 | Pending |
| CRON-05 | Phase 14 | Pending |
| E2E-01 | Phase 15 | Pending |
| E2E-02 | Phase 15 | Pending |
| E2E-03 | Phase 15 | Pending |
| E2E-04 | Phase 15 | Pending |

**Coverage:**
- v1.2 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after research synthesis*
