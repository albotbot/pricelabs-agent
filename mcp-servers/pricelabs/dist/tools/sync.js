/**
 * Sync MCP tools: pricelabs_push_prices, pricelabs_add_listing.
 *
 * Write-only tools for triggering price syncs and adding new listings.
 * Both are destructive operations requiring a reason parameter for audit trail.
 *
 * push_prices: Forces PriceLabs to recalculate and push prices to connected OTAs.
 * add_listing: Imports a new listing (BookingSync PMS only) into PriceLabs.
 *
 * Neither uses fetchWithFallback -- writes must go to the live API.
 * No cache is used (action, not data retrieval). On success, relevant
 * cache entries are invalidated.
 */
import { PushPricesInputSchema } from "../schemas/prices.js";
import { RateLimitError, AuthError, ApiError } from "../errors.js";
import { z } from "zod";
/**
 * Register sync tools (push_prices, add_listing) on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for cache invalidation after writes
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export function registerSyncTools(server, apiClient, cache, rateLimiter) {
    // ---------------------------------------------------------------
    // Tool 1: pricelabs_push_prices (write)
    // ---------------------------------------------------------------
    server.registerTool("pricelabs_push_prices", {
        description: "Trigger a price sync/push for a listing. Forces PriceLabs to recalculate and push updated prices to connected OTAs. DESTRUCTIVE -- only use when prices need immediate refresh. REQUIRES reason.",
        inputSchema: PushPricesInputSchema.shape,
        annotations: {
            destructiveHint: true,
            readOnlyHint: false,
            openWorldHint: true,
        },
    }, async (params) => {
        try {
            const { listing_id, pms_name, reason } = params;
            // Write operations go directly to the live API -- never cached
            const response = await apiClient.post("/v1/push_prices", {
                listing: listing_id,
                pms_name,
            });
            // Build response with write metadata
            const status = rateLimiter.getStatus();
            const toolResponse = {
                data: response.data,
                computed: {
                    reason,
                    action: "price_push",
                    listing_id,
                    pms_name,
                },
                meta: {
                    cache_age_seconds: 0,
                    data_source: "live",
                    api_calls_remaining: status.remaining,
                    fetched_at: new Date().toISOString(),
                },
            };
            return {
                content: [
                    { type: "text", text: JSON.stringify(toolResponse) },
                ],
            };
        }
        catch (error) {
            return formatWriteErrorResponse(error, "push prices");
        }
    });
    // ---------------------------------------------------------------
    // Tool 2: pricelabs_add_listing (write)
    // ---------------------------------------------------------------
    // Input schema for add_listing with z.literal("bookingsync") constraint
    const AddListingToolInputSchema = z.object({
        listing_id: z.string().describe("The listing ID to import from PMS"),
        pms_name: z
            .literal("bookingsync")
            .describe("Only BookingSync PMS is supported for adding listings via the API"),
        reason: z
            .string()
            .min(10)
            .describe("Rationale for adding this listing (min 10 chars, required for audit trail)"),
    });
    server.registerTool("pricelabs_add_listing", {
        description: "Add a new listing to PriceLabs for price management. ONLY works for BookingSync PMS. DESTRUCTIVE -- creates a new managed listing. REQUIRES reason.",
        inputSchema: AddListingToolInputSchema.shape,
        annotations: {
            destructiveHint: true,
            readOnlyHint: false,
            openWorldHint: true,
        },
    }, async (params) => {
        try {
            const { listing_id, pms_name, reason } = params;
            // Write operations go directly to the live API -- never cached
            const response = await apiClient.post("/v1/add_listing_data", {
                listing_id,
                pms_name,
            });
            // Invalidate listings cache since we added a new listing
            cache.invalidate("listings:");
            cache.invalidate("listing:");
            // Build response with write metadata
            const status = rateLimiter.getStatus();
            const toolResponse = {
                data: response.data,
                computed: {
                    reason,
                    action: "add_listing",
                    listing_id,
                    pms_name,
                },
                meta: {
                    cache_age_seconds: 0,
                    data_source: "live",
                    api_calls_remaining: status.remaining,
                    fetched_at: new Date().toISOString(),
                },
            };
            return {
                content: [
                    { type: "text", text: JSON.stringify(toolResponse) },
                ],
            };
        }
        catch (error) {
            return formatWriteErrorResponse(error, "add listing");
        }
    });
}
// --- Error formatting ---
/**
 * Format errors for write tool responses.
 * Write-specific messaging: never suggests cached data, emphasizes severity.
 */
function formatWriteErrorResponse(error, operation) {
    let message;
    if (error instanceof RateLimitError) {
        const retryMinutes = Math.ceil(error.retryAfterMs / 60_000);
        message = `Cannot ${operation} -- rate limit reached. Write operations cannot use cached data. Try again in ~${retryMinutes} minutes.`;
    }
    else if (error instanceof AuthError) {
        message = `CRITICAL: Authentication failed. The ${operation} operation could not be executed. Check PRICELABS_API_KEY immediately.`;
    }
    else if (error instanceof ApiError) {
        message = `Failed to ${operation} (${error.statusCode}): ${error.message}. Check that the listing ID and PMS values are correct.`;
    }
    else if (error instanceof Error) {
        message = `Failed to ${operation}: ${error.message}. The operation was not applied. Try again shortly.`;
    }
    else {
        message = `Failed to ${operation} with unknown error. The operation was not applied. Try again shortly.`;
    }
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
