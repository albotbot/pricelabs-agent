/**
 * Override (DSO) tool registration for the PriceLabs MCP server.
 *
 * Registers three tools for the full DSO lifecycle:
 * - pricelabs_get_overrides: read active date-specific overrides
 * - pricelabs_set_overrides: create/update DSOs with full safety validation
 * - pricelabs_delete_overrides: remove DSOs with audit trail
 *
 * DSOs have the HIGHEST priority in PriceLabs and override ALL other settings
 * including min price. The set_overrides tool implements critical safety checks:
 * 1. Percentage range validation (-75 to 500)
 * 2. Currency matching for fixed-price DSOs
 * 3. Price floor validation against listing min_price
 * 4. Post-write verification to detect silently dropped dates
 *
 * Write tools never use fetchWithFallback -- writes must go live.
 * All write tools require a reason parameter for audit trail.
 * All write tools invalidate the override cache after success.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PriceLabsApiClient } from "../services/api-client.js";
import { TtlCache } from "../services/cache.js";
import { TokenBucketRateLimiter } from "../services/rate-limiter.js";
/**
 * Register the override tools on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export declare function registerOverrideTools(server: McpServer, apiClient: PriceLabsApiClient, cache: TtlCache, rateLimiter: TokenBucketRateLimiter): void;
