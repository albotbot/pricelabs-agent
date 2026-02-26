---
status: verifying
trigger: "OpenClaw plugin registers 28 PriceLabs MCP tools but the agent doesn't use them when chatting in Slack/Telegram"
created: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:03:00Z
---

## Current Focus

hypothesis: CONFIRMED - Sandbox mode "all" applies DEFAULT_TOOL_ALLOW which only includes core tools; plugin tools filtered out
test: Both fixes applied, need gateway restart to verify
expecting: After restart, agent sessions will include pricelabs_* tools and respond to portfolio questions with real data
next_action: Return CHECKPOINT for user to restart gateway and test

## Symptoms

expected: When user asks "How is my portfolio doing?" in Slack/Telegram, the OpenClaw agent should call pricelabs_get_listings and return real PriceLabs data
actual: Agent responds as generic AI -- interprets "portfolio" as stock investments, no tool calls, says it doesn't have pricing data
errors: Gateway log warning: "plugin pricelabs: plugin id mismatch (manifest uses pricelabs, entry hints pricelabs-mcp-bridge)" -- but log also shows "Registering 28 tools from MCP server definitions" and "MCP bridge service started (lazy init)"
reproduction: Ask "How is my portfolio doing?" in Slack or Telegram
started: Plugin just created and installed. Never worked.

## Eliminated

- hypothesis: Plugin ID mismatch causes tools to register under wrong namespace
  evidence: manifest-registry.ts line 114 uses manifest.id ("pricelabs") which wins over idHint ("pricelabs-mcp-bridge"). Plugin loads correctly as id "pricelabs". Warning is cosmetic only.
  timestamp: 2026-02-26T00:00:30Z

- hypothesis: Plugin fails to load or tools fail to register
  evidence: Gateway logs confirm "Registering 28 tools from MCP server definitions" and "MCP bridge service started (lazy init)". Plugin register() runs successfully.
  timestamp: 2026-02-26T00:00:35Z

- hypothesis: Tool policy (allow/deny lists) blocks plugin tools
  evidence: tools.deny is empty [], no tools.allow is set, no per-agent tools config exists. Global tool policy is effectively undefined (no filtering).
  timestamp: 2026-02-26T00:00:40Z

- hypothesis: Plugin config validation fails silently
  evidence: configSchema allows all provided fields, no required fields missing. Plugin is enabled with entry config matching schema.
  timestamp: 2026-02-26T00:00:42Z

## Evidence

- timestamp: 2026-02-26T00:00:30Z
  checked: Plugin discovery and ID resolution flow
  found: discovery.ts derives idHint from package.json name ("pricelabs-mcp-bridge"). manifest-registry.ts uses manifest.id ("pricelabs") as authoritative ID. Mismatch warning is diagnostic only.
  implication: Plugin loads under correct id "pricelabs" matching config entry

- timestamp: 2026-02-26T00:00:35Z
  checked: Plugin registration flow in registry.ts
  found: registerTool wraps tool object in factory, stores in registry.tools with pluginId "pricelabs" and optional=false
  implication: Tools are registered correctly in plugin registry

- timestamp: 2026-02-26T00:00:40Z
  checked: Tool pipeline from resolvePluginTools through applyToolPolicyPipeline
  found: Plugin tools with optional=false pass through resolvePluginTools without allowlist filtering. They enter the main tools array.
  implication: Tools make it into the combined tool list

- timestamp: 2026-02-26T00:00:45Z
  checked: Sandbox tool policy (sandbox/constants.ts, sandbox/tool-policy.ts, sandbox/config.ts)
  found: DEFAULT_TOOL_ALLOW = ["exec","process","read","write","edit","apply_patch","image","sessions_list","sessions_history","sessions_send","sessions_spawn","subagents","session_status"]. When sandbox mode="all", this allowlist is applied. Plugin tools (pricelabs_*) are NOT in this list.
  implication: ROOT CAUSE - sandbox default allowlist blocks all plugin tools

- timestamp: 2026-02-26T00:00:48Z
  checked: applyToolPolicyPipeline in tool-policy-pipeline.ts
  found: sandbox?.tools is passed as a pipeline step. filterToolsByPolicy uses makeToolPolicyMatcher which returns false for any tool not in allow list when allow list is non-empty.
  implication: All 28 pricelabs tools are filtered out before reaching the LLM

- timestamp: 2026-02-26T00:00:50Z
  checked: package.json name vs manifest id
  found: package.json name "pricelabs-mcp-bridge" does not match manifest id "pricelabs". This causes warning log on every gateway start. Should be aligned.
  implication: Secondary issue - cosmetic warning can be eliminated by renaming package.json name

- timestamp: 2026-02-26T00:02:00Z
  checked: Fix 1 applied - sandbox tool allow list
  found: Added tools.sandbox.tools.allow to openclaw.json with all 13 DEFAULT_TOOL_ALLOW entries plus "pricelabs_*" glob. resolveSandboxToolPolicyForAgent() reads cfg.tools.sandbox.tools.allow and will use this explicit list instead of DEFAULT_TOOL_ALLOW.
  implication: pricelabs_* tools will now pass through sandbox tool policy filtering

- timestamp: 2026-02-26T00:03:00Z
  checked: Fix 2 applied - package.json name alignment
  found: Changed package.json name from "pricelabs-mcp-bridge" to "pricelabs". Now matches manifest id "pricelabs". discovery.ts deriveIdHint() will produce "pricelabs" matching manifest-registry.ts comparison.
  implication: ID mismatch warning on gateway startup will be eliminated

## Resolution

root_cause: Sandbox mode "all" in agents.defaults.sandbox applies DEFAULT_TOOL_ALLOW (only core tools) as an explicit allowlist. Plugin tools like pricelabs_* are not in this list and get filtered out by filterToolsByPolicy() in the tool policy pipeline. The tools register correctly but never reach the LLM.
fix: (1) Added "pricelabs_*" to tools.sandbox.tools.allow in openclaw.json so sandbox policy permits all pricelabs tools. (2) Changed package.json name from "pricelabs-mcp-bridge" to "pricelabs" to eliminate ID mismatch warning on startup.
verification: Pending gateway restart and live test
files_changed:
  - /home/NGA/.openclaw/openclaw.json: Added tools.sandbox.tools.allow with all default sandbox tools + "pricelabs_*"
  - /home/NGA/.openclaw/extensions/pricelabs/package.json: Changed name from "pricelabs-mcp-bridge" to "pricelabs"
