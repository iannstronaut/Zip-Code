import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  analyzeComplexity,
  findTodos,
  analyzeDependencies,
  countLines,
} from '../src/code-analysis-tools';
import { mkdtemp, rm, writeFile as fsWriteFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Code Analysis Tools', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'zipcode-analysis-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('analyzeComplexity', () => {
    it('should analyze TypeScript files', async () => {
      await fsWriteFile(
        join(testDir, 'sample.ts'),
        'function test() {\n  return 1;\n}\n'
      );

      const result = await analyzeComplexity(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should handle empty directory', async () => {
      const result = await analyzeComplexity(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('No code files');
    });
  });

  describe('findTodos', () => {
    it('should find TODO comments', async () => {
      await fsWriteFile(
        join(testDir, 'todo-test.ts'),
        '// TODO: Implement this\n// FIXME: Bug here\nconst x = 1;\n'
      );

      const result = await findTodos(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('TODO');
    });

    it('should categorize comments', async () => {
      await fsWriteFile(
        join(testDir, 'mixed.ts'),
        '// TODO: task\n// FIXME: bug\n// HACK: workaround\n// NOTE: info\n'
      );

      const result = await findTodos(testDir);

      expect(result.success).toBe(true);
    });

    it('should handle directory with no annotations', async () => {
      await fsWriteFile(join(testDir, 'clean.ts'), 'const x = 1;\n');

      const result = await findTodos(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('No');
    });
  });

  describe('analyzeDependencies', () => {
    it('should analyze package.json', async () => {
      const pkg = {
        name: 'test',
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      };
      await fsWriteFile(join(testDir, 'package.json'), JSON.stringify(pkg));

      const result = await analyzeDependencies(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('react');
      expect(result.output).toContain('typescript');
    });

    it('should analyze requirements.txt', async () => {
      await fsWriteFile(
        join(testDir, 'requirements.txt'),
        'django==4.2.0\nflask>=2.0\n'
      );

      const result = await analyzeDependencies(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('django');
    });

    it('should handle no dependency files', async () => {
      const result = await analyzeDependencies(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('No dependency');
    });
  });

  describe('countLines', () => {
    it('should count lines in TypeScript files', async () => {
      await fsWriteFile(
        join(testDir, 'a.ts'),
        'line1\nline2\nline3\n'
      );
      await fsWriteFile(join(testDir, 'b.ts'), 'line1\nline2\n');

      const result = await countLines(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Total');
    });

    it('should handle empty directory', async () => {
      const result = await countLines(testDir);

      expect(result.success).toBe(true);
    });
  });
});
