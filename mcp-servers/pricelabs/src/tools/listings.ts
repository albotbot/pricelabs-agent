/**
 * Listing MCP tools: get_listings, get_listing.
 *
 * Core data access layer for portfolio monitoring. Listings are the most
 * frequently accessed resource -- daily health checks, interactive queries,
 * and all downstream analysis starts here.
 *
 * Read tools use fetchWithFallback with 60-minute cache and computed fields.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PriceLabsApiClient } from "../services/api-client.js";
import type { TtlCache } from "../services/cache.js";
import type { TokenBucketRateLimiter } from "../services/rate-limiter.js";
import type { Listing } from "../types.js";
import { fetchWithFallback } from "../services/fetch-with-fallback.js";
import { computeListingFields } from "../computed-fields.js";
import { RateLimitError, AuthError, ApiError } from "../errors.js";
import {
  GetListingsInputSchema,
  GetListingInputSchema,
} from "../schemas/listings.js";

// --- Constants ---

const LISTING_CACHE_TTL_MS = 3_600_000; // 60 minutes

/**
 * Register listing MCP tools on the server.
 *
 * Tools registered:
 * - pricelabs_get_listings (read, cached)
 * - pricelabs_get_listing (read, cached)
 */
export function registerListingTools(
  server: McpServer,
  apiClient: PriceLabsApiClient,
  cache: TtlCache,
  rateLimiter: TokenBucketRateLimiter,
): void {
  // --- pricelabs_get_listings ---

  server.registerTool(
    "pricelabs_get_listings",
    {
      description:
        "Fetch all PriceLabs listings with health scores, occupancy, revenue, and sync status. Returns computed fields: occupancy_gap_pct, revenue_vs_stly_pct, days_since_sync.",
      inputSchema: GetListingsInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        // Build query string from optional params
        const queryParts: string[] = [];
        if (params.skip_hidden !== undefined) {
          queryParts.push(`skip_hidden=${params.skip_hidden}`);
        }
        if (params.only_syncing !== undefined) {
          queryParts.push(`only_syncing=${params.only_syncing}`);
        }
        const queryString =
          queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

        const cacheKey = `listings:all:${JSON.stringify(params)}`;

        const result = await fetchWithFallback<Listing[]>(
          cacheKey,
          async () => {
            const response = await apiClient.get<Listing[]>(
              `/v1/listings${queryString}`,
            );
            return response.data;
          },
          cache,
          rateLimiter,
          LISTING_CACHE_TTL_MS,
          (listings) => {
            // Compute fields per listing
            const listingsComputed = listings.map((listing) =>
              computeListingFields(listing),
            );
            return { listings_computed: listingsComputed };
          },
        );

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (error) {
        return formatErrorResponse(error);
      }
    },
  );

  // --- pricelabs_get_listing ---

  server.registerTool(
    "pricelabs_get_listing",
    {
      description:
        "Fetch a single PriceLabs listing by ID with detailed health, occupancy, revenue data, and computed analysis fields.",
      inputSchema: GetListingInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const cacheKey = `listing:${params.listing_id}:${params.pms}`;

        const result = await fetchWithFallback<Listing>(
          cacheKey,
          async () => {
            const response = await apiClient.get<Listing>(
              `/v1/listings/${params.listing_id}?pms=${encodeURIComponent(params.pms)}`,
            );
            return response.data;
          },
          cache,
          rateLimiter,
          LISTING_CACHE_TTL_MS,
          (listing) => computeListingFields(listing),
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

// --- Error formatting helpers ---

/**
 * Format errors for read tool responses.
 * Plain and direct messages with next steps (locked decision).
 */
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
