// Resilience utilities: retry with exponential backoff + circuit breaker

import { logger } from './logger';

export interface RetryOptions {
  /** Max number of attempts (including the first). Default 3. */
  maxAttempts?: number;
  /** Initial delay in ms. Default 500. */
  initialDelayMs?: number;
  /** Multiplier for exponential backoff. Default 2. */
  backoffMultiplier?: number;
  /** Max delay between attempts in ms. Default 30000. */
  maxDelayMs?: number;
  /** Add random jitter (0-100ms) to prevent thundering herd. Default true. */
  jitter?: boolean;
  /** Predicate: should this error be retried? Default: retry on any error. */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Optional label for logging. */
  label?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'label'>> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  jitter: true,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retry predicate — retries on network errors and 5xx, not on 4xx (except 429).
 */
export function defaultShouldRetry(error: any): boolean {
  // Network errors
  if (error?.code === 'ECONNREFUSED') return true;
  if (error?.code === 'ETIMEDOUT') return true;
  if (error?.code === 'ECONNRESET') return true;
  if (error?.code === 'ENOTFOUND') return true;

  // OpenAI/HTTP errors
  const status = error?.status || error?.response?.status;
  if (typeof status === 'number') {
    // 429 (rate limit) - retry
    if (status === 429) return true;
    // 5xx server errors - retry
    if (status >= 500 && status < 600) return true;
    // 4xx client errors - don't retry (except 429)
    if (status >= 400 && status < 500) return false;
  }

  // Default: retry on unknown errors
  return true;
}

/**
 * Run a function with exponential backoff retry.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = options.shouldRetry || defaultShouldRetry;
  const label = options.label || 'operation';

  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const isLastAttempt = attempt === opts.maxAttempts;
      const retryable = shouldRetry(error, attempt);

      if (isLastAttempt || !retryable) {
        logger.warn(`${label} failed`, {
          attempt,
          maxAttempts: opts.maxAttempts,
          retryable,
          error_message: error?.message,
        });
        throw error;
      }

      // Calculate next delay
      let nextDelay = delay;
      if (opts.jitter) {
        nextDelay += Math.floor(Math.random() * 100);
      }
      nextDelay = Math.min(nextDelay, opts.maxDelayMs);

      logger.info(`${label} retry`, {
        attempt,
        next_attempt_in_ms: nextDelay,
        error_message: error?.message,
      });

      await sleep(nextDelay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Circuit breaker states:
 *   CLOSED  - normal operation, requests flow through
 *   OPEN    - failing fast, requests rejected immediately
 *   HALF_OPEN - testing recovery, allows one request through
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Failures before opening circuit. Default 5. */
  failureThreshold?: number;
  /** Time before allowing a test request (ms). Default 30000. */
  resetTimeoutMs?: number;
  /** Optional label for logging. */
  label?: string;
}

/**
 * Circuit breaker - stops hammering a failing service after N consecutive failures.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly label: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.label = options.label ?? 'circuit';
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition OPEN -> HALF_OPEN
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        logger.info(`${this.label}: OPEN -> HALF_OPEN`, { elapsed_ms: elapsed });
        this.state = 'HALF_OPEN';
      } else {
        const error = new Error(
          `Circuit breaker OPEN for ${this.label}. Retry in ${this.resetTimeoutMs - elapsed}ms.`
        );
        (error as any).code = 'CIRCUIT_OPEN';
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info(`${this.label}: HALF_OPEN -> CLOSED (recovered)`);
    }
    this.state = 'CLOSED';
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      logger.warn(`${this.label}: HALF_OPEN -> OPEN (test failed)`);
      this.state = 'OPEN';
    } else if (this.failures >= this.failureThreshold) {
      logger.warn(`${this.label}: CLOSED -> OPEN`, {
        failures: this.failures,
        threshold: this.failureThreshold,
      });
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}
