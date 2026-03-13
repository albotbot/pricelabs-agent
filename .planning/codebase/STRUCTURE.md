# Codebase Structure

**Analysis Date:** 2026-03-12

## Directory Layout

```
pricelabs-agent/
├── .claude/                    # Claude Code settings
│   └── settings.json           # MCP server and permission config
├── .mcp.json                   # MCP server definitions for Claude Code
├── .planning/                  # GSD planning documents
│   └── codebase/               # Architecture/convention docs (this file)
├── agent/                      # Design documents and specs
│   ├── architecture.md         # Agent design, capabilities, data models
│   ├── api-client-spec.md      # API client specification
│   └── workflows.md            # Automated workflow definitions
├── mcp-servers/                # MCP server implementations
│   └── pricelabs/              # PriceLabs MCP server (core codebase)
│       ├── package.json        # Dependencies and scripts
│       ├── tsconfig.json       # TypeScript configuration
│       ├── dist/               # Compiled output (generated)
│       └── src/                # Source code
│           ├── index.ts        # Entry point -- wires everything
│           ├── types.ts        # Type exports (inferred from Zod)
│           ├── errors.ts       # Error classification hierarchy
│           ├── computed-fields.ts  # Derived metrics from API data
│           ├── schemas/        # Zod input/output schemas
│           ├── services/       # Infrastructure services
│           ├── tools/          # MCP tool registration handlers
│           └── db/             # Database layer
│               ├── migrations.ts   # Versioned schema migrations
│               └── queries/    # Prepared statement factories
├── openclaw/                   # OpenClaw Gateway configuration
│   ├── openclaw.json           # Gateway config (agents, channels, auth)
│   ├── cron/                   # Scheduled job definitions
│   │   └── jobs.json           # Daily/weekly cron jobs
│   ├── extensions/             # OpenClaw plugin definitions
│   │   └── pricelabs/          # PriceLabs MCP bridge plugin
│   ├── skills/                 # Agent skill files (shared)
│   └── workspace-pricelabs/    # Agent workspace (persona, memory)
│       ├── IDENTITY.md         # Name, role, emoji
│       ├── SOUL.md             # Persona and communication style
│       ├── USER.md             # Team info and portfolio context
│       ├── AGENTS.md           # Operating instructions and safety
│       ├── BOOT.md             # Startup sequence
│       ├── TOOLS.md            # Tool catalog summary
│       ├── HEARTBEAT.md        # Heartbeat config (empty -- cron handles)
│       ├── MEMORY.md           # Persistent portfolio memory
│       └── skills/             # Workspace-scoped skill copies
├── research/                   # PriceLabs platform research
│   ├── 01-platform-overview.md
│   ├── 02-api-reference.md
│   ├── 03-optimization-playbook.md
│   ├── 04-integrations-ecosystem.md
│   ├── 05-algorithm-and-settings.md
│   ├── 06-competitor-analysis.md
│   ├── 07-common-mistakes.md
│   └── 08-social-media-research.md
├── scripts/                    # Validation and setup scripts
│   ├── validate-boot.sh        # Boot sequence validation
│   ├── validate-api.sh         # API connectivity validation
│   ├── validate-persistence.sh # Database persistence validation
│   ├── validate-deployment.sh  # Deployment validation
│   ├── validate-messaging.sh   # Messaging channel validation
│   ├── install-openclaw-plugin.sh  # Plugin installation
│   └── *.mjs                   # Node.js validation scripts
├── secrets/                    # Secrets directory (DO NOT READ)
├── skills/                     # Claude Code skill files
│   ├── pricelabs-domain/       # Domain knowledge skill
│   ├── pricelabs-monitoring/   # Monitoring protocols skill
│   ├── pricelabs-analysis/     # Analysis playbook skill
│   └── pricelabs-optimization/ # Optimization playbook skill
├── config                      # Git config (bare repo artifact)
├── Dockerfile                  # Container build definition
├── HEAD                        # Git HEAD reference
└── README.md                   # Project overview
```

## Directory Purposes

**`mcp-servers/pricelabs/src/`:**
- Purpose: The core MCP server -- all runtime code lives here
- Contains: TypeScript source files organized by concern
- Key files: `index.ts` (entry point), `types.ts` (type exports), `errors.ts` (error hierarchy), `computed-fields.ts` (derived metrics)

**`mcp-servers/pricelabs/src/tools/`:**
- Purpose: MCP tool handler implementations -- one file per domain area
- Contains: Tool registration functions that accept server + dependencies
- Key files: `listings.ts` (3 tools), `overrides.ts` (3 tools), `prices.ts` (1 tool), `snapshots.ts` (5 tools), `monitoring.ts` (1 tool), `audit.ts` (2 tools), `analysis.ts` (2 tools), `optimization.ts` (1 tool), `scale.ts` (4 tools), `neighborhood.ts` (1 tool), `reservations.ts` (1 tool), `sync.ts` (2 tools), `rate-plans.ts` (1 tool), `status.ts` (1 tool)

**`mcp-servers/pricelabs/src/schemas/`:**
- Purpose: Zod schemas for tool input validation and API response typing
- Contains: Schema definitions grouped by domain area
- Key files: `common.ts` (shared primitives, response schemas), `listings.ts`, `prices.ts`, `overrides.ts`, `neighborhoods.ts`, `reservations.ts`, `snapshots.ts`, `monitoring.ts`, `analysis.ts`, `optimization.ts`, `scale.ts`

**`mcp-servers/pricelabs/src/services/`:**
- Purpose: Infrastructure services shared across all tools
- Contains: API client, cache, rate limiter, fetch-with-fallback, database initialization
- Key files: `api-client.ts` (HTTP client with retry), `cache.ts` (TTL cache), `rate-limiter.ts` (token bucket), `fetch-with-fallback.ts` (cache-first resilience), `database.ts` (SQLite factory)

**`mcp-servers/pricelabs/src/db/`:**
- Purpose: Database schema and query layer
- Contains: Migration definitions and prepared statement factories
- Key files: `migrations.ts` (7 versioned migrations), `queries/listing-snapshots.ts`, `queries/price-snapshots.ts`, `queries/reservations.ts`, `queries/audit-log.ts`, `queries/market-snapshots.ts`, `queries/analysis.ts`, `queries/change-tracking.ts`, `queries/user-config.ts`

**`openclaw/`:**
- Purpose: OpenClaw Gateway configuration -- defines the AI agent, its channels, cron jobs, and persona
- Contains: JSON config files and markdown skill/persona files
- Key files: `openclaw.json` (gateway config), `cron/jobs.json` (scheduled tasks), `workspace-pricelabs/SOUL.md` (persona)

**`research/`:**
- Purpose: PriceLabs platform research documents that informed the agent design
- Contains: 8 research documents covering platform, API, optimization, integrations, algorithm, competitors, mistakes, and social media
- Generated: No, manually authored
- Committed: Yes

**`scripts/`:**
- Purpose: Validation scripts for verifying deployment, API connectivity, persistence, and messaging
- Contains: Shell scripts (.sh) paired with Node.js implementations (.mjs)

**`skills/`:**
- Purpose: Claude Code skill files that define agent operational protocols
- Contains: Markdown skill files in subdirectories, one per skill area

**`agent/`:**
- Purpose: Design documents that describe the agent's intended architecture and workflows
- Contains: Markdown files with architecture, API client spec, and workflow definitions

## Key File Locations

**Entry Points:**
- `mcp-servers/pricelabs/src/index.ts`: MCP server entry -- validates env, initializes services, registers tools, connects transport
- `openclaw/openclaw.json`: OpenClaw Gateway configuration -- agent definition, MCP server config, channel bindings
- `openclaw/cron/jobs.json`: Cron job definitions -- daily health checks and weekly reports

**Configuration:**
- `mcp-servers/pricelabs/package.json`: NPM dependencies and scripts
- `mcp-servers/pricelabs/tsconfig.json`: TypeScript compiler options (ES2022, NodeNext, strict)
- `openclaw/extensions/pricelabs/openclaw.plugin.json`: OpenClaw plugin schema for MCP bridge
- `openclaw/extensions/pricelabs/package.json`: Plugin package metadata

**Core Logic:**
- `mcp-servers/pricelabs/src/services/fetch-with-fallback.ts`: Cache-first fetch with graceful degradation
- `mcp-servers/pricelabs/src/services/api-client.ts`: HTTP client with rate limiting and exponential backoff retry
- `mcp-servers/pricelabs/src/computed-fields.ts`: Derived metrics (occupancy gap, revenue vs STLY, demand level, health trend)
- `mcp-servers/pricelabs/src/errors.ts`: Error classification (RateLimitError, AuthError, ApiError)
- `mcp-servers/pricelabs/src/db/migrations.ts`: 7 versioned SQLite schema migrations

**Tool Implementations:**
- `mcp-servers/pricelabs/src/tools/listings.ts`: Core listing CRUD (get_listings, get_listing, update_listings)
- `mcp-servers/pricelabs/src/tools/overrides.ts`: DSO lifecycle (get/set/delete overrides) -- highest risk write operations
- `mcp-servers/pricelabs/src/tools/snapshots.ts`: Persistence tools (store/get daily, price, market snapshots and reservations)
- `mcp-servers/pricelabs/src/tools/analysis.ts`: Portfolio KPIs and underperformer detection
- `mcp-servers/pricelabs/src/tools/scale.ts`: Change tracking and user config management

**Agent Persona & Skills:**
- `openclaw/workspace-pricelabs/SOUL.md`: Agent personality and communication style
- `openclaw/workspace-pricelabs/AGENTS.md`: Operating instructions, safety rules, approval workflow
- `openclaw/skills/domain-knowledge.md`: PriceLabs domain expertise (optimization strategies, algorithm internals)
- `openclaw/skills/monitoring-protocols.md`: Daily health check protocol
- `openclaw/skills/analysis-playbook.md`: Weekly optimization report protocol
- `openclaw/skills/optimization-playbook.md`: Pricing optimization and orphan detection protocols

**Testing:**
- No test files detected in the codebase. Validation scripts in `scripts/` serve as integration/smoke tests.

## Naming Conventions

**Files:**
- `kebab-case.ts`: All TypeScript source files (`api-client.ts`, `fetch-with-fallback.ts`, `listing-snapshots.ts`)
- `UPPERCASE.md`: Workspace files (`SOUL.md`, `AGENTS.md`, `BOOT.md`, `MEMORY.md`)
- `kebab-case.md`: Research and skill files (`domain-knowledge.md`, `monitoring-protocols.md`)
- `kebab-case.mjs`: Node.js validation scripts (`validate-boot.mjs`, `validate-api.mjs`)
- `kebab-case.sh`: Shell validation scripts (`validate-boot.sh`, `validate-api.sh`)
- `kebab-case.json`: Configuration files (`openclaw.json`, `jobs.json`, `package.json`)

**Directories:**
- `kebab-case/`: All directories (`mcp-servers/`, `workspace-pricelabs/`, `rate-plans/`)
- Exception: `db/` is abbreviated

**Exports:**
- `PascalCase` for classes: `PriceLabsApiClient`, `TtlCache`, `TokenBucketRateLimiter`, `RateLimitError`
- `camelCase` for functions: `registerListingTools`, `computeListingFields`, `fetchWithFallback`, `initializeDatabase`, `runMigrations`
- `camelCase` for factory functions: `createListingSnapshotQueries`, `createAuditLogQueries`
- `PascalCase` with `Schema` suffix for Zod schemas: `GetListingsInputSchema`, `ListingResponseSchema`
- `PascalCase` with `Row` or `Params` suffix for interfaces: `ListingSnapshotRow`, `InsertAuditLogParams`
- `SCREAMING_SNAKE_CASE` for constants: `LISTING_CACHE_TTL_MS`, `RETRY_CONFIG`, `DEMAND_COLOR_MAP`

**Tool Names:**
- `pricelabs_` prefix with `snake_case`: `pricelabs_get_listings`, `pricelabs_set_overrides`, `pricelabs_store_daily_snapshots`

## Where to Add New Code

**New MCP Tool:**
- Create tool handler: `mcp-servers/pricelabs/src/tools/{domain}.ts`
- Create input schema: `mcp-servers/pricelabs/src/schemas/{domain}.ts`
- If tool needs DB: create query factory in `mcp-servers/pricelabs/src/db/queries/{table-name}.ts`
- If tool needs new table: add migration to `mcp-servers/pricelabs/src/db/migrations.ts` (increment version)
- Wire registration: add import + `registerXxxTools(server, ...)` call in `mcp-servers/pricelabs/src/index.ts`
- Update tool catalog: add entry to `openclaw/workspace-pricelabs/TOOLS.md`
- Follow patterns: use `server.registerTool()` with annotations, wrap handler in try/catch, return `{ content: [{ type: "text", text: JSON.stringify(...) }] }`

**New Computed Field:**
- Add computation function to `mcp-servers/pricelabs/src/computed-fields.ts`
- Follow pattern: accept raw API type, return `Record<string, unknown>`, never throw on bad input, return null for missing data
- Wire into relevant tool's `computeFields` callback in `fetchWithFallback()` call

**New Service:**
- Create service class/module in `mcp-servers/pricelabs/src/services/`
- Follow pattern: constructor takes dependencies, no global state (except `fetchWithFallback`'s outage tracker)
- Instantiate in `mcp-servers/pricelabs/src/index.ts` and pass to tool registration functions

**New DB Table:**
- Add migration to `mcp-servers/pricelabs/src/db/migrations.ts` with next version number
- Create query factory in `mcp-servers/pricelabs/src/db/queries/{table-name}.ts`
- Follow pattern: `createXxxQueries(db)` returns object of prepared statements with typed params/rows
- Add index creation in the migration for any frequently queried columns

**New Agent Skill:**
- Create skill file: `openclaw/skills/{skill-name}.md` with YAML frontmatter (`name`, `description`, `user-invocable`, `metadata`)
- Create workspace copy: `openclaw/workspace-pricelabs/skills/{skill-name}/SKILL.md`
- Add to agent instructions list in `openclaw/openclaw.json` under `agents.list[0].instructions`
- Reference in `openclaw/workspace-pricelabs/AGENTS.md` skills section

**New Cron Job:**
- Add job object to `openclaw/cron/jobs.json` array
- Follow pattern: include `name`, `agentId`, `schedule` (cron expr + timezone), `payload` (message + model), `delivery` (channel + target)

**New Validation Script:**
- Create shell script: `scripts/validate-{name}.sh`
- Create Node.js implementation: `scripts/validate-{name}.mjs`

## Special Directories

**`mcp-servers/pricelabs/dist/`:**
- Purpose: Compiled JavaScript output from TypeScript
- Generated: Yes (by `tsc` via `npm run build`)
- Committed: Yes (OpenClaw spawns `node dist/index.js` directly)

**`mcp-servers/pricelabs/node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (by `npm install`)
- Committed: Appears to be committed (present in repo)

**`secrets/`:**
- Purpose: Secret files (API keys, tokens)
- Generated: No, manually managed
- Committed: Should NOT be committed (existence noted only)

**`openclaw/workspace-pricelabs/`:**
- Purpose: Agent workspace defining persona, memory, and operating instructions
- Generated: No, manually authored
- Committed: Yes

**`research/`:**
- Purpose: Platform research that informed agent design
- Generated: No, manually authored during research phase
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: Yes, by GSD commands
- Committed: Yes

---

*Structure analysis: 2026-03-12*
