/**
 * Error classification for PriceLabs API failures.
 *
 * Three error types with distinct retry/severity semantics:
 * - RateLimitError: retryable after delay (token bucket or 429)
 * - AuthError: never retryable, immediate alert (401)
 * - ApiError: retryable depending on status code (5xx yes, 4xx no)
 */
/**
 * Thrown when the token bucket rate limiter denies a request,
 * or when the API returns 429 Too Many Requests.
 */
export declare class RateLimitError extends Error {
    readonly retryAfterMs: number;
    constructor(retryAfterMs: number, message?: string);
}
/**
 * Thrown on 401 Unauthorized responses.
 * Critical severity -- locked decision: immediate alert, never retry.
 * API key is never included in the error message for security.
 */
export declare class AuthError extends Error {
    constructor(message?: string);
}
/**
 * Thrown for non-auth API failures (400, 404, 500, etc.).
 * Carries the HTTP status code and response body for diagnostics.
 */
export declare class ApiError extends Error {
    readonly statusCode: number;
    readonly body: string;
    constructor(statusCode: number, body: string, message?: string);
}
/**
 * Determine if an error is retryable.
 *
 * Retryable: RateLimitError, ApiError with 429/5xx status codes.
 * Not retryable: AuthError (never), ApiError with 4xx (client errors).
 *
 * @param error - Any caught error
 * @returns true if the operation should be retried
 */
export declare function isRetryable(error: unknown): boolean;
