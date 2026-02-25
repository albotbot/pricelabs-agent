# Phase 6: Server Boot + Safety Gate - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the MCP server building, booting, creating SQLite database with all 7 tables, registering all 28 tools, and confirming write operations are disabled by default. This is local validation only -- deployment to OpenClaw is Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Write disable mechanism
- Environment variable `PRICELABS_WRITES_ENABLED=false` by default
- When a write tool is called while disabled, return a clear error: "Write operations are disabled. Set PRICELABS_WRITES_ENABLED=true to enable."
- Agent skill instructions must include: "Do not enable writes unless the user explicitly tells you to"
- Dual safety layer: env var gate (hard block) + skill-level instruction (agent behavior)

### Validation method
- MCP Inspector (`npx @modelcontextprotocol/inspector`) for systematic Phase 6 boot validation
- Claude Code integration (`.mcp.json` config) added alongside for live testing in later phases
- Both approaches: Inspector first for structured tool-by-tool validation, then Claude Code for conversational testing

### Error messaging
- Write tools (set_overrides, update_listings, delete_overrides) remain registered and visible in tools/list
- Calling them returns an error with instructions on how to enable, but the agent is instructed not to act on those instructions without explicit user permission
- This gives visibility into the full tool set while preventing accidental writes

### Claude's Discretion
- Database file location and path configuration approach
- Exact error message wording for write-disabled state
- Whether to add a `pricelabs_status` enhancement showing write-enabled state
- Build script and startup validation details

</decisions>

<specifics>
## Specific Ideas

- User wants writes completely off during the learning/validation period -- this is about trust building before allowing pricing changes
- The safety gate is a user-controlled switch, not an automatic feature flag
- Agent should be aware writes are disabled and communicate that to the user transparently

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 06-server-boot-safety-gate*
*Context gathered: 2026-02-25*
