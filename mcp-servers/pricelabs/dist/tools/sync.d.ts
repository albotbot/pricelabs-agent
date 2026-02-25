/**
 * Sync MCP tools: pricelabs_push_prices, pricelabs_add_listing.
 *
 * Write-only tools for triggering price syncs and adding new listings.
 * Both are destructive operations requiring a reason parameter for audit trail.
 *
 * push_prices: Forces PriceLabs to recalculate and push prices to connected OTAs.
 * add_listing: Imports a new listing (BookingSync PMS only) into PriceLabs.
 *
 * Neither uses fetchWithFallback -- writes must go to the live API.
 * No cache is used (action, not data retrieval). On success, relevant
 * cache entries are invalidated.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PriceLabsApiClient } from "../services/api-client.js";
import type { TtlCache } from "../services/cache.js";
import type { TokenBucketRateLimiter } from "../services/rate-limiter.js";
/**
 * Register sync tools (push_prices, add_listing) on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for cache invalidation after writes
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export declare function registerSyncTools(server: McpServer, apiClient: PriceLabsApiClient, cache: TtlCache, rateLimiter: TokenBucketRateLimiter): void;
