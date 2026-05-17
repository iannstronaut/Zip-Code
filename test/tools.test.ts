import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, listDir, executeBash } from '../src/tools';
import { mkdtemp, rm, writeFile as fsWriteFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Tools', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'zipcode-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('should read file contents successfully', async () => {
      const testFile = join(testDir, 'test.txt');
      await fsWriteFile(testFile, 'Hello World');

      const result = await readFile(testFile);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello World');
    });

    it('should handle non-existent files', async () => {
      const result = await readFile(join(testDir, 'nonexistent.txt'));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('writeFile', () => {
    it('should write file successfully', async () => {
      const testFile = join(testDir, 'output.txt');
      const content = 'Test content';

      const result = await writeFile(testFile, content);

      expect(result.success).toBe(true);
      expect(result.output).toContain('written');
    });

    it('should create parent directories', async () => {
      const nestedFile = join(testDir, 'nested', 'deep', 'file.txt');

      const result = await writeFile(nestedFile, 'content');

      expect(result.success).toBe(true);
    });
  });

  describe('listDir', () => {
    it('should list directory contents', async () => {
      await fsWriteFile(join(testDir, 'file1.txt'), '');
      await fsWriteFile(join(testDir, 'file2.txt'), '');

      const result = await listDir(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('file2.txt');
    });

    it('should handle non-existent directories', async () => {
      const result = await listDir(join(testDir, 'nonexistent'));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('executeBash', () => {
    it('should execute simple commands', async () => {
      const result = await executeBash('echo "test"');

      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    });

    it('should handle command errors', async () => {
      const result = await executeBash('nonexistent-command-xyz-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
