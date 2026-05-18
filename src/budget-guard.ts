// Budget guard - hard caps on spend and tokens per session.
//
// Pairs with usage-tracker.ts (which records what's actually been used).
// This module enforces limits: when threshold is hit, future LLM/tool calls
// can be denied.
//
// Limits are configured via env or programmatically:
//   ZIPCODE_BUDGET_USD=5.00          → stop after $5 spent in this session
//   ZIPCODE_BUDGET_TOKENS=200000     → stop after 200k tokens consumed
//   ZIPCODE_BUDGET_TOOLCALLS=200     → stop after 200 tool invocations
//
// Soft warnings fire at 75% and 90% of each limit.

import { logger } from './logger.js';

export interface BudgetLimits {
  usd?: number;
  tokens?: number;
  toolCalls?: number;
}

export interface BudgetState {
  usdSpent: number;
  tokensUsed: number;
  toolCallsMade: number;
  limits: BudgetLimits;
  warningsFired: Set<string>;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
}

class BudgetGuard {
  private state: BudgetState = {
    usdSpent: 0,
    tokensUsed: 0,
    toolCallsMade: 0,
    limits: this.loadFromEnv(),
    warningsFired: new Set(),
  };

  private loadFromEnv(): BudgetLimits {
    const limits: BudgetLimits = {};
    const usd = parseFloat(process.env.ZIPCODE_BUDGET_USD || '');
    const tokens = parseInt(process.env.ZIPCODE_BUDGET_TOKENS || '', 10);
    const toolCalls = parseInt(process.env.ZIPCODE_BUDGET_TOOLCALLS || '', 10);
    if (Number.isFinite(usd) && usd > 0) limits.usd = usd;
    if (Number.isFinite(tokens) && tokens > 0) limits.tokens = tokens;
    if (Number.isFinite(toolCalls) && toolCalls > 0) limits.toolCalls = toolCalls;
    return limits;
  }

  /** Override limits programmatically. */
  setLimits(limits: BudgetLimits): void {
    this.state.limits = { ...this.state.limits, ...limits };
    logger.info('Budget limits updated', { limits: this.state.limits });
  }

  /** Reset all counters and warnings. Useful at session start. */
  reset(): void {
    this.state.usdSpent = 0;
    this.state.tokensUsed = 0;
    this.state.toolCallsMade = 0;
    this.state.warningsFired.clear();
  }

  /** Record actual spend - call this after each LLM response. */
  recordSpend(usdDelta: number, tokenDelta: number): void {
    this.state.usdSpent += usdDelta;
    this.state.tokensUsed += tokenDelta;
  }

  /** Record a tool call. */
  recordToolCall(): void {
    this.state.toolCallsMade += 1;
  }

  /**
   * Check whether the next operation is allowed under current limits.
   * Pass projected delta to verify it won't push you over.
   */
  check(projectedUsd = 0, projectedTokens = 0, projectedToolCalls = 0): BudgetCheckResult {
    const { limits } = this.state;
    const warnings: string[] = [];

    const checks: Array<{ key: string; current: number; limit?: number; label: string }> = [
      {
        key: 'usd',
        current: this.state.usdSpent + projectedUsd,
        limit: limits.usd,
        label: `$${(this.state.usdSpent + projectedUsd).toFixed(4)}/$${limits.usd?.toFixed(2)}`,
      },
      {
        key: 'tokens',
        current: this.state.tokensUsed + projectedTokens,
        limit: limits.tokens,
        label: `${this.state.tokensUsed + projectedTokens}/${limits.tokens} tokens`,
      },
      {
        key: 'toolCalls',
        current: this.state.toolCallsMade + projectedToolCalls,
        limit: limits.toolCalls,
        label: `${this.state.toolCallsMade + projectedToolCalls}/${limits.toolCalls} tool calls`,
      },
    ];

    for (const c of checks) {
      if (!c.limit) continue;
      if (c.current >= c.limit) {
        return {
          allowed: false,
          reason: `Budget limit reached: ${c.label}. Increase ZIPCODE_BUDGET_${c.key.toUpperCase()} or call BudgetGuard.reset().`,
          warnings,
        };
      }
      const ratio = c.current / c.limit;
      const warnKey = `${c.key}-90`;
      const softKey = `${c.key}-75`;
      if (ratio >= 0.9 && !this.state.warningsFired.has(warnKey)) {
        warnings.push(`Budget ${c.key} at 90%: ${c.label}`);
        this.state.warningsFired.add(warnKey);
        // Skip the 75% warning - we've already passed it
        this.state.warningsFired.add(softKey);
      } else if (ratio >= 0.75 && !this.state.warningsFired.has(softKey)) {
        warnings.push(`Budget ${c.key} at 75%: ${c.label}`);
        this.state.warningsFired.add(softKey);
      }
    }

    return { allowed: true, warnings };
  }

  /** Get a snapshot of the current state (for status display). */
  snapshot(): {
    usdSpent: number;
    tokensUsed: number;
    toolCallsMade: number;
    limits: BudgetLimits;
    percentages: Record<string, number>;
  } {
    const { limits } = this.state;
    const percentages: Record<string, number> = {};
    if (limits.usd) percentages.usd = (this.state.usdSpent / limits.usd) * 100;
    if (limits.tokens) percentages.tokens = (this.state.tokensUsed / limits.tokens) * 100;
    if (limits.toolCalls)
      percentages.toolCalls = (this.state.toolCallsMade / limits.toolCalls) * 100;
    return {
      usdSpent: this.state.usdSpent,
      tokensUsed: this.state.tokensUsed,
      toolCallsMade: this.state.toolCallsMade,
      limits: { ...limits },
      percentages,
    };
  }

  /** Returns true if any limit is configured. */
  isActive(): boolean {
    const { limits } = this.state;
    return !!(limits.usd || limits.tokens || limits.toolCalls);
  }
}

export const budgetGuard = new BudgetGuard();
