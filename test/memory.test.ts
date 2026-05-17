import { describe, it, expect, beforeEach } from 'vitest';
import { memoryStore, memoryAdd, memoryList, memorySearch, memoryRemove } from '../src/memory-tools';

describe('Memory System', () => {
  beforeEach(async () => {
    await memoryStore.clear();
  });

  describe('memoryAdd', () => {
    it('adds an entry', async () => {
      const result = await memoryAdd('User prefers concise responses', 'preference');
      expect(result.success).toBe(true);
      expect(result.output).toContain('preference');
    });

    it('deduplicates by content', async () => {
      await memoryAdd('Project uses pnpm', 'project');
      await memoryAdd('Project uses pnpm', 'project');
      const count = await memoryStore.count();
      expect(count).toBe(1);
    });

    it('rejects empty content', async () => {
      const result = await memoryAdd('', 'fact');
      expect(result.success).toBe(false);
    });

    it('defaults to fact category', async () => {
      await memoryAdd('Some random fact');
      const entries = await memoryStore.list();
      expect(entries[0].category).toBe('fact');
    });
  });

  describe('memoryList', () => {
    it('lists all entries', async () => {
      await memoryAdd('Fact 1', 'fact');
      await memoryAdd('Fact 2', 'project');
      const result = await memoryList();
      expect(result.success).toBe(true);
      expect(result.output).toContain('Fact 1');
      expect(result.output).toContain('Fact 2');
    });

    it('filters by category', async () => {
      await memoryAdd('A user fact', 'user');
      await memoryAdd('A project fact', 'project');
      const result = await memoryList('user');
      expect(result.output).toContain('A user fact');
      expect(result.output).not.toContain('A project fact');
    });

    it('handles empty memory', async () => {
      const result = await memoryList();
      expect(result.success).toBe(true);
      expect(result.output).toContain('No memory');
    });
  });

  describe('memorySearch', () => {
    it('finds matching entries', async () => {
      await memoryAdd('Project uses TypeScript', 'project');
      await memoryAdd('Project uses Python', 'project');
      const result = await memorySearch('TypeScript');
      expect(result.success).toBe(true);
      expect(result.output).toContain('TypeScript');
      expect(result.output).not.toContain('Python');
    });

    it('handles no matches', async () => {
      await memoryAdd('Some fact', 'fact');
      const result = await memorySearch('nonexistent-term');
      expect(result.output).toContain('No memory');
    });
  });

  describe('memoryRemove', () => {
    it('removes an entry by ID', async () => {
      const addResult = await memoryAdd('Remove me', 'fact');
      const idMatch = addResult.output.match(/\[([a-f0-9]+)\]/);
      const id = idMatch![1];

      const removeResult = await memoryRemove(id);
      expect(removeResult.success).toBe(true);
      expect(await memoryStore.count()).toBe(0);
    });

    it('fails on unknown ID', async () => {
      const result = await memoryRemove('nonexistent');
      expect(result.success).toBe(false);
    });
  });
});
