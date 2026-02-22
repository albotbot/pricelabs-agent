/**
 * Token bucket rate limiter for PriceLabs API.
 *
 * Timer-free implementation: tokens are calculated lazily on each call
 * based on elapsed time. No setInterval or background timers.
 *
 * Default: 1000 tokens per hour (PriceLabs API limit).
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  private readonly refillWindowMs: number;

  constructor(maxTokens: number = 1000, refillWindowMs: number = 3_600_000) {
    this.maxTokens = maxTokens;
    this.refillWindowMs = refillWindowMs;
    this.tokens = maxTokens;
    this.lastRefillTime = Date.now();
    this.refillRate = maxTokens / refillWindowMs;
  }

  /**
   * Lazily refill tokens based on elapsed time since last refill.
   * Caps at maxTokens -- no accumulation beyond the bucket size.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefillTime = now;
  }

  /**
   * Attempt to consume tokens from the bucket.
   *
   * @param count - Number of tokens to consume (default: 1)
   * @returns Object with `allowed` flag and optional `retryAfterMs` estimate
   */
  tryConsume(count: number = 1): { allowed: boolean; retryAfterMs?: number } {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return { allowed: true };
    }

    const deficit = count - this.tokens;
    const retryAfterMs = Math.ceil(deficit / this.refillRate);
    return { allowed: false, retryAfterMs };
  }

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
  } {
    this.refill();

    const remaining = Math.floor(this.tokens);
    const used = this.maxTokens - remaining;
    const utilizationPct =
      this.maxTokens > 0
        ? Math.round((used / this.maxTokens) * 100 * 10) / 10
        : 0;

    return {
      remaining,
      max: this.maxTokens,
      resetMs: Math.ceil((this.maxTokens - this.tokens) / this.refillRate),
      utilizationPct,
    };
  }
}
