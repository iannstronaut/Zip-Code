// Custom slash commands - user-defined shortcuts loaded from markdown files.
//
// Looks in two places (project takes precedence):
//   ./.zipcode/commands/<name>.md      (project-local)
//   ~/.zipcode/commands/<name>.md      (user-global)
//
// File format - markdown with optional YAML frontmatter:
//
//   ---
//   description: Refactor a file with strict rules
//   args: filename
//   ---
//   Refactor {{filename}} to:
//   - extract long functions
//   - add JSDoc
//   - keep behavior identical
//
// Usage: type "/refactor src/foo.ts" in the input bar.
// Variables {{arg1}}, {{arg2}}, etc. and named args from frontmatter
// are substituted into the body before the prompt is sent.

import { readFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';
import { logger } from './logger.js';

export interface SlashCommand {
  name: string;
  description: string;
  /** Named positional argument labels (from frontmatter `args:` field). */
  argNames: string[];
  /** Raw template body. */
  body: string;
  /** Where it was loaded from. */
  source: 'project' | 'user';
  filePath: string;
}

const PROJECT_DIR = join(process.cwd(), '.zipcode', 'commands');
const USER_DIR = join(homedir(), '.zipcode', 'commands');

function parseFrontmatter(content: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([a-zA-Z_-]+)\s*:\s*(.+)$/);
    if (m) meta[m[1].trim()] = m[2].trim();
  }
  return { meta, body: match[2] };
}

function parseArgs(spec: string | undefined): string[] {
  if (!spec) return [];
  return spec
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadDir(dir: string, source: 'project' | 'user'): Promise<SlashCommand[]> {
  if (!existsSync(dir)) return [];
  try {
    const files = await readdir(dir);
    const cmds: SlashCommand[] = [];
    for (const file of files) {
      if (extname(file).toLowerCase() !== '.md') continue;
      const filePath = join(dir, file);
      try {
        const raw = await readFile(filePath, 'utf-8');
        const { meta, body } = parseFrontmatter(raw);
        const name = basename(file, '.md');
        cmds.push({
          name,
          description: meta.description || `Custom command: ${name}`,
          argNames: parseArgs(meta.args),
          body: body.trim(),
          source,
          filePath,
        });
      } catch (e: any) {
        logger.warn(`Failed to load slash command '${file}'`, { error: e?.message });
      }
    }
    return cmds;
  } catch (e: any) {
    logger.warn(`Failed to read slash command dir '${dir}'`, { error: e?.message });
    return [];
  }
}

class SlashCommandManager {
  private cache: Map<string, SlashCommand> | null = null;

  async ensureLoaded(): Promise<void> {
    if (this.cache) return;
    await this.reload();
  }

  async reload(): Promise<void> {
    const userCmds = await loadDir(USER_DIR, 'user');
    const projectCmds = await loadDir(PROJECT_DIR, 'project');
    this.cache = new Map();
    // User first, project overrides on conflict
    for (const cmd of userCmds) this.cache.set(cmd.name, cmd);
    for (const cmd of projectCmds) this.cache.set(cmd.name, cmd);
  }

  async get(name: string): Promise<SlashCommand | undefined> {
    await this.ensureLoaded();
    return this.cache!.get(name);
  }

  async list(): Promise<SlashCommand[]> {
    await this.ensureLoaded();
    return Array.from(this.cache!.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Resolve a slash command invocation.
   * Input: "/refactor src/foo.ts"  →  { command, args }
   * Returns null if not found or not a slash command.
   */
  async resolve(input: string): Promise<{
    command: SlashCommand;
    rendered: string;
  } | null> {
    if (!input.startsWith('/')) return null;
    const trimmed = input.slice(1).trim();
    if (!trimmed) return null;

    const [name, ...rawArgs] = trimmed.split(/\s+/);
    const cmd = await this.get(name);
    if (!cmd) return null;

    const rendered = this.render(cmd, rawArgs);
    return { command: cmd, rendered };
  }

  private render(cmd: SlashCommand, args: string[]): string {
    let body = cmd.body;
    // Positional {{arg1}}, {{arg2}}, ...
    args.forEach((value, i) => {
      const re = new RegExp(`\\{\\{\\s*arg${i + 1}\\s*\\}\\}`, 'g');
      body = body.replace(re, value);
    });
    // Named args from frontmatter
    cmd.argNames.forEach((argName, i) => {
      if (i >= args.length) return;
      const re = new RegExp(`\\{\\{\\s*${argName}\\s*\\}\\}`, 'g');
      body = body.replace(re, args[i]);
    });
    // {{args}} - all remaining joined
    const allArgs = args.join(' ');
    body = body.replace(/\{\{\s*args\s*\}\}/g, allArgs);
    return body;
  }

  /** Create a new command file (user-global by default). */
  async create(
    name: string,
    description: string,
    body: string,
    location: 'user' | 'project' = 'user'
  ): Promise<string> {
    const dir = location === 'user' ? USER_DIR : PROJECT_DIR;
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${name}.md`);
    const content = `---\ndescription: ${description}\n---\n${body.trim()}\n`;
    const { writeFile } = await import('fs/promises');
    await writeFile(filePath, content, 'utf-8');
    this.cache = null; // force reload
    return filePath;
  }
}

export const slashCommands = new SlashCommandManager();
