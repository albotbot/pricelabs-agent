# Pitfalls Research

**Domain:** Adding a dedicated OpenClaw agent to an existing single-agent setup (v1.2 milestone)
**Researched:** 2026-02-26
**Confidence:** HIGH (sourced from OpenClaw official docs, actual v1.1 post-mortems, and live config inspection)

This document catalogs pitfalls specific to the v1.2 migration: transforming the PriceLabs integration from a plugin on the main agent into a dedicated agent with its own workspace, bindings, Telegram bot, Slack channel routing, and permanent cron jobs. These are not generic pitfalls -- each one references actual OpenClaw behavior verified against the docs and the current `openclaw.json` configuration.

---

## Critical Pitfalls

### Pitfall 1: Sandbox Tool Allow List Does Not Inherit to New Agent

**What goes wrong:**
The new PriceLabs agent is created under `agents.list[]` but the `pricelabs_*` tool glob that was added to `tools.sandbox.tools.allow` in v1.1 does not apply. The agent silently loses access to all 28 PriceLabs tools. The agent responds to "How is my portfolio doing?" as a generic AI because the tools never reach the LLM.

**Why it happens:**
This is the exact root cause from the v1.1 debug session (`.planning/debug/openclaw-plugin-tools.md`). OpenClaw's sandbox tool policy pipeline (documented in `/tools/multi-agent-sandbox-tools`) has a strict precedence chain:

1. Global tool policy (`tools.allow`/`tools.deny`)
2. Agent-specific tool policy (`agents.list[].tools.allow/deny`)
3. Sandbox tool policy (`tools.sandbox.tools` OR `agents.list[].tools.sandbox.tools`)

The critical behavior: "If `agents.list[].tools.sandbox.tools` is set, it **replaces** `tools.sandbox.tools` for that agent." Conversely, if the new agent has its own `sandbox` block but no `tools.sandbox.tools`, it falls back to `agents.defaults.sandbox`, which uses `DEFAULT_TOOL_ALLOW` -- the hardcoded list of 13 core tools that does NOT include `pricelabs_*`.

The current config has `tools.sandbox.tools.allow` at the global level with `pricelabs_*`. But once a new agent entry exists in `agents.list[]` with its own `sandbox` config, the resolution path changes. If the new agent's sandbox scope or mode differs from the default, OpenClaw may re-evaluate which tool policy layer applies, and the global `tools.sandbox.tools.allow` may or may not carry through depending on the exact combination.

**How to avoid:**
1. Explicitly set `agents.list[].tools.sandbox.tools.allow` on the PriceLabs agent entry, including both the 13 core tools AND the `pricelabs_*` glob.
2. Do NOT assume the global `tools.sandbox.tools.allow` inherits. Per the docs: "each level can further restrict tools, but cannot grant back denied tools from earlier levels."
3. After creating the agent, run `openclaw sandbox explain --agent pricelabs` to verify the effective tool policy includes `pricelabs_*`.
4. Test immediately: send a PriceLabs-specific question to the new agent and confirm tool calls appear in the gateway log.

**Warning signs:**
- Agent responds to portfolio questions with generic advice instead of calling `pricelabs_get_listings`.
- Gateway log shows `[tools] filtering tools for agent:pricelabs` with no `pricelabs_*` entries in the resolved list.
- `openclaw sandbox explain --agent pricelabs` does not show `pricelabs_*` in the allowed tools.

**Phase to address:**
Phase 1 (Agent Creation). The very first thing after creating the agent entry. Must be verified BEFORE any other testing.

---

### Pitfall 2: Plugin Tools Registered Globally But Agent Cannot See Them

**What goes wrong:**
The PriceLabs plugin is loaded via `plugins.load.paths` and `plugins.entries.pricelabs` at the global config level. The plugin registers 28 tools into the Gateway-wide tool registry. However, the new agent might not receive these tools because of agent-level tool policy filtering.

**Why it happens:**
Plugin tools pass through `resolvePluginTools()` into the combined tool list. But then `applyToolPolicyPipeline()` applies each filter layer sequentially. If the new agent has `agents.list[].tools.allow` set to a restricted list (for example, copying the "family bot" pattern from the docs with only `["read", "exec", "sessions_*"]`), the plugin tools are filtered out.

The subtlety: even if you do NOT set an explicit `tools.allow` on the agent, sandbox mode `"all"` applies `DEFAULT_TOOL_ALLOW` which is hardcoded to 13 core tools. Plugin tools are not core tools.

**How to avoid:**
1. The PriceLabs agent MUST have `pricelabs_*` in its tool allow list (either via `agents.list[].tools.sandbox.tools.allow` or `agents.list[].tools.allow`).
2. Do NOT use the "read-only agent" or "communication-only agent" patterns from the docs as starting templates. Those explicitly deny tools the PriceLabs agent needs.
3. The minimum tool set for the PriceLabs agent is: `["exec", "process", "read", "write", "edit", "apply_patch", "image", "sessions_list", "sessions_history", "sessions_send", "sessions_spawn", "subagents", "session_status", "pricelabs_*"]`.

**Warning signs:**
- `openclaw agents list --bindings` shows the agent but tool count is lower than expected.
- Agent says "I don't have any tools available for pricing data" when asked about portfolio.

**Phase to address:**
Phase 1 (Agent Creation). Must validate tool visibility as the first functional test.

---

### Pitfall 3: New Telegram Bot Token Breaks Existing Main Agent Telegram

**What goes wrong:**
You create a second Telegram bot (via BotFather) for the PriceLabs agent and add it under `channels.telegram.accounts`. But the existing main agent's Telegram bot token is currently at the top-level `channels.telegram.botToken`, not under an `accounts` structure. Moving to multi-account requires restructuring the entire Telegram channel config. If done incorrectly, the main agent loses its Telegram connection.

**Why it happens:**
OpenClaw's single-bot Telegram config uses:
```json
"telegram": { "botToken": "...", "dmPolicy": "pairing" }
```

Multi-bot Telegram config uses:
```json
"telegram": { "accounts": { "default": { "botToken": "..." }, "pricelabs": { "botToken": "..." } } }
```

These are different config shapes. The docs say: "Tokens live in `channels.telegram.accounts.<id>.botToken` (default account can use `TELEGRAM_BOT_TOKEN`)." The migration from flat to accounts structure is not automatically handled. If you add `accounts` but leave the old top-level `botToken`, the behavior is undefined -- OpenClaw may use the top-level token as the default account, or it may conflict.

**How to avoid:**
1. Migrate the existing Telegram config to the multi-account structure FIRST, keeping the existing bot token under `accounts.default`.
2. Verify the main agent still receives Telegram messages after the restructure (before adding the PriceLabs bot).
3. Only then add the PriceLabs bot token under `accounts.pricelabs`.
4. Add bindings: `{ "agentId": "main", "match": { "channel": "telegram", "accountId": "default" } }` and `{ "agentId": "pricelabs", "match": { "channel": "telegram", "accountId": "pricelabs" } }`.
5. Run `openclaw channels status --probe` after each change to verify both bots connect.

**Warning signs:**
- `openclaw channels status --probe` shows Telegram disconnected after config change.
- Main agent stops responding to Telegram messages.
- Gateway log shows "telegram: auth error" or "botToken not found for account".

**Phase to address:**
Phase 2 (Channel Routing). Must be a careful, sequential migration with rollback plan.

---

### Pitfall 4: Binding Precedence Causes Cross-Talk Between Agents

**What goes wrong:**
Messages intended for the PriceLabs agent are routed to the main agent (or vice versa) because bindings are ordered incorrectly or use insufficient match specificity. The main agent receives a "How is my portfolio doing?" message, cannot find PriceLabs tools, and responds generically.

**Why it happens:**
OpenClaw bindings are evaluated in **most-specific-first** order per the documented precedence:
1. `peer` match (exact DM/group/channel id)
2. `parentPeer` match
3. `guildId + roles`
4. `guildId`
5. `teamId`
6. `accountId` match
7. channel-level match (`accountId: "*"`)
8. fallback to default agent

"If multiple bindings match in the same tier, the first one in config order wins." This means if you have:
```json
[
  { "agentId": "main", "match": { "channel": "telegram" } },
  { "agentId": "pricelabs", "match": { "channel": "telegram", "accountId": "pricelabs" } }
]
```
The first binding wins for ALL Telegram messages because it is a channel-level catch-all evaluated first in config order, even though the second binding is more specific. The specificity tiers determine which fields are evaluated, but within the same tier evaluation proceeds in config order.

Actually, re-reading the docs: "Bindings are deterministic and most-specific wins" with the numbered precedence. An `accountId` match (tier 6) is more specific than a channel-level match (tier 7). So the `accountId: "pricelabs"` binding SHOULD win. But the danger is when both bots receive a DM from the same user -- the `peer` tier may collapse to the same session key.

The real cross-talk risk: if the user DMs both bots from the same Telegram account, and bindings match on `accountId`, this should route correctly. But if a binding is missing `accountId` (bare channel match), it catches everything.

**How to avoid:**
1. Every binding MUST specify `accountId` explicitly. Never use bare channel matches in multi-agent setups.
2. For Slack, use `peer` match with the specific channel ID: `{ "agentId": "pricelabs", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "C0PRICELABS" } } }`.
3. Put more-specific bindings BEFORE less-specific ones in the config array.
4. After configuring bindings, run `openclaw agents list --bindings` and verify every route.
5. Test by sending a message to each channel/bot and checking which agent responds in the gateway log.

**Warning signs:**
- Messages sent to the PriceLabs Telegram bot are answered by the main agent (or vice versa).
- Gateway log shows `routing message to agent:main` when it should show `agent:pricelabs`.
- `openclaw agents list --bindings` shows overlapping or ambiguous routes.

**Phase to address:**
Phase 2 (Channel Routing). Must be verified with a routing test matrix.

---

### Pitfall 5: Cron Jobs Target Wrong Agent (Missing or Stale `agentId`)

**What goes wrong:**
Permanent cron jobs for daily health summaries and weekly optimization reports run under the `main` agent instead of the `pricelabs` agent. The main agent does not have PriceLabs domain context (different workspace, different skills) and produces generic or empty reports. Alternatively, existing main-agent cron jobs accidentally get `agentId` reassigned.

**Why it happens:**
OpenClaw cron jobs have an optional `agentId` field. Per the docs: "If missing or unknown, the gateway falls back to the default agent." The current `jobs.json` shows 5 existing cron jobs, some with `"agentId": "main"` and some without. New cron jobs created via `openclaw cron add` default to the caller's agent context. If you create the PriceLabs cron jobs from the main agent's session, they may default to `agentId: "main"`.

The `--agent` flag exists: `openclaw cron add --agent pricelabs`, but forgetting it is easy and the failure mode is silent -- the job runs, just under the wrong agent.

Additionally, the known OpenClaw cron skip bug #17852 may cause scheduled jobs to silently skip execution. If the first runs of new permanent jobs are skipped, you may not notice the problem for days.

**How to avoid:**
1. Always use `--agent pricelabs` when creating PriceLabs cron jobs.
2. After creation, run `openclaw cron list` and verify `agentId` is `"pricelabs"` for each PriceLabs job.
3. For the v1.2 delivery targets, use explicit `--channel` and `--to` flags:
   - Telegram: `--channel telegram --to "<pricelabs-bot-chatId>"` (explicit chatId required -- Telegram does not auto-resolve like Slack).
   - Slack: `--channel slack --to "channel:C0PRICELABS"` (must use `channel:` prefix for channel targets).
4. Run each cron job manually once with `openclaw cron run <jobId>` and verify the correct agent handles it.
5. Monitor cron runs for the first week: `openclaw cron runs --id <jobId> --limit 10`.

**Warning signs:**
- `openclaw cron list` shows PriceLabs jobs with `agentId: "main"` or no `agentId`.
- Cron run output contains generic responses instead of PriceLabs-specific content.
- `cron delivery target is missing` error (already seen in current `jobs.json` for the Weekly Security Check job).
- Multiple consecutive `lastStatus: "error"` entries (cron skip bug #17852).

**Phase to address:**
Phase 3 (Cron Jobs). Must be validated individually for each permanent job.

---

### Pitfall 6: Workspace Brain Files Ignored by the LLM

**What goes wrong:**
You create AGENTS.md, SOUL.md, IDENTITY.md, USER.md, TOOLS.md, and MEMORY.md in the PriceLabs agent's workspace. But the agent does not follow the instructions in these files -- it ignores domain-specific rules, uses the wrong tone, or does not reference PriceLabs-specific protocols.

**Why it happens:**
Multiple causes documented in the OpenClaw workspace docs:

1. **Workspace path misconfiguration:** The `agents.list[].workspace` path does not match the actual directory where files were created. OpenClaw injects "missing file" markers and continues.

2. **Token budget exhaustion:** Bootstrap files are injected into the context window on every turn. The current main workspace has a 17KB AGENTS.md. If the PriceLabs agent's workspace files are similarly large, combined with skill instructions and the PriceLabs tool schemas (28 tools), the context window fills quickly. `agents.defaults.bootstrapMaxChars` defaults to 20,000 per file. `agents.defaults.bootstrapTotalMaxChars` defaults to 150,000 total. But with 28 tool schemas, the effective available space is much less.

3. **Compaction wipes context:** If the session reaches its context limit, compaction kicks in. After compaction, only the summary survives -- the full workspace file instructions may be reduced to a few sentences. The `compaction.mode: "safeguard"` setting in the current config preserves more, but domain-specific nuances in AGENTS.md can still be lost.

4. **Skills conflict:** If PriceLabs skills in `<workspace>/skills/` conflict with managed skills in `~/.openclaw/skills/`, workspace skills win by precedence. But if the workspace `skills/` directory is empty or misconfigured, the agent falls back to shared skills that know nothing about PriceLabs.

**How to avoid:**
1. Keep workspace files concise. AGENTS.md should be under 5,000 characters for a domain-specific agent. Do not copy the main agent's 17KB AGENTS.md.
2. Use `openclaw agents list` to verify the workspace path resolves correctly.
3. After creating the workspace, send the agent a test message and check that it references workspace file content (e.g., "what are your instructions?" should echo AGENTS.md content).
4. Copy PriceLabs skills (currently in `~/.openclaw/workspace/pricelabs-skills/`) to the new agent's `<workspace>/skills/` directory.
5. Use `/context list` or `/context detail` to inspect how much context budget each file consumes.
6. Set `agents.list[].contextTokens` appropriately (default: 131072). With 28 tool schemas, allow at least 30,000 tokens for tools alone.

**Warning signs:**
- Agent responds with generic personality instead of PriceLabs domain tone.
- Agent says "I don't see any special instructions" when asked about its role.
- `/context list` shows "missing file" markers for workspace files.
- Gateway log shows workspace path resolution errors.

**Phase to address:**
Phase 1 (Agent Creation). Workspace setup is the foundation for agent identity.

---

### Pitfall 7: Auth Profiles Not Copied to New Agent Directory

**What goes wrong:**
The PriceLabs agent is created but cannot make LLM calls because it has no auth profiles. The agent's first turn fails with an authentication error. The gateway falls back to the default agent or returns an error.

**Why it happens:**
Per the multi-agent docs: "Auth profiles are per-agent. Each agent reads from its own `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`. Main agent credentials are NOT shared automatically. Never reuse `agentDir` across agents (it causes auth/session collisions). If you want to share creds, copy `auth-profiles.json` into the other agent's `agentDir`."

The current config uses `openai-codex:default` with OAuth mode. The PriceLabs agent needs the same OAuth credentials to call the LLM. These must be explicitly copied.

**How to avoid:**
1. After creating the agent with `openclaw agents add pricelabs`, immediately copy auth profiles:
   ```bash
   cp ~/.openclaw/agents/main/agent/auth-profiles.json ~/.openclaw/agents/pricelabs/agent/auth-profiles.json
   ```
2. Alternatively, run `openclaw models auth login` in the pricelabs agent context.
3. Verify auth works before any other testing: send a simple "hello" message and confirm a response.

**Warning signs:**
- Agent fails on first message with "no auth profile found" or model authentication errors.
- Gateway log shows auth resolution failure for `agent:pricelabs`.

**Phase to address:**
Phase 1 (Agent Creation). Must be done immediately after agent directory creation.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Share `agentDir` between main and pricelabs agents | Quick setup, no auth copy needed | Auth/session collisions, corrupted state | Never -- explicitly forbidden by docs |
| Copy entire main workspace as starting point | Fast initial content | 17KB AGENTS.md wastes tokens, irrelevant content confuses agent | Never -- write from scratch for domain agent |
| Use `delivery.channel: "last"` for cron jobs | No need to specify targets | "Last" route is undefined for a new agent that has never responded anywhere | Only after the agent has established a conversation history |
| Reuse main agent's Telegram bot for PriceLabs | No BotFather setup needed | No identity separation, confusing UX, binding conflicts | Never for production -- acceptable for quick local testing only |
| Skip `openclaw sandbox explain` verification | Saves a command | Silent tool filtering goes unnoticed for days | Never -- takes 5 seconds and prevents the #1 pitfall |
| Set `agents.list[].sandbox.mode: "off"` to avoid tool filtering | All tools available immediately | No security isolation, full host access | Only during initial development, must re-enable before production |

## Integration Gotchas

Common mistakes when connecting the new agent to existing infrastructure.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Telegram cron delivery | Omitting `--to <chatId>` | Telegram requires explicit `--to` with the chatId. Unlike Slack, it does not auto-resolve from the bot token. Verify chatId by sending `/start` to the new bot and checking updates. |
| Slack channel routing | Using bare channel name instead of ID | Slack bindings require the channel ID (`C0PRICELABS`), not the display name (`#pricelabs`). Get the ID from Slack's channel details. Use `channel:C0PRICELABS` prefix in cron delivery targets. |
| Plugin sharing across agents | Assuming plugin config is per-agent | `plugins.entries.pricelabs` is GLOBAL. Both agents share the same plugin instance and MCP server process. You cannot have different PriceLabs configs per agent. This is fine for v1.2 (single user), but blocks multi-user in v2.0. |
| Existing cron jobs after migration | Not updating old cron jobs' `agentId` | The 5 existing cron jobs in `jobs.json` are bound to `agentId: "main"`. If PriceLabs cron logic was ever added to any of them, they need to be migrated. In practice, none of the existing jobs are PriceLabs-related, so they stay as-is. But verify. |
| Slack channel allowlist | Adding new channel to bindings but not to `channels.slack.channels` allowlist | The current config only allows `C0AF9MXD0ER` and `C0AG7FJNKNC`. A new `#pricelabs` channel must be added to `channels.slack.channels` with `allow: true`. Without this, Slack ignores messages from the channel entirely. |
| OpenClaw gateway restart | Editing config without restarting | "Config changes require a gateway restart." Every `openclaw.json` change is dead until `openclaw gateway restart`. Easy to forget during iterative config changes. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Single MCP server process for all agent requests | Works fine for one user, one agent | The current plugin spawns one `node` child process for the MCP server. If both main and pricelabs agents call PriceLabs tools simultaneously (`agents.defaults.maxConcurrent: 2`), requests serialize through one stdin pipe. | 2+ concurrent agent turns using PriceLabs tools |
| Plugin tool timeout at 60 seconds | Adequate for single calls | The MCP bridge uses `timeoutMs = 60000` for tool calls. If the MCP server is busy with a long API call from the other agent, the queue grows and later calls may timeout. | Heavy concurrent usage or slow PriceLabs API responses |
| Isolated cron sessions accumulate | Invisible at first | Each isolated cron run creates a session. Default `cron.sessionRetention: "24h"` helps, but if the PriceLabs agent runs 2 cron jobs daily (health + optimization), that is 14 sessions/week. With the existing 5 jobs, total is 49 sessions/week before pruning. | After weeks of operation, session storage may grow if retention is increased |
| 28 tool schemas in every context window | Works with 131K context | Each PriceLabs tool schema consumes tokens. 28 tools with JSON schemas average ~100-200 tokens each, totaling ~3,000-5,000 tokens per session turn. This is unavoidable overhead. | If context window is reduced, or if workspace files are too large |

## Security Mistakes

Domain-specific security issues for the multi-agent transition.

| Mistake | Risk | Prevention |
|---------|------|------------|
| PriceLabs API key visible to main agent | Main agent sessions could log or expose the key if instructed by prompt injection | The key is in the global `env` block of `openclaw.json` AND in `plugins.entries.pricelabs.config`. Both are readable by any agent. For v1.2 this is acceptable (single user). For v2.0, must move to per-agent credential isolation. |
| New Telegram bot token in config file | `openclaw.json` contains both bot tokens in plaintext. Anyone with file access has both bots. | Set `chmod 600 ~/.openclaw/openclaw.json`. Consider moving tokens to environment variables: `TELEGRAM_BOT_TOKEN_PRICELABS`. |
| PriceLabs agent with `exec` tool allowed | Agent can run arbitrary commands on the host | Evaluate whether `exec` is needed. If the agent only needs to call PriceLabs tools, deny `exec`: `agents.list[].tools.deny: ["exec"]`. If exec is needed for workspace file management, keep it but enable `tools.exec.security: "allowlist"`. |
| Cross-agent session leakage | Main agent could theoretically access PriceLabs agent session data via `sessions_list`/`sessions_history` | Session stores are per-agent under `~/.openclaw/agents/<agentId>/sessions/`. The tools should be scoped. But if `tools.agentToAgent` is enabled, explicit cross-agent messaging becomes possible. Keep `tools.agentToAgent.enabled: false` (current default). |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| PriceLabs bot responds with main agent's personality | Confusing -- user messages the PriceLabs bot but gets generic assistant replies | Ensure SOUL.md and IDENTITY.md establish clear PriceLabs domain identity. First message should confirm: "I'm your PriceLabs revenue manager." |
| Cron health summary delivered to wrong channel | User receives PriceLabs reports in their general Slack channel mixed with other notifications | Always use explicit `--channel` and `--to` on cron jobs. Never use `--channel last` for new agents. |
| No response acknowledgment | User sends a portfolio question, agent takes 30 seconds to fetch data, user thinks it is broken | Set `messages.ackReactionScope: "group-mentions"` (already configured). For the PriceLabs agent, consider `streaming: "partial"` to show progress. |
| Approval messages in PriceLabs channel mixed with reports | Health summaries and approval requests in the same channel create noise | Consider separating: health summaries go to `#pricelabs-reports`, approval requests go to DM. Or use threading in Slack (`parentPeer` binding). |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Agent created:** Verify `openclaw agents list` shows the agent with correct workspace path AND `openclaw sandbox explain --agent pricelabs` shows `pricelabs_*` in allowed tools.
- [ ] **Telegram bot connected:** Verify `openclaw channels status --probe` shows BOTH bots connected, not just the default one.
- [ ] **Bindings correct:** Verify `openclaw agents list --bindings` shows every route. Test by sending a message to each channel and checking the gateway log for correct agent resolution.
- [ ] **Skills loaded:** Verify the PriceLabs agent can list its skills and they include the 4 PriceLabs skills (domain-knowledge, monitoring-protocols, analysis-playbook, optimization-playbook).
- [ ] **Auth working:** Verify the PriceLabs agent can complete an LLM call (not just tool registration). Send "hello" and get a response.
- [ ] **Cron jobs targeting correctly:** Verify `openclaw cron list` shows PriceLabs jobs with `agentId: "pricelabs"` AND correct delivery targets. Run each job once with `openclaw cron run <jobId>` and check output.
- [ ] **No cross-talk:** Send a PriceLabs question to the main agent's Telegram. It should NOT trigger PriceLabs tools. Send a general question to the PriceLabs bot. It should NOT use main agent context.
- [ ] **Workspace files injected:** Send the PriceLabs agent "what are your instructions?" and verify it references AGENTS.md content, not generic defaults.
- [ ] **Existing main agent unaffected:** After all changes, verify the main agent still responds on all its channels with its full tool set and personality.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Tools filtered by sandbox | LOW | Add `pricelabs_*` to `agents.list[].tools.sandbox.tools.allow`, restart gateway, re-test. Takes 2 minutes. |
| Main agent Telegram broken by config migration | MEDIUM | Revert `channels.telegram` to the pre-migration flat structure (keep a backup of `openclaw.json` before any changes). Restart gateway. Then retry the migration more carefully. |
| Cron jobs running under wrong agent | LOW | `openclaw cron edit <jobId> --agent pricelabs` for each job. No restart needed -- takes effect on next run. |
| Workspace files not injected | LOW | Check workspace path. Fix path in `agents.list[].workspace`. Restart gateway. |
| Auth profiles missing | LOW | Copy `auth-profiles.json` from main agent directory. Restart gateway. |
| Cross-talk between agents | MEDIUM | Review bindings order. Add explicit `accountId` to all bindings. Verify with `openclaw agents list --bindings`. Restart gateway. May need to clear stale session keys. |
| Plugin ID mismatch warning | LOW | Align `package.json` name with `openclaw.plugin.json` id (already done in v1.1 fix). Cosmetic only -- does not affect functionality. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Sandbox tool allow list (Pitfall 1) | Phase 1: Agent Creation | `openclaw sandbox explain --agent pricelabs` shows `pricelabs_*` |
| Plugin tool visibility (Pitfall 2) | Phase 1: Agent Creation | Agent responds to "show me my listings" with actual PriceLabs data |
| Telegram bot migration (Pitfall 3) | Phase 2: Channel Routing | `openclaw channels status --probe` shows both bots connected |
| Binding precedence (Pitfall 4) | Phase 2: Channel Routing | Routing test matrix: send to each channel, verify correct agent in logs |
| Cron job targeting (Pitfall 5) | Phase 3: Cron Jobs | `openclaw cron list` shows correct `agentId` + manual run produces correct output |
| Workspace brain files (Pitfall 6) | Phase 1: Agent Creation | Agent echoes AGENTS.md instructions when asked about its role |
| Auth profiles (Pitfall 7) | Phase 1: Agent Creation | Agent completes first LLM call successfully |
| Slack channel allowlist (Integration) | Phase 2: Channel Routing | Messages in `#pricelabs` Slack channel trigger agent response |
| Gateway restart after config changes | All phases | Always restart gateway after config changes. Never assume hot reload. |
| Cross-talk validation | Phase 4: End-to-End Validation | Full matrix test: each agent only responds to its own channels/bots |

## Sources

### OpenClaw Official Documentation (HIGH confidence)
- Multi-Agent Routing: `/home/NGA/openclaw/docs/concepts/multi-agent.md` -- agent isolation, bindings, routing precedence
- Agent Workspace: `/home/NGA/openclaw/docs/concepts/agent-workspace.md` -- file layout, bootstrap injection, token budget
- Multi-Agent Sandbox & Tools: `/home/NGA/openclaw/docs/tools/multi-agent-sandbox-tools.md` -- tool policy precedence, migration from single agent
- Cron Jobs: `/home/NGA/openclaw/docs/automation/cron-jobs.md` -- `agentId` binding, delivery targets, skip bug
- Plugins: `/home/NGA/openclaw/docs/tools/plugin.md` -- discovery, config validation, plugin ID resolution
- Skills: `/home/NGA/openclaw/docs/tools/skills.md` -- per-agent vs shared, precedence rules
- CLI Agents: `/home/NGA/openclaw/docs/cli/agents.md` -- add/set-identity commands
- System Prompt: `/home/NGA/openclaw/docs/concepts/system-prompt.md` -- bootstrap file injection, token limits

### Actual v1.1 Post-Mortems (HIGH confidence)
- Sandbox tool filtering root cause: `/mnt/c/Projects/pricelabs-agent/.planning/debug/openclaw-plugin-tools.md`
- Plugin ID mismatch fix: same file, package.json name alignment
- Known issues from PROJECT.md: sandbox allow glob, plugin ID mismatch, Telegram cron `--to` requirement, cron skip bug #17852

### Live Configuration Inspection (HIGH confidence)
- Current `openclaw.json`: `/home/NGA/.openclaw/openclaw.json` -- existing sandbox config, tool allow list, channel structure, plugin config
- Current `jobs.json`: `/home/NGA/.openclaw/cron/jobs.json` -- existing cron jobs, delivery failures (`"cron delivery target is missing"`)
- PriceLabs plugin: `/home/NGA/.openclaw/extensions/pricelabs/` -- index.ts, openclaw.plugin.json, tool-definitions.json

---
*Pitfalls research for: Adding dedicated PriceLabs agent to existing OpenClaw setup (v1.2)*
*Researched: 2026-02-26*
