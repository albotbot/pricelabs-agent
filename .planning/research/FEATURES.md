# Feature Landscape

**Domain:** OpenClaw Dedicated Agent Workspace -- PriceLabs Revenue Management Agent Identity & Production Setup
**Researched:** 2026-02-26
**Overall Confidence:** HIGH -- grounded in OpenClaw official documentation (concepts/agent-workspace.md, concepts/multi-agent.md, concepts/system-prompt.md, concepts/memory.md, reference/templates/), verified against live main agent workspace and existing nextgen/singleseed agent patterns

## Scope

This document covers features for v1.2: transforming the PriceLabs integration from skills on the main agent into a **dedicated, isolated OpenClaw agent** with its own workspace brain, identity, messaging channels, and cron jobs. It does NOT cover MCP tools, API integration, or pricing logic (those are v1.0/v1.1 -- already built).

---

## Table Stakes

Features the PriceLabs agent workspace MUST have. Without these, the agent will not function as a proper isolated OpenClaw agent.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **AGENTS.md** | Operating instructions loaded every session. Defines how the agent behaves, what it reads, safety rules, tool usage patterns. Without it, agent has no operational protocol. | Medium | Existing skill files (4) for reference | Must be concise -- injected into context window every turn. Max 20,000 chars per file. |
| **SOUL.md** | Persona, tone, and boundaries. Loaded every session. Defines the agent's personality and communication style. | Low | USER.md for relationship context | Revenue management domain requires professional-but-accessible tone. Not the casual "Albot" vibe. |
| **USER.md** | User profile -- who the agent serves. Loaded every session. | Low | None | Beau's name, timezone (CST), preferences for STR business context. |
| **IDENTITY.md** | Agent name, vibe, emoji. Created during bootstrap or pre-seeded. Used by OpenClaw for display and routing. | Low | None | Needs a distinct name (not "Albot"). Avatar path optional. |
| **TOOLS.md** | Environment-specific tool notes. Loaded every session. Documents the 28 PriceLabs MCP tools, rate limits, safety gates, and any local config. | Medium | Existing domain-knowledge.md skill file | Should NOT duplicate skill content -- reference skills instead. Keep it a cheat sheet. |
| **skills/ directory** | Workspace-local skill files. Overrides managed/bundled skills on name collision. | Low | Existing 4 skill files in pricelabs-skills/ | Copy or symlink existing skill files into the agent's workspace skills/ directory. |
| **Agent registration in openclaw.json** | agents.list entry with unique id, workspace path, agentDir. Without this, no isolated sessions or routing. | Medium | Workspace directory must exist first | Key is `agentDir` (singular, NOT `agentsDir`). This is a documented crash-causing mistake. |
| **Channel bindings** | Route messages from dedicated channels to this agent. Without bindings, messages go to main agent. | Medium | Telegram bot token, Slack channel ID | Bindings use deterministic most-specific-wins routing. Peer/channel matches needed. |
| **Dedicated Telegram bot** | Separate BotFather bot for PriceLabs agent. Required for channel isolation. | Low | BotFather interaction (manual) | Token goes in channels.telegram.accounts.<id>.botToken |
| **Dedicated Slack channel** | #pricelabs channel in Slack workspace. Required for isolated cron delivery. | Low | Slack workspace admin access | Channel ID needed for cron --to parameter |
| **Permanent cron jobs** | Daily health + weekly optimization cron jobs targeting dedicated channels. Replace one-shot test pattern. | Medium | Channel bindings must work first | Use `openclaw cron add` with `--session isolated` and `--channel`/`--to` targeting |

### AGENTS.md Content Pattern (HIGH confidence)

Based on OpenClaw documentation and observed patterns from main/nextgen/singleseed agents:

```
# AGENTS.md - [Agent Name]

## First Run
- BOOTSTRAP.md ritual reference (standard)

## Every Session
1. Read SOUL.md
2. Read USER.md
3. Read memory/YYYY-MM-DD.md (today + yesterday)
4. If main session: Also read MEMORY.md

## What You Handle
- [Domain-specific responsibilities]

## How You Work
- [Operational protocols, tool usage patterns]

## Safety
- [Domain-specific safety rules]

## Tools
- [Skill references, not full content]
- [Environment-specific notes]
```

Observed size pattern: NextGen AGENTS.md = 1,134 chars. SingleSeed = 987 chars. Main agent = 17,372 chars (extremely large, includes accumulated lessons). Target for PriceLabs: 2,000-4,000 chars -- enough for domain protocols without excessive token burn.

### SOUL.md Content Pattern (HIGH confidence)

```
# SOUL.md - [Agent Name]

## Who You Work For
- [User relationship to this domain]

## What [Domain] Is
- [Domain context]

## Your Style
- [Communication patterns]
- [Decision-making approach]

## What You Handle
- [Responsibility areas]

## Your Approach
- [Philosophy, priorities]

## Safety
- [Domain-specific boundaries]
```

Observed size pattern: NextGen = 2,105 chars. SingleSeed = 1,769 chars. Main = 2,244 chars. Target for PriceLabs: 1,500-2,500 chars.

### IDENTITY.md Content Pattern (HIGH confidence)

```
# IDENTITY.md

- **Name:** [unique name]
- **Creature:** [what it is]
- **Vibe:** [personality descriptors]
- **Emoji:** [signature emoji]
- **Avatar:** [optional path]
```

Observed size: 164-495 chars. This is metadata, not prose.

### USER.md Content Pattern (HIGH confidence)

```
# USER.md - About Your Human

- **Name:** Beau
- **What to call them:** Beau
- **Timezone:** CST (America/Chicago)
- **Notes:** [STR business context]

## Context
- [Relevant business relationship details]
```

Observed size: 664 chars. Keep minimal. The agent's domain knowledge lives in skills, not here.

### TOOLS.md Content Pattern (HIGH confidence)

```
# TOOLS.md - Local Notes

## PriceLabs MCP Tools (28 tools)
- [Quick reference -- tool categories, not full descriptions]
- [Rate limit: 1000 req/hr]
- [Safety gate: PRICELABS_WRITES_ENABLED]

## Skills
- [Paths to skill files]
- [When to read each one]
```

Observed size: Main = 1,985 chars. Target for PriceLabs: 1,000-1,500 chars. Point to skills instead of duplicating.

---

## Differentiators

Features that elevate the PriceLabs agent beyond minimum viable isolated agent. Not strictly required, but significantly improve operational quality.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **BOOT.md** | Startup checklist executed on gateway restart (when hooks.internal.enabled). Can run a quick portfolio health check or send "I'm online" notification on restart. | Low | boot-md hook must be enabled | Keep SHORT. Runs via agent runner on gateway:startup event. Use message tool for outbound, then NO_REPLY. |
| **MEMORY.md** | Curated long-term memory. Enables the agent to accumulate portfolio insights, learned patterns, and operational lessons across sessions. | Medium | Memory search plugin, regular maintenance | Only loaded in main (private) sessions. NOT in cron or group contexts. Security-sensitive -- contains operational history. |
| **memory/ directory** | Daily log files (memory/YYYY-MM-DD.md). Provides session continuity. Agent reads today + yesterday at session start. | Low | Workspace writable | Auto-created by agent. memory_search and memory_get tools provide semantic recall. |
| **HEARTBEAT.md** | Periodic task checklist. Enables background monitoring without dedicated cron jobs. Can batch portfolio spot-checks, stale sync detection. | Low | Heartbeat polling must be configured | Keep it TINY to limit token burn. Empty = skip heartbeat API calls. Revenue agent may not need active heartbeat if cron handles all scheduled work. |
| **BOOTSTRAP.md** | One-time first-run ritual. Agent introduces itself, confirms identity, then deletes the file. | Low | None | Nice for onboarding UX but since we're pre-seeding the workspace (not running the standard bootstrap Q&A), may skip this entirely with `agent.skipBootstrap: true`. |
| **Pre-compaction memory flush** | Automatic prompt to write durable memory before context window compacts. Prevents loss of in-session learnings. | Low (config only) | agents.defaults.compaction.memoryFlush | Already configured globally. Per-agent override possible via agents.list[].compaction if needed. |
| **Agent-specific model selection** | Use a specific model for the PriceLabs agent (e.g., a cheaper/faster model for routine cron health checks vs. Opus for interactive analysis). | Low (config only) | Model must be configured in providers | Set via agents.list[].model in openclaw.json. Could use Sonnet for cron, Opus for interactive. |
| **Per-agent sandbox config** | Restrict the PriceLabs agent's filesystem access and tool permissions. Only allow pricelabs_* tools + essential core tools. | Medium | agents.list[].sandbox + agents.list[].tools | Good security practice. Already have sandbox.tools.allow glob for pricelabs_* from v1.1. |
| **Cron job agentId targeting** | Cron jobs explicitly target the pricelabs agentId so they run in the agent's isolated session with its workspace context. | Medium | Agent registration must be complete | Use --agent <agentId> flag in cron add, or configure agentId in job definition. |

### BOOT.md Content Pattern (HIGH confidence)

```
# BOOT.md

Send a brief "online" notification to the #pricelabs Slack channel.
Read today's memory file if it exists.
Check pricelabs_get_api_status to verify API connectivity.
If API is down, alert via message tool.
Reply with NO_REPLY.
```

Keep under 500 chars. This runs on every gateway restart.

### MEMORY.md Content Pattern (MEDIUM confidence)

For a revenue management agent, long-term memory should accumulate:
- Portfolio composition (listing IDs, names, property types)
- Learned pricing patterns (seasonal trends, event-based demand)
- Historical recommendations and their outcomes
- User preferences for alert thresholds and communication style
- Known issues per listing (stale syncs, pricing anomalies)

Initial state: seed with current portfolio overview. Let the agent build it over time.

### HEARTBEAT.md Content Pattern (HIGH confidence)

```
# HEARTBEAT.md

# Keep empty unless you want periodic background checks.
# Revenue agent uses cron for scheduled work, not heartbeat.
# Add tasks below only for ad-hoc monitoring needs.
```

For a domain-specific agent that runs scheduled cron jobs, heartbeat is mostly unnecessary. Leave empty by default. The main agent's heartbeat pattern (checking email, calendar, weather) does not apply to a revenue management agent.

---

## Anti-Features

Features to explicitly NOT build for the v1.2 PriceLabs agent workspace.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Massive AGENTS.md** | Main agent AGENTS.md grew to 17,372 chars with accumulated lessons, model selection strategy, group chat rules, sub-agent monitoring, etc. This burns ~4,300 tokens EVERY turn. A domain agent does not need general-purpose instructions. | Keep AGENTS.md under 4,000 chars. Domain protocols live in skills/, not AGENTS.md. Reference skills by path. |
| **General-purpose personality** | The PriceLabs agent is NOT a personal assistant. It should not have casual chat capabilities, humor directives, or "break the tension" instructions. | SOUL.md should be professional, domain-focused. "Revenue analyst" not "friend." |
| **Group chat rules** | PriceLabs agent operates in dedicated channels only. No need for "when to speak" / "when to stay silent" group chat protocols. | Bind to specific channels via openclaw.json bindings. No group chat logic needed. |
| **Multi-model selection strategy** | Main agent's 3-tier model routing (Ollama/Ephor/Opus) is overkill for a focused agent that runs the same types of tasks. | Set one model in agents.list[].model. Optionally use a cheaper model for cron jobs. |
| **Email/calendar/social monitoring** | Heartbeat checks for email, calendar, weather are main agent concerns. Revenue agent has no mailbox. | Leave HEARTBEAT.md empty. All scheduled work goes through cron. |
| **Interactive bootstrap Q&A** | Standard BOOTSTRAP.md ritual has the agent ask "who am I?" -- unnecessary for a pre-configured domain agent. | Pre-seed all workspace files. Set agent.skipBootstrap: true. OR use a minimal BOOTSTRAP.md that just confirms identity and deletes itself. |
| **Workspace git repo** | While recommended for the main agent, a separate git repo for the PriceLabs agent workspace is unnecessary overhead when the agent's configuration already lives in the pricelabs-agent project repo. | Track workspace files in the project repo under openclaw/ or a similar path. Symlink or copy to the OpenClaw workspace path at deploy time. |
| **QMD memory backend** | The main agent uses QMD for searching across 300+ workshop docs. The PriceLabs agent has 4 skill files and will accumulate modest daily memory. Default SQLite memory search is sufficient. | Use default memory search (builtin SQLite indexer). No QMD configuration needed. |
| **Canvas UI** | The PriceLabs agent communicates via Slack and Telegram. No web canvas needed. | Skip canvas/ directory entirely. |
| **Voice/TTS capabilities** | Revenue data is best consumed as text (numbers, tables, charts). Voice adds no value. | Do not include sag or voice skills. |
| **Agent-to-agent messaging** | While OpenClaw supports tools.agentToAgent, the PriceLabs agent should not initiate conversations with other agents. It responds to user queries and runs scheduled reports. | Keep tools.agentToAgent.enabled: false (default). If cross-agent communication is needed in v2.0+, enable then. |

---

## Feature Dependencies

```
Agent registration (openclaw.json)
  --> Workspace directory (files must exist before registration)
  --> Channel bindings (require agentId to exist)
    --> Dedicated Telegram bot (token needed for binding)
    --> Dedicated Slack channel (channelId needed for binding)
      --> Permanent cron jobs (need channel targets for delivery)

AGENTS.md --> SOUL.md (references persona)
AGENTS.md --> skills/ (references skill file paths)
AGENTS.md --> TOOLS.md (references tool notes)

BOOT.md --> boot-md hook enabled in openclaw.json
BOOT.md --> Channel bindings (to send startup notification)

MEMORY.md --> memory/ directory (daily files feed long-term curation)
MEMORY.md --> Memory search plugin (for semantic recall)

Cron jobs --> Agent registration (need agentId)
Cron jobs --> Channel bindings (need delivery targets)
Cron jobs --> skills/ loaded (cron prompts reference skill protocols)
```

Critical path: **Workspace files --> Agent registration --> Channel bindings --> Cron jobs**

---

## MVP Recommendation

### Phase 1: Workspace Files (build first)

Create all workspace brain files for the PriceLabs agent:

1. **AGENTS.md** -- Operating instructions. Reference skill files by path. Include: session startup protocol, safety rules, write gate reminder, rate budget awareness, cron response formatting.
2. **SOUL.md** -- Professional revenue analyst persona. Direct, data-driven, no-nonsense. Not casual. Not a personal assistant.
3. **USER.md** -- Beau's profile. Name, timezone, STR business context.
4. **IDENTITY.md** -- Unique name + emoji. Suggestions: "RevBot" / "PriceBot" / a domain-appropriate name.
5. **TOOLS.md** -- Quick reference for 28 MCP tools, rate limits, safety gate, skill file locations.
6. **skills/** -- Copy the 4 existing skill files (domain-knowledge.md, monitoring-protocols.md, analysis-playbook.md, optimization-playbook.md).
7. **BOOT.md** -- Gateway startup: verify API health, send "online" to #pricelabs.
8. **HEARTBEAT.md** -- Empty (cron handles all scheduled work).
9. **MEMORY.md** -- Seed with portfolio overview and operational baseline.
10. **memory/** -- Create directory. Agent populates daily files.

### Phase 2: Agent Registration + Channel Routing (build second)

1. Add agent to openclaw.json agents.list with id, workspace, agentDir.
2. Create dedicated Telegram bot via BotFather.
3. Create #pricelabs Slack channel.
4. Add Telegram account entry in channels.telegram.accounts.
5. Add Slack channel binding.
6. Add bindings routing dedicated channels to pricelabs agentId.
7. Configure per-agent sandbox and tool permissions.
8. Restart gateway, verify with `openclaw agents list --bindings`.

### Phase 3: Permanent Cron Jobs (build third)

1. Register daily health check cron job targeting #pricelabs Slack + Telegram.
2. Register weekly optimization report cron job.
3. Verify cron jobs fire with agent's workspace context (not main agent).
4. End-to-end validation: agent responds independently, cron delivers to dedicated channels, no cross-talk with main agent.

### Defer: BOOTSTRAP.md

Pre-seed workspace instead of running interactive bootstrap ritual. Set `agent.skipBootstrap: true` or provide a minimal BOOTSTRAP.md that self-deletes.

---

## Workspace File Sizing Budget

OpenClaw injects bootstrap files into every context window. Token burn matters.

| File | Target Size (chars) | Estimated Tokens | Injected Every Turn? |
|------|--------------------:|------------------:|---------------------|
| AGENTS.md | 2,500-4,000 | ~625-1,000 | Yes |
| SOUL.md | 1,500-2,500 | ~375-625 | Yes |
| USER.md | 400-700 | ~100-175 | Yes |
| IDENTITY.md | 200-400 | ~50-100 | Yes |
| TOOLS.md | 800-1,500 | ~200-375 | Yes |
| HEARTBEAT.md | 100-200 | ~25-50 | Yes |
| BOOT.md | 200-500 | ~50-125 | No (startup only) |
| MEMORY.md | 1,000-3,000 | ~250-750 | Main sessions only |
| BOOTSTRAP.md | 0 (skip) | 0 | First run only |
| **Total per-turn overhead** | **~5,500-9,300** | **~1,375-2,325** | |

For comparison: the main agent's bootstrap files consume ~6,000+ tokens per turn (AGENTS.md alone is ~4,300 tokens). The PriceLabs agent should aim for under 2,000 tokens total bootstrap overhead.

Keep AGENTS.md lean. Domain knowledge lives in skills (loaded on demand, NOT injected per-turn). This is the single most important architecture decision for the workspace.

---

## Key Design Principle: Skills vs Bootstrap Files

**Bootstrap files** (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md) are injected into EVERY context window. They consume tokens on every single turn.

**Skills** (skills/*.md) are loaded ON DEMAND when the agent needs them. They appear in the system prompt as a compact skills list (name + description + location), and the agent reads the full SKILL.md only when executing a relevant task.

**Implication:** Put operational protocols in skills. Put only startup behavior, safety rules, and quick-reference metadata in bootstrap files. The 4 existing PriceLabs skill files (6,124 + 5,556 + 5,316 + 9,506 = 26,502 chars of domain knowledge) should NEVER be inlined into AGENTS.md or TOOLS.md.

This is the pattern the main agent already uses: AGENTS.md says "read pricelabs-skills/monitoring-protocols.md for the Daily Health Check Protocol" instead of including the protocol inline.

---

## Sources

- OpenClaw Agent Workspace docs: `/home/NGA/openclaw/docs/concepts/agent-workspace.md` (HIGH confidence)
- OpenClaw Multi-Agent Routing docs: `/home/NGA/openclaw/docs/concepts/multi-agent.md` (HIGH confidence)
- OpenClaw System Prompt docs: `/home/NGA/openclaw/docs/concepts/system-prompt.md` (HIGH confidence)
- OpenClaw Context docs: `/home/NGA/openclaw/docs/concepts/context.md` (HIGH confidence)
- OpenClaw Memory docs: `/home/NGA/openclaw/docs/concepts/memory.md` (HIGH confidence)
- OpenClaw Bootstrapping docs: `/home/NGA/openclaw/docs/start/bootstrapping.md` (HIGH confidence)
- OpenClaw Agent Runtime docs: `/home/NGA/openclaw/docs/concepts/agent.md` (HIGH confidence)
- OpenClaw Reference Templates: `/home/NGA/openclaw/docs/reference/templates/` (HIGH confidence)
- OpenClaw Hooks/BOOT.md docs: `/home/NGA/openclaw/docs/automation/hooks.md` (HIGH confidence)
- OpenClaw Cron docs: `/home/NGA/openclaw/docs/automation/cron-jobs.md` (HIGH confidence)
- Live main agent workspace: `/home/NGA/.openclaw/workspace/` (HIGH confidence -- verified patterns)
- NextGen agent: `/home/NGA/.openclaw/agents/nextgen/` (HIGH confidence -- verified multi-agent pattern)
- SingleSeed agent: `/home/NGA/.openclaw/agents/singleseed/` (HIGH confidence -- verified multi-agent pattern)
- Existing PriceLabs skills: `/home/NGA/.openclaw/workspace/pricelabs-skills/` (HIGH confidence -- 4 files, 26,502 chars total)
