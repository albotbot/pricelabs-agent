# Technology Stack

**Analysis Date:** 2026-03-12

## Languages

**Primary:**
- TypeScript 5.7+ - All MCP server source code (`mcp-servers/pricelabs/src/**/*.ts`), OpenClaw plugin (`openclaw/extensions/pricelabs/index.ts`), and validation scripts (`scripts/*.mjs`)

**Secondary:**
- JavaScript (ESM) - Validation/test scripts (`scripts/validate-boot.mjs`, `scripts/validate-api.mjs`, `scripts/validate-persistence.mjs`, `scripts/validate-deployment.mjs`, `scripts/validate-messaging.mjs`, `scripts/swagger-coverage.mjs`)
- Bash - Shell wrapper scripts (`scripts/*.sh`), install script (`scripts/install-openclaw-plugin.sh`)
- Markdown - Agent skills, research docs, planning docs (`openclaw/skills/*.md`, `research/*.md`, `agent/*.md`)
- JSON - Configuration files, tool definitions (`openclaw/openclaw.json`, `openclaw/cron/jobs.json`, `openclaw/extensions/pricelabs/tool-definitions.json`)

## Runtime

**Environment:**
- Node.js 20 (specified in `Dockerfile` via `node:20-slim`)
- ES2022 target with NodeNext module resolution (top-level await enabled)
- ESM modules (`"type": "module"` in `mcp-servers/pricelabs/package.json`)

**Package Manager:**
- npm
- Lockfile: `mcp-servers/pricelabs/package-lock.json` (present, lockfileVersion 3)

## Frameworks

**Core:**
- `@modelcontextprotocol/sdk` ^1.26.0 - MCP server framework (stdio JSON-RPC transport)
- No HTTP framework for the server itself (MCP uses stdio, not HTTP)

**Validation:**
- `zod` ^3.25.0 - Schema validation for all tool inputs and API response types

**Database:**
- `better-sqlite3` ^12.6.2 - Embedded SQLite database with native bindings

**Build/Dev:**
- `typescript` ^5.7.0 - TypeScript compiler (`tsc`)
- No bundler (raw `tsc` output to `dist/`)
- No linter configured (no eslint, prettier, or biome config files)
- No test framework configured (no jest, vitest, or mocha)

## Key Dependencies

**Critical (production):**
- `@modelcontextprotocol/sdk` ^1.26.0 - Entire MCP server protocol implementation; defines `McpServer`, `StdioServerTransport`, tool registration API
- `better-sqlite3` ^12.6.2 - Persistent storage for snapshots, reservations, audit log, change tracking, user config; requires native compilation and SQLite runtime library
- `zod` ^3.25.0 - All input validation schemas; types are inferred from Zod schemas (no manual type duplication)

**Dev Dependencies:**
- `@types/better-sqlite3` ^7.6.13 - TypeScript type definitions for better-sqlite3
- `@types/node` ^22.0.0 - Node.js type definitions (Node 22 types, covers `fetch` global)
- `typescript` ^5.7.0 - TypeScript compiler

**Transitive (notable in node_modules, used by OpenClaw plugin bridge):**
- `express` - Used by `@modelcontextprotocol/sdk` for SSE transport (not used directly)
- `hono` - Used by `@modelcontextprotocol/sdk` for StreamableHTTP transport (not used directly)
- `cors`, `express-rate-limit` - Transitive from MCP SDK

## Configuration

**Environment Variables:**
- `PRICELABS_API_KEY` (required) - PriceLabs Customer API key, passed via `X-API-Key` header
- `PRICELABS_BASE_URL` (optional, default: `https://api.pricelabs.co`) - API base URL
- `PRICELABS_DB_PATH` (optional, default: `~/.pricelabs-agent/data.sqlite`) - SQLite database file path
- `PRICELABS_WRITES_ENABLED` (optional, default: `"false"`) - Safety gate for destructive API operations
- `.env` file exists at project root (NOT to be read; contains secrets)
- `openclaw/env.example` documents all required env vars for OpenClaw deployment

**OpenClaw Gateway Config:**
- `openclaw/openclaw.json` - Full gateway config (agent definition, MCP server config, channel config, logging)
- Environment variable references (`${VAR}`) resolved from `~/.openclaw/.env`
- Additional secrets: `OPENCLAW_GATEWAY_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`

**Build:**
- `mcp-servers/pricelabs/tsconfig.json` - TypeScript config
  - Target: ES2022
  - Module: NodeNext
  - Module resolution: NodeNext
  - Strict mode: enabled
  - Source: `./src` -> Output: `./dist`

**No additional config files:** No `.nvmrc`, `.node-version`, `.prettierrc`, `.eslintrc`, `biome.json`, or `jest.config.*`

## Build & Run Commands

**Build:**
```bash
cd mcp-servers/pricelabs && npm run build    # Runs tsc
```

**Start:**
```bash
cd mcp-servers/pricelabs && npm start        # Runs node dist/index.js
```

**Dev (watch mode):**
```bash
cd mcp-servers/pricelabs && npm run dev      # Runs tsc --watch
```

**Docker:**
```bash
docker build -t pricelabs-agent .
docker run --rm -i -e PRICELABS_API_KEY=your-key pricelabs-agent
```

**Validation scripts (not unit tests -- integration/E2E validation):**
```bash
node scripts/validate-boot.mjs          # Boot validation
node scripts/validate-api.mjs           # API tool validation
node scripts/validate-persistence.mjs   # SQLite persistence validation
node scripts/validate-deployment.mjs    # Deployment validation
node scripts/validate-messaging.mjs     # Messaging channel validation
```

## Platform Requirements

**Development:**
- Node.js 20+ (for top-level await, global `fetch`, ESM)
- npm (for dependency management)
- C/C++ build tools (for `better-sqlite3` native compilation via `node-gyp`)
- Windows, Linux, or macOS (cross-platform via Node.js)

**Production (Docker):**
- `node:20-slim` base image
- `sqlite3` system package (for `better-sqlite3` native module)
- No HTTP port exposed (MCP server uses stdio JSON-RPC, spawned as child process)
- Persistent volume at `/data/` for SQLite database
- All secrets injected at runtime via `docker run -e`

**AI Model:**
- Claude claude-opus-4-6 (`anthropic/claude-opus-4-6` specified in `openclaw/openclaw.json`)
- Agent orchestrated by OpenClaw Gateway

---

*Stack analysis: 2026-03-12*
