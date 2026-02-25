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
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PriceLabsApiClient } from "../services/api-client.js";
import { TtlCache } from "../services/cache.js";
import { TokenBucketRateLimiter } from "../services/rate-limiter.js";
/**
 * Register the pricelabs_get_prices tool on the MCP server.
 *
 * @param server - MCP server instance
 * @param apiClient - PriceLabs API client with rate limiting and retry
 * @param cache - TTL cache for response caching
 * @param rateLimiter - Token bucket rate limiter for status reporting
 */
export declare function registerPriceTools(server: McpServer, apiClient: PriceLabsApiClient, cache: TtlCache, rateLimiter: TokenBucketRateLimiter): void;
