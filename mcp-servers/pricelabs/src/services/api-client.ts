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
import { RateLimitError, AuthError, ApiError } from "../errors.js";

/** Typed API response envelope */
export interface ApiResponse<T> {
  data: T;
  status: number;
}

/** Retry configuration */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableStatuses: [429, 500, 502, 503, 504] as const,
  defaultRetryAfterMs: 60_000, // 60s default when Retry-After header missing
} as const;

export class PriceLabsApiClient {
  private readonly headers: Record<string, string>;

  constructor(
    private readonly apiKey: string,
    private readonly rateLimiter: TokenBucketRateLimiter,
    private readonly baseUrl: string = "https://api.pricelabs.co",
    private readonly timeoutMs: number = 300_000,
  ) {
    this.headers = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Core request method with rate limiting and retry.
   *
   * @param method - HTTP method (GET, POST, DELETE)
   * @param path - API path (e.g., "/v1/listings")
   * @param body - Optional request body for POST
   * @param retryCount - Current retry attempt (internal, starts at 0)
   * @returns Typed API response with data and status code
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryCount: number = 0,
  ): Promise<ApiResponse<T>> {
    // 1. Check rate limiter before every outbound call
    const rateCheck = this.rateLimiter.tryConsume();
    if (!rateCheck.allowed) {
      throw new RateLimitError(
        rateCheck.retryAfterMs ?? RETRY_CONFIG.defaultRetryAfterMs,
        "Local rate limit exceeded. Too many API calls.",
      );
    }

    // 2. Create AbortController with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}${path}`;
      const options: RequestInit = {
        method,
        headers: this.headers,
        signal: controller.signal,
      };

      if (body !== undefined) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      // 3. Handle response statuses
      return await this.handleResponse<T>(response, method, path, body, retryCount);
    } catch (error) {
      // Re-throw our own errors directly
      if (
        error instanceof RateLimitError ||
        error instanceof AuthError ||
        error instanceof ApiError
      ) {
        throw error;
      }

      // Abort errors become ApiError
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError(0, "", `Request to ${path} timed out after ${this.timeoutMs}ms`);
      }

      // Network errors -- retry if under limit
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delayMs = this.calculateBackoff(retryCount);
        await this.sleep(delayMs);
        return this.request<T>(method, path, body, retryCount + 1);
      }

      throw new ApiError(
        0,
        "",
        `Network error after ${RETRY_CONFIG.maxRetries} retries: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle HTTP response based on status code.
   */
  private async handleResponse<T>(
    response: Response,
    method: string,
    path: string,
    body: unknown,
    retryCount: number,
  ): Promise<ApiResponse<T>> {
    const { status } = response;

    // 429 Too Many Requests -- retry with Retry-After header
    if (status === 429) {
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader
          ? parseInt(retryAfterHeader, 10) * 1000
          : RETRY_CONFIG.defaultRetryAfterMs;

        await this.sleep(retryAfterMs);
        return this.request<T>(method, path, body, retryCount + 1);
      }
      throw new RateLimitError(
        RETRY_CONFIG.defaultRetryAfterMs,
        `Rate limited by API after ${RETRY_CONFIG.maxRetries} retries`,
      );
    }

    // 401 Unauthorized -- NEVER retry, immediate fatal error
    if (status === 401) {
      throw new AuthError(
        "Authentication failed. Verify that PRICELABS_API_KEY is valid.",
      );
    }

    // 5xx Server errors -- retry with exponential backoff
    if (status >= 500 && status <= 504) {
      const responseBody = await response.text();
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delayMs = this.calculateBackoff(retryCount);
        await this.sleep(delayMs);
        return this.request<T>(method, path, body, retryCount + 1);
      }
      throw new ApiError(status, responseBody);
    }

    // 400/403/404 -- non-retryable client errors
    if (status >= 400 && status < 500) {
      const responseBody = await response.text();
      throw new ApiError(status, responseBody);
    }

    // 204 No Content -- successful delete
    if (status === 204) {
      return { data: null as T, status: 204 };
    }

    // 200-299 -- success, parse JSON
    const data = (await response.json()) as T;
    return { data, status };
  }

  /**
   * Calculate exponential backoff delay with jitter.
   * Formula: min(baseDelayMs * 2^attempt + random(0, baseDelayMs), maxDelayMs)
   */
  private calculateBackoff(attempt: number): number {
    const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * RETRY_CONFIG.baseDelayMs;
    return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
  }

  /** Promisified setTimeout */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- Convenience methods ---

  /** GET request */
  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path);
  }

  /** POST request */
  async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body);
  }

  /** DELETE request */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path);
  }
}
