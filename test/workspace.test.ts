import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile as fsWriteFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  findContextFile,
  loadWorkspaceContext,
  formatContextForPrompt,
} from '../src/workspace';

describe('Workspace Context', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'zipcode-ws-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('findContextFile', () => {
    it('returns null when no context file exists', () => {
      const result = findContextFile(testDir);
      expect(result).toBeNull();
    });

    it('finds .zipcoderc in current dir', async () => {
      const file = join(testDir, '.zipcoderc');
      await fsWriteFile(file, 'project info');
      const result = findContextFile(testDir);
      expect(result).toBe(file);
    });

    it('finds AGENTS.md', async () => {
      const file = join(testDir, 'AGENTS.md');
      await fsWriteFile(file, '# Agents');
      const result = findContextFile(testDir);
      expect(result).toBe(file);
    });

    it('walks up directory tree', async () => {
      const subdir = join(testDir, 'sub', 'deep');
      await mkdir(subdir, { recursive: true });
      const file = join(testDir, '.zipcoderc');
      await fsWriteFile(file, 'project');

      const result = findContextFile(subdir);
      expect(result).toBe(file);
    });

    it('prefers .zipcoderc over AGENTS.md if both exist', async () => {
      await fsWriteFile(join(testDir, 'AGENTS.md'), 'agents');
      await fsWriteFile(join(testDir, '.zipcoderc'), 'rc');

      const result = findContextFile(testDir);
      expect(result).toContain('.zipcoderc');
    });
  });

  describe('loadWorkspaceContext', () => {
    it('returns null when no file', async () => {
      const result = await loadWorkspaceContext(testDir);
      expect(result).toBeNull();
    });

    it('loads file content', async () => {
      await fsWriteFile(
        join(testDir, '.zipcoderc'),
        '# My project\nUse pnpm not npm'
      );
      const result = await loadWorkspaceContext(testDir);
      expect(result).not.toBeNull();
      expect(result!.content).toContain('Use pnpm');
    });

    it('parses frontmatter', async () => {
      const fm = `---
name: my-app
language: TypeScript
test: pnpm test
build: pnpm build
---

Project notes here.`;
      await fsWriteFile(join(testDir, '.zipcoderc'), fm);
      const result = await loadWorkspaceContext(testDir);
      expect(result).not.toBeNull();
      expect(result!.metadata.name).toBe('my-app');
      expect(result!.metadata.language).toBe('TypeScript');
      expect(result!.metadata.testCommand).toBe('pnpm test');
      expect(result!.metadata.buildCommand).toBe('pnpm build');
      expect(result!.content).toContain('Project notes');
    });

    it('handles file with no frontmatter', async () => {
      await fsWriteFile(join(testDir, '.zipcoderc'), 'plain content');
      const result = await loadWorkspaceContext(testDir);
      expect(result!.metadata).toEqual({});
      expect(result!.content).toBe('plain content');
    });
  });

  describe('formatContextForPrompt', () => {
    it('formats metadata and content', () => {
      const ctx = {
        source: '/tmp/test',
        content: 'Project notes',
        metadata: {
          name: 'test',
          language: 'TS',
          testCommand: 'npm test',
        },
      };
      const formatted = formatContextForPrompt(ctx);
      expect(formatted).toContain('WORKSPACE CONTEXT');
      expect(formatted).toContain('Project: test');
      expect(formatted).toContain('Language: TS');
      expect(formatted).toContain('Test: npm test');
      expect(formatted).toContain('Project notes');
    });

    it('handles empty metadata gracefully', () => {
      const ctx = {
        source: '/tmp/test',
        content: 'just notes',
        metadata: {},
      };
      const formatted = formatContextForPrompt(ctx);
      expect(formatted).toContain('just notes');
    });
  });
});
