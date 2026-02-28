# Phase 12: Agent Registration - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Register the Prism agent in openclaw.json with per-agent sandbox, tool access, auth profiles, and workspace path. Verify it can authenticate for LLM calls, see all 28 PriceLabs tools, and respond with the Prism persona via CLI. Channel routing is a separate phase (13).

</domain>

<decisions>
## Implementation Decisions

### Tool Access Scope
- PriceLabs tools ONLY -- only `pricelabs_*` tools in the allow list
- Deny `exec` tool -- Prism cannot run shell commands. Tightest sandbox.
- Workspace access: read-write (`workspaceAccess: "rw"`) so Prism can update MEMORY.md with operational observations
- Filesystem scope: Claude's discretion on appropriate directory restrictions

### Model Selection
- Same model as main agent (currently gpt-5.3-codex) for all interactions
- Same model for cron jobs -- no per-mode model differentiation in v1.2
- Keep it simple: one model for everything

### Verification Testing
- Two-step sequential verification via CLI (`openclaw agent --agent pricelabs --message "..."`)
  1. First: "Hello, who are you?" -- verify Prism persona (NOT Albot's casual tone)
  2. Then: "Show me my listings" -- verify PriceLabs tool access returns real data
- Persona check: both tone AND specifics
  - Should NOT be casual, humorous, or use Albot personality
  - SHOULD use Prism intro text, sign with "◆ Prism", reference "your portfolio"
- Data check: verify specific content -- known listing names/locations (TN/NH markets) must appear
- Tool count: explicitly verify all 28 tools visible via `openclaw sandbox explain --agent pricelabs`

### Rollback Safety
- Back up openclaw.json before making changes (`cp openclaw.json openclaw.json.bak`)
- Test gateway restart after each config change
- If gateway fails to start, restore backup immediately
- NEVER run `openclaw doctor --fix` or `openclaw doctor --force --yes` -- it can strip config (lesson from Feb 27 recovery)
- Only ONE gateway service: system-level (`/etc/systemd/system/openclaw-gateway.service`). NEVER enable user-level service -- causes duplicate processes and Telegram 409 conflicts
- Gateway restart command: `sudo systemctl restart openclaw-gateway.service` (system-level, NOT `systemctl --user`)
- After restart, wait ~30 seconds for Telegram rate limit cooldown if gateway was crash-looping
- gateway.mode MUST be "local" and gateway.tailscale.mode MUST be "off" (WSL2 constraints)

### Post-Recovery State (Feb 27, 2026)
The live openclaw.json was fully rebuilt after a cascade failure. Current state:
- 11 agents: main/AlBot (default), nextgen, singleseed, 8 NGA workshop agents
- AlBot has subagent access to all other agents
- Telegram and Slack channels restored and working
- System-level systemd service only (user-level disabled)
- WSL2 keepalive script active to prevent VM idle shutdown
- Pricelabs plugin installed at ~/.openclaw/extensions/pricelabs/

### Claude's Discretion
- Exact filesystem access scope (workspace-only vs broader read access)
- Whether to test the gateway restart between auth profile copy and first message
- Order of config changes within openclaw.json (agent entry, then sandbox, then tools)

</decisions>

<specifics>
## Specific Ideas

- The `agentDir` not `agentsDir` typo crashed the gateway 39 times -- use exact verified key name from docs
- Auth profiles must be copied IMMEDIATELY after creating the agent directory -- agent can't make LLM calls without them
- Sandbox tool allow list does NOT inherit from global -- must explicitly set `pricelabs_*` in per-agent config (repeat of v1.1 root-cause bug)
- Research documented exact openclaw.json config patterns in STACK.md and ARCHITECTURE.md
- CRITICAL: The live config was REBUILT on Feb 27 after a cascade failure. The current config is fragile -- treat every edit as high-risk. MERGE only, never replace. Always back up first.
- Restart with `sudo systemctl restart openclaw-gateway.service` (system-level only)
- If Telegram shows 429 rate limit after restart, WAIT for the retry-after countdown to expire (up to ~10 min)

</specifics>

<deferred>
## Deferred Ideas

- Per-agent model selection for cron vs interactive -- revisit after seeing usage patterns
- Broader tool access (web search, exec) -- only if a clear need emerges
- Knowledge stack integration for MEMORY.md writes -- v2+ milestone

</deferred>

---

*Phase: 12-agent-registration*
*Context gathered: 2026-02-27*
