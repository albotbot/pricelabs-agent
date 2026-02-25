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
import { fetchWithFallback } from "../services/fetch-with-fallback.js";
import { computeNeighborhoodFields } from "../computed-fields.js";
import { GetNeighborhoodInputSchema } from "../schemas/neighborhoods.js";
import { RateLimitError, AuthError, ApiError } from "../errors.js";
// --- Constants ---
const NEIGHBORHOOD_CACHE_TTL_MS = 86_400_000; // 24 hours
/**
 * Register the pricelabs_get_neighborhood tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export function registerNeighborhoodTools(server, apiClient, cache, rateLimiter) {
    server.registerTool("pricelabs_get_neighborhood", {
        description: "Fetch neighborhood market data showing ADR, occupancy, and revenue at 25th/50th/75th/90th percentiles. Use for competitive positioning and base price calibration.",
        inputSchema: GetNeighborhoodInputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
        },
    }, async (params) => {
        try {
            // Build query string
            const queryParts = [
                `listing_id=${encodeURIComponent(params.listing_id)}`,
                `pms=${encodeURIComponent(params.pms)}`,
            ];
            if (params.start_date) {
                queryParts.push(`start_date=${encodeURIComponent(params.start_date)}`);
            }
            if (params.end_date) {
                queryParts.push(`end_date=${encodeURIComponent(params.end_date)}`);
            }
            const queryString = `?${queryParts.join("&")}`;
            const cacheKey = `neighborhood:${params.listing_id}:${params.pms}`;
            // Try to get listing from cache for computed fields (don't make an API call just for this)
            const cachedListing = cache.get(`listing:${params.listing_id}:${params.pms}`);
            const result = await fetchWithFallback(cacheKey, async () => {
                const response = await apiClient.get(`/v1/neighborhood_data${queryString}`);
                return response.data;
            }, cache, rateLimiter, NEIGHBORHOOD_CACHE_TTL_MS, (neighborhoodData) => {
                // Compute price_percentile_position if we have the listing cached
                if (cachedListing) {
                    return computeNeighborhoodFields(neighborhoodData, cachedListing.data);
                }
                // Skip computed fields if listing not cached -- don't burn a rate token
                return { price_percentile_position: null };
            });
            return {
                content: [{ type: "text", text: JSON.stringify(result) }],
            };
        }
        catch (error) {
            return formatErrorResponse(error);
        }
    });
}
// --- Error formatting ---
function formatErrorResponse(error) {
    let message;
    if (error instanceof RateLimitError) {
        const retryMinutes = Math.ceil(error.retryAfterMs / 60_000);
        message = `Rate limit reached. No cached data available for this request. Try again in ~${retryMinutes} minutes.`;
    }
    else if (error instanceof AuthError) {
        message = `CRITICAL: Authentication failed. Check PRICELABS_API_KEY immediately. No data can be served until authentication is restored.`;
    }
    else if (error instanceof ApiError) {
        message = `API error (${error.statusCode}): ${error.message}. Check that the listing ID and PMS values are correct.`;
    }
    else if (error instanceof Error) {
        message = `Unexpected error: ${error.message}. Try again shortly.`;
    }
    else {
        message = `Unknown error occurred. Try again shortly.`;
    }
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
