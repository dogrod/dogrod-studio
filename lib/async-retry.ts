/**
 * Generic async retry utility with exponential backoff and jitter.
 * Designed for background tasks like geocoding, AI tagging, etc.
 */

export type RetryOptions = {
  /** Maximum number of attempts (default: 5) */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff (default: 500) */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 10000) */
  maxDelayMs?: number;
  /** Context identifier for logging (e.g., photoId) */
  context?: Record<string, unknown>;
  /** Operation name for logging */
  operationName?: string;
};

export type RetryResult<T> =
  | { success: true; data: T; attempts: number }
  | { success: false; error: Error; attempts: number };

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10000;

/**
 * Computes delay with full jitter strategy.
 * Formula: random(0, min(cap, base * 2^attempt))
 */
function computeDelayWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  return Math.random() * cappedDelay;
}

/**
 * Sleeps for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an async function with retry logic using exponential backoff and jitter.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns RetryResult indicating success/failure with data or error
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetchFromApi(),
 *   { maxAttempts: 3, operationName: 'api-fetch', context: { id: '123' } }
 * );
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    context = {},
    operationName = 'operation',
  } = options;

  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await fn();

      if (attempt > 0) {
        console.info('[async-retry] Success after retry', {
          operationName,
          attempt: attempt + 1,
          totalAttempts: maxAttempts,
          ...context,
        });
      }

      return { success: true, data, attempts: attempt + 1 };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isLastAttempt = attempt === maxAttempts - 1;

      if (isLastAttempt) {
        console.error('[async-retry] All attempts exhausted', {
          operationName,
          attempt: attempt + 1,
          totalAttempts: maxAttempts,
          errorType: lastError.name,
          errorMessage: lastError.message,
          ...context,
        });
      } else {
        const delayMs = computeDelayWithJitter(attempt, baseDelayMs, maxDelayMs);

        console.info('[async-retry] Attempt failed, retrying', {
          operationName,
          attempt: attempt + 1,
          totalAttempts: maxAttempts,
          nextDelayMs: Math.round(delayMs),
          errorType: lastError.name,
          errorMessage: lastError.message,
          ...context,
        });

        await sleep(delayMs);
      }
    }
  }

  return { success: false, error: lastError, attempts: maxAttempts };
}

