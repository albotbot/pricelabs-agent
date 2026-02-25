/**
 * TTL cache with metadata for PriceLabs API responses.
 *
 * Features:
 * - Time-based expiration with lazy cleanup on access
 * - Returns cache_age_seconds metadata with every hit (locked decision)
 * - Prefix-based invalidation for write tool cache busting
 * - Hit/miss tracking for get_api_status diagnostics
 */
export class TtlCache {
    store = new Map();
    hits = 0;
    misses = 0;
    /**
     * Get a cached value if it exists and hasn't expired.
     * Expired entries are deleted on access (lazy cleanup).
     *
     * @returns Object with data and cacheAgeSeconds, or null if miss/expired
     */
    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        const age = Date.now() - entry.cachedAt;
        if (age > entry.ttlMs) {
            this.store.delete(key);
            this.misses++;
            return null;
        }
        this.hits++;
        return {
            data: entry.data,
            cacheAgeSeconds: Math.round(age / 1000),
        };
    }
    /**
     * Store a value with a TTL.
     *
     * @param key - Cache key
     * @param data - Data to cache
     * @param ttlMs - Time to live in milliseconds
     */
    set(key, data, ttlMs) {
        this.store.set(key, {
            data,
            cachedAt: Date.now(),
            ttlMs,
        });
    }
    /**
     * Delete all entries whose key starts with the given prefix.
     * Used by write tools to invalidate affected cache entries
     * (e.g., invalidate("overrides:listing-123") after setting overrides).
     *
     * @param pattern - Prefix pattern to match against cache keys
     */
    invalidate(pattern) {
        for (const key of this.store.keys()) {
            if (key.startsWith(pattern)) {
                this.store.delete(key);
            }
        }
    }
    /**
     * Get cache statistics for the get_api_status tool.
     *
     * @returns Entry count, oldest entry age, and hit rate percentage
     */
    getStats() {
        // Clean expired entries first
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now - entry.cachedAt > entry.ttlMs) {
                this.store.delete(key);
            }
        }
        let oldestAge = 0;
        for (const entry of this.store.values()) {
            const age = now - entry.cachedAt;
            if (age > oldestAge) {
                oldestAge = age;
            }
        }
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "0.0%";
        return {
            entries: this.store.size,
            oldestEntryAgeSeconds: Math.round(oldestAge / 1000),
            hitRate,
        };
    }
    /**
     * Remove all entries and reset counters.
     */
    clear() {
        this.store.clear();
        this.hits = 0;
        this.misses = 0;
    }
}
