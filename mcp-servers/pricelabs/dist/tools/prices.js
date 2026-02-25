/**
 * Price tool registration for the PriceLabs MCP server.
 *
 * Registers pricelabs_get_prices: fetches daily pricing data with demand signal
 * enrichment (demand_level, adr_vs_stly_pct) via computed fields.
 *
 * Uses fetchWithFallback for cache-first degradation. POST /v1/listing_prices
 * is a read operation (PriceLabs API design choice), so the tool is annotated
 * as readOnly despite using POST.
 *
 * Cache TTL: 6 hours (prices recalculate on nightly sync cycle).
 */
import { z } from "zod";
import { fetchWithFallback } from "../services/fetch-with-fallback.js";
import { computePriceFields } from "../computed-fields.js";
import { GetPricesInputSchema } from "../schemas/prices.js";
/** Cache TTL for prices: 6 hours (nightly sync cycle makes this safe) */
const PRICES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 21600000ms
/**
 * Register the pricelabs_get_prices tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export function registerPriceTools(server, apiClient, cache, rateLimiter) {
    const inputShape = GetPricesInputSchema.shape;
    server.tool("pricelabs_get_prices", "Fetch daily pricing data for a listing including dynamic prices, demand signals (colors/descriptions), booking status, and ADR comparisons. Returns computed fields: demand_level (human-readable), adr_vs_stly_pct.", {
        listing_id: inputShape.listing_id,
        pms: inputShape.pms,
        start_date: inputShape.start_date,
        end_date: inputShape.end_date,
        currency: inputShape.currency ?? z.string().optional(),
    }, {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    }, async (args) => {
        const { listing_id, pms, start_date, end_date, currency } = args;
        const cacheKey = `prices:${listing_id}:${pms}:${start_date}:${end_date}`;
        const result = await fetchWithFallback(cacheKey, () => apiClient
            .post("/v1/listing_prices", {
            listing_id,
            pms,
            start_date,
            end_date,
            currency,
        })
            .then((r) => r.data), cache, rateLimiter, PRICES_CACHE_TTL_MS, (data) => {
            // Compute fields per daily price entry
            const enrichedEntries = data.data.map((entry) => computePriceFields(entry));
            return { daily_computed: enrichedEntries };
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    });
}
