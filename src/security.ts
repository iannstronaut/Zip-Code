// Security utilities for ZIP CODE

import { resolve, normalize } from 'path';
import { homedir } from 'os';

/**
 * Validate and sanitize file paths to prevent directory traversal attacks
 */
export function sanitizePath(inputPath: string, baseDir?: string): string {
  const base = baseDir || process.cwd();
  const resolved = resolve(base, inputPath);
  const normalized = normalize(resolved);

  // Ensure the path is within the base directory
  if (!normalized.startsWith(normalize(base))) {
    throw new Error(`Path traversal detected: ${inputPath}`);
  }

  return normalized;
}

/**
 * Check if a command is potentially dangerous
 */
export function isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /:\(\)\{\s*:\|:&\s*\};:/, // Fork bomb
    /mkfs/, // Format filesystem
    /dd\s+if=.*of=\/dev\//, // Disk operations
    />\s*\/dev\/sd/, // Write to disk
    /curl.*\|\s*bash/, // Pipe to bash
    /wget.*\|\s*sh/, // Pipe to shell
    /chmod\s+777/, // Dangerous permissions
    /chown\s+root/, // Change ownership to root
  ];

  return dangerousPatterns.some((pattern) => pattern.test(command));
}

/**
 * Sanitize shell command arguments
 */
export function sanitizeShellArg(arg: string): string {
  // Escape special characters
  return arg.replace(/(["\s'$`\\])/g, '\\$1');
}

/**
 * Check if a path is within allowed directories
 */
export function isPathAllowed(path: string, allowedDirs?: string[]): boolean {
  const normalized = normalize(resolve(path));
  const home = homedir();
  const cwd = process.cwd();

  const defaultAllowed = [cwd, home];
  const allowed = allowedDirs || defaultAllowed;

  return allowed.some((dir) => normalized.startsWith(normalize(dir)));
}

/**
 * Validate URL to prevent SSRF attacks
 */
export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Block private IP ranges
    const hostname = parsed.hostname.toLowerCase();

    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^::1$/, // IPv6 localhost
      /^fe80:/i, // IPv6 link-local
      /^fc00:/i, // IPv6 private
    ];

    if (blockedPatterns.some((pattern) => pattern.test(hostname))) {
      return false;
    }

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /**
   * Check if a request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.requests.clear();
  }
}

/**
 * Simple LRU cache for tool results
 */
export class ResultCache<T> {
  private cache: Map<string, { value: T; timestamp: number }> = new Map();

  constructor(
    private maxSize: number,
    private ttlMs: number
  ) {}

  /**
   * Get a cached value
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a cached value
   */
  set(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}
