# Phase 9: OpenClaw Deployment - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the complete PriceLabs agent inside OpenClaw's Docker sandbox. MCP server runs in a container with environment variables, all 4 skill files are loaded and referenced by the agent, and cron jobs for daily health checks and weekly optimization are configured and validated. Does NOT include messaging integration (Phase 10) or enabling write operations.

</domain>

<decisions>
## Implementation Decisions

### OpenClaw access & local validation
- Validate deployment readiness locally with Docker -- create a Dockerfile that mimics OpenClaw's sandbox environment
- Docker image: Node.js base, SQLite installed, read-only workspace mount, MCP server built and runnable
- Prove MCP server starts in container, responds to tool calls, environment variables are injected correctly
- Actual OpenClaw cloud deployment is a human checkpoint -- user deploys when they have platform access
- This gives 100% confidence the agent works in a containerized environment before touching OpenClaw

### Skill file creation
- Create 4 standalone skill files in `openclaw/skills/` as markdown instruction documents:
  1. `domain-knowledge.md` -- PriceLabs concepts, terminology, portfolio management context, API capabilities
  2. `monitoring-protocols.md` -- Daily health check workflow, alert thresholds, stale sync detection, cancellation handling
  3. `analysis-playbook.md` -- KPI calculations, week-over-week comparisons, STLY analysis, underperformance detection
  4. `optimization-playbook.md` -- Orphan day detection, demand spike handling, base price calibration, recommendation prioritization
- Content sources: `agent/workflows.md`, `research/03-optimization-playbook.md`, cron job messages in `openclaw/cron/jobs.json`
- Add `skills` or `instructions` section to `openclaw.json` referencing these files
- Skills should be self-contained -- agent should be able to follow protocols without additional context

### Cron schedule configuration
- Keep existing defaults -- well-chosen for revenue management:
  - Daily health check: 8am CT (America/Chicago) every day
  - Weekly optimization: Monday 10am CT
  - 30-second stagger between Slack and Telegram deliveries (prevents duplicate API load)
- Cron jobs already defined in `openclaw/cron/jobs.json` -- validate they parse correctly and reference the right agent
- No changes needed to schedule timing

### Validation strategy
- Automated Docker validation script (`validate-deployment.mjs`) following established pattern from Phases 6-8
- Tests to run:
  - Docker image builds successfully from Dockerfile
  - Container starts and MCP server process is running
  - MCP server responds to tool/list request inside container
  - Environment variables (PRICELABS_API_KEY, PRICELABS_DB_PATH) are injected and accessible
  - All 4 skill files exist and are non-empty
  - Skill files are referenced in openclaw.json configuration
  - Cron job configs parse as valid JSON with required fields
  - Cron expressions are valid (schedule.expr)
- Human checkpoint: User confirms deployment to actual OpenClaw platform
- Same PASS/FAIL summary format as previous phases

### Claude's Discretion
- Dockerfile base image and build optimization (multi-stage, layer caching)
- Exact skill file content organization and section headings
- Docker validation approach (direct container exec vs docker-compose)
- Whether to create a docker-compose.yml for local development convenience
- Level of detail in validation script diagnostics

</decisions>

<specifics>
## Specific Ideas

- Follow the exact same validation script pattern as Phases 6-8 -- user is comfortable with `bash scripts/validate-deployment.sh` workflow
- Skills should contain the actual protocols and workflows the agent follows, not just descriptions -- the cron job messages already reference specific protocol names
- The existing `openclaw/openclaw.json` is well-structured -- extend it, don't rewrite it
- Docker validation should work without PRICELABS_API_KEY (test infrastructure, not API connectivity)

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 09-openclaw-deployment*
*Context gathered: 2026-02-26*
