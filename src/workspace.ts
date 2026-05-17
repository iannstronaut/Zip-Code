// Workspace context loader (.zipcoderc)
// Auto-loaded into the system prompt when ZIP CODE starts in a project that has one.

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { logger } from './logger';

export interface WorkspaceContext {
  /** Absolute path of the file that was loaded. */
  source: string;
  /** Raw markdown / text content. */
  content: string;
  /** Optional structured fields parsed from frontmatter or first lines. */
  metadata: {
    name?: string;
    language?: string;
    runtime?: string;
    testCommand?: string;
    buildCommand?: string;
    lintCommand?: string;
  };
}

const SUPPORTED_FILES = [
  '.zipcoderc',
  '.zipcoderc.md',
  'ZIPCODE.md',
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
];

/**
 * Walk up from `startDir` looking for the first supported workspace context file.
 * Stops at the user's home dir or filesystem root.
 */
export function findContextFile(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  const root = resolve('/');

  while (dir !== root) {
    for (const filename of SUPPORTED_FILES) {
      const candidate = join(dir, filename);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Parse YAML-ish frontmatter at the top of a file.
 * Very simple parser - handles `key: value` lines between `---` markers.
 */
function parseFrontmatter(content: string): {
  metadata: WorkspaceContext['metadata'];
  body: string;
} {
  const metadata: WorkspaceContext['metadata'] = {};

  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!fmMatch) {
    return { metadata, body: content };
  }

  const fmContent = fmMatch[1];
  const body = content.slice(fmMatch[0].length);

  const lines = fmContent.split('\n');
  for (const line of lines) {
    const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase().replace(/-/g, '');
    const value = m[2].trim().replace(/^["']|["']$/g, '');

    switch (key) {
      case 'name':
        metadata.name = value;
        break;
      case 'language':
        metadata.language = value;
        break;
      case 'runtime':
        metadata.runtime = value;
        break;
      case 'testcommand':
      case 'test':
        metadata.testCommand = value;
        break;
      case 'buildcommand':
      case 'build':
        metadata.buildCommand = value;
        break;
      case 'lintcommand':
      case 'lint':
        metadata.lintCommand = value;
        break;
    }
  }

  return { metadata, body };
}

/**
 * Load workspace context from disk.
 */
export async function loadWorkspaceContext(
  startDir: string = process.cwd()
): Promise<WorkspaceContext | null> {
  const file = findContextFile(startDir);
  if (!file) {
    logger.debug('No workspace context file found');
    return null;
  }

  try {
    const raw = await readFile(file, 'utf-8');
    const { metadata, body } = parseFrontmatter(raw);

    logger.info('Workspace context loaded', {
      source: file,
      size_bytes: raw.length,
      metadata,
    });

    return {
      source: file,
      content: body.trim(),
      metadata,
    };
  } catch (error: any) {
    logger.warn('Failed to load workspace context', {
      source: file,
      error: error?.message,
    });
    return null;
  }
}

/**
 * Build a system prompt addition from workspace context.
 */
export function formatContextForPrompt(ctx: WorkspaceContext): string {
  const lines = [`--- WORKSPACE CONTEXT (loaded from ${ctx.source}) ---`];

  if (Object.keys(ctx.metadata).length > 0) {
    lines.push('');
    if (ctx.metadata.name) lines.push(`Project: ${ctx.metadata.name}`);
    if (ctx.metadata.language) lines.push(`Language: ${ctx.metadata.language}`);
    if (ctx.metadata.runtime) lines.push(`Runtime: ${ctx.metadata.runtime}`);
    if (ctx.metadata.buildCommand) lines.push(`Build: ${ctx.metadata.buildCommand}`);
    if (ctx.metadata.testCommand) lines.push(`Test: ${ctx.metadata.testCommand}`);
    if (ctx.metadata.lintCommand) lines.push(`Lint: ${ctx.metadata.lintCommand}`);
  }

  if (ctx.content) {
    lines.push('');
    lines.push(ctx.content);
  }

  return lines.join('\n');
}
