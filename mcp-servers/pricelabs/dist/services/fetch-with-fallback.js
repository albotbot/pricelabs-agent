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
import { RateLimitError } from "../errors.js";
// --- Outage tracking state (module-level, shared across all calls) ---
let firstFailureAt = null;
const OUTAGE_ALERT_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
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
export async function fetchWithFallback(cacheKey, fetcher, cache, rateLimiter, ttlMs, computeFields) {
    try {
        // Attempt live fetch
        const data = await fetcher();
        // Success -- reset outage tracking
        firstFailureAt = null;
        // Cache the result
        cache.set(cacheKey, data, ttlMs);
        // Build response
        const computed = computeFields ? computeFields(data) : {};
        const status = rateLimiter.getStatus();
        return {
            data,
            computed,
            meta: {
                cache_age_seconds: 0,
                data_source: "live",
                api_calls_remaining: status.remaining,
                fetched_at: new Date().toISOString(),
            },
        };
    }
    catch (error) {
        if (error instanceof RateLimitError) {
            return handleRateLimitFallback(error, cacheKey, cache, rateLimiter, computeFields);
        }
        // All other errors (ApiError, network errors, etc.)
        return handleErrorFallback(error, cacheKey, cache, rateLimiter, computeFields);
    }
}
/**
 * Handle rate limit errors by serving cached data.
 */
function handleRateLimitFallback(error, cacheKey, cache, rateLimiter, computeFields) {
    const cached = cache.get(cacheKey);
    if (cached) {
        const cacheAgeMinutes = Math.round(cached.cacheAgeSeconds / 60);
        const retryMinutes = Math.ceil(error.retryAfterMs / 60_000);
        const computed = computeFields ? computeFields(cached.data) : {};
        const status = rateLimiter.getStatus();
        return {
            data: cached.data,
            computed,
            meta: {
                cache_age_seconds: cached.cacheAgeSeconds,
                data_source: "cached",
                api_calls_remaining: status.remaining,
                fetched_at: new Date().toISOString(),
                note: `Using cached data (${cacheAgeMinutes} min old). Fresh data available in ~${retryMinutes} minutes.`,
            },
        };
    }
    // No cache available -- cannot serve anything
    const retryMinutes = Math.ceil(error.retryAfterMs / 60_000);
    throw new RateLimitError(error.retryAfterMs, `Rate limited with no cached data available. Retry in ~${retryMinutes} minutes.`);
}
/**
 * Handle API/network errors by serving cached data with outage awareness.
 */
function handleErrorFallback(error, cacheKey, cache, rateLimiter, computeFields) {
    // Track outage start
    if (firstFailureAt === null) {
        firstFailureAt = Date.now();
    }
    const outageDurationMs = Date.now() - firstFailureAt;
    const cached = cache.get(cacheKey);
    if (cached) {
        const computed = computeFields ? computeFields(cached.data) : {};
        const status = rateLimiter.getStatus();
        const cacheAgeMinutes = Math.round(cached.cacheAgeSeconds / 60);
        if (outageDurationMs < OUTAGE_ALERT_THRESHOLD_MS) {
            // Brief outage -- serve cached silently (don't alarm for hiccups)
            const errorMsg = error instanceof Error ? error.message : "Unknown API error";
            return {
                data: cached.data,
                computed,
                meta: {
                    cache_age_seconds: cached.cacheAgeSeconds,
                    data_source: "cached",
                    api_calls_remaining: status.remaining,
                    fetched_at: new Date().toISOString(),
                    note: `API temporarily unavailable (${errorMsg}). Using cached data (${cacheAgeMinutes} min old).`,
                },
            };
        }
        // Prolonged outage -- alert
        const outageMinutes = Math.round(outageDurationMs / 60_000);
        return {
            data: cached.data,
            computed,
            meta: {
                cache_age_seconds: cached.cacheAgeSeconds,
                data_source: "cached",
                api_calls_remaining: status.remaining,
                fetched_at: new Date().toISOString(),
                note: `CRITICAL: PriceLabs API has been unreachable for ${outageMinutes} minutes. Using cached data (${cacheAgeMinutes} min old). This may indicate an extended outage. Alert both channels.`,
                outage_alert: true,
            },
        };
    }
    // No cache available -- re-throw with outage context
    const outageMinutes = Math.round(outageDurationMs / 60_000);
    const originalMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`API error with no cached data (outage: ${outageMinutes} min): ${originalMessage}`);
}
