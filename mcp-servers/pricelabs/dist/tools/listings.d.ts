/**
 * Listing MCP tools: get_listings, get_listing, update_listings.
 *
 * Core data access layer for portfolio monitoring. Listings are the most
 * frequently accessed resource -- daily health checks, interactive queries,
 * and all downstream analysis starts here.
 *
 * Read tools use fetchWithFallback with 60-minute cache and computed fields.
 * Write tool bypasses cache, requires reason parameter for audit trail,
 * and invalidates all listing cache entries on success.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PriceLabsApiClient } from "../services/api-client.js";
import type { TtlCache } from "../services/cache.js";
import type { TokenBucketRateLimiter } from "../services/rate-limiter.js";
/**
 * Register all listing MCP tools on the server.
 *
 * Tools registered:
 * - pricelabs_get_listings (read, cached)
 * - pricelabs_get_listing (read, cached)
 * - pricelabs_update_listings (write, destructive, audit trail)
 */
export declare function registerListingTools(server: McpServer, apiClient: PriceLabsApiClient, cache: TtlCache, rateLimiter: TokenBucketRateLimiter): void;
