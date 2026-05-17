import { describe, it, expect, beforeEach } from 'vitest';
import { hookManager, registerAuditHook, registerValidationHook } from '../src/hooks';

describe('Hooks', () => {
  beforeEach(() => {
    hookManager.clear();
  });

  describe('register and run', () => {
    it('runs registered hooks for matching events', async () => {
      let called = false;
      hookManager.register({
        event: 'pre-tool',
        fn: () => {
          called = true;
        },
      });

      await hookManager.run({ event: 'pre-tool', toolName: 'read_file' });
      expect(called).toBe(true);
    });

    it('does not run hooks for non-matching events', async () => {
      let called = false;
      hookManager.register({
        event: 'pre-message',
        fn: () => {
          called = true;
        },
      });

      await hookManager.run({ event: 'pre-tool' });
      expect(called).toBe(false);
    });

    it('respects toolFilter as string', async () => {
      let called = false;
      hookManager.register({
        event: 'pre-tool',
        toolFilter: 'execute_bash',
        fn: () => {
          called = true;
        },
      });

      await hookManager.run({ event: 'pre-tool', toolName: 'read_file' });
      expect(called).toBe(false);

      await hookManager.run({ event: 'pre-tool', toolName: 'execute_bash' });
      expect(called).toBe(true);
    });

    it('respects toolFilter as regex', async () => {
      let count = 0;
      hookManager.register({
        event: 'pre-tool',
        toolFilter: /^git_/,
        fn: () => {
          count++;
        },
      });

      await hookManager.run({ event: 'pre-tool', toolName: 'read_file' });
      await hookManager.run({ event: 'pre-tool', toolName: 'git_status' });
      await hookManager.run({ event: 'pre-tool', toolName: 'git_commit' });
      expect(count).toBe(2);
    });
  });

  describe('blocking', () => {
    it('aggregates block result from any hook', async () => {
      hookManager.register({
        event: 'pre-tool',
        fn: () => ({ block: true, blockReason: 'nope' }),
      });

      const result = await hookManager.run({ event: 'pre-tool', toolName: 'foo' });
      expect(result.block).toBe(true);
      expect(result.blockReason).toBe('nope');
    });

    it('rewrites args via hook', async () => {
      hookManager.register({
        event: 'pre-tool',
        fn: () => ({ rewriteArgs: { rewritten: true } }),
      });

      const ctx: any = { event: 'pre-tool', toolName: 'foo', args: { original: 1 } };
      const result = await hookManager.run(ctx);
      expect(result.rewriteArgs).toEqual({ rewritten: true });
      expect(ctx.args).toEqual({ rewritten: true });
    });
  });

  describe('error handling', () => {
    it('does not break on hook errors', async () => {
      hookManager.register({
        event: 'pre-tool',
        fn: () => {
          throw new Error('boom');
        },
      });

      let nextCalled = false;
      hookManager.register({
        event: 'pre-tool',
        fn: () => {
          nextCalled = true;
        },
      });

      const result = await hookManager.run({ event: 'pre-tool' });
      expect(result.block).toBeUndefined();
      expect(nextCalled).toBe(true);
    });
  });

  describe('list and unregister', () => {
    it('lists registered hooks without exposing fn', async () => {
      hookManager.register({ event: 'pre-tool', label: 'a', fn: () => {} });
      hookManager.register({ event: 'post-tool', label: 'b', fn: () => {} });

      const list = hookManager.list();
      expect(list).toHaveLength(2);
      expect((list[0] as any).fn).toBeUndefined();
      expect(list[0].label).toBe('a');
    });

    it('unregisters by id', async () => {
      const id = hookManager.register({ event: 'pre-tool', fn: () => {} });
      expect(hookManager.list()).toHaveLength(1);
      const removed = hookManager.unregister(id);
      expect(removed).toBe(true);
      expect(hookManager.list()).toHaveLength(0);
    });
  });

  describe('built-in hook factories', () => {
    it('registerAuditHook attaches a post-tool hook', () => {
      const id = registerAuditHook();
      const hooks = hookManager.list();
      expect(hooks).toHaveLength(1);
      expect(hooks[0].event).toBe('post-tool');
      hookManager.unregister(id);
    });

    it('registerValidationHook blocks on invalid args', async () => {
      registerValidationHook(
        'execute_bash',
        (args) => (!args.command ? 'command required' : null)
      );

      const result = await hookManager.run({
        event: 'pre-tool',
        toolName: 'execute_bash',
        args: {},
      });
      expect(result.block).toBe(true);
      expect(result.blockReason).toBe('command required');
    });

    it('validation hook allows valid args through', async () => {
      registerValidationHook(
        'execute_bash',
        (args) => (!args.command ? 'command required' : null)
      );

      const result = await hookManager.run({
        event: 'pre-tool',
        toolName: 'execute_bash',
        args: { command: 'ls' },
      });
      expect(result.block).toBeUndefined();
    });
  });
});
