# Phase 12: Agent Registration - Research

**Researched:** 2026-02-27
**Domain:** OpenClaw multi-agent registration -- adding a dedicated PriceLabs agent to an existing NGA gateway
**Confidence:** HIGH

## Summary

Phase 12 registers the PriceLabs agent ("Prism") in the live OpenClaw gateway, which currently runs 8 NGA (NextGen Academy) agents. The workspace files already exist in the repo at `openclaw/workspace-pricelabs/` (created in Phase 11). This phase deploys those files to `~/.openclaw/workspace-pricelabs/`, creates the agent directory with auth profiles, updates the live `openclaw.json` to add the pricelabs agent entry with per-agent sandbox/tool config, and verifies the agent can authenticate, see all 28 PriceLabs tools, and respond with the Prism persona.

A critical discovery during research: the live `~/.openclaw/openclaw.json` is an NGA gateway config with 8 existing agents (`nga-life-skill-researcher`, `nga-orchestrator`, etc.), NOT the repo's standalone PriceLabs config (`openclaw/openclaw.json`). The repo config was designed as a standalone gateway config and cannot simply replace the live one -- the pricelabs agent entry must be MERGED into the existing NGA agent list. The repo's `gateway`, `channels`, and `agents.defaults` sections are NOT applicable to the live gateway and must be ignored. Only the `agents.list[]` entry (with modifications) and the MCP server config are relevant.

**Primary recommendation:** Merge the pricelabs agent entry into the live `~/.openclaw/openclaw.json` agents list, deploy workspace files, copy auth profiles, configure per-agent sandbox with explicit `pricelabs_*` tool allow, and verify via CLI before any message testing. The repo `openclaw/openclaw.json` serves as a reference template, not a deployable config.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- PriceLabs tools ONLY -- only `pricelabs_*` tools in the allow list
- Deny `exec` tool -- Prism cannot run shell commands. Tightest sandbox.
- Workspace access: read-write (`workspaceAccess: "rw"`) so Prism can update MEMORY.md with operational observations
- Filesystem scope: Claude's discretion on appropriate directory restrictions
- Same model as main agent (currently gpt-5.3-codex) for all interactions
- Same model for cron jobs -- no per-mode model differentiation in v1.2
- Two-step sequential verification via CLI (`openclaw agent --agent pricelabs --message "..."`)
  1. First: "Hello, who are you?" -- verify Prism persona (NOT Albot's casual tone)
  2. Then: "Show me my listings" -- verify PriceLabs tool access returns real data
- Persona check: both tone AND specifics (should NOT be casual/humorous, SHOULD use Prism intro text, sign with diamond Prism, reference "your portfolio")
- Data check: verify specific content -- known listing names/locations (TN/NH markets) must appear
- Tool count: explicitly verify all 28 tools visible via `openclaw sandbox explain --agent pricelabs`
- Back up openclaw.json before making changes (`cp openclaw.json openclaw.json.bak`)
- Test gateway restart after each config change
- If gateway fails to start, restore backup immediately

### Claude's Discretion
- Exact filesystem access scope (workspace-only vs broader read access)
- Whether to test the gateway restart between auth profile copy and first message
- Order of config changes within openclaw.json (agent entry, then sandbox, then tools)

### Deferred Ideas (OUT OF SCOPE)
- Per-agent model selection for cron vs interactive -- revisit after seeing usage patterns
- Broader tool access (web search, exec) -- only if a clear need emerges
- Knowledge stack integration for MEMORY.md writes -- v2+ milestone
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGEN-01 | Agent registered in openclaw.json `agents.list[]` with id "pricelabs", correct `agentDir` (not `agentsDir`), and workspace path | Exact config syntax verified in STACK.md and ARCHITECTURE.md. Live config at `~/.openclaw/openclaw.json` inspected -- agent must be added to existing 8-agent list. `agentDir` key confirmed singular (Pitfall #4). |
| AGEN-02 | Agent has per-agent sandbox config with `pricelabs_*` explicitly in `tools.sandbox.tools.allow` (not relying on global inheritance) | Pitfall #1 (sandbox tool allow does NOT inherit) documented with exact root cause from v1.1 debug. User decision locks exec denial. Exact tool allow pattern documented. |
| AGEN-03 | Auth profiles copied from main agent to `~/.openclaw/agents/pricelabs/agent/auth-profiles.json` enabling LLM calls | Main agent auth-profiles.json confirmed at `~/.openclaw/agents/main/agent/auth-profiles.json` (2795 bytes). Pitfall #7 documents immediate copy requirement. |
| AGEN-04 | Agent responds to direct messages with correct persona (SOUL.md personality, not main agent) | SOUL.md verified in Phase 11 workspace (1525 chars). Prism persona distinct from Albot. IDENTITY.md confirms name/emoji/intro. Verification: two-step CLI test per user decision. |
| AGEN-05 | Agent can access all 28 PriceLabs MCP tools and return real API data when queried | MCP server config in repo openclaw.json verified. Extension deployed at `~/.openclaw/extensions/pricelabs/` with tool-definitions.json (1532 lines, 28 tools). Must configure MCP in agent entry. |
</phase_requirements>

## Standard Stack

### Core

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| OpenClaw Gateway | v2026.1.6+ (deployed) | Multi-agent runtime with per-agent sandbox and tool config | Already running with 8 NGA agents. Per-agent config is first-class since v2026.1.6. |
| OpenClaw `agents.list[]` | N/A (JSON config) | Declare pricelabs agent with workspace, agentDir, identity, sandbox, tools, MCP | Documented pattern. 8 agents already registered as proof of pattern. |
| OpenClaw CLI (`openclaw agent`, `openclaw sandbox explain`) | v2026.1.6+ | Test agent registration and verify sandbox tool visibility | Verified commands in STACK.md and PITFALLS.md. |
| Auth profiles (`auth-profiles.json`) | N/A (file copy) | Per-agent LLM authentication | Auth is per-agent at `~/.openclaw/agents/<id>/agent/auth-profiles.json`. |
| MCP Server (pricelabs) | Existing (v1.1) | 28 PriceLabs tools via stdio JSON-RPC | Already deployed at `~/.openclaw/extensions/pricelabs/`. MCP config goes in agent entry. |

### Supporting

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| Workspace files | N/A (Markdown) | Agent brain (AGENTS.md, SOUL.md, etc.) -- created in Phase 11 | Deployed from `openclaw/workspace-pricelabs/` to `~/.openclaw/workspace-pricelabs/` |
| Skills directories | N/A (SKILL.md format) | Domain knowledge, monitoring protocols, playbooks | Already created in Phase 11 at `openclaw/workspace-pricelabs/skills/` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-agent `mcp.servers` in agent entry | Global `plugins.entries.pricelabs` | Global plugin is shared by all agents. Per-agent MCP config restricts the MCP server to only this agent. Since only pricelabs agent needs these tools, per-agent MCP is cleaner. |
| Copying auth-profiles.json | Running `openclaw models auth login` in pricelabs context | Copy is faster and ensures identical auth. Login requires interactive OAuth flow. |
| Tightest sandbox (deny exec, write, edit) | Moderate sandbox (allow exec for workspace management) | User decision locks tightest sandbox. Prism only needs `pricelabs_*` tools + workspace write for MEMORY.md. |

**Installation:**
No new packages. This phase is entirely configuration and file deployment.

## Architecture Patterns

### Deployment Structure

```
~/.openclaw/
  openclaw.json                           # MODIFY: add pricelabs to agents.list[]
  workspace-pricelabs/                    # NEW: deploy from repo openclaw/workspace-pricelabs/
    AGENTS.md, SOUL.md, USER.md, etc.
    skills/
      domain-knowledge/SKILL.md
      monitoring-protocols/SKILL.md
      analysis-playbook/SKILL.md
      optimization-playbook/SKILL.md
  agents/
    main/agent/auth-profiles.json         # SOURCE for auth copy
    pricelabs/                            # NEW
      agent/
        auth-profiles.json                # COPY from main
      sessions/                           # Auto-created by gateway
  extensions/pricelabs/                   # EXISTING: plugin bridge (unchanged)
```

### Pattern 1: Agent Entry for Existing Multi-Agent Gateway

**What:** Adding the pricelabs agent to an existing `agents.list[]` that already contains 8 NGA agents.
**When to use:** When a gateway already has agents registered and you need to add a new one.
**Critical insight:** The live `~/.openclaw/openclaw.json` is NOT the repo's `openclaw/openclaw.json`. The repo config is a standalone template. The live config has 8 NGA agents, subagent orchestration, agent-to-agent tools, Discord channel config, and session thread bindings. The pricelabs agent must be APPENDED to the existing `agents.list[]` array.

**Example agent entry (to merge into live config):**
```json5
{
  "id": "pricelabs",
  "name": "Prism",
  "workspace": "~/.openclaw/workspace-pricelabs",
  // agentDir auto-resolves to ~/.openclaw/agents/pricelabs/agent
  // DO NOT use "agentsDir" (plural) -- crashed gateway 39 times
  "model": {
    "primary": "openai-codex/gpt-5.3-codex"  // same as NGA defaults
  },
  "identity": {
    "name": "Prism",
    "emoji": "diamond_shape_with_a_dot_inside"
  },
  "sandbox": {
    "mode": "all",
    "scope": "agent",
    "workspaceAccess": "rw"  // for MEMORY.md writes
  },
  "tools": {
    "deny": [
      "exec", "process", "write", "edit", "apply_patch",
      "browser", "canvas", "nodes", "gateway",
      "group:runtime", "group:automation",
      "sessions_spawn", "sessions_send", "cron"
    ],
    "sandbox": {
      "tools": {
        "allow": ["pricelabs_*", "read"]
      }
    }
  },
  "mcp": {
    "servers": [
      {
        "name": "pricelabs",
        "command": "node",
        "args": ["/mnt/c/Projects/pricelabs-agent/mcp-servers/pricelabs/dist/index.js"],
        "env": {
          "PRICELABS_API_KEY": "${PRICELABS_API_KEY}",
          "PRICELABS_BASE_URL": "https://api.pricelabs.co",
          "PRICELABS_DB_PATH": "${HOME}/.pricelabs-agent/data.sqlite",
          "PRICELABS_WRITES_ENABLED": "false"
        }
      }
    ]
  }
}
```

**Source:** STACK.md agent declaration pattern, ARCHITECTURE.md section 5, adapted for live NGA gateway context.

### Pattern 2: Auth Profile Isolation

**What:** Each agent has its own `auth-profiles.json` at `~/.openclaw/agents/<id>/agent/`.
**When to use:** Always when creating a new agent that needs LLM access.
**Example:**
```bash
mkdir -p ~/.openclaw/agents/pricelabs/agent
cp ~/.openclaw/agents/main/agent/auth-profiles.json ~/.openclaw/agents/pricelabs/agent/
```

**Source:** ARCHITECTURE.md section 7, PITFALLS.md Pitfall #7.

### Pattern 3: Workspace Deployment

**What:** Copy workspace files from the repo to the live system.
**When to use:** When workspace files are authored in the repo and need deployment.
**Example:**
```bash
# Deploy workspace from repo to live system
cp -r /mnt/c/Projects/pricelabs-agent/openclaw/workspace-pricelabs/ ~/.openclaw/workspace-pricelabs/
```

**Source:** Phase 11 created all files. Deployment is a simple copy.

### Pattern 4: Rollback Safety

**What:** Back up the live config before any modifications.
**When to use:** Before every config change (user decision).
**Example:**
```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak
# Make changes...
# If gateway fails to start:
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json
openclaw gateway restart
```

### Anti-Patterns to Avoid

- **Replacing live openclaw.json with repo version:** The repo's `openclaw/openclaw.json` is a standalone PriceLabs config. The live system has 8 NGA agents, Discord channels, subagent orchestration. Replacing it destroys the entire NGA setup.
- **Using `agentsDir` (plural):** Crashed the gateway 39 times on 2026-02-14. Always use `agentDir` (singular). The config validator rejects unknown keys.
- **Relying on global tool inheritance:** The `pricelabs_*` tools MUST be explicitly in the per-agent sandbox tools allow list. Global tool config does NOT inherit to per-agent sandbox scope.
- **Sharing `agentDir` between agents:** Explicitly forbidden by docs. Causes auth/session collisions.
- **Adding plugin config to agent entry:** Plugins are global in OpenClaw. Use `mcp.servers` under the agent entry for per-agent MCP servers, NOT `plugins.entries`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent registration | Manual JSON editing without backup | `cp openclaw.json openclaw.json.bak` then careful merge, then `openclaw gateway restart` | One typo crashes the gateway. Backup enables instant rollback. |
| Tool visibility verification | Sending test messages and hoping | `openclaw sandbox explain --agent pricelabs` | CLI gives definitive tool list in seconds. Message testing is ambiguous. |
| Auth profile setup | Running OAuth login flow | `cp` from main agent's `auth-profiles.json` | Copy is instant, deterministic, and identical to main agent credentials. |
| Gateway restart verification | Assuming restart succeeded | `openclaw gateway restart` then check process status | Config validation happens at startup. Silent failure is possible. |

**Key insight:** Every step in this phase has a deterministic CLI verification command. Never skip verification and assume success.

## Common Pitfalls

### Pitfall 1: Sandbox Tool Allow List Does Not Inherit (CRITICAL -- v1.1 Root Cause Repeat)

**What goes wrong:** The pricelabs agent is registered but silently loses access to all 28 PriceLabs tools. Agent responds generically because tools never reach the LLM.
**Why it happens:** Per-agent sandbox config REPLACES the global sandbox config, not supplements it. The `pricelabs_*` glob in the global `tools.sandbox.tools.allow` does NOT carry to the new agent's sandbox scope. When the agent has its own `sandbox` block, OpenClaw uses `DEFAULT_TOOL_ALLOW` (13 core tools only) as the starting point.
**How to avoid:**
1. Explicitly set `agents.list[].tools.sandbox.tools.allow` with `pricelabs_*` on the agent entry.
2. Run `openclaw sandbox explain --agent pricelabs` IMMEDIATELY after registration.
3. Verify the output includes `pricelabs_*` in the allowed tools list.
**Warning signs:** Agent responds with generic advice instead of calling tools. Gateway log shows tool filtering with no `pricelabs_*` entries.

### Pitfall 2: Auth Profiles Not Copied (CRITICAL)

**What goes wrong:** Agent cannot make LLM calls. First message fails with authentication error.
**Why it happens:** Auth is per-agent at `~/.openclaw/agents/<id>/agent/auth-profiles.json`. Main agent credentials are NOT shared automatically.
**How to avoid:** Copy auth-profiles.json from main agent IMMEDIATELY after creating the agent directory.
**Warning signs:** "No auth profile found" error. Model authentication failure in gateway log.

### Pitfall 3: `agentDir` Typo (agentsDir vs agentDir)

**What goes wrong:** Gateway crashes on startup. Config validator rejects unknown key `agentsDir`.
**Why it happens:** The plural form `agentsDir` looks correct but is invalid. Only `agentDir` (singular) is recognized.
**How to avoid:** Use the exact key `agentDir` if explicitly setting it. Or omit it entirely (auto-resolves to `~/.openclaw/agents/<id>/agent`).
**Warning signs:** Gateway fails to start after config change. 39 crashes documented on 2026-02-14.

### Pitfall 4: Live Config is NGA Gateway, Not Standalone PriceLabs

**What goes wrong:** Planner assumes the repo's `openclaw/openclaw.json` can be deployed directly. Deploying it destroys 8 NGA agents, Discord config, subagent orchestration.
**Why it happens:** The repo contains a standalone PriceLabs config designed during v1.0. The live system evolved into a multi-agent NGA gateway.
**How to avoid:** MERGE the pricelabs agent entry into the live config. Never replace the live `openclaw.json`. The repo config is a reference template only.
**Warning signs:** After deployment, `openclaw agents list` shows only 1 agent instead of 9.

### Pitfall 5: MCP Server Path Resolution

**What goes wrong:** MCP server fails to spawn because the path in `mcp.servers[].args` is wrong.
**Why it happens:** The repo config uses relative path `mcp-servers/pricelabs/dist/index.js`. The live gateway may resolve paths relative to its own working directory, not the project repo.
**How to avoid:** Use an absolute path in the agent's `mcp.servers[].args`: `/mnt/c/Projects/pricelabs-agent/mcp-servers/pricelabs/dist/index.js`.
**Warning signs:** Gateway log shows "spawn error" or "ENOENT" for the MCP server command. Agent has no tools available.

### Pitfall 6: Model Mismatch Between NGA Default and User Decision

**What goes wrong:** User decided "same model as main agent (currently gpt-5.3-codex)". But the repo config has `"model": "anthropic/claude-opus-4-6"`. If the planner uses the repo config's model, it contradicts the user decision.
**Why it happens:** The repo config was created before the user decision to use gpt-5.3-codex.
**How to avoid:** Use `"model": { "primary": "openai-codex/gpt-5.3-codex" }` matching the live NGA defaults, per the user decision.
**Warning signs:** Agent uses a different model than expected. Token costs differ from main agent.

## Code Examples

### Example 1: Complete Agent Entry for Live Config Merge

```json5
// Source: Synthesized from STACK.md, ARCHITECTURE.md, CONTEXT.md decisions, live config inspection
// Add this to the end of agents.list[] in ~/.openclaw/openclaw.json
{
  "id": "pricelabs",
  "name": "Prism",
  "workspace": "~/.openclaw/workspace-pricelabs",
  "model": {
    "primary": "openai-codex/gpt-5.3-codex"
  },
  "identity": {
    "name": "Prism",
    "emoji": "diamond_shape_with_a_dot_inside"
  },
  "sandbox": {
    "mode": "all",
    "scope": "agent",
    "workspaceAccess": "rw"
  },
  "tools": {
    "deny": [
      "exec", "process", "write", "edit", "apply_patch",
      "browser", "canvas", "nodes", "gateway",
      "group:runtime", "group:automation",
      "sessions_spawn", "sessions_send", "cron"
    ],
    "sandbox": {
      "tools": {
        "allow": ["pricelabs_*", "read"]
      }
    },
    "fs": {
      "workspaceOnly": true
    },
    "exec": {
      "security": "deny"
    },
    "elevated": {
      "enabled": false
    }
  },
  "mcp": {
    "servers": [
      {
        "name": "pricelabs",
        "command": "node",
        "args": ["/mnt/c/Projects/pricelabs-agent/mcp-servers/pricelabs/dist/index.js"],
        "env": {
          "PRICELABS_API_KEY": "${PRICELABS_API_KEY}",
          "PRICELABS_BASE_URL": "https://api.pricelabs.co",
          "PRICELABS_DB_PATH": "${HOME}/.pricelabs-agent/data.sqlite",
          "PRICELABS_WRITES_ENABLED": "false"
        }
      }
    ]
  }
}
```

### Example 2: Deployment Script (Workspace + Auth + Config)

```bash
# Source: ARCHITECTURE.md build order, adapted for live NGA gateway

# Step 1: Backup
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak

# Step 2: Deploy workspace files
cp -r /mnt/c/Projects/pricelabs-agent/openclaw/workspace-pricelabs/ ~/.openclaw/workspace-pricelabs/

# Step 3: Create agent directory and copy auth
mkdir -p ~/.openclaw/agents/pricelabs/agent
cp ~/.openclaw/agents/main/agent/auth-profiles.json ~/.openclaw/agents/pricelabs/agent/

# Step 4: Merge pricelabs agent into live openclaw.json
# (manual JSON edit -- add entry to agents.list[])
# See Example 1 for the exact entry

# Step 5: Restart gateway
openclaw gateway restart

# Step 6: Verify
openclaw sandbox explain --agent pricelabs   # Must show pricelabs_*
openclaw agent --agent pricelabs --message "Hello, who are you?"  # Must show Prism persona
openclaw agent --agent pricelabs --message "Show me my listings"  # Must show real data
```

### Example 3: Verification Commands

```bash
# Source: PITFALLS.md "Looks Done But Isn't" checklist

# Verify agent is registered
openclaw agents list

# Verify tool visibility (MOST IMPORTANT -- prevents Pitfall #1)
openclaw sandbox explain --agent pricelabs
# Expected: pricelabs_* in allowed tools, exec NOT in allowed tools

# Verify persona (AGEN-04)
openclaw agent --agent pricelabs --message "Hello, who are you?"
# Expected: Prism intro, diamond signature, professional tone, NOT Albot

# Verify tool access (AGEN-05)
openclaw agent --agent pricelabs --message "Show me my listings"
# Expected: Real listing data from TN/NH markets, actual names/locations
```

## State of the Art

| Old Approach (repo config) | Current Approach (live system) | When Changed | Impact |
|---------------------------|-------------------------------|--------------|--------|
| Standalone PriceLabs gateway | Multi-agent NGA gateway with pricelabs added | Discovered during research | Repo config is a template, NOT deployable. Must merge into live config. |
| `"model": "anthropic/claude-opus-4-6"` in repo | `"model": { "primary": "openai-codex/gpt-5.3-codex" }` in live NGA defaults | User decision in CONTEXT.md | Must use gpt-5.3-codex per user decision, matching NGA defaults. |
| `instructions: [...]` for skills in agent entry | Workspace `skills/` directory with SKILL.md format | Phase 11 | Remove `instructions` field from agent entry. Skills are now in workspace. |
| Relative MCP server path | Absolute path required for live gateway | Live system discovery | Gateway resolves paths from its own CWD, not repo root. |

**Deprecated/outdated:**
- The repo's `openclaw/openclaw.json` `agents.defaults` section is NOT applicable to the live system. The live system has its own defaults.
- The repo's `channels` section is NOT applicable. The live system uses Discord, not Slack/Telegram directly.
- The `instructions: [...]` field on the agent entry is superseded by workspace `skills/` directories (Phase 11 migration).

## Open Questions

1. **Exact `tools.sandbox.tools.allow` syntax for per-agent config**
   - What we know: The allow list must include `pricelabs_*`. The deny list must exclude `exec`. The docs show both `tools.deny` and `tools.sandbox.tools.allow` as separate config paths.
   - What's unclear: Whether `tools.deny` at the agent level interacts with `tools.sandbox.tools.allow` at the agent level. Does deny take precedence over sandbox allow? The tool policy pipeline docs suggest deny always wins.
   - Recommendation: Set both `tools.deny` (for exec, runtime, etc.) AND `tools.sandbox.tools.allow` (for `pricelabs_*`). Verify with `openclaw sandbox explain`. If tools are missing, adjust.

2. **Whether the live gateway needs `plugins` or `extensions` config for the PriceLabs MCP**
   - What we know: The pricelabs extension exists at `~/.openclaw/extensions/pricelabs/` on disk. The live `openclaw.json` has NO `plugins` or `extensions` config. The repo config uses per-agent `mcp.servers` instead.
   - What's unclear: Whether the extension on disk is auto-discovered or must be referenced in config. The per-agent `mcp.servers` pattern may bypass the extension system entirely.
   - Recommendation: Use per-agent `mcp.servers` in the agent entry (as in the repo config). This directly spawns the MCP server as a child process. No global plugin config needed. The extension on disk is a deployment artifact, not a config requirement.

3. **Workspace write access mechanism**
   - What we know: User decided `workspaceAccess: "rw"` for MEMORY.md writes. The sandbox config supports this.
   - What's unclear: With `tools.deny` including `write` and `edit`, can the agent still write to its workspace via the memory system? Workspace writes may use a different code path than the `write` tool.
   - Recommendation: Set `workspaceAccess: "rw"` in sandbox config. If MEMORY.md writes fail, the `write` tool denial may need to be scoped to non-workspace paths. Test immediately.

4. **Gateway restart behavior with new agent**
   - What we know: Config changes require `openclaw gateway restart`. The user wants restart tested after each config change.
   - What's unclear: Whether `openclaw gateway restart` preserves existing NGA agent sessions or kills them.
   - Recommendation: Test restart during a quiet period. Back up config. Expect a brief service interruption for all agents.

## Sources

### Primary (HIGH confidence)

- **STACK.md** (`/mnt/c/Projects/pricelabs-agent/.planning/research/STACK.md`) -- Exact config syntax for agents.list[], MCP servers, sandbox, tools. Verified against OpenClaw docs.
- **ARCHITECTURE.md** (`/mnt/c/Projects/pricelabs-agent/.planning/research/ARCHITECTURE.md`) -- System diagram, data flow, agent entry structure, auth profile isolation, build order.
- **PITFALLS.md** (`/mnt/c/Projects/pricelabs-agent/.planning/research/PITFALLS.md`) -- 7 critical pitfalls, especially Pitfall #1 (sandbox tool allow), Pitfall #4 (agentDir typo), Pitfall #7 (auth profiles).
- **SUMMARY.md** (`/mnt/c/Projects/pricelabs-agent/.planning/research/SUMMARY.md`) -- Executive summary, phase ordering rationale, research flags.
- **Live `~/.openclaw/openclaw.json`** -- Actual running config with 8 NGA agents (inspected during research).
- **Live `~/.openclaw/agents/main/agent/`** -- Confirmed auth-profiles.json exists (2795 bytes).
- **Live `~/.openclaw/extensions/pricelabs/`** -- Confirmed plugin bridge deployed with tool-definitions.json (1532 lines).

### Secondary (MEDIUM confidence)

- **Repo `openclaw/openclaw.json`** (`/mnt/c/Projects/pricelabs-agent/openclaw/openclaw.json`) -- Template config (standalone PriceLabs gateway). Useful as reference for MCP server config and agent entry structure. NOT directly deployable.
- **Phase 11 workspace files** (`/mnt/c/Projects/pricelabs-agent/openclaw/workspace-pricelabs/`) -- All brain files and skills verified. Combined bootstrap overhead: 5,171 chars (~1,293 tokens). Well under 8,000 char budget.

### Tertiary (LOW confidence)

- **Exact tool policy interaction (tools.deny vs tools.sandbox.tools.allow):** Only training data suggests deny always wins over sandbox allow. Needs validation with `openclaw sandbox explain` after config change.
- **Workspace write path vs write tool denial:** Uncertain whether `workspaceAccess: "rw"` bypasses `tools.deny: ["write"]` for memory operations. Needs live testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all config patterns verified in project research docs AND cross-referenced with live system
- Architecture: HIGH -- live system inspected, deployment structure mapped, merge strategy clear
- Pitfalls: HIGH -- sourced from v1.1 post-mortems, OpenClaw docs, and live config inspection

**Critical discovery:** The live `openclaw.json` is an NGA multi-agent gateway, not the standalone PriceLabs config from the repo. This fundamentally changes the deployment approach from "deploy config" to "merge agent entry into existing config."

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- config-only milestone, no dependency version drift)
