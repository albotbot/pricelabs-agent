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

// Capture server start time at module load for uptime calculation
const serverStartTime = Date.now();

/**
 * Register the pricelabs_get_api_status tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param rateLimiter - Token bucket rate limiter for budget reporting
 * @param cache - TTL cache for cache health reporting
 */
export function registerStatusTools(
  server: McpServer,
  rateLimiter: TokenBucketRateLimiter,
  cache: TtlCache,
): void {
  server.registerTool(
    "pricelabs_get_api_status",
    {
      description:
        "Check PriceLabs MCP server health: rate limit budget remaining, cache statistics, and system status. Use this for self-awareness before planning expensive operations.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      // Gather status from internal services -- no API call consumed
      const rateStatus = rateLimiter.getStatus();
      const cacheStats = cache.getStats();

      const status = {
        rate_limit: {
          remaining: rateStatus.remaining,
          max: rateStatus.max,
          reset_in_minutes: Math.ceil(rateStatus.resetMs / 60_000),
          utilization_pct: rateStatus.utilizationPct,
        },
        cache: {
          entries: cacheStats.entries,
          hit_rate: cacheStats.hitRate,
          oldest_entry_age_seconds: cacheStats.oldestEntryAgeSeconds,
        },
        server: {
          uptime_seconds: Math.floor((Date.now() - serverStartTime) / 1000),
          version: "1.0.0",
        },
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(status, null, 2) },
        ],
      };
    },
  );
}
