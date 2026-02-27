# Stack Research

**Domain:** OpenClaw multi-agent configuration, workspace files, channel routing, and cron jobs for a dedicated PriceLabs agent
**Researched:** 2026-02-26
**Confidence:** HIGH

## Context: What Already Exists (DO NOT change)

This is NOT a greenfield stack decision. v1.1 shipped with a working system:

- TypeScript MCP server with 28 tools (`mcp-servers/pricelabs/`)
- OpenClaw plugin bridge (`openclaw/extensions/pricelabs/`) via stdio JSON-RPC
- SQLite persistence (7 tables) at `~/.pricelabs-agent/data.sqlite`
- 4 skill files in `openclaw/skills/`
- `openclaw.json` with single-agent config (agent id: `pricelabs`)
- 4 cron jobs in `openclaw/cron/jobs.json` (daily health x2, weekly optimization x2)
- Slack (socket mode) + Telegram (long polling) channels connected

**v1.2 adds NO new code or packages.** This milestone is purely OpenClaw configuration and workspace file authoring.

## Recommended Stack

### Core Technologies (config-only, no new packages)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OpenClaw Gateway | v2026.1.6+ | Multi-agent runtime, cron scheduler, channel routing | Already deployed. Per-agent sandbox + tool config available since v2026.1.6. Multi-agent routing is a first-class feature. |
| OpenClaw `agents.list[]` | N/A (config) | Declare the `pricelabs` agent as an isolated brain with dedicated workspace | Documented pattern for multi-agent. Each agent gets its own workspace, agentDir, sessions. No code needed. |
| OpenClaw `bindings[]` | N/A (config) | Route inbound Telegram/Slack messages to the `pricelabs` agent deterministically | Most-specific-wins routing. Peer bindings (channel + peer ID) beat channel-wide rules. Supports Slack channel ID and Telegram chat ID binding. |
| OpenClaw `cron` CLI | N/A (CLI) | Register permanent cron jobs with `--agent pricelabs` flag | Cron supports `agentId` field per job. CLI: `openclaw cron add --agent pricelabs`. Jobs persist in `~/.openclaw/cron/jobs.json`. |
| Markdown workspace files | N/A (files) | Agent identity, behavior, and domain knowledge | Standard OpenClaw workspace contract. Files loaded at session start. No schema enforcement -- plain Markdown. |

### Workspace Files (new files to create)

| File | Purpose | When Loaded |
|------|---------|-------------|
| `AGENTS.md` | Operating instructions: how the agent should use tools, respond to users, handle approvals | Every session start |
| `SOUL.md` | Persona and tone: "You are a PriceLabs revenue management agent..." | Every session start |
| `USER.md` | User context: who the operator is, preferences, property portfolio context | Every session start |
| `IDENTITY.md` | Agent name, emoji, theme (e.g., "PriceLabs Agent", chart emoji) | Bootstrap + identity resolution |
| `TOOLS.md` | Notes about the 28 pricelabs_* tools: when to use which, parameter conventions | Every session start |
| `MEMORY.md` | Long-term curated facts: portfolio specifics, learned preferences, pricing history notes | Main session only (not group/cron) |
| `HEARTBEAT.md` | NOT recommended for v1.2 -- cron jobs handle all scheduling | N/A |
| `BOOT.md` | Optional startup checklist on gateway restart (keep minimal or skip) | Gateway restart |
| `BOOTSTRAP.md` | One-time ritual for new workspace; delete after first run | First run only |
| `skills/` | Existing 4 skill files move here as workspace-scoped skills | Every session |

### Channel Configuration (config changes)

| Component | Configuration Pattern | Why This Approach |
|-----------|----------------------|-------------------|
| Telegram: dedicated bot | `channels.telegram.accounts.pricelabs.botToken` (new account) | OpenClaw multi-account Telegram: one BotFather bot per agent. Each account gets its own `botToken`. Bound to agent via `bindings`. Completely isolated from main bot. |
| Slack: dedicated channel | `bindings[].match.channel: "slack", peer.kind: "channel", peer.id: "<channel_id>"` | Route a specific Slack channel (#pricelabs) to the pricelabs agent. Single Slack app, single bot token -- routing is per-channel via bindings, not per-account. |
| Slack: same app token | Reuse existing `SLACK_APP_TOKEN` / `SLACK_BOT_TOKEN` | Slack multi-agent does NOT require multiple Slack apps. One app can serve multiple agents by routing channels/DMs via bindings. Creating a second Slack app is unnecessary overhead. |

### Cron Job Configuration (CLI commands)

| Job | Schedule | Channel | Agent Flag | Delivery Target |
|-----|----------|---------|------------|-----------------|
| Daily health (Slack) | `0 8 * * *` CT | slack | `--agent pricelabs` | `channel:<pricelabs_channel_id>` |
| Daily health (Telegram) | `0 8 * * *` CT | telegram | `--agent pricelabs` | `<pricelabs_bot_chat_id>` |
| Weekly optimization (Slack) | `0 10 * * 1` CT | slack | `--agent pricelabs` | `channel:<pricelabs_channel_id>` |
| Weekly optimization (Telegram) | `0 10 * * 1` CT | telegram | `--agent pricelabs` | `<pricelabs_bot_chat_id>` |

## Configuration Syntax (Exact Patterns from Docs)

### 1. Agent Declaration in openclaw.json

```json5
{
  agents: {
    list: [
      // Keep existing main agent (if there is one)
      {
        id: "main",
        default: true,
        workspace: "~/.openclaw/workspace",
      },
      // NEW: PriceLabs dedicated agent
      {
        id: "pricelabs",
        name: "PriceLabs Revenue Agent",
        workspace: "~/.openclaw/workspace-pricelabs",
        model: "anthropic/claude-opus-4-6",
        // agentDir auto-resolves to ~/.openclaw/agents/pricelabs/agent
        sandbox: {
          mode: "all",
          scope: "agent",
          workspaceAccess: "rw",  // Agent needs to write memory files
        },
        tools: {
          // Allow reading workspace + pricelabs plugin tools
          // Deny dangerous tools that a revenue agent should never use
          deny: [
            "group:runtime",    // exec, bash, process
            "write",            // host file writes (memory tools use workspace writes)
            "edit",
            "apply_patch",
            "browser",
            "canvas",
            "nodes",
            "gateway",
          ],
        },
        // Skills are in the workspace /skills directory
        // Plugin (pricelabs MCP bridge) is configured via plugins section
        groupChat: {
          mentionPatterns: ["@pricelabs", "@PriceLabs", "@pricelabs-agent"],
        },
      },
    ],
  },
}
```

### 2. Bindings for Channel Routing

```json5
{
  bindings: [
    // Telegram: dedicated bot account routes to pricelabs agent
    {
      agentId: "pricelabs",
      match: {
        channel: "telegram",
        accountId: "pricelabs",
      },
    },
    // Slack: dedicated #pricelabs channel routes to pricelabs agent
    {
      agentId: "pricelabs",
      match: {
        channel: "slack",
        peer: { kind: "channel", id: "C_PRICELABS_CHANNEL_ID" },
      },
    },
  ],
}
```

### 3. Telegram Multi-Account Configuration

```json5
{
  channels: {
    telegram: {
      accounts: {
        default: {
          botToken: "${TELEGRAM_BOT_TOKEN}",  // Existing main bot
          dmPolicy: "pairing",
        },
        pricelabs: {
          botToken: "${TELEGRAM_PRICELABS_BOT_TOKEN}",  // NEW: dedicated PriceLabs bot
          dmPolicy: "allowlist",
          allowFrom: ["${TELEGRAM_OWNER_USER_ID}"],  // Only the portfolio owner
        },
      },
    },
  },
}
```

### 4. Slack Channel Configuration

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      appToken: "${SLACK_APP_TOKEN}",
      botToken: "${SLACK_BOT_TOKEN}",
      channels: {
        "C_PRICELABS_CHANNEL_ID": {
          requireMention: false,  // No @mention needed in dedicated channel
          // users: ["U_OWNER_ID"],  // Optional: restrict to owner only
        },
      },
    },
  },
}
```

### 5. Permanent Cron Job Registration (CLI)

```bash
# Remove old test cron jobs first
openclaw cron list  # identify existing jobs
openclaw cron remove <old-job-id>

# Daily health -- Slack
openclaw cron add \
  --name "daily-portfolio-health-slack" \
  --cron "0 8 * * *" \
  --tz "America/Chicago" \
  --exact \
  --session isolated \
  --message "Run the daily portfolio health check. Follow the Daily Health Check Protocol..." \
  --model "opus" \
  --thinking high \
  --agent pricelabs \
  --announce \
  --channel slack \
  --to "channel:C_PRICELABS_CHANNEL_ID"

# Daily health -- Telegram
openclaw cron add \
  --name "daily-portfolio-health-telegram" \
  --cron "0 8 * * *" \
  --tz "America/Chicago" \
  --stagger 30s \
  --session isolated \
  --message "Run the daily portfolio health check..." \
  --model "opus" \
  --thinking high \
  --agent pricelabs \
  --announce \
  --channel telegram \
  --to "${TELEGRAM_PRICELABS_CHAT_ID}"

# Weekly optimization -- Slack
openclaw cron add \
  --name "weekly-optimization-slack" \
  --cron "0 10 * * 1" \
  --tz "America/Chicago" \
  --exact \
  --session isolated \
  --message "Generate the weekly optimization report..." \
  --model "opus" \
  --thinking high \
  --agent pricelabs \
  --announce \
  --channel slack \
  --to "channel:C_PRICELABS_CHANNEL_ID"

# Weekly optimization -- Telegram
openclaw cron add \
  --name "weekly-optimization-telegram" \
  --cron "0 10 * * 1" \
  --tz "America/Chicago" \
  --stagger 30s \
  --session isolated \
  --message "Generate the weekly optimization report..." \
  --model "opus" \
  --thinking high \
  --agent pricelabs \
  --announce \
  --channel telegram \
  --to "${TELEGRAM_PRICELABS_CHAT_ID}"
```

Key flags explained:
- `--agent pricelabs`: Pins the cron job to the pricelabs agent (uses its workspace, skills, tools)
- `--session isolated`: Fresh session per run (no context carry-over, clean agent turn)
- `--announce`: Deliver output directly to the target channel
- `--exact` / `--stagger 30s`: Controls timing precision (no auto-stagger for primary, 30s offset for secondary)
- `--model opus` / `--thinking high`: Per-job model override for quality analysis

## Environment Variables (Additions to ~/.openclaw/.env)

```bash
# --- NEW for v1.2 ---
# Telegram: PriceLabs dedicated bot (create via BotFather /newbot)
TELEGRAM_PRICELABS_BOT_TOKEN=your-pricelabs-telegram-bot-token

# Telegram: Owner's user ID (for allowlist)
TELEGRAM_OWNER_USER_ID=123456789

# Telegram: Chat ID for the pricelabs bot DM (get from logs after first message)
TELEGRAM_PRICELABS_CHAT_ID=123456789

# Slack: PriceLabs channel ID (create #pricelabs channel, get ID from channel details)
SLACK_PRICELABS_CHANNEL_ID=C_YOUR_CHANNEL_ID
```

## Workspace Directory Structure

```
~/.openclaw/workspace-pricelabs/
  AGENTS.md          # Operating instructions
  SOUL.md            # Persona and tone
  USER.md            # User profile
  IDENTITY.md        # Name, emoji, theme
  TOOLS.md           # Tool usage notes
  MEMORY.md          # Long-term curated memory (optional at start)
  BOOT.md            # Startup checklist (optional)
  BOOTSTRAP.md       # One-time ritual (delete after)
  memory/            # Daily memory logs (auto-created)
  skills/            # Workspace-scoped skills (4 existing skill files)
    domain-knowledge/
      SKILL.md
    monitoring-protocols/
      SKILL.md
    analysis-playbook/
      SKILL.md
    optimization-playbook/
      SKILL.md
```

**Important:** Skills in the workspace must follow AgentSkills format -- each skill is a directory containing a `SKILL.md` with YAML frontmatter. The existing flat `.md` files need to be restructured into `skills/<name>/SKILL.md` directories with proper frontmatter.

## Skill Migration Format

Each existing skill file (e.g., `openclaw/skills/domain-knowledge.md`) becomes:

```
~/.openclaw/workspace-pricelabs/skills/domain-knowledge/SKILL.md
```

With YAML frontmatter added:

```markdown
---
name: domain-knowledge
description: PriceLabs platform knowledge, API endpoints, pricing concepts, and revenue management domain expertise
---

[existing content]
```

The 4 existing skills become 4 AgentSkills directories:

| Current File | New Path | Skill Name |
|-------------|----------|------------|
| `openclaw/skills/domain-knowledge.md` | `skills/domain-knowledge/SKILL.md` | `domain-knowledge` |
| `openclaw/skills/monitoring-protocols.md` | `skills/monitoring-protocols/SKILL.md` | `monitoring-protocols` |
| `openclaw/skills/analysis-playbook.md` | `skills/analysis-playbook/SKILL.md` | `analysis-playbook` |
| `openclaw/skills/optimization-playbook.md` | `skills/optimization-playbook/SKILL.md` | `optimization-playbook` |

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Dedicated Telegram bot (multi-account) | Single bot with peer-based routing | Peer routing on a single bot means the PriceLabs agent shares the bot identity. Dedicated bot gets its own @username, avatar, and `/start` message. BotFather setup takes 30 seconds. |
| Slack channel binding (peer routing) | Second Slack app (multi-account) | Slack multi-account requires creating and installing a second Slack app, managing two sets of tokens. Channel binding achieves the same routing with zero new infrastructure -- just create a #pricelabs channel and add the existing bot. |
| Workspace skills (per-agent `skills/`) | Shared skills in `~/.openclaw/skills` | Per-agent workspace skills ensure the PriceLabs domain knowledge is only loaded for the PriceLabs agent. Shared skills would inject PriceLabs protocols into all agents on the gateway. |
| `workspaceAccess: "rw"` | `workspaceAccess: "ro"` (current) | Agent needs to write memory files (`memory/YYYY-MM-DD.md`, `MEMORY.md`). Read-only workspace blocks the memory flush system. Change from `ro` to `rw` for this agent only. |
| Isolated cron sessions | Main session cron (systemEvent) | Isolated sessions give clean context per run, don't pollute main session history, and support model/thinking overrides. PriceLabs health checks are standalone tasks that don't need conversational context. |
| `--agent pricelabs` flag on cron | No agent flag (default agent) | Without `--agent`, cron jobs fall back to the default agent, which uses the wrong workspace, skills, and tools. The `--agent` flag is mandatory for multi-agent cron. |
| Separate workspace `~/.openclaw/workspace-pricelabs` | Shared workspace `~/.openclaw/workspace` | Multi-agent requires separate workspaces to prevent cross-contamination of memory, identity, and skills between agents. OpenClaw docs explicitly warn against sharing workspaces. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New npm packages | v1.2 is configuration-only. The MCP server and plugin bridge are complete. No TypeScript code changes needed. | OpenClaw config + workspace Markdown files |
| `openclaw channels login` for Telegram | Telegram does NOT use `openclaw channels login`. Configure `botToken` in config/env, then start gateway. Only WhatsApp uses the login flow. | Set `TELEGRAM_PRICELABS_BOT_TOKEN` in env |
| Multiple Slack apps / workspaces | One Slack app can serve multiple agents via channel bindings. Creating a second app doubles OAuth management for no routing benefit. | Peer binding: `match.channel: "slack", match.peer.kind: "channel"` |
| Custom `agentDir` override | Auto-resolves to `~/.openclaw/agents/pricelabs/agent`. Only override if you have a non-standard state directory. | Let OpenClaw auto-resolve |
| Heartbeat for PriceLabs agent | Cron jobs handle all scheduled work. Heartbeat would add token overhead on every 30-min cycle for no benefit. PriceLabs agent has no inbox-checking workload. | Cron (isolated) for all scheduled tasks |
| Agent-to-agent messaging | `tools.agentToAgent` is off by default and unnecessary. PriceLabs agent should be fully self-contained -- no cross-talk with other agents. | Keep `agentToAgent` disabled |
| Native MCP `mcp.servers` gateway config | This does not exist at the gateway level. MCP is configured per-agent via `agents.list[].mcp.servers`. Already correct in v1.1 config. | Keep existing `agents.list[].mcp.servers` pattern |
| `chat:write.customize` Slack scope | Only needed if you want the agent to post with a custom username/icon that differs from the Slack app name. The Slack app already has the right name. | Use existing bot identity; agent identity is set via `agents.list[].identity` for internal routing only |

## Stack Patterns by Scenario

**If the main agent does NOT exist yet (PriceLabs is the only agent):**
- Set `default: true` on the `pricelabs` agent entry
- Bindings are optional for channel-wide routing (Telegram account binding is still needed for multi-account)
- Slack channel binding still recommended for clean channel isolation

**If the main agent already exists (PriceLabs is a second agent):**
- Keep `default: true` on the `main` agent
- PriceLabs agent MUST have explicit bindings for every channel/peer it should receive
- Messages not matching any binding fall through to the default agent
- Peer bindings (most specific) always beat channel-wide bindings

**If the owner wants DMs to the PriceLabs Telegram bot:**
- Set `dmPolicy: "allowlist"` on the `pricelabs` Telegram account
- Add owner's numeric user ID to `allowFrom`
- DMs collapse to `agent:pricelabs:main` session key (full main-session context)

**If the owner wants approval flow via Telegram DM:**
- DMs to the dedicated PriceLabs bot carry full agent context
- Approval messages route to the PriceLabs agent automatically (binding matches the account)
- No special configuration needed beyond the account binding

## Critical Notes on Existing Config

The current `openclaw.json` has the agent listed under `agents.list[]` with `id: "pricelabs"` but uses `agents.defaults` for sandbox/tools. For v1.2:

1. **Move sandbox config to per-agent**: The `agents.defaults.sandbox` becomes the fallback. Per-agent `sandbox` in `agents.list[].sandbox` overrides it. PriceLabs agent needs `workspaceAccess: "rw"` (currently `"ro"` in defaults).

2. **Move tool deny to per-agent**: The current `agents.defaults.tools.deny` is overly restrictive for the PriceLabs agent (denies `cron` tool which the agent may need for self-scheduling). Per-agent `tools` in `agents.list[].tools` overrides defaults.

3. **Skills via instructions field vs workspace skills/**: The current config uses `instructions: [...]` pointing to file paths. In multi-agent, prefer workspace `skills/` directory so skills are scoped to the agent. The `instructions` field still works but is NOT the standard AgentSkills pattern. The `instructions` field should be removed from the agent entry once skills are in the workspace.

4. **MCP config stays**: The `mcp.servers` under the agent entry is correct and should not change. The existing MCP server configuration with env vars for API key, base URL, DB path, and writes-enabled flag is the right pattern.

5. **Existing cron jobs need `agentId`**: The 4 jobs in `openclaw/cron/jobs.json` lack an `agentId` field. They need to be re-registered with `--agent pricelabs` or edited with `openclaw cron edit <id> --agent pricelabs`.

6. **Cron delivery targets change**: Current jobs deliver to `${SLACK_HEALTH_CHANNEL}` and `${TELEGRAM_HEALTH_CHAT_ID}`. v1.2 jobs should deliver to the new dedicated channel/bot: the Slack `#pricelabs` channel and the dedicated Telegram bot's DM chat ID.

## Version Compatibility

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| OpenClaw Gateway | v2026.1.6+ | Per-agent sandbox + tool config, `agents.list[]` with per-agent `sandbox` and `tools` |
| OpenClaw CLI | v2026.1.6+ | `openclaw cron add --agent <id>` flag support |
| Telegram Bot API | Any current | Standard BotFather bot creation, long polling |
| Slack API | Socket Mode + bot scopes | Existing scopes sufficient; add `chat:write.customize` only if agent identity in messages is desired |
| Node.js | 20+ (already running) | OpenClaw Gateway requirement |

## Migration Path from v1.1

1. **Create workspace directory**: `mkdir -p ~/.openclaw/workspace-pricelabs/{skills,memory}`
2. **Write workspace files**: AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, BOOT.md
3. **Restructure skills**: Convert flat skill `.md` files to AgentSkills directory format (`skills/<name>/SKILL.md`)
4. **Create Telegram bot**: BotFather `/newbot`, save token to env
5. **Create Slack channel**: Create #pricelabs, note the channel ID
6. **Update openclaw.json**: Add agent workspace, add `bindings[]`, add Telegram `accounts.pricelabs`, update sandbox to `rw`
7. **Register cron jobs**: `openclaw cron add --agent pricelabs ...` (4 jobs) OR edit existing jobs with `openclaw cron edit <id> --agent pricelabs`
8. **Update cron delivery targets**: Point to new dedicated channel/bot IDs
9. **Restart gateway**: `openclaw gateway restart`
10. **Validate**: `openclaw agents list --bindings`, `openclaw channels status --probe`, send test message to both channels

## Sources

- OpenClaw docs: `/home/NGA/openclaw/docs/concepts/multi-agent.md` -- Multi-agent routing (bindings, accounts, per-agent workspace) [HIGH confidence, official docs]
- OpenClaw docs: `/home/NGA/openclaw/docs/concepts/agent-workspace.md` -- Workspace file map (AGENTS.md, SOUL.md, etc.) [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/automation/cron-jobs.md` -- Cron job creation, `agentId` field, delivery config [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/cli/cron.md` -- CLI `--agent` flag, `--announce`, `--exact`/`--stagger` [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/channels/telegram.md` -- Multi-account Telegram, BotFather setup, `accounts.<id>.botToken` [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/channels/slack.md` -- Socket mode, channel config, per-channel settings [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/channels/channel-routing.md` -- Routing rules, session keys, peer matching [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/tools/skills.md` -- Per-agent vs shared skills, AgentSkills format [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/tools/multi-agent-sandbox-tools.md` -- Per-agent sandbox/tool config, precedence [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/concepts/memory.md` -- Memory file layout, auto-flush, memory search [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/automation/cron-vs-heartbeat.md` -- When to use cron vs heartbeat [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/start/bootstrapping.md` -- Bootstrap ritual, workspace seeding [HIGH confidence]
- OpenClaw docs: `/home/NGA/openclaw/docs/concepts/agent.md` -- Agent runtime, workspace contract, bootstrap files [HIGH confidence]
- Existing config: `/mnt/c/Projects/pricelabs-agent/openclaw/openclaw.json` -- Current v1.1 configuration [verified]
- Existing cron: `/mnt/c/Projects/pricelabs-agent/openclaw/cron/jobs.json` -- Current v1.1 cron job definitions [verified]
- Existing plugin: `/mnt/c/Projects/pricelabs-agent/openclaw/extensions/pricelabs/openclaw.plugin.json` -- Plugin manifest [verified]

---
*Stack research for: PriceLabs Agent v1.2 -- Agent Identity & Production Setup*
*Researched: 2026-02-26*
