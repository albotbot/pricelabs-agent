/**
 * Token bucket rate limiter for PriceLabs API.
 *
 * Timer-free implementation: tokens are calculated lazily on each call
 * based on elapsed time. No setInterval or background timers.
 *
 * Default: 1000 tokens per hour (PriceLabs API limit).
 */
export declare class TokenBucketRateLimiter {
    private tokens;
    private lastRefillTime;
    private readonly maxTokens;
    private readonly refillRate;
    private readonly refillWindowMs;
    constructor(maxTokens?: number, refillWindowMs?: number);
    /**
     * Lazily refill tokens based on elapsed time since last refill.
     * Caps at maxTokens -- no accumulation beyond the bucket size.
     */
    private refill;
    /**
     * Attempt to consume tokens from the bucket.
     *
     * @param count - Number of tokens to consume (default: 1)
     * @returns Object with `allowed` flag and optional `retryAfterMs` estimate
     */
    tryConsume(count?: number): {
        allowed: boolean;
        retryAfterMs?: number;
    };
    /**
     * Get current rate limiter status for the get_api_status tool.
     *
     * @returns Current token budget info including utilization percentage
     */
    getStatus(): {
        remaining: number;
        max: number;
        resetMs: number;
        utilizationPct: number;
    };
}
