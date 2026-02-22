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
import type { ReservationsResponse } from "../types.js";
import { fetchWithFallback } from "../services/fetch-with-fallback.js";
import { GetReservationsInputSchema } from "../schemas/reservations.js";
import { RateLimitError, AuthError, ApiError } from "../errors.js";

// --- Constants ---

const RESERVATIONS_CACHE_TTL_MS = 3_600_000; // 60 minutes

/**
 * Register the pricelabs_get_reservations tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export function registerReservationTools(
  server: McpServer,
  apiClient: PriceLabsApiClient,
  cache: TtlCache,
  rateLimiter: TokenBucketRateLimiter,
): void {
  server.registerTool(
    "pricelabs_get_reservations",
    {
      description:
        "Fetch reservation data for a listing including guest info, dates, revenue, source, and booking timestamps. Use for pace tracking and cancellation detection.",
      inputSchema: GetReservationsInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        // Build query string
        const queryParts: string[] = [
          `listing_id=${encodeURIComponent(params.listing_id)}`,
          `pms=${encodeURIComponent(params.pms)}`,
          `start_date=${encodeURIComponent(params.start_date)}`,
          `end_date=${encodeURIComponent(params.end_date)}`,
        ];
        if (params.limit !== undefined) {
          queryParts.push(`limit=${params.limit}`);
        }
        if (params.offset !== undefined) {
          queryParts.push(`offset=${params.offset}`);
        }
        const queryString = `?${queryParts.join("&")}`;

        const cacheKey = `reservations:${params.listing_id}:${params.pms}`;

        const result = await fetchWithFallback<ReservationsResponse>(
          cacheKey,
          async () => {
            const response = await apiClient.get<ReservationsResponse>(
              `/v1/reservation_data${queryString}`,
            );
            return response.data;
          },
          cache,
          rateLimiter,
          RESERVATIONS_CACHE_TTL_MS,
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
