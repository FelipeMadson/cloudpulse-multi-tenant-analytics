// =========================================================================
// Exponential Backoff with Full Jitter (AWS Best Practice)
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export class RetryPolicy {
  public static async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const baseDelay = options.baseDelayMs ?? 100;
    const maxDelay = options.maxDelayMs ?? 2000;
    const shouldRetry = options.shouldRetry ?? (() => true);

    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (err) {
        attempt++;
        if (attempt > maxRetries || !shouldRetry(err)) {
          throw err;
        }

        // Full Jitter: Sleep = rand(0, min(maxDelay, baseDelay * 2^attempt))
        const exponentialBound = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
        const sleepMs = Math.floor(Math.random() * exponentialBound);
        await new Promise(res => setTimeout(res, sleepMs));
      }
    }
  }
}
