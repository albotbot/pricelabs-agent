/**
 * PriceLabs HTTP client with rate limiting and retry logic.
 *
 * Integrates with TokenBucketRateLimiter to enforce API call limits.
 * Retries 429/5xx with exponential backoff + jitter (max 3 attempts).
 * Never retries 401 -- auth failures are immediately fatal.
 * API key is never exposed in error messages or logs.
 *
 * Uses Node 22 built-in global fetch (no external HTTP library).
 */
import { TokenBucketRateLimiter } from "./rate-limiter.js";
/** Typed API response envelope */
export interface ApiResponse<T> {
    data: T;
    status: number;
}
export declare class PriceLabsApiClient {
    private readonly apiKey;
    private readonly rateLimiter;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly headers;
    constructor(apiKey: string, rateLimiter: TokenBucketRateLimiter, baseUrl?: string, timeoutMs?: number);
    /**
     * Core request method with rate limiting and retry.
     *
     * @param method - HTTP method (GET, POST, DELETE)
     * @param path - API path (e.g., "/v1/listings")
     * @param body - Optional request body for POST
     * @param retryCount - Current retry attempt (internal, starts at 0)
     * @returns Typed API response with data and status code
     */
    request<T>(method: string, path: string, body?: unknown, retryCount?: number): Promise<ApiResponse<T>>;
    /**
     * Handle HTTP response based on status code.
     */
    private handleResponse;
    /**
     * Calculate exponential backoff delay with jitter.
     * Formula: min(baseDelayMs * 2^attempt + random(0, baseDelayMs), maxDelayMs)
     */
    private calculateBackoff;
    /** Promisified setTimeout */
    private sleep;
    /** GET request */
    get<T>(path: string): Promise<ApiResponse<T>>;
    /** POST request */
    post<T>(path: string, body: unknown): Promise<ApiResponse<T>>;
    /** DELETE request */
    delete<T>(path: string): Promise<ApiResponse<T>>;
}
