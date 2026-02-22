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
export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, message?: string) {
    super(message ?? `Rate limited. Retry after ${retryAfterMs}ms`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown on 401 Unauthorized responses.
 * Critical severity -- locked decision: immediate alert, never retry.
 * API key is never included in the error message for security.
 */
export class AuthError extends Error {
  constructor(message?: string) {
    super(message ?? "Authentication failed. Check PRICELABS_API_KEY.");
    this.name = "AuthError";
  }
}

/**
 * Thrown for non-auth API failures (400, 404, 500, etc.).
 * Carries the HTTP status code and response body for diagnostics.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly body: string;

  constructor(statusCode: number, body: string, message?: string) {
    super(
      message ?? `API error ${statusCode}: ${body.slice(0, 200)}`
    );
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
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
export function isRetryable(error: unknown): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof AuthError) {
    return false;
  }

  if (error instanceof ApiError) {
    const retryableStatuses = [429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.statusCode);
  }

  return false;
}
