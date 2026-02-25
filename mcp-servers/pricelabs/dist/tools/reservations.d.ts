/**
 * Reservation MCP tool: pricelabs_get_reservations.
 *
 * Fetches reservation data for a listing including guest info, dates, revenue,
 * source, and booking timestamps. Used for pace tracking and cancellation detection.
 *
 * Uses fetchWithFallback with 60-minute cache (bookings can arrive anytime).
 * No computed fields needed -- pace tracking is a Phase 2 concern.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PriceLabsApiClient } from "../services/api-client.js";
import type { TtlCache } from "../services/cache.js";
import type { TokenBucketRateLimiter } from "../services/rate-limiter.js";
/**
 * Register the pricelabs_get_reservations tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export declare function registerReservationTools(server: McpServer, apiClient: PriceLabsApiClient, cache: TtlCache, rateLimiter: TokenBucketRateLimiter): void;
