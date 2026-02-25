/**
 * TTL cache with metadata for PriceLabs API responses.
 *
 * Features:
 * - Time-based expiration with lazy cleanup on access
 * - Returns cache_age_seconds metadata with every hit (locked decision)
 * - Prefix-based invalidation for write tool cache busting
 * - Hit/miss tracking for get_api_status diagnostics
 */
export declare class TtlCache {
    private store;
    private hits;
    private misses;
    /**
     * Get a cached value if it exists and hasn't expired.
     * Expired entries are deleted on access (lazy cleanup).
     *
     * @returns Object with data and cacheAgeSeconds, or null if miss/expired
     */
    get<T>(key: string): {
        data: T;
        cacheAgeSeconds: number;
    } | null;
    /**
     * Store a value with a TTL.
     *
     * @param key - Cache key
     * @param data - Data to cache
     * @param ttlMs - Time to live in milliseconds
     */
    set<T>(key: string, data: T, ttlMs: number): void;
    /**
     * Delete all entries whose key starts with the given prefix.
     * Used by write tools to invalidate affected cache entries
     * (e.g., invalidate("overrides:listing-123") after setting overrides).
     *
     * @param pattern - Prefix pattern to match against cache keys
     */
    invalidate(pattern: string): void;
    /**
     * Get cache statistics for the get_api_status tool.
     *
     * @returns Entry count, oldest entry age, and hit rate percentage
     */
    getStats(): {
        entries: number;
        oldestEntryAgeSeconds: number;
        hitRate: string;
    };
    /**
     * Remove all entries and reset counters.
     */
    clear(): void;
}
