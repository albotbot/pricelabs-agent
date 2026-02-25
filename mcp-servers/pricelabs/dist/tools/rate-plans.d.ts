/**
 * Rate plan MCP tool: pricelabs_get_rate_plans.
 *
 * Fetches available rate plan configurations for a listing.
 * Shows pricing tiers and adjustment rules.
 *
 * Uses fetchWithFallback with 6-hour cache (rate plan changes are rare).
 *
 * Note: This endpoint uses `pms_name` (not `pms`) in the query string
 * per the PriceLabs API spec. The tool input uses pms_name accordingly.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PriceLabsApiClient } from "../services/api-client.js";
import type { TtlCache } from "../services/cache.js";
import type { TokenBucketRateLimiter } from "../services/rate-limiter.js";
/**
 * Register the pricelabs_get_rate_plans tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export declare function registerRatePlanTools(server: McpServer, apiClient: PriceLabsApiClient, cache: TtlCache, rateLimiter: TokenBucketRateLimiter): void;
