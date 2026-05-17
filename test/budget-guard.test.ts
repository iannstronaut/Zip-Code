import { describe, it, expect, beforeEach } from 'vitest';
import { budgetGuard } from '../src/budget-guard';

describe('Budget Guard', () => {
  beforeEach(() => {
    budgetGuard.reset();
    budgetGuard.setLimits({ usd: undefined, tokens: undefined, toolCalls: undefined });
  });

  describe('limits', () => {
    it('allows operations when no limits are set', () => {
      const result = budgetGuard.check();
      expect(result.allowed).toBe(true);
    });

    it('blocks when usd limit is reached', () => {
      budgetGuard.setLimits({ usd: 1.0 });
      budgetGuard.recordSpend(1.0, 0);
      const result = budgetGuard.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Budget limit');
    });

    it('blocks when token limit is reached', () => {
      budgetGuard.setLimits({ tokens: 1000 });
      budgetGuard.recordSpend(0, 1000);
      const result = budgetGuard.check();
      expect(result.allowed).toBe(false);
    });

    it('blocks when tool call limit is reached', () => {
      budgetGuard.setLimits({ toolCalls: 3 });
      budgetGuard.recordToolCall();
      budgetGuard.recordToolCall();
      budgetGuard.recordToolCall();
      const result = budgetGuard.check();
      expect(result.allowed).toBe(false);
    });

    it('considers projected delta when checking', () => {
      budgetGuard.setLimits({ usd: 1.0 });
      budgetGuard.recordSpend(0.5, 0);
      const result = budgetGuard.check(0.6);
      expect(result.allowed).toBe(false);
    });
  });

  describe('warnings', () => {
    it('fires warning at 75%', () => {
      budgetGuard.setLimits({ usd: 1.0 });
      budgetGuard.recordSpend(0.75, 0);
      const result = budgetGuard.check();
      expect(result.warnings.some((w) => w.includes('75%'))).toBe(true);
    });

    it('fires warning at 90%', () => {
      budgetGuard.setLimits({ usd: 1.0 });
      budgetGuard.recordSpend(0.9, 0);
      const result = budgetGuard.check();
      expect(result.warnings.some((w) => w.includes('90%'))).toBe(true);
    });

    it('does not refire the same warning', () => {
      budgetGuard.setLimits({ usd: 1.0 });
      budgetGuard.recordSpend(0.9, 0);
      const first = budgetGuard.check();
      const second = budgetGuard.check();
      expect(first.warnings.length).toBeGreaterThan(0);
      // Second call should fire fewer warnings than the first
      expect(second.warnings.length).toBeLessThan(first.warnings.length);
    });
  });

  describe('snapshot', () => {
    it('returns current state and percentages', () => {
      budgetGuard.setLimits({ usd: 10, tokens: 1000, toolCalls: 100 });
      budgetGuard.recordSpend(2.5, 250);
      budgetGuard.recordToolCall();
      budgetGuard.recordToolCall();

      const snap = budgetGuard.snapshot();
      expect(snap.usdSpent).toBe(2.5);
      expect(snap.tokensUsed).toBe(250);
      expect(snap.toolCallsMade).toBe(2);
      expect(snap.percentages.usd).toBe(25);
      expect(snap.percentages.tokens).toBe(25);
      expect(snap.percentages.toolCalls).toBe(2);
    });
  });

  describe('isActive', () => {
    it('returns false when no limits set', () => {
      expect(budgetGuard.isActive()).toBe(false);
    });

    it('returns true when at least one limit is set', () => {
      budgetGuard.setLimits({ usd: 1 });
      expect(budgetGuard.isActive()).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears counters and warnings', () => {
      budgetGuard.setLimits({ usd: 1.0 });
      budgetGuard.recordSpend(0.5, 100);
      budgetGuard.recordToolCall();
      budgetGuard.reset();

      const snap = budgetGuard.snapshot();
      expect(snap.usdSpent).toBe(0);
      expect(snap.tokensUsed).toBe(0);
      expect(snap.toolCallsMade).toBe(0);
    });
  });
});
