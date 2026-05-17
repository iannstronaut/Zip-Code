// Token usage tracking and cost estimation

import { logger } from './logger';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface SessionUsage {
  sessionId: string;
  model: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  requestCount: number;
  startedAt: number;
  lastUpdatedAt: number;
}

/**
 * Pricing per 1K tokens in USD (as of late 2024 / early 2025).
 * Maintainers should keep this updated. Unknown models fall back to gpt-4o-mini pricing.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'o1-preview': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },

  // Anthropic (via OpenAI-compatible gateway)
  'claude-sonnet-4': { input: 0.003, output: 0.015 },
  'claude-opus-4': { input: 0.015, output: 0.075 },
  'claude-haiku-4': { input: 0.0008, output: 0.004 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku': { input: 0.0008, output: 0.004 },

  // Local models (free)
  'llama2': { input: 0, output: 0 },
  'llama3': { input: 0, output: 0 },
  'mistral': { input: 0, output: 0 },
  'codellama': { input: 0, output: 0 },
  'local-model': { input: 0, output: 0 },
};

/**
 * Look up pricing for a model. Falls back to a sensible default for unknown models.
 */
export function getModelPricing(model: string): { input: number; output: number } {
  // Exact match
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  // Prefix match (handles model versions like "gpt-4o-2024-08-06")
  const lowerModel = model.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (lowerModel.startsWith(key.toLowerCase())) return pricing;
  }

  // Fallback: assume gpt-4o-mini pricing (cheap)
  return { input: 0.00015, output: 0.0006 };
}

/**
 * Calculate cost in USD for a single request.
 */
export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = getModelPricing(model);
  const inputCost = (usage.promptTokens / 1000) * pricing.input;
  const outputCost = (usage.completionTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * In-memory tracker for the current run.
 * Persistent storage can layer on top via store.ts hooks.
 */
class UsageTracker {
  private sessions = new Map<string, SessionUsage>();

  /**
   * Record usage for a request.
   */
  record(sessionId: string, model: string, usage: TokenUsage): SessionUsage {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        model,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        requestCount: 0,
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };
      this.sessions.set(sessionId, session);
    }

    session.totalPromptTokens += usage.promptTokens;
    session.totalCompletionTokens += usage.completionTokens;
    session.totalTokens += usage.totalTokens;
    session.estimatedCostUsd += calculateCost(model, usage);
    session.requestCount += 1;
    session.lastUpdatedAt = Date.now();
    session.model = model; // last-used model

    logger.debug('Usage recorded', {
      session_id: sessionId,
      model,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      session_total_tokens: session.totalTokens,
      session_cost_usd: session.estimatedCostUsd.toFixed(4),
    });

    return session;
  }

  /**
   * Get usage for a session.
   */
  getSession(sessionId: string): SessionUsage | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions in this run.
   */
  getAllSessions(): SessionUsage[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Aggregate stats across all sessions.
   */
  getTotals(): {
    totalRequests: number;
    totalTokens: number;
    totalCostUsd: number;
    sessionCount: number;
  } {
    let totalRequests = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    this.sessions.forEach((s) => {
      totalRequests += s.requestCount;
      totalTokens += s.totalTokens;
      totalCostUsd += s.estimatedCostUsd;
    });

    return {
      totalRequests,
      totalTokens,
      totalCostUsd,
      sessionCount: this.sessions.size,
    };
  }

  /**
   * Reset usage for a session.
   */
  resetSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Format a summary for display.
   */
  formatSessionSummary(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return 'No usage recorded for this session.';

    const lines = [
      `Session: ${session.sessionId}`,
      `Model: ${session.model}`,
      `Requests: ${session.requestCount}`,
      `Prompt tokens: ${session.totalPromptTokens.toLocaleString()}`,
      `Completion tokens: ${session.totalCompletionTokens.toLocaleString()}`,
      `Total tokens: ${session.totalTokens.toLocaleString()}`,
      `Estimated cost: $${session.estimatedCostUsd.toFixed(4)} USD`,
    ];
    return lines.join('\n');
  }
}

export const usageTracker = new UsageTracker();
