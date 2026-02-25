/**
 * API status self-awareness tool: pricelabs_get_api_status.
 *
 * Exposes internal server health without consuming any PriceLabs API calls:
 * - Rate limit budget: remaining tokens, max capacity, reset estimate, utilization
 * - Cache health: entry count, hit rate, oldest entry age
 * - Server uptime and version
 *
 * The agent uses this for self-awareness before planning expensive operations.
 * For example, checking remaining budget before a batch of listing queries.
 *
 * Different function signature from other tools: takes rateLimiter and cache
 * directly (no apiClient needed since it reads only internal state).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TtlCache } from "../services/cache.js";
import type { TokenBucketRateLimiter } from "../services/rate-limiter.js";
/**
 * Register the pricelabs_get_api_status tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param rateLimiter - Token bucket rate limiter for budget reporting
 * @param cache - TTL cache for cache health reporting
 */
export declare function registerStatusTools(server: McpServer, rateLimiter: TokenBucketRateLimiter, cache: TtlCache): void;
