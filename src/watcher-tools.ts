// File watcher and monitoring tools for ZIP CODE

import type { ToolDefinition, ToolResult } from './types.js';
import { watch } from 'fs';
import { resolve } from 'path';

// File watcher tools definitions
export const WATCHER_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'watch_file',
      description:
        'Watch a file or directory for changes. Returns immediately with watch ID. Changes will be reported asynchronously.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File or directory path to watch.',
          },
          recursive: {
            type: 'boolean',
            description: 'Watch subdirectories recursively (default: false).',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop_watch',
      description: 'Stop watching a file or directory.',
      parameters: {
        type: 'object',
        properties: {
          watchId: {
            type: 'string',
            description: 'Watch ID returned from watch_file.',
          },
        },
        required: ['watchId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_watches',
      description: 'List all active file watches.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

// ──────────── implementations ────────────

interface WatchEntry {
  id: string;
  path: string;
  recursive: boolean;
  watcher: ReturnType<typeof watch>;
  changes: Array<{ event: string; filename: string; timestamp: number }>;
}

const activeWatches = new Map<string, WatchEntry>();
let watchIdCounter = 0;

export async function watchFile(
  path: string,
  recursive: boolean = false
): Promise<ToolResult> {
  try {
    const resolvedPath = resolve(path);
    const watchId = `watch_${++watchIdCounter}`;

    const changes: Array<{ event: string; filename: string; timestamp: number }> = [];

    const watcher = watch(
      resolvedPath,
      { recursive },
      (eventType, filename) => {
        changes.push({
          event: eventType,
          filename: filename || '',
          timestamp: Date.now(),
        });

        // Keep only last 100 changes
        if (changes.length > 100) {
          changes.shift();
        }
      }
    );

    activeWatches.set(watchId, {
      id: watchId,
      path: resolvedPath,
      recursive,
      watcher,
      changes,
    });

    return {
      success: true,
      output: `Watching ${resolvedPath} (ID: ${watchId}, recursive: ${recursive})\nUse list_watches to see changes.`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Failed to watch file: ${error?.message || error}`,
    };
  }
}

export async function stopWatch(watchId: string): Promise<ToolResult> {
  try {
    const entry = activeWatches.get(watchId);

    if (!entry) {
      return {
        success: false,
        output: '',
        error: `Watch ID not found: ${watchId}`,
      };
    }

    entry.watcher.close();
    activeWatches.delete(watchId);

    return {
      success: true,
      output: `Stopped watching ${entry.path} (ID: ${watchId})`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Failed to stop watch: ${error?.message || error}`,
    };
  }
}

export async function listWatches(): Promise<ToolResult> {
  try {
    if (activeWatches.size === 0) {
      return {
        success: true,
        output: 'No active watches.',
      };
    }

    const lines: string[] = ['Active file watches:\n'];

    activeWatches.forEach((entry, id) => {
      lines.push(`\n[${id}] ${entry.path} (recursive: ${entry.recursive})`);

      if (entry.changes.length > 0) {
        lines.push(`  Recent changes (${entry.changes.length}):`);
        const recentChanges = entry.changes.slice(-10);
        for (const change of recentChanges) {
          const time = new Date(change.timestamp).toLocaleTimeString();
          lines.push(`    ${time} - ${change.event}: ${change.filename}`);
        }
      } else {
        lines.push('  No changes detected yet.');
      }
    });

    return {
      success: true,
      output: lines.join('\n'),
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Failed to list watches: ${error?.message || error}`,
    };
  }
}

// Cleanup function to close all watchers
export function closeAllWatches(): void {
  activeWatches.forEach((entry) => {
    entry.watcher.close();
  });
  activeWatches.clear();
}
