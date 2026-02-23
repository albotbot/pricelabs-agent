/**
 * PriceLabs MCP Server entry point.
 *
 * Wires all 21 tools (11 registration functions) to a single MCP server
 * connected via stdio transport. Initializes SQLite database with WAL mode
 * and runs migrations on startup. Validates environment on startup and
 * exits with actionable error if PRICELABS_API_KEY is missing.
 *
 * Uses top-level await (ES2022 + NodeNext). All imports use .js extensions
 * for ESM compatibility.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TokenBucketRateLimiter } from "./services/rate-limiter.js";
import { TtlCache } from "./services/cache.js";
import { PriceLabsApiClient } from "./services/api-client.js";

import { registerListingTools } from "./tools/listings.js";
import { registerPriceTools } from "./tools/prices.js";
import { registerOverrideTools } from "./tools/overrides.js";
import { registerNeighborhoodTools } from "./tools/neighborhood.js";
import { registerReservationTools } from "./tools/reservations.js";
import { registerSyncTools } from "./tools/sync.js";
import { registerRatePlanTools } from "./tools/rate-plans.js";
import { registerStatusTools } from "./tools/status.js";

import { initializeDatabase } from "./services/database.js";
import { runMigrations } from "./db/migrations.js";
import { registerSnapshotTools } from "./tools/snapshots.js";
import { registerMonitoringTools } from "./tools/monitoring.js";
import { registerAuditTools } from "./tools/audit.js";

// --- Environment validation ---
// Exit immediately with actionable error if API key is missing.
// NEVER log the actual key value (INFRA-04: credential isolation).

const apiKey = process.env.PRICELABS_API_KEY;
if (!apiKey) {
  console.error(
    "FATAL: PRICELABS_API_KEY environment variable is required. " +
      "Set it in openclaw.json -> agents.list[].mcp.servers[].env",
  );
  process.exit(1);
}

// --- Service initialization ---

const baseUrl =
  process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co";
const rateLimiter = new TokenBucketRateLimiter(1000, 3_600_000);
const cache = new TtlCache();
const apiClient = new PriceLabsApiClient(apiKey, rateLimiter, baseUrl);

// --- Database initialization ---
// Create SQLite database with WAL mode, run pending migrations.
// Path from env or default to ~/.pricelabs-agent/data.sqlite
const db = initializeDatabase(process.env.PRICELABS_DB_PATH);
runMigrations(db);

// --- Server creation ---

const server = new McpServer({
  name: "pricelabs",
  version: "1.0.0",
});

// --- Tool registration (11 functions, 21 tools total) ---

registerListingTools(server, apiClient, cache, rateLimiter);
registerPriceTools(server, apiClient, cache, rateLimiter);
registerOverrideTools(server, apiClient, cache, rateLimiter);
registerNeighborhoodTools(server, apiClient, cache, rateLimiter);
registerReservationTools(server, apiClient, cache, rateLimiter);
registerSyncTools(server, apiClient, cache, rateLimiter);
registerRatePlanTools(server, apiClient, cache, rateLimiter);
registerStatusTools(server, rateLimiter, cache);

// --- Phase 2 tool registration (3 functions, 8 tools) ---
registerSnapshotTools(server, db);
registerMonitoringTools(server, db);
registerAuditTools(server, db);

// --- Transport connection ---

const transport = new StdioServerTransport();
await server.connect(transport);

// --- Process error handling ---

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

// --- Graceful shutdown ---

process.on("SIGTERM", () => {
  db.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
