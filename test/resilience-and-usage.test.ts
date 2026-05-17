import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retry,
  defaultShouldRetry,
  CircuitBreaker,
} from '../src/resilience';
import {
  getModelPricing,
  calculateCost,
  usageTracker,
} from '../src/usage-tracker';

describe('Resilience: retry()', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retry(fn, { initialDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient');
      return 'ok';
    });

    const result = await retry(fn, {
      maxAttempts: 5,
      initialDelayMs: 1,
      backoffMultiplier: 1,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(
      retry(fn, { maxAttempts: 3, initialDelayMs: 1, backoffMultiplier: 1 })
    ).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects shouldRetry predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('client error'));
    await expect(
      retry(fn, {
        maxAttempts: 5,
        initialDelayMs: 1,
        shouldRetry: () => false,
      })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('Resilience: defaultShouldRetry()', () => {
  it('retries on 429', () => {
    expect(defaultShouldRetry({ status: 429 })).toBe(true);
  });

  it('retries on 5xx', () => {
    expect(defaultShouldRetry({ status: 500 })).toBe(true);
    expect(defaultShouldRetry({ status: 503 })).toBe(true);
  });

  it('does not retry on 4xx (except 429)', () => {
    expect(defaultShouldRetry({ status: 400 })).toBe(false);
    expect(defaultShouldRetry({ status: 401 })).toBe(false);
    expect(defaultShouldRetry({ status: 404 })).toBe(false);
  });

  it('retries on network errors', () => {
    expect(defaultShouldRetry({ code: 'ECONNREFUSED' })).toBe(true);
    expect(defaultShouldRetry({ code: 'ETIMEDOUT' })).toBe(true);
  });
});

describe('Resilience: CircuitBreaker', () => {
  it('starts CLOSED', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens after threshold failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    const fail = () => Promise.reject(new Error('boom'));

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fail)).rejects.toThrow();
    }
    expect(cb.getState()).toBe('OPEN');
  });

  it('rejects fast when OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    const fail = () => Promise.reject(new Error('boom'));

    await expect(cb.execute(fail)).rejects.toThrow('boom');
    // Now circuit is OPEN
    await expect(cb.execute(fail)).rejects.toThrow(/Circuit breaker OPEN/);
  });

  it('transitions OPEN -> HALF_OPEN after timeout', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
    });

    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    await new Promise((r) => setTimeout(r, 80));
    // Successful call should close the circuit
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('reset() returns to CLOSED', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');
    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });
});

describe('Usage Tracker', () => {
  describe('getModelPricing', () => {
    it('returns pricing for known models', () => {
      const p = getModelPricing('gpt-4o');
      expect(p.input).toBeGreaterThan(0);
      expect(p.output).toBeGreaterThan(0);
    });

    it('matches model prefixes', () => {
      const p1 = getModelPricing('gpt-4o-2024-08-06');
      const p2 = getModelPricing('gpt-4o');
      expect(p1.input).toBe(p2.input);
    });

    it('returns zero for local models', () => {
      const p = getModelPricing('local-model');
      expect(p.input).toBe(0);
      expect(p.output).toBe(0);
    });

    it('falls back to mini pricing for unknown', () => {
      const p = getModelPricing('totally-unknown-model-xyz');
      expect(p.input).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateCost', () => {
    it('calculates cost correctly', () => {
      const cost = calculateCost('gpt-4o', {
        promptTokens: 1000,
        completionTokens: 1000,
        totalTokens: 2000,
      });
      // gpt-4o: input 0.0025, output 0.01 per 1K
      expect(cost).toBeCloseTo(0.0025 + 0.01, 5);
    });

    it('returns 0 for free models', () => {
      const cost = calculateCost('llama2', {
        promptTokens: 10000,
        completionTokens: 10000,
        totalTokens: 20000,
      });
      expect(cost).toBe(0);
    });
  });

  describe('usageTracker', () => {
    beforeEach(() => {
      usageTracker.resetSession('test-session');
    });

    afterEach(() => {
      usageTracker.resetSession('test-session');
    });

    it('records usage', () => {
      const session = usageTracker.record('test-session', 'gpt-4o-mini', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      expect(session.totalTokens).toBe(150);
      expect(session.requestCount).toBe(1);
      expect(session.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('accumulates across requests', () => {
      usageTracker.record('test-session', 'gpt-4o-mini', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      const session = usageTracker.record('test-session', 'gpt-4o-mini', {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
      });
      expect(session.totalTokens).toBe(450);
      expect(session.requestCount).toBe(2);
    });

    it('formatSessionSummary returns readable text', () => {
      usageTracker.record('test-session', 'gpt-4o-mini', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      const summary = usageTracker.formatSessionSummary('test-session');
      expect(summary).toContain('gpt-4o-mini');
      expect(summary).toContain('150');
    });
  });
});
