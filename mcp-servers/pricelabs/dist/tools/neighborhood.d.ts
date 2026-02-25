/**
 * Neighborhood MCP tool: pricelabs_get_neighborhood.
 *
 * Fetches market percentile data (ADR, occupancy, revenue at 25th/50th/75th/90th)
 * for competitive positioning and base price calibration.
 *
 * Uses fetchWithFallback with 24-hour cache (market data updates daily).
 * Includes computed field: price_percentile_position (where listing falls
 * relative to market percentiles). Requires listing base_price from cache
 * for computed fields -- skips if not cached (avoids burning a rate token).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PriceLabsApiClient } from "../services/api-client.js";
import type { TtlCache } from "../services/cache.js";
import type { TokenBucketRateLimiter } from "../services/rate-limiter.js";
/**
 * Register the pricelabs_get_neighborhood tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export declare function registerNeighborhoodTools(server: McpServer, apiClient: PriceLabsApiClient, cache: TtlCache, rateLimiter: TokenBucketRateLimiter): void;
