// Hook/middleware system - intercept tool execution and messages.
//
// Hooks are user-defined async functions that fire at specific points in the
// agent lifecycle. They can:
//   - inspect arguments and results
//   - mutate or block tool calls (pre-tool can return { block: true })
//   - log, audit, or trigger side-effects
//
// Hooks are registered with hookManager.register() and run in the order they
// were registered. Errors in hooks are logged but do not break the agent.

import { logger } from './logger';
import type { ToolResult } from './types';

export type HookEvent =
  | 'pre-tool'
  | 'post-tool'
  | 'pre-message'
  | 'post-message'
  | 'session-start'
  | 'session-end';

export interface HookContext {
  /** Event that fired this hook. */
  event: HookEvent;
  /** Tool name (for pre-tool / post-tool). */
  toolName?: string;
  /** Tool arguments (for pre-tool). Mutable - hook can rewrite. */
  args?: any;
  /** Tool result (for post-tool). */
  result?: ToolResult;
  /** Message content (for pre-message / post-message). */
  message?: string;
  /** Session ID. */
  sessionId?: string;
  /** Arbitrary metadata. */
  metadata?: Record<string, any>;
}

export interface HookResult {
  /** If true, blocks the tool execution (pre-tool only). */
  block?: boolean;
  /** Reason for blocking (shown to the agent as the tool error). */
  blockReason?: string;
  /** Optional rewritten args (pre-tool only). */
  rewriteArgs?: any;
}

export type HookFn = (ctx: HookContext) => Promise<HookResult | void> | HookResult | void;

export interface RegisteredHook {
  id: string;
  event: HookEvent;
  /** Optional tool name filter (only fires for matching tools). */
  toolFilter?: string | RegExp;
  fn: HookFn;
  /** Optional human-readable label for logs. */
  label?: string;
}

class HookManager {
  private hooks: RegisteredHook[] = [];
  private nextId = 1;

  /** Register a new hook. Returns the hook ID for later removal. */
  register(hook: Omit<RegisteredHook, 'id'>): string {
    const id = `hook_${this.nextId++}`;
    this.hooks.push({ ...hook, id });
    logger.debug('Hook registered', {
      id,
      event: hook.event,
      label: hook.label,
    });
    return id;
  }

  /** Unregister a hook by ID. */
  unregister(id: string): boolean {
    const idx = this.hooks.findIndex((h) => h.id === id);
    if (idx === -1) return false;
    this.hooks.splice(idx, 1);
    return true;
  }

  /** List all registered hooks. */
  list(): Array<Omit<RegisteredHook, 'fn'>> {
    return this.hooks.map(({ fn, ...rest }) => rest);
  }

  /** Clear all hooks. Useful for tests. */
  clear(): void {
    this.hooks = [];
  }

  /**
   * Run all hooks matching this event. Returns an aggregate result that
   * combines block flags and rewritten args from all hooks.
   */
  async run(ctx: HookContext): Promise<HookResult> {
    const matching = this.hooks.filter((h) => {
      if (h.event !== ctx.event) return false;
      if (!h.toolFilter || !ctx.toolName) return true;
      if (typeof h.toolFilter === 'string') {
        return h.toolFilter === ctx.toolName;
      }
      return h.toolFilter.test(ctx.toolName);
    });

    let aggregate: HookResult = {};

    for (const hook of matching) {
      try {
        const result = await Promise.resolve(hook.fn(ctx));
        if (!result) continue;
        if (result.block) {
          aggregate.block = true;
          aggregate.blockReason = result.blockReason || `Blocked by ${hook.label || hook.id}`;
        }
        if (result.rewriteArgs !== undefined) {
          ctx.args = result.rewriteArgs;
          aggregate.rewriteArgs = result.rewriteArgs;
        }
      } catch (e: any) {
        // Hook errors are logged but never break the agent
        logger.error(`Hook '${hook.label || hook.id}' threw`, e, {
          event: ctx.event,
          toolName: ctx.toolName,
        });
      }
    }

    return aggregate;
  }
}

export const hookManager = new HookManager();

// ──────────── built-in hooks ────────────

/**
 * Audit log hook - records every tool call to the logger.
 * Register with: registerAuditHook()
 */
export function registerAuditHook(): string {
  return hookManager.register({
    event: 'post-tool',
    label: 'audit-log',
    fn: (ctx) => {
      logger.info('Tool executed', {
        tool: ctx.toolName,
        success: ctx.result?.success,
        argsKeys: ctx.args ? Object.keys(ctx.args) : [],
      });
    },
  });
}

/**
 * Confirmation hook - blocks dangerous tools and asks for confirmation.
 * Caller passes a confirm function (e.g. opens a TUI prompt).
 */
export function registerConfirmHook(
  toolPattern: string | RegExp,
  confirm: (ctx: HookContext) => Promise<boolean>,
  label = 'confirm'
): string {
  return hookManager.register({
    event: 'pre-tool',
    toolFilter: toolPattern,
    label,
    fn: async (ctx) => {
      const ok = await confirm(ctx);
      if (!ok) {
        return { block: true, blockReason: 'User declined' };
      }
    },
  });
}

/**
 * Argument validator hook - block tools whose args fail a predicate.
 */
export function registerValidationHook(
  toolName: string,
  validate: (args: any) => string | null,
  label?: string
): string {
  return hookManager.register({
    event: 'pre-tool',
    toolFilter: toolName,
    label: label || `validate-${toolName}`,
    fn: (ctx) => {
      const err = validate(ctx.args);
      if (err) {
        return { block: true, blockReason: err };
      }
    },
  });
}
