/**
 * PriceLabs MCP Server entry point.
 *
 * Wires all 13 tools (8 registration functions) to a single MCP server
 * connected via stdio transport. Validates environment on startup and
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

// --- Server creation ---

const server = new McpServer({
  name: "pricelabs",
  version: "1.0.0",
});

// --- Tool registration (8 functions, 13 tools total) ---

registerListingTools(server, apiClient, cache, rateLimiter);
registerPriceTools(server, apiClient, cache, rateLimiter);
registerOverrideTools(server, apiClient, cache, rateLimiter);
registerNeighborhoodTools(server, apiClient, cache, rateLimiter);
registerReservationTools(server, apiClient, cache, rateLimiter);
registerSyncTools(server, apiClient, cache, rateLimiter);
registerRatePlanTools(server, apiClient, cache, rateLimiter);
registerStatusTools(server, rateLimiter, cache);

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
