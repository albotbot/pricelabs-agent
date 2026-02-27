# Architecture: Dedicated PriceLabs Agent Integration

**Domain:** Multi-agent OpenClaw integration -- dedicated PriceLabs agent with channel routing
**Researched:** 2026-02-26
**Milestone:** v1.2 Agent Identity & Production Setup
**Overall confidence:** HIGH (verified against OpenClaw docs on disk at /home/NGA/openclaw/docs/)

## Executive Summary

The v1.2 milestone transforms the PriceLabs integration from a plugin loaded by the "main" (Albot) agent into a **dedicated, isolated OpenClaw agent** (`pricelabs`) with its own workspace, brain files, channel accounts, and cron jobs. This is a configuration-heavy milestone: most changes live in `~/.openclaw/openclaw.json` and new workspace files, not in application code.

OpenClaw's multi-agent system is well-documented and the existing infrastructure already includes two inactive agent stubs (`nextgen` and `singleseed` at `~/.openclaw/agents/`), proving the pattern works on this gateway. The PriceLabs plugin is already loaded globally; the key architectural question is how to route it to the dedicated agent while keeping it available for the main agent too (answered: plugins are global, per-agent tool allow/deny controls access).

---

## Current State (v1.1)

```
~/.openclaw/openclaw.json
  agents.list = []                          # empty -- single-agent mode, agentId = "main"
  agents.defaults.workspace = ~/.openclaw/workspace   # Albot's workspace
  plugins.entries.pricelabs = { enabled: true, ... }  # global plugin
  tools.sandbox.tools.allow = ["pricelabs_*", ...]    # global tool allow
  channels.telegram = { botToken: "8540...", ... }    # single bot
  channels.slack = { botToken: "xoxb-...", channels: { C0AF9MXD0ER, C0AG7FJNKNC } }
  bindings = (none)                         # everything routes to "main"

~/.openclaw/workspace/pricelabs-skills/     # 4 skill files in main workspace
~/.openclaw/extensions/pricelabs/           # plugin bridge (index.ts + tool-definitions.json)
~/.openclaw/cron/jobs.json                  # 5 jobs, all agentId: "main"
```

**Problems with current state:**
1. PriceLabs skills pollute the main agent's workspace (Albot loads all 4 skill files every session)
2. Cron jobs target the main agent -- health summaries appear in Albot's context
3. No channel isolation -- PriceLabs reports arrive alongside Albot's other messages
4. No dedicated brain -- PriceLabs agent shares Albot's SOUL.md, IDENTITY.md, USER.md

---

## Target State (v1.2)

```
~/.openclaw/openclaw.json
  agents.list = [
    { id: "main", default: true, workspace: "~/.openclaw/workspace" },
    { id: "pricelabs", workspace: "~/.openclaw/workspace-pricelabs", ... }
  ]
  bindings = [
    { agentId: "pricelabs", match: { channel: "telegram", accountId: "pricelabs" } },
    { agentId: "pricelabs", match: { channel: "slack", peer: { kind: "channel", id: "C_PRICELABS" } } },
    ... (main agent catches everything else via default)
  ]
  channels.telegram.accounts = {
    default: { botToken: "8540..." },          # Albot's existing bot
    pricelabs: { botToken: "<NEW_BOT_TOKEN>" }  # PriceLabs dedicated bot
  }
  channels.slack.channels.C_PRICELABS = { allow: true, requireMention: false }

~/.openclaw/workspace-pricelabs/            # dedicated workspace
  AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, MEMORY.md,
  HEARTBEAT.md, BOOT.md, BOOTSTRAP.md
  skills/                                   # per-agent skills (moved from main)
    domain-knowledge/SKILL.md
    monitoring-protocols/SKILL.md
    analysis-playbook/SKILL.md
    optimization-playbook/SKILL.md

~/.openclaw/agents/pricelabs/               # agent state directory
  agent/auth-profiles.json                  # copy from main (shares codex auth)
  sessions/                                 # isolated session store

~/.openclaw/cron/jobs.json                  # cron jobs with agentId: "pricelabs"
```

---

## Recommended Architecture

### System Diagram (v1.2)

```
+----------------------------------------------------------------------+
|                        OpenClaw Gateway                               |
|  ~/.openclaw/openclaw.json                                           |
|  ws://127.0.0.1:2974                                                 |
+----------------------------------------------------------------------+
      |              |              |              |
+----------+  +-----------+  +-----------+  +------------+
| Slack    |  | Telegram  |  | Telegram  |  | Cron       |
| (Socket) |  | default   |  | pricelabs |  | Scheduler  |
| 1 app    |  | (Albot)   |  | (new bot) |  | jobs.json  |
+----------+  +-----------+  +-----------+  +------------+
      |              |              |              |
      |              |              |              |
   [bindings route to correct agent]               |
      |              |              |              |
+------------------+    +--------------------------|------+
| Agent: main      |    | Agent: pricelabs                |
| (Albot)          |    | (PriceLabs Revenue Agent)       |
| workspace:       |    | workspace:                      |
|  ~/.openclaw/    |    |  ~/.openclaw/                   |
|  workspace       |    |  workspace-pricelabs            |
| sessions:        |    | sessions:                       |
|  agents/main/    |    |  agents/pricelabs/              |
|  sessions/       |    |  sessions/                      |
+------------------+    +---------------------------------+
                                   |
                         +------------------+
                         | PriceLabs Plugin |
                         | (global, shared) |
                         | 28 MCP tools     |
                         +------------------+
                                   |
                         +------------------+
                         | MCP Server       |
                         | (child process)  |
                         | stdio JSON-RPC   |
                         +------------------+
                                   |
                    +--------------+-----------+
                    |                          |
           +------------------+    +------------------+
           | api.pricelabs.co |    | SQLite DB        |
           | REST API         |    | ~/.pricelabs-    |
           +------------------+    |  agent/data.db   |
                                   +------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | New/Modified |
|-----------|---------------|-------------------|--------------|
| **openclaw.json** | Agent list, bindings, channel accounts, plugin config | Gateway (read at startup + hot-reload) | MODIFIED (major) |
| **Agent: pricelabs** | Isolated workspace, brain files, per-agent skills, PriceLabs domain reasoning | Gateway (sessions), plugin (tool calls) | NEW |
| **Workspace: pricelabs** | AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, MEMORY.md, HEARTBEAT.md, BOOT.md, skills/ | Agent runtime (bootstrap injection) | NEW |
| **Telegram: pricelabs account** | Dedicated bot token, DM/group routing for PriceLabs interactions | Gateway (inbound/outbound), bindings (routing) | NEW |
| **Slack: #pricelabs channel** | Dedicated Slack channel for PriceLabs reports and interaction | Gateway (inbound/outbound), bindings (routing) | NEW (channel in Slack, config in openclaw.json) |
| **Cron jobs** | Daily health, weekly optimization -- pinned to agent "pricelabs" | Gateway scheduler, agent runtime, delivery channels | MODIFIED (agentId + delivery targets) |
| **PriceLabs plugin** | Global plugin, 28 MCP tools via stdio bridge | Agent runtime (tool calls), MCP server (child process) | UNCHANGED |
| **Plugin bridge** | index.ts + tool-definitions.json at ~/.openclaw/extensions/pricelabs/ | Gateway (plugin loading), MCP server (stdio) | UNCHANGED |
| **MCP Server** | PriceLabs API client, rate limiter, SQLite persistence | Plugin bridge (stdio), PriceLabs API (HTTP), SQLite (file) | UNCHANGED |

### Data Flow

**Channel -> Binding -> Agent -> Plugin -> MCP:**
```
1. User sends message to @PriceLabsBot on Telegram
2. Gateway receives via grammY long-poll (account: "pricelabs")
3. Binding matches: channel=telegram, accountId=pricelabs -> agentId=pricelabs
4. Gateway creates/resumes session: agent:pricelabs:telegram:group:-100XXXXX
5. Agent runtime loads workspace-pricelabs/ brain files + skills/
6. Agent reasons, calls pricelabs_get_listings tool
7. Plugin bridge forwards to MCP server child process via stdio JSON-RPC
8. MCP server calls api.pricelabs.co, returns data
9. Agent formulates response
10. Gateway delivers response to Telegram (pricelabs account)
```

**Cron -> Agent -> Plugin -> Delivery:**
```
1. Cron scheduler fires "pricelabs-daily-health" (agentId: "pricelabs")
2. Gateway creates isolated session: cron:pricelabs-daily-health
3. Agent runtime loads workspace-pricelabs/ brain files + skills/
4. Agent executes health check workflow using pricelabs_* tools
5. Agent generates health summary
6. Delivery: announce mode -> Slack channel:C_PRICELABS + Telegram pricelabs account
```

---

## Integration Points: Detailed Analysis

### 1. Plugin Sharing Between Agents

**Finding (HIGH confidence, verified in docs):** Plugins in OpenClaw are loaded **globally** at the gateway level. The `plugins.load.paths` and `plugins.entries` configuration is not per-agent. Both the main agent and the pricelabs agent will see all 28 `pricelabs_*` tools.

**Access control mechanism:** Use per-agent `tools.allow` / `tools.deny` lists to restrict which agent can use which plugin tools.

```json5
// In agents.list[]:
{
  "id": "pricelabs",
  "tools": {
    "allow": ["pricelabs_*", "exec", "read", "write", "edit", "apply_patch"]
  }
}
```

**For the main agent:** The existing global `tools.sandbox.tools.allow` already includes `pricelabs_*`. To restrict the main agent from accessing PriceLabs tools (optional, not required), add per-agent tool config. For v1.2, keeping `pricelabs_*` available to both agents is acceptable since Albot's AGENTS.md already documents how to use them.

**Decision:** Leave plugin globally accessible. Both agents can call PriceLabs tools. The pricelabs agent's skills make it the expert; the main agent can still answer quick PriceLabs questions from the general Slack workspace.

### 2. Skills: Per-Agent vs Shared

**Finding (HIGH confidence, verified in docs at /home/NGA/openclaw/docs/tools/skills.md):**

Skills load from three locations with precedence:
1. `<workspace>/skills/` (highest -- per-agent)
2. `~/.openclaw/skills/` (shared across all agents)
3. Bundled skills (lowest)

**Current state:** PriceLabs skill files are at `~/.openclaw/workspace/pricelabs-skills/` (in the main workspace root, NOT under `skills/`). They are referenced in AGENTS.md but are NOT loaded as proper OpenClaw skills -- they are just markdown files the agent reads manually.

**Target state:** Move skill files into the pricelabs workspace as proper skills:

```
~/.openclaw/workspace-pricelabs/
  skills/
    pricelabs-domain/SKILL.md         # from domain-knowledge.md
    pricelabs-monitor/SKILL.md        # from monitoring-protocols.md
    pricelabs-analyst/SKILL.md        # from analysis-playbook.md
    pricelabs-optimizer/SKILL.md      # from optimization-playbook.md
```

Each SKILL.md gets proper YAML frontmatter so OpenClaw auto-loads them:

```yaml
---
name: pricelabs-domain
description: PriceLabs domain knowledge, tool catalog, rate limits, STR revenue management.
user-invocable: false
---
```

**Removing from main workspace:** Delete `~/.openclaw/workspace/pricelabs-skills/` and remove the "PriceLabs Revenue Agent" section from the main workspace's AGENTS.md. The main agent can still call `pricelabs_*` tools; it just won't have the domain skill context.

### 3. Channel Routing: Telegram

**Finding (HIGH confidence, multi-agent.md examples):** Telegram multi-agent requires **one bot per agent**. Each bot gets its own `accountId` under `channels.telegram.accounts`.

**Implementation:**

1. Create new Telegram bot via @BotFather (e.g., @PriceLabsRevBot)
2. Add to openclaw.json under `channels.telegram.accounts`:

```json5
{
  "channels": {
    "telegram": {
      "enabled": true,
      // Remove top-level botToken (moved to accounts.default)
      "accounts": {
        "default": {
          "botToken": "8540404056:AAERapYCYOl5YtGM6IutMWDXNiB-L1RTVZc",
          "dmPolicy": "pairing"
        },
        "pricelabs": {
          "botToken": "<NEW_PRICELABS_BOT_TOKEN>",
          "dmPolicy": "allowlist",
          "allowFrom": ["8283515561"]
        }
      },
      "groupPolicy": "allowlist",
      "streaming": "partial"
    }
  }
}
```

3. Add binding:

```json5
{
  "bindings": [
    { "agentId": "pricelabs", "match": { "channel": "telegram", "accountId": "pricelabs" } }
    // main agent catches everything else as default
  ]
}
```

**Key detail:** When migrating from single-account to multi-account Telegram, the existing top-level `botToken` must move into `accounts.default.botToken`. The top-level key becomes a fallback only for the default account, but explicit accounts are cleaner.

### 4. Channel Routing: Slack

**Finding (HIGH confidence):** Slack in OpenClaw does NOT use `accounts` for multi-agent routing (unlike Telegram/Discord). Instead, routing uses:
- `teamId` binding (routes all messages from a Slack team to an agent)
- `peer` binding with `kind: "channel"` and channel ID (routes a specific Slack channel to an agent)

Since both agents share the same Slack workspace and bot app, the recommended approach is **peer-based channel binding**: create a dedicated `#pricelabs` Slack channel and bind it to the pricelabs agent.

**Implementation:**

1. Create `#pricelabs` channel in Slack workspace
2. Invite the existing Slack bot to the channel
3. Get the channel ID (e.g., `C0AXXXXXX`)
4. Add to openclaw.json:

```json5
{
  "channels": {
    "slack": {
      // ... existing config ...
      "channels": {
        "C0AF9MXD0ER": { "allow": true, "requireMention": true, "allowBots": true },
        "C0AG7FJNKNC": { "allow": true, "requireMention": true, "allowBots": true },
        "C_PRICELABS": { "allow": true, "requireMention": false, "allowBots": true }
      }
    }
  },
  "bindings": [
    {
      "agentId": "pricelabs",
      "match": { "channel": "slack", "peer": { "kind": "channel", "id": "C_PRICELABS" } }
    },
    {
      "agentId": "pricelabs",
      "match": { "channel": "telegram", "accountId": "pricelabs" }
    }
    // main agent is default fallback -- no binding needed
  ]
}
```

**Important:** `requireMention: false` in the #pricelabs channel means the agent responds to every message without needing `@mention`. This is correct for a dedicated channel.

**Slack identity:** With `chat:write.customize` scope, the pricelabs agent can use a custom username and icon when posting to Slack. Set via `agents.list[].identity`:

```json5
{
  "id": "pricelabs",
  "identity": {
    "name": "PriceLabs Agent",
    "emoji": "chart_with_upwards_trend"  // Slack shortcode
  }
}
```

### 5. Agent Definition in openclaw.json

**Verified config structure from multi-agent.md and the family agent example:**

```json5
{
  "agents": {
    "defaults": {
      // ... existing defaults (model, sandbox, etc.) ...
    },
    "list": [
      {
        "id": "main",
        "default": true,
        "name": "Albot",
        "workspace": "/home/NGA/.openclaw/workspace"
        // inherits all defaults
      },
      {
        "id": "pricelabs",
        "name": "PriceLabs Revenue Agent",
        "workspace": "/home/NGA/.openclaw/workspace-pricelabs",
        "agentDir": "/home/NGA/.openclaw/agents/pricelabs/agent",
        "identity": {
          "name": "PriceLabs Agent",
          "emoji": "chart_with_upwards_trend"
        },
        "model": {
          "primary": "openai-codex/gpt-5.3-codex"
        },
        "groupChat": {
          "mentionPatterns": ["@pricelabs", "@PriceLabs", "@pricelab"]
        },
        "sandbox": {
          "mode": "all",
          "scope": "agent"
        },
        "tools": {
          "allow": [
            "exec", "process", "read", "write", "edit", "apply_patch",
            "sessions_list", "sessions_history", "sessions_send",
            "sessions_spawn", "session_status", "pricelabs_*"
          ]
        },
        "heartbeat": {
          "every": "1h",
          "model": "openai-codex/gpt-5.3-codex"
        }
      }
    ]
  }
}
```

**Critical note from AGENTS.md (main workspace):** `agentDir` is singular, NOT `agentsDir`. Using `agentsDir` will crash the gateway. This crashed the gateway 39 times on 2026-02-14.

### 6. Cron Jobs: Agent Binding

**Finding (HIGH confidence, verified in cron-jobs.md):** Each cron job accepts an optional `agentId` field that pins the job to a specific agent. If `agentId` is missing or unknown, the gateway falls back to the default agent.

**Current cron jobs to modify:** None of the existing 5 jobs are PriceLabs-related. They are all correctly bound to `agentId: "main"`.

**New cron jobs for v1.2:**

```bash
# Daily health check (8am CST, announce to both channels)
openclaw cron add \
  --name "pricelabs-daily-health" \
  --cron "0 8 * * *" \
  --tz "America/Chicago" \
  --session isolated \
  --message "Run the daily portfolio health check. Fetch all listings, check health scores, compare occupancy to market, check sync freshness, compare revenue to STLY. Store snapshots in SQLite. Generate alert summary." \
  --agent pricelabs \
  --announce \
  --channel slack \
  --to "channel:C_PRICELABS"

# Weekly optimization scan (Monday 9am CST)
openclaw cron add \
  --name "pricelabs-weekly-optimization" \
  --cron "0 9 * * 1" \
  --tz "America/Chicago" \
  --session isolated \
  --message "Run the weekly optimization report. Fetch prices for all listings (next 90 days). Identify pricing anomalies, orphan gaps, demand mismatches. Compare to historical data. Generate optimization recommendations with PENDING APPROVAL status." \
  --agent pricelabs \
  --announce \
  --channel slack \
  --to "channel:C_PRICELABS"
```

**Telegram delivery:** Cron `--channel` only accepts one channel. For dual-channel delivery (Slack + Telegram), either:
- Create two jobs (one per channel) -- simpler, recommended
- Use a single job that delivers to Slack, and configure a Telegram cron job separately with `--channel telegram --to "<chatId>"`

### 7. Auth Profiles

**Finding (HIGH confidence, multi-agent.md):** Auth profiles are per-agent. Each agent reads from `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`. Main agent credentials are NOT shared automatically.

**Action required:** Copy the auth-profiles.json from the main agent to the pricelabs agent directory:

```bash
mkdir -p ~/.openclaw/agents/pricelabs/agent
cp ~/.openclaw/agents/main/agent/auth-profiles.json ~/.openclaw/agents/pricelabs/agent/
```

This gives the pricelabs agent access to the same OpenAI Codex auth as the main agent.

---

## Workspace Brain Files

### New Files to Create

All files go in `~/.openclaw/workspace-pricelabs/`:

| File | Purpose | Content Source |
|------|---------|---------------|
| `AGENTS.md` | Operating instructions, memory protocol, PriceLabs-specific rules | NEW (domain-specific) |
| `SOUL.md` | Persona: professional revenue management agent, not casual Albot | NEW |
| `USER.md` | Same user (Beau), CST timezone, portfolio owner context | ADAPTED from main |
| `IDENTITY.md` | Name, emoji, avatar for the PriceLabs agent | NEW |
| `TOOLS.md` | PriceLabs tool notes, API quirks, rate limit reminders | ADAPTED from main's PriceLabs section |
| `MEMORY.md` | Long-term PriceLabs memory (portfolio learnings, seasonal patterns) | NEW (empty initially) |
| `HEARTBEAT.md` | Lightweight checklist for hourly heartbeats | NEW |
| `BOOT.md` | Startup checklist (verify MCP server, check last sync) | NEW |
| `BOOTSTRAP.md` | One-time setup ritual (deleted after first run) | NEW |
| `skills/` | 4 PriceLabs skill directories | MOVED from main workspace |

### AGENTS.md Key Differences from Main

The pricelabs agent's AGENTS.md should be focused and domain-specific:

```markdown
# AGENTS.md - PriceLabs Revenue Agent

## Identity
You are a dedicated PriceLabs revenue management agent. Your ONLY domain is
short-term rental pricing, portfolio health monitoring, and market analysis.

## Every Session
1. Read SOUL.md
2. Read USER.md
3. Read memory/YYYY-MM-DD.md (today + yesterday)
4. If main session: also read MEMORY.md

## Core Rules
- ALL pricing changes require explicit owner approval
- PRICELABS_WRITES_ENABLED must be "true" before any write operations
- Rate budget: 1000 API calls/hour -- use snapshots to avoid redundant fetches
- Always fetch real data before analysis -- never estimate or hallucinate numbers
- Store snapshots in SQLite during every monitoring run
- Format reports clearly: listing name, current value, change, rationale

## Tools
You have 28 pricelabs_* tools. Read the skills for protocols:
- skills/pricelabs-domain/ -- domain knowledge, API quirks
- skills/pricelabs-monitor/ -- daily health check protocol
- skills/pricelabs-analyst/ -- analysis playbook
- skills/pricelabs-optimizer/ -- optimization playbook

## Safety
- Never execute pricing changes without approval
- Never share API keys or portfolio data outside authorized channels
- When in doubt about a recommendation, present it as "PENDING REVIEW"
```

---

## Config Changes Summary: New vs Modified

### New Configuration (does not exist yet)

| Config Path | What | Why |
|-------------|------|-----|
| `agents.list[]` | Array with main + pricelabs agent definitions | Currently empty; single-agent mode |
| `agents.list[1]` (pricelabs) | Full agent definition with workspace, agentDir, identity, tools | Dedicated agent needs full config |
| `bindings[]` | Routing rules for Slack channel + Telegram account | Route messages to correct agent |
| `channels.telegram.accounts` | Multi-account Telegram with default + pricelabs bots | Need separate bot for pricelabs agent |
| `channels.slack.channels.C_PRICELABS` | Allow config for dedicated Slack channel | New channel for PriceLabs |
| `~/.openclaw/workspace-pricelabs/` | Entire workspace directory tree | Dedicated agent workspace |
| `~/.openclaw/agents/pricelabs/` | Agent state directory (auth, sessions) | Agent runtime state |
| Cron jobs (2 new) | pricelabs-daily-health, pricelabs-weekly-optimization | Scheduled monitoring |

### Modified Configuration (exists, needs changes)

| Config Path | Current | Target | Why |
|-------------|---------|--------|-----|
| `agents.list` | `[]` (empty) | `[{id:"main",...}, {id:"pricelabs",...}]` | Enable multi-agent mode |
| `channels.telegram.botToken` | Top-level single token | Moved to `accounts.default.botToken` | Multi-account migration |
| `channels.telegram.dmPolicy` | Top-level | Moved to `accounts.default.dmPolicy` | Per-account policy |

### Unchanged Configuration

| Config Path | Why Unchanged |
|-------------|---------------|
| `plugins.load.paths` | Plugin is global, already loaded correctly |
| `plugins.entries.pricelabs` | Plugin config unchanged; same MCP server path, same DB |
| `tools.sandbox.tools.allow` | Global sandbox allow list still needed for main agent |
| `gateway.*` | Gateway config unchanged |
| `auth.*` | Global auth unchanged; per-agent auth via auth-profiles.json copy |
| Existing cron jobs (5) | Already bound to agentId: "main", unaffected |

### Files in the Repo vs OpenClaw Config Only

| Location | What Changes | In Repo? |
|----------|-------------|----------|
| `openclaw/` directory | Skill files converted to SKILL.md format with frontmatter | YES |
| `openclaw/` directory | Workspace brain file templates (AGENTS.md, SOUL.md, etc.) | YES |
| `~/.openclaw/openclaw.json` | Multi-agent config, bindings, accounts | NO (runtime config) |
| `~/.openclaw/workspace-pricelabs/` | Deployed workspace files | NO (deployed from repo) |
| `~/.openclaw/agents/pricelabs/` | Agent state (auth, sessions) | NO (runtime state) |
| `~/.openclaw/cron/jobs.json` | New cron job entries | NO (created via CLI) |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared Workspace

**What:** Putting the pricelabs agent in the same workspace as Albot.
**Why bad:** Skills from both agents would load every session. Brain files would conflict (SOUL.md can't serve two personalities). Session context would bleed between domains.
**Instead:** Separate workspaces. Each agent has its own brain, skills, and memory.

### Anti-Pattern 2: Two Slack Apps

**What:** Creating a second Slack app for the pricelabs agent.
**Why bad:** Slack workspaces have app limits. Two apps means two bot tokens, two app tokens, two sets of scopes to manage. Channel binding via peer routing works with one app.
**Instead:** One Slack app, one bot. Route by channel ID using peer bindings. Use `chat:write.customize` for per-agent identity (custom username/icon) if desired.

### Anti-Pattern 3: Cron Jobs Without agentId

**What:** Creating cron jobs without explicitly setting `--agent pricelabs`.
**Why bad:** Jobs without `agentId` fall back to the default agent (main). The pricelabs agent's workspace and skills would not be loaded. The job would run as Albot with no PriceLabs domain knowledge.
**Instead:** Always set `--agent pricelabs` on PriceLabs cron jobs.

### Anti-Pattern 4: Duplicating Plugin Config Per-Agent

**What:** Trying to add per-agent plugin entries or per-agent plugin.load.paths.
**Why bad:** OpenClaw plugins are global. There is no per-agent plugin config. Attempting to add unknown keys to agent entries will crash the gateway (strict schema validation).
**Instead:** Plugins stay global. Use per-agent `tools.allow`/`tools.deny` to control access.

### Anti-Pattern 5: Using agentsDir (plural)

**What:** Writing `"agentsDir"` instead of `"agentDir"` in agent config.
**Why bad:** Crashed the gateway 39 times on 2026-02-14. The config validator rejects unknown keys.
**Instead:** Always use `"agentDir"` (singular). Copy existing agent entries as templates.

---

## Suggested Build Order (Dependency-Driven)

### Phase 1: Workspace Creation (no config changes yet)

**Build first because:** Everything depends on having workspace files ready before the agent is activated.

1. Create `~/.openclaw/workspace-pricelabs/` directory
2. Write brain files: AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, MEMORY.md, HEARTBEAT.md, BOOT.md, BOOTSTRAP.md
3. Convert existing skills to proper SKILL.md format with YAML frontmatter
4. Create `skills/pricelabs-domain/SKILL.md`, `skills/pricelabs-monitor/SKILL.md`, `skills/pricelabs-analyst/SKILL.md`, `skills/pricelabs-optimizer/SKILL.md`
5. Keep in repo at `openclaw/workspace-pricelabs/` with deploy script

**Validates:** Files exist and are well-formed. No runtime impact yet.

### Phase 2: Agent Registration + Auth

**Build second because:** Agent must exist before bindings or cron can reference it.

1. Create `~/.openclaw/agents/pricelabs/agent/` directory
2. Copy `auth-profiles.json` from main agent
3. Add `agents.list` to openclaw.json with both main and pricelabs entries
4. **Do NOT add bindings yet** -- the agent exists but receives no routed messages
5. Restart gateway: `openclaw gateway restart`
6. Verify: `openclaw agents list --bindings`

**Validates:** Gateway starts with two agents, no crash, no routing changes.

### Phase 3: Channel Routing (Telegram)

**Build third because:** Telegram is simpler (one bot = one account, clean routing).

1. Create new Telegram bot via @BotFather
2. Migrate `channels.telegram` from single-account to multi-account format
3. Add `accounts.default` (existing bot) and `accounts.pricelabs` (new bot)
4. Add binding: `{ agentId: "pricelabs", match: { channel: "telegram", accountId: "pricelabs" } }`
5. Restart gateway
6. Test: DM the new bot, verify pricelabs agent responds with correct workspace context
7. Verify: DM the old bot, verify Albot still works normally

**Validates:** Telegram multi-account works, routing is correct, no cross-talk.

### Phase 4: Channel Routing (Slack)

**Build fourth because:** Slack requires a new channel in the workspace and peer-based routing.

1. Create `#pricelabs` channel in Slack workspace
2. Invite the existing bot to the channel
3. Get channel ID
4. Add channel to `channels.slack.channels` config with `requireMention: false`
5. Add binding: `{ agentId: "pricelabs", match: { channel: "slack", peer: { kind: "channel", id: "C_PRICELABS" } } }`
6. Restart gateway
7. Test: Send message in #pricelabs, verify pricelabs agent responds
8. Verify: Send message in existing channels, verify Albot still works

**Validates:** Slack peer-based routing works, dedicated channel is functional.

### Phase 5: Cron Jobs

**Build last because:** Cron requires working agent + working delivery channels.

1. Add daily health check cron job with `--agent pricelabs`
2. Add weekly optimization cron job with `--agent pricelabs`
3. Create Telegram delivery jobs (separate from Slack jobs, or dual delivery via two jobs)
4. Force-run jobs to validate: `openclaw cron run <jobId>`
5. Verify delivery arrives in correct channels

**Validates:** Scheduled monitoring works end-to-end with dedicated agent.

### Phase 6: Cleanup + Validation

1. Remove PriceLabs skills from main workspace (`pricelabs-skills/` directory)
2. Remove PriceLabs section from main AGENTS.md (or leave a minimal reference)
3. End-to-end validation: agent responds independently, cron delivers, no cross-talk
4. Document deployment procedure

---

## Scalability Considerations

| Concern | Current (1 agent) | v1.2 (2 agents) | Future (N agents) |
|---------|-------------------|------------------|-------------------|
| **Gateway memory** | ~150MB | ~200MB (one more MCP child) | Linear with agent count |
| **Cron concurrency** | `maxConcurrentRuns: 1` | May need `maxConcurrentRuns: 2` | Tune per workload |
| **Session storage** | Single agent dir | Two agent dirs | Disk grows linearly |
| **Plugin processes** | 1 MCP server child | Still 1 (shared) | Still 1 unless isolated |
| **Slack bot** | 1 app | Still 1 app (peer routing) | Still 1 app works |
| **Telegram bots** | 1 bot | 2 bots | N bots (one per agent) |

---

## Sources

### OpenClaw Official Documentation (HIGH confidence -- read from local docs)

- `/home/NGA/openclaw/docs/concepts/multi-agent.md` -- Multi-agent routing, bindings, per-agent sandbox/tools, platform examples
- `/home/NGA/openclaw/docs/channels/channel-routing.md` -- Session key shapes, routing rules, broadcast groups
- `/home/NGA/openclaw/docs/concepts/agent-workspace.md` -- Workspace file map, bootstrap, per-agent skills
- `/home/NGA/openclaw/docs/concepts/agent.md` -- Agent runtime, skill loading precedence, bootstrap injection
- `/home/NGA/openclaw/docs/automation/cron-jobs.md` -- Cron agentId binding, delivery modes, CLI reference
- `/home/NGA/openclaw/docs/automation/cron-vs-heartbeat.md` -- When to use cron vs heartbeat
- `/home/NGA/openclaw/docs/channels/slack.md` -- Slack Socket Mode, channel allowlists, peer routing
- `/home/NGA/openclaw/docs/channels/telegram.md` -- Telegram multi-account, bot setup, group policy
- `/home/NGA/openclaw/docs/plugins/agent-tools.md` -- Plugin tool registration, per-agent allowlists
- `/home/NGA/openclaw/docs/plugins/manifest.md` -- Plugin manifest format
- `/home/NGA/openclaw/docs/tools/skills.md` -- Skill precedence, per-agent vs shared, SKILL.md format

### Existing Infrastructure (HIGH confidence -- verified on disk)

- `/home/NGA/.openclaw/openclaw.json` -- Current config (single-agent, global plugin)
- `/home/NGA/.openclaw/workspace/` -- Current main workspace (AGENTS.md with PriceLabs section)
- `/home/NGA/.openclaw/workspace/pricelabs-skills/` -- Current skill files (4 markdown files)
- `/home/NGA/.openclaw/extensions/pricelabs/` -- Installed plugin bridge
- `/home/NGA/.openclaw/cron/jobs.json` -- Current cron jobs (5 jobs, all main agent)
- `/home/NGA/.openclaw/agents/` -- Agent directories (main, nextgen, singleseed)
- `/mnt/c/Projects/pricelabs-agent/openclaw/extensions/pricelabs/index.ts` -- Plugin source
