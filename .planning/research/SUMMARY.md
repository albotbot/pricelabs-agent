# Project Research Summary

**Project:** PriceLabs Agent v1.2 -- Agent Identity & Production Setup
**Domain:** OpenClaw multi-agent configuration (config + markdown only, zero new code)
**Researched:** 2026-02-26
**Confidence:** HIGH

## Executive Summary

v1.2 is a pure configuration and content authoring milestone. The PriceLabs integration shipped in v1.1 with a working MCP server (28 tools), plugin bridge, 4 skill files, and cron jobs -- all running under the main agent ("Albot"). v1.2 transforms this into a dedicated, isolated OpenClaw agent with its own workspace brain, identity, messaging channels, and permanent cron jobs. No TypeScript code changes. No new npm packages. Every deliverable is either a Markdown file, a JSON config edit, or a CLI command. The OpenClaw multi-agent system is well-documented and already proven on this gateway (two inactive agent stubs exist at `~/.openclaw/agents/`).

The recommended approach is a strict dependency-ordered build: workspace files first (the agent needs a brain before it can think), then agent registration with auth profiles, then channel routing (Telegram dedicated bot, Slack peer-channel binding), then permanent cron jobs (which need working delivery targets). Each phase has a clear validation gate. The critical architectural insight is that plugins are global (not per-agent) -- the PriceLabs MCP bridge stays untouched, and per-agent `tools.allow` controls which agent sees the 28 tools. Skills move from the main workspace to the dedicated workspace as proper `SKILL.md` directories with YAML frontmatter.

The top risk is a repeat of the v1.1 sandbox tool allow bug: when a new agent entry has its own `sandbox` block, the global `tools.sandbox.tools.allow` may not inherit, silently stripping all 28 `pricelabs_*` tools. This was the root cause of the v1.1 debug session and will recur unless `pricelabs_*` is explicitly added to the new agent's tool allow list. The second risk is the Telegram flat-to-multi-account config migration -- a breaking structural change that can disconnect the main agent's existing bot if done incorrectly. Both risks are well-understood and have verified prevention steps.

## Key Findings

### Recommended Stack

Zero new dependencies. v1.2 uses only what is already deployed. See [STACK.md](./STACK.md) for full config syntax and exact CLI commands.

**Core technologies (all config-only):**
- **OpenClaw Gateway v2026.1.6+**: Multi-agent runtime with per-agent sandbox, tool config, and binding-based routing. Already deployed.
- **OpenClaw `agents.list[]`**: Declares the `pricelabs` agent with dedicated workspace, agentDir, identity, model, and tool permissions. Pure JSON config.
- **OpenClaw `bindings[]`**: Routes Telegram (account-based) and Slack (peer-channel-based) messages to the correct agent. Most-specific-wins deterministic routing.
- **OpenClaw `cron` CLI**: Registers permanent jobs with `--agent pricelabs` flag. Jobs persist in `~/.openclaw/cron/jobs.json`.
- **Markdown workspace files**: AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, MEMORY.md, BOOT.md -- the agent's brain, loaded at session start.
- **AgentSkills format**: Existing 4 skill `.md` files restructured into `skills/<name>/SKILL.md` directories with YAML frontmatter.

**Critical version requirement:** OpenClaw Gateway v2026.1.6+ for per-agent `sandbox` and `tools` config in `agents.list[]`.

### Expected Features

See [FEATURES.md](./FEATURES.md) for content patterns, sizing targets, and observed examples from other agents.

**Must have (table stakes):**
- AGENTS.md -- operating instructions, safety rules, tool usage protocol (target: 2,500-4,000 chars)
- SOUL.md -- professional revenue analyst persona, not casual Albot personality (target: 1,500-2,500 chars)
- USER.md -- Beau's profile, CST timezone, STR business context (target: 400-700 chars)
- IDENTITY.md -- unique agent name, emoji, distinct from main agent (target: 200-400 chars)
- TOOLS.md -- quick reference for 28 MCP tools, rate limits, safety gate, skill pointers (target: 800-1,500 chars)
- skills/ directory -- 4 existing skills migrated to workspace-scoped SKILL.md format
- Agent registration in openclaw.json with proper agentDir, workspace, sandbox, tools
- Channel bindings -- dedicated Telegram bot (BotFather), dedicated #pricelabs Slack channel
- Permanent cron jobs -- daily health + weekly optimization targeting dedicated channels

**Should have (differentiators):**
- BOOT.md -- gateway startup health check and "online" notification (under 500 chars)
- MEMORY.md -- seeded portfolio overview, grows over time with operational history
- Per-agent model selection -- cheaper model for routine cron, Opus for interactive analysis
- Per-agent sandbox -- restrict filesystem and tool access to PriceLabs scope only

**Defer (v2+):**
- Interactive bootstrap Q&A (pre-seed workspace instead, set `skipBootstrap: true`)
- HEARTBEAT.md (keep empty -- cron handles all scheduled work)
- Agent-to-agent messaging (keep disabled, PriceLabs agent is self-contained)
- Multi-user support, auto-approval, seasonal profiles, monthly strategy reports
- Canvas UI, voice/TTS, QMD memory backend, workspace git repo

### Architecture Approach

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system diagram, data flow, and config change inventory.

The architecture separates cleanly into existing infrastructure (unchanged) and new configuration layers. The PriceLabs plugin remains global -- both agents share the same MCP server process via stdio. Routing is the new layer: Telegram uses multi-account (one BotFather bot per agent), Slack uses peer-channel binding (single app, channel ID routes to agent). Each agent gets an isolated workspace, session store, and auth profile directory.

**Major components:**
1. **openclaw.json config** -- agents.list with main + pricelabs, bindings for routing, telegram accounts for multi-bot, slack channel allowlist. MODIFIED (major).
2. **Workspace: ~/.openclaw/workspace-pricelabs/** -- all brain files + skills/ directory. Agent runtime injects these into every context window. NEW.
3. **Agent state: ~/.openclaw/agents/pricelabs/** -- auth-profiles.json (copied from main), sessions directory. NEW.
4. **Telegram: pricelabs account** -- dedicated bot token, dmPolicy: allowlist, bound via accountId. NEW.
5. **Slack: #pricelabs channel** -- added to channel allowlist with requireMention: false, bound via peer.kind + peer.id. NEW.
6. **Cron jobs** -- 4 new jobs (daily health x2, weekly optimization x2) with `--agent pricelabs` and explicit delivery targets. NEW.
7. **PriceLabs plugin + MCP server** -- completely unchanged. Global plugin, 28 tools, stdio bridge.

**Key architectural decisions:**
- Plugins are global, not per-agent. Tool visibility controlled by per-agent `tools.allow`/`tools.deny`.
- Telegram requires separate bot per agent. Slack uses one app with channel routing.
- Skills in `<workspace>/skills/` are agent-scoped (highest precedence). Domain knowledge lives in skills (on-demand), not bootstrap files (every-turn).
- Cron jobs MUST have `--agent pricelabs` flag. Without it, jobs silently fall back to the default agent.
- Auth profiles are per-agent. Must copy from main agent directory.

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all 7 critical pitfalls, integration gotchas, and the "looks done but isn't" checklist.

1. **Sandbox tool allow list does not inherit** -- The `pricelabs_*` glob in global `tools.sandbox.tools.allow` may not carry to the new agent's sandbox scope. Must explicitly set `agents.list[].tools.sandbox.tools.allow` including `pricelabs_*`. This is a REPEAT of the v1.1 root-cause bug. Verify with `openclaw sandbox explain --agent pricelabs`. Phase 2.
2. **Telegram flat-to-multi-account migration breaks existing bot** -- Moving from `channels.telegram.botToken` (top-level) to `channels.telegram.accounts.default.botToken` is a breaking config restructure. Must migrate the existing bot FIRST, verify it still works, THEN add the pricelabs bot. Phase 3.
3. **Auth profiles not copied to new agent directory** -- The pricelabs agent cannot make LLM calls without auth. Auth is per-agent at `~/.openclaw/agents/<id>/agent/auth-profiles.json`. Must copy from main immediately after creating the agent directory. Phase 2.
4. **`agentDir` not `agentsDir` typo** -- Using the plural `agentsDir` crashed the gateway 39 times on 2026-02-14. Config validator rejects unknown keys. Always use singular `agentDir`. Phase 2.
5. **Cron jobs target wrong agent** -- Jobs created without `--agent pricelabs` silently default to the main agent. The failure mode is silent: the job runs, but with the wrong workspace and no PriceLabs skills. Verify with `openclaw cron list` after every job creation. Phase 4.

## Implications for Roadmap

Based on the dependency chain: Workspace files --> Agent registration --> Channel routing --> Cron jobs --> Validation.

### Phase 1: Workspace Brain Creation
**Rationale:** Everything depends on workspace files existing before the agent is activated. Brain files define agent identity and behavior. Skills must be migrated to SKILL.md format. No runtime changes -- this phase is pure content authoring.
**Delivers:** Complete workspace directory at `~/.openclaw/workspace-pricelabs/` with all brain files and 4 migrated skills.
**Addresses:** AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, BOOT.md, MEMORY.md, skills/ migration.
**Avoids:** Workspace brain files ignored (Pitfall 6) by keeping total bootstrap token overhead under ~2,000 tokens. Domain knowledge stays in skills (on-demand), not bootstrap files (every-turn).
**Token budget constraint:** AGENTS.md + SOUL.md + USER.md + IDENTITY.md + TOOLS.md + HEARTBEAT.md must total under ~2,000 tokens combined. This is the single most important design constraint for this phase.

### Phase 2: Agent Registration + Auth
**Rationale:** Agent must exist in openclaw.json before bindings or cron can reference it. Auth profiles must be copied immediately to enable LLM calls.
**Delivers:** Working agent entry in `agents.list[]` with correct workspace, agentDir, sandbox, tools. Auth profiles copied. Agent responds to direct messages (no channel routing yet).
**Addresses:** Agent registration, per-agent sandbox config, tool allow list with `pricelabs_*`, auth profile isolation.
**Avoids:** Sandbox tool allow bug (Pitfall 1) by explicitly setting `pricelabs_*` in agent tools config. Auth failure (Pitfall 7) by copying auth-profiles.json immediately. `agentDir` typo (Pitfall 4) by using verified config from docs.
**Validation gate:** `openclaw sandbox explain --agent pricelabs` shows `pricelabs_*`. Agent responds to "hello" with correct persona. Agent responds to "show me my listings" with actual PriceLabs data.

### Phase 3: Channel Routing (Telegram + Slack)
**Rationale:** Channel isolation must work before cron jobs can deliver to dedicated targets. Telegram migration (flat to multi-account) is a breaking change that must be done carefully and sequentially.
**Delivers:** Dedicated Telegram bot connected and routing to pricelabs agent. Dedicated #pricelabs Slack channel routing to pricelabs agent. Main agent unaffected on existing channels.
**Addresses:** Dedicated Telegram bot, Slack channel binding, bindings configuration, channel isolation.
**Avoids:** Telegram migration breaking existing bot (Pitfall 3) by migrating to multi-account format FIRST with existing bot, verifying, THEN adding new bot. Binding cross-talk (Pitfall 4) by using explicit accountId on all Telegram bindings and peer.id on Slack bindings.
**Validation gate:** `openclaw channels status --probe` shows both Telegram bots connected. Messages to PriceLabs bot route to pricelabs agent. Messages to Albot route to main agent. Messages in #pricelabs Slack channel route to pricelabs agent.

### Phase 4: Permanent Cron Jobs
**Rationale:** Cron jobs need working agent + working delivery channels. Must be the last functional phase.
**Delivers:** 4 permanent cron jobs (daily health x2 channels, weekly optimization x2 channels) targeting dedicated channels with `--agent pricelabs`.
**Addresses:** Daily health check scheduling, weekly optimization scheduling, cron agentId targeting, delivery target configuration.
**Avoids:** Cron targeting wrong agent (Pitfall 5) by always using `--agent pricelabs` flag and verifying with `openclaw cron list`. Telegram delivery failure by using explicit `--to <chatId>`.
**Validation gate:** `openclaw cron list` shows all 4 jobs with `agentId: "pricelabs"`. `openclaw cron run <jobId>` produces correct output in correct channel. No reports appear in main agent channels.

### Phase 5: End-to-End Validation + Cleanup
**Rationale:** Full system validation across all integration points. Remove PriceLabs skills from main workspace to complete the separation.
**Delivers:** Verified multi-agent system with no cross-talk. PriceLabs skills removed from main workspace. Documentation of deployment procedure.
**Addresses:** Cross-talk validation, main workspace cleanup, deployment documentation.
**Validation gate:** Full routing test matrix (each channel/bot tested with both domain-specific and generic questions). Main agent unaffected. Cron deliveries arrive in correct channels. "Looks done but isn't" checklist from PITFALLS.md passes completely.

### Phase Ordering Rationale

- **Dependency chain is strict:** Workspace files must exist before agent registration. Agent must be registered before bindings can reference it. Bindings must work before cron can deliver to dedicated channels.
- **Risk frontloading:** The two highest-risk pitfalls (sandbox tool allow, auth profiles) are in Phase 2 with immediate verification gates. The Telegram migration (third highest risk) is in Phase 3 with a sequential rollback-safe approach.
- **Isolation of breaking changes:** The Telegram flat-to-multi-account migration is isolated in Phase 3. If it fails, Phase 1 and 2 work is unaffected. Rollback is straightforward (revert channels.telegram config).
- **Content before config:** Phase 1 is pure content authoring (Markdown files) with zero runtime impact. This allows iterating on agent personality and instructions without touching the live system.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Workspace Brain):** Needs phase research for optimal token budgeting. The ~2,000 token target is tight. Must analyze how much context the 28 tool schemas consume (estimated ~3,000-5,000 tokens) and what remains for workspace files. Also needs research on SKILL.md frontmatter fields (user-invocable, description format).
- **Phase 3 (Channel Routing):** Needs phase research for the Telegram flat-to-multi-account migration. The exact behavior of `channels.telegram.botToken` (top-level) vs `channels.telegram.accounts.default.botToken` during migration is not fully documented. Test with the existing bot before adding the new one.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Agent Registration):** Well-documented in OpenClaw multi-agent docs. Exact config syntax verified in STACK.md. Copy existing agent entries as templates.
- **Phase 4 (Cron Jobs):** CLI commands are straightforward and documented. Exact commands provided in STACK.md.
- **Phase 5 (Validation):** Verification commands are all documented. "Looks done but isn't" checklist in PITFALLS.md is comprehensive.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All config sourced from OpenClaw official docs on disk. Zero new dependencies. Exact JSON syntax verified. |
| Features | HIGH | Workspace file patterns verified against 3 live agents (main, nextgen, singleseed). Token sizing based on measured char counts. |
| Architecture | HIGH | System diagram matches actual deployed infrastructure. Plugin sharing, skill precedence, and binding routing all verified in docs. |
| Pitfalls | HIGH | Top pitfall is a direct repeat of v1.1 root cause (verified in debug log). Telegram migration risk verified against channel docs. All 7 pitfalls sourced from docs or post-mortems. |

**Overall confidence:** HIGH -- This is an unusually well-documented milestone. All sources are official OpenClaw docs read from the local filesystem, plus verified live configuration and v1.1 post-mortems. The risk profile is well-understood.

### Gaps to Address

- **Telegram chatId for new bot:** The PriceLabs Telegram bot chatId is unknown until the first message is sent to it. Cron jobs need this ID for `--to` targeting. Must send `/start` to the new bot, capture chatId from gateway logs, then register cron jobs. This creates a manual step in the deployment flow.
- **Slack #pricelabs channel ID:** Unknown until the channel is created. Must be created in Slack, ID captured, then used in bindings and cron. Another manual step.
- **Token budget precision:** The ~2,000 token target for bootstrap files is an estimate based on 4 chars per token. Actual token consumption depends on the model's tokenizer. May need adjustment after first deployment using `/context list`.
- **Cron skip bug #17852:** Known OpenClaw issue that may cause scheduled jobs to silently skip. No mitigation beyond monitoring. Must watch first week of cron runs for missed executions.
- **`exec` tool for pricelabs agent:** PITFALLS.md raises whether the agent needs `exec`. If it only needs PriceLabs tools + workspace file access, denying `exec` improves security. Decision needed during Phase 2 planning.

## Sources

### Primary (HIGH confidence -- OpenClaw official docs, read from local filesystem)
- `/home/NGA/openclaw/docs/concepts/multi-agent.md` -- multi-agent routing, bindings, per-agent sandbox/tools
- `/home/NGA/openclaw/docs/concepts/agent-workspace.md` -- workspace file map, bootstrap injection, token budget
- `/home/NGA/openclaw/docs/concepts/agent.md` -- agent runtime, skill loading precedence
- `/home/NGA/openclaw/docs/concepts/system-prompt.md` -- bootstrap file injection, context budget
- `/home/NGA/openclaw/docs/concepts/memory.md` -- memory file layout, auto-flush
- `/home/NGA/openclaw/docs/tools/multi-agent-sandbox-tools.md` -- tool policy precedence, migration from single agent
- `/home/NGA/openclaw/docs/tools/skills.md` -- per-agent vs shared skills, SKILL.md format, precedence
- `/home/NGA/openclaw/docs/automation/cron-jobs.md` -- cron agentId, delivery targets, CLI reference
- `/home/NGA/openclaw/docs/automation/cron-vs-heartbeat.md` -- when to use cron vs heartbeat
- `/home/NGA/openclaw/docs/channels/telegram.md` -- multi-account Telegram, BotFather setup
- `/home/NGA/openclaw/docs/channels/slack.md` -- Socket Mode, channel allowlists, peer routing
- `/home/NGA/openclaw/docs/channels/channel-routing.md` -- routing rules, session keys, precedence
- `/home/NGA/openclaw/docs/start/bootstrapping.md` -- bootstrap ritual, workspace seeding

### Secondary (HIGH confidence -- verified live infrastructure)
- `/home/NGA/.openclaw/openclaw.json` -- current v1.1 config (single-agent, global plugin)
- `/home/NGA/.openclaw/cron/jobs.json` -- current cron jobs (5 jobs, all main agent)
- `/home/NGA/.openclaw/workspace/` -- live main agent workspace (patterns observed)
- `/home/NGA/.openclaw/agents/` -- existing agent directories (main, nextgen, singleseed)
- `/home/NGA/.openclaw/extensions/pricelabs/` -- installed plugin bridge
- `/home/NGA/.openclaw/workspace/pricelabs-skills/` -- existing 4 skill files (26,502 chars)

### Tertiary (HIGH confidence -- v1.1 post-mortems)
- `/mnt/c/Projects/pricelabs-agent/.planning/debug/openclaw-plugin-tools.md` -- sandbox tool filtering root cause
- `/mnt/c/Projects/pricelabs-agent/.planning/PROJECT.md` -- project context, known issues, constraints

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
