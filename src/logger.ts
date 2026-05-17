// Structured logging system for ZIP CODE

import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private logDir: string;
  private logFile: string;
  private minLevel: LogLevel;
  private writeToFile: boolean;
  private writeToConsole: boolean;

  constructor() {
    this.logDir = join(homedir(), '.zipcode', 'logs');
    this.logFile = join(this.logDir, `zipcode-${this.getDateString()}.log`);

    // Configure from environment
    this.minLevel = this.parseLogLevel(process.env.ZIPCODE_LOG_LEVEL);
    this.writeToFile = process.env.ZIPCODE_LOG_FILE !== 'false';
    this.writeToConsole = process.env.ZIPCODE_LOG_CONSOLE === 'true';

    this.ensureLogDir();
  }

  private parseLogLevel(level?: string): LogLevel {
    switch (level?.toUpperCase()) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'FATAL':
        return LogLevel.FATAL;
      default:
        return LogLevel.INFO;
    }
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private async ensureLogDir(): Promise<void> {
    try {
      if (!existsSync(this.logDir)) {
        await mkdir(this.logDir, { recursive: true });
      }
    } catch {
      // Silently fail - logging shouldn't break the app
    }
  }

  private formatEntry(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  private async write(entry: LogEntry): Promise<void> {
    const formatted = this.formatEntry(entry);

    if (this.writeToFile) {
      try {
        await appendFile(this.logFile, formatted);
      } catch {
        // Silently fail
      }
    }

    if (this.writeToConsole) {
      const colorMap: Record<string, string> = {
        DEBUG: '\x1b[36m', // cyan
        INFO: '\x1b[32m', // green
        WARN: '\x1b[33m', // yellow
        ERROR: '\x1b[31m', // red
        FATAL: '\x1b[35m', // magenta
      };
      const reset = '\x1b[0m';
      const color = colorMap[entry.level] || '';
      console.error(
        `${color}[${entry.timestamp}] ${entry.level}:${reset} ${entry.message}`,
        entry.context || ''
      );
    }
  }

  private log(
    level: LogLevel,
    levelName: string,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
    };

    if (context) {
      entry.context = this.sanitizeContext(context);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.write(entry).catch(() => {
      // Silently fail
    });
  }

  /**
   * Sanitize context to remove sensitive data
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'apiKey',
      'api_key',
      'password',
      'token',
      'secret',
      'authorization',
    ];

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context, error);
  }

  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, 'FATAL', message, context, error);
  }

  /**
   * Get the current log file path
   */
  getLogFile(): string {
    return this.logFile;
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

// Singleton instance
export const logger = new Logger();
