// Privacy-first telemetry & error tracking for ZIP CODE
// All telemetry is OPT-IN and stored LOCALLY by default

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { logger } from './logger.js';

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  type: 'tool_use' | 'error' | 'session' | 'performance';
  name: string;
  duration?: number;
  success?: boolean;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  fingerprint: string;
}

class Telemetry {
  private dataDir: string;
  private eventsFile: string;
  private errorsFile: string;
  private enabled: boolean;
  private events: TelemetryEvent[] = [];
  private errors: ErrorReport[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.dataDir = join(homedir(), '.zipcode', 'telemetry');
    this.eventsFile = join(this.dataDir, 'events.jsonl');
    this.errorsFile = join(this.dataDir, 'errors.jsonl');

    // Default OFF - users must opt-in
    this.enabled = process.env.ZIPCODE_TELEMETRY === 'true';

    if (this.enabled) {
      this.ensureDataDir();
      this.startFlushInterval();
    }
  }

  private async ensureDataDir(): Promise<void> {
    try {
      if (!existsSync(this.dataDir)) {
        await mkdir(this.dataDir, { recursive: true });
      }
    } catch {
      // Silently fail
    }
  }

  private startFlushInterval(): void {
    // Flush every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  /**
   * Generate stable fingerprint for error deduplication
   */
  private generateFingerprint(error: { type: string; message: string }): string {
    return createHash('sha256')
      .update(`${error.type}:${error.message}`)
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * Sanitize metadata - remove sensitive data
   */
  private sanitize(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'apikey',
      'api_key',
      'password',
      'token',
      'secret',
      'auth',
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '***';
      } else if (typeof value === 'string' && value.length > 200) {
        // Truncate long strings
        sanitized[key] = value.slice(0, 200) + '...';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value as Record<string, any>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Track a tool usage event
   */
  trackToolUse(toolName: string, success: boolean, duration: number): void {
    if (!this.enabled) return;

    this.events.push({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'tool_use',
      name: toolName,
      success,
      duration,
    });
  }

  /**
   * Track a session event
   */
  trackSession(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    this.events.push({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'session',
      name,
      metadata: metadata ? this.sanitize(metadata) : undefined,
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(name: string, duration: number, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    this.events.push({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'performance',
      name,
      duration,
      metadata: metadata ? this.sanitize(metadata) : undefined,
    });
  }

  /**
   * Report an error
   */
  reportError(error: Error, context?: Record<string, any>): void {
    if (!this.enabled) return;

    const errorReport: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: error.name,
      message: error.message,
      stack: error.stack,
      context: context ? this.sanitize(context) : undefined,
      fingerprint: this.generateFingerprint({
        type: error.name,
        message: error.message,
      }),
    };

    this.errors.push(errorReport);

    // Also log to logger
    logger.error('Error tracked', error, context);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Flush buffered events to disk
   */
  async flush(): Promise<void> {
    if (!this.enabled) return;
    if (this.events.length === 0 && this.errors.length === 0) return;

    try {
      // Append events
      if (this.events.length > 0) {
        const eventsData = this.events.map((e) => JSON.stringify(e)).join('\n') + '\n';
        await writeFile(this.eventsFile, eventsData, { flag: 'a' });
        this.events = [];
      }

      // Append errors
      if (this.errors.length > 0) {
        const errorsData = this.errors.map((e) => JSON.stringify(e)).join('\n') + '\n';
        await writeFile(this.errorsFile, errorsData, { flag: 'a' });
        this.errors = [];
      }
    } catch {
      // Silently fail - telemetry shouldn't break the app
    }
  }

  /**
   * Get telemetry summary for the user
   */
  async getSummary(): Promise<{
    enabled: boolean;
    eventsCount: number;
    errorsCount: number;
    dataDir: string;
  }> {
    let eventsCount = 0;
    let errorsCount = 0;

    if (this.enabled) {
      try {
        if (existsSync(this.eventsFile)) {
          const data = await readFile(this.eventsFile, 'utf-8');
          eventsCount = data.split('\n').filter((l) => l.trim()).length;
        }
        if (existsSync(this.errorsFile)) {
          const data = await readFile(this.errorsFile, 'utf-8');
          errorsCount = data.split('\n').filter((l) => l.trim()).length;
        }
      } catch {
        // Silently fail
      }
    }

    return {
      enabled: this.enabled,
      eventsCount,
      errorsCount,
      dataDir: this.dataDir,
    };
  }

  /**
   * Enable telemetry (opt-in)
   */
  enable(): void {
    this.enabled = true;
    this.ensureDataDir();
    if (!this.flushInterval) {
      this.startFlushInterval();
    }
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.enabled = false;
    this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Clean up
   */
  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

// Singleton instance
export const telemetry = new Telemetry();

// Cleanup on exit
process.on('exit', () => {
  telemetry.shutdown();
});
