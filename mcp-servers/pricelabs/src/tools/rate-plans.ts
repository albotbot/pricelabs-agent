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
import { fetchWithFallback } from "../services/fetch-with-fallback.js";
import { GetRatePlansInputSchema } from "../schemas/prices.js";
import { RateLimitError, AuthError, ApiError } from "../errors.js";

// --- Constants ---

const RATE_PLANS_CACHE_TTL_MS = 21_600_000; // 6 hours

/**
 * Register the pricelabs_get_rate_plans tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export function registerRatePlanTools(
  server: McpServer,
  apiClient: PriceLabsApiClient,
  cache: TtlCache,
  rateLimiter: TokenBucketRateLimiter,
): void {
  server.registerTool(
    "pricelabs_get_rate_plans",
    {
      description:
        "Fetch available rate plan configurations for a listing. Shows pricing tiers and adjustment rules.",
      inputSchema: GetRatePlansInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        // Note: API uses pms_name not pms for this endpoint
        const queryString = `?listing_id=${encodeURIComponent(params.listing_id)}&pms_name=${encodeURIComponent(params.pms_name)}`;

        const cacheKey = `rate-plans:${params.listing_id}:${params.pms_name}`;

        const result = await fetchWithFallback<unknown>(
          cacheKey,
          async () => {
            const response = await apiClient.get<unknown>(
              `/v1/fetch_rate_plans${queryString}`,
            );
            return response.data;
          },
          cache,
          rateLimiter,
          RATE_PLANS_CACHE_TTL_MS,
        );

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (error) {
        return formatErrorResponse(error);
      }
    },
  );
}

// --- Error formatting ---

function formatErrorResponse(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  let message: string;

  if (error instanceof RateLimitError) {
    const retryMinutes = Math.ceil(error.retryAfterMs / 60_000);
    message = `Rate limit reached. No cached data available for this request. Try again in ~${retryMinutes} minutes.`;
  } else if (error instanceof AuthError) {
    message = `CRITICAL: Authentication failed. Check PRICELABS_API_KEY immediately. No data can be served until authentication is restored.`;
  } else if (error instanceof ApiError) {
    message = `API error (${error.statusCode}): ${error.message}. Check that the listing ID and PMS values are correct.`;
  } else if (error instanceof Error) {
    message = `Unexpected error: ${error.message}. Try again shortly.`;
  } else {
    message = `Unknown error occurred. Try again shortly.`;
  }

  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
