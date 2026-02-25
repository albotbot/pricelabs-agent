/**
 * Cache-first fetch with graceful degradation.
 *
 * Implements the locked decision: "Rate limit hit -> serve cached + inform.
 * Never block the agent completely."
 *
 * Also implements: "API outage: Silent retry for 30 minutes, alert if prolonged."
 *
 * Every response includes cache_age_seconds, data_source, api_calls_remaining,
 * and fetched_at metadata fields.
 */
import { TtlCache } from "./cache.js";
import { TokenBucketRateLimiter } from "./rate-limiter.js";
import type { ToolResponse } from "../types.js";
/**
 * Fetch data from the API with automatic cache fallback.
 *
 * On success: caches result, returns live data with metadata.
 * On rate limit: returns cached data with freshness note if available.
 * On API error: returns cached data silently for brief outages,
 *               raises outage alert after 30 minutes.
 *
 * @param cacheKey - Unique key for caching the result
 * @param fetcher - Async function that fetches data (typically uses API client)
 * @param cache - TtlCache instance for read/write
 * @param rateLimiter - TokenBucketRateLimiter for status reporting
 * @param ttlMs - Time-to-live for cache entries in milliseconds
 * @param computeFields - Optional function to derive computed fields from data
 * @returns ToolResponse with data, computed fields, and metadata
 */
export declare function fetchWithFallback<T>(cacheKey: string, fetcher: () => Promise<T>, cache: TtlCache, rateLimiter: TokenBucketRateLimiter, ttlMs: number, computeFields?: (data: T) => Record<string, unknown>): Promise<ToolResponse<T>>;
