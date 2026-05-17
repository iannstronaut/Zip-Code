import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { watchFile, stopWatch, listWatches, closeAllWatches } from '../src/watcher-tools';
import { mkdtemp, rm, writeFile as fsWriteFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Watcher Tools', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'zipcode-watcher-'));
  });

  afterEach(async () => {
    closeAllWatches();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('watchFile', () => {
    it('should start watching a directory', async () => {
      const result = await watchFile(testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('watch_');
    });

    it('should support recursive watching', async () => {
      const result = await watchFile(testDir, true);

      expect(result.success).toBe(true);
      expect(result.output).toContain('recursive: true');
    });

    it('should fail on non-existent path', async () => {
      const result = await watchFile(join(testDir, 'nonexistent'));

      expect(result.success).toBe(false);
    });
  });

  describe('listWatches', () => {
    it('should return empty when no watches active', async () => {
      const result = await listWatches();

      expect(result.success).toBe(true);
      expect(result.output).toContain('No active');
    });

    it('should list active watches', async () => {
      await watchFile(testDir);

      const result = await listWatches();

      expect(result.success).toBe(true);
      expect(result.output).toContain(testDir);
    });
  });

  describe('stopWatch', () => {
    it('should stop an active watch', async () => {
      const watchResult = await watchFile(testDir);
      const watchId = watchResult.output.match(/watch_\d+/)?.[0];

      expect(watchId).toBeDefined();

      const stopResult = await stopWatch(watchId!);

      expect(stopResult.success).toBe(true);
      expect(stopResult.output).toContain('Stopped');
    });

    it('should fail with invalid watch ID', async () => {
      const result = await stopWatch('invalid_id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('closeAllWatches', () => {
    it('should close all active watches', async () => {
      await watchFile(testDir);

      closeAllWatches();

      const result = await listWatches();
      expect(result.output).toContain('No active');
    });
  });
});
