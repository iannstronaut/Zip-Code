// Long-term memory system - persistent facts the agent remembers across sessions.
// Stored as JSON at ~/.zipcode/memory.json with simple add/list/remove ops.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import type { ToolDefinition, ToolResult } from './types.js';
import { logger } from './logger.js';

export interface MemoryEntry {
  id: string;
  content: string;
  category: 'user' | 'project' | 'tech' | 'preference' | 'fact';
  createdAt: number;
  updatedAt: number;
  hits: number;
}

const MEMORY_DIR = join(homedir(), '.zipcode');
const MEMORY_FILE = join(MEMORY_DIR, 'memory.json');

// ──────────── memory store ────────────

class MemoryStore {
  private entries: MemoryEntry[] = [];
  private loaded = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      if (!existsSync(MEMORY_DIR)) {
        await mkdir(MEMORY_DIR, { recursive: true });
      }
      if (existsSync(MEMORY_FILE)) {
        const raw = await readFile(MEMORY_FILE, 'utf-8');
        this.entries = JSON.parse(raw);
      }
      this.loaded = true;
    } catch (error: any) {
      logger.warn('Memory load failed', { error: error?.message });
      this.entries = [];
      this.loaded = true;
    }
  }

  private async persist(): Promise<void> {
    try {
      if (!existsSync(MEMORY_DIR)) {
        await mkdir(MEMORY_DIR, { recursive: true });
      }
      await writeFile(MEMORY_FILE, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch (error: any) {
      logger.warn('Memory persist failed', { error: error?.message });
    }
  }

  private generateId(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 12);
  }

  async add(
    content: string,
    category: MemoryEntry['category'] = 'fact'
  ): Promise<MemoryEntry> {
    await this.ensureLoaded();
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Memory content cannot be empty');

    // Deduplicate by content hash
    const id = this.generateId(trimmed);
    const existing = this.entries.find((e) => e.id === id);
    if (existing) {
      existing.updatedAt = Date.now();
      existing.hits += 1;
      await this.persist();
      return existing;
    }

    const entry: MemoryEntry = {
      id,
      content: trimmed,
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hits: 0,
    };
    this.entries.push(entry);
    await this.persist();
    logger.info('Memory added', { id, category });
    return entry;
  }

  async remove(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length < before) {
      await this.persist();
      return true;
    }
    return false;
  }

  async list(category?: MemoryEntry['category']): Promise<MemoryEntry[]> {
    await this.ensureLoaded();
    if (!category) return [...this.entries];
    return this.entries.filter((e) => e.category === category);
  }

  async search(query: string, limit = 10): Promise<MemoryEntry[]> {
    await this.ensureLoaded();
    const q = query.toLowerCase();
    const matches = this.entries
      .filter((e) => e.content.toLowerCase().includes(q))
      .slice(0, limit);

    // Bump hit counter for matched entries
    for (const m of matches) m.hits += 1;
    if (matches.length > 0) await this.persist();

    return matches;
  }

  async clear(): Promise<number> {
    await this.ensureLoaded();
    const count = this.entries.length;
    this.entries = [];
    await this.persist();
    return count;
  }

  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.entries.length;
  }
}

export const memoryStore = new MemoryStore();

// ──────────── tools ────────────

export const MEMORY_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'memory_add',
      description:
        'Save a durable fact to long-term memory. Use for: user preferences, project conventions, environment quirks, tool-specific knowledge that will matter in future sessions. Do NOT save: task progress, ephemeral state, or facts that go stale within a week.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Declarative fact to remember (e.g. "User prefers concise responses").',
          },
          category: {
            type: 'string',
            enum: ['user', 'project', 'tech', 'preference', 'fact'],
            description:
              'Category: user (about the user), project (about the codebase), tech (env/tools), preference (style choices), fact (general).',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_search',
      description: 'Search long-term memory for relevant facts.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Substring to search for in memory entries.',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 10).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_list',
      description: 'List all memory entries, optionally filtered by category.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['user', 'project', 'tech', 'preference', 'fact'],
            description: 'Optional category filter.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_remove',
      description: 'Remove a memory entry by its ID.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the memory entry to remove.',
          },
        },
        required: ['id'],
      },
    },
  },
];

function formatEntry(e: MemoryEntry): string {
  const date = new Date(e.createdAt).toISOString().split('T')[0];
  return `[${e.id}] (${e.category}, added ${date}, hits ${e.hits}) ${e.content}`;
}

export async function memoryAdd(
  content: string,
  category?: string
): Promise<ToolResult> {
  try {
    const entry = await memoryStore.add(content, (category as any) || 'fact');
    return {
      success: true,
      output: `Saved to memory: [${entry.id}] (${entry.category}) ${entry.content}`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `memory_add failed: ${error?.message || error}`,
    };
  }
}

export async function memorySearch(
  query: string,
  limit?: number
): Promise<ToolResult> {
  try {
    const results = await memoryStore.search(query, limit);
    if (results.length === 0) {
      return { success: true, output: `No memory entries match: "${query}"` };
    }
    const lines = [`Found ${results.length} memory entries for "${query}":\n`];
    for (const e of results) lines.push(formatEntry(e));
    return { success: true, output: lines.join('\n') };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `memory_search failed: ${error?.message || error}`,
    };
  }
}

export async function memoryList(category?: string): Promise<ToolResult> {
  try {
    const entries = await memoryStore.list(category as any);
    if (entries.length === 0) {
      return {
        success: true,
        output: category ? `No memory entries in category "${category}"` : 'No memory entries.',
      };
    }
    const lines = [`Memory (${entries.length} entries):\n`];
    for (const e of entries) lines.push(formatEntry(e));
    return { success: true, output: lines.join('\n') };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `memory_list failed: ${error?.message || error}`,
    };
  }
}

export async function memoryRemove(id: string): Promise<ToolResult> {
  try {
    const removed = await memoryStore.remove(id);
    return {
      success: removed,
      output: removed ? `Removed memory: ${id}` : '',
      error: removed ? undefined : `Memory ID not found: ${id}`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `memory_remove failed: ${error?.message || error}`,
    };
  }
}

/**
 * Load all memory entries formatted as a system-prompt block.
 */
export async function getMemoryPromptBlock(): Promise<string> {
  const entries = await memoryStore.list();
  if (entries.length === 0) return '';

  const byCategory = new Map<string, MemoryEntry[]>();
  for (const e of entries) {
    const list = byCategory.get(e.category) || [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  const lines = ['--- LONG-TERM MEMORY ---'];
  byCategory.forEach((list, cat) => {
    lines.push(`\n${cat.toUpperCase()}:`);
    for (const e of list) lines.push(`  • ${e.content}`);
  });

  return lines.join('\n');
}
