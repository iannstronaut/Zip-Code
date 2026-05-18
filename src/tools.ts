// Tool implementations for ZIP CODE

import type { ToolDefinition, ToolResult } from './types.js';
import { existsSync } from 'fs';
import {
  readdir,
  stat,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir,
} from 'fs/promises';
import { join, resolve, dirname, relative, sep } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GIT_TOOLS } from './git-tools.js';
import { WEB_TOOLS } from './web-tools.js';
import { WATCHER_TOOLS } from './watcher-tools.js';
import { CODE_ANALYSIS_TOOLS } from './code-analysis-tools.js';
import { DELEGATION_TOOLS } from './sub-agent.js';
import { MEMORY_TOOLS } from './memory-tools.js';
import { DATABASE_TOOLS, sqlQuery, sqlSchema } from './database-tools.js';
import { hookManager } from './hooks.js';
import { mcpManager } from './mcp-client.js';
import { sanitizePath, isDangerousCommand, RateLimiter, ResultCache } from './security.js';

const execAsync = promisify(exec);

// Rate limiters for different operations
const bashRateLimiter = new RateLimiter(30, 60000); // 30 commands per minute
const webRateLimiter = new RateLimiter(20, 60000); // 20 requests per minute

// Result cache for expensive operations
const fileCache = new ResultCache<string>(100, 30000); // 100 files, 30s TTL
const dirCache = new ResultCache<string>(50, 30000); // 50 dirs, 30s TTL

// Tool definitions for LLM
export const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file from the filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read (relative or absolute).',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Write content to a file. Creates parent directories if needed. Overwrites existing files.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to write.',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List the contents of a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list (defaults to current working directory).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_bash',
      description:
        'Execute a shell command. Has a 30s timeout. Use carefully — destructive commands should be confirmed first.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Shell command to execute.',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description:
        'Search file contents using a regex pattern. Recursively scans the given path (defaults to CWD).',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Regex pattern to search for.',
          },
          path: {
            type: 'string',
            description: 'Directory or file to search (defaults to CWD).',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of matching lines to return (default 200).',
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description:
        'Find files matching a glob-like pattern (supports *, **, ?). Returns matching paths.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern, e.g. "src/**/*.ts".',
          },
          path: {
            type: 'string',
            description: 'Root directory to search from (defaults to CWD).',
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Ask the user for input or confirmation. Use this for destructive or ambiguous operations.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Question to present to the user.',
          },
        },
        required: ['question'],
      },
    },
  },
  ...GIT_TOOLS,
  ...WEB_TOOLS,
  ...WATCHER_TOOLS,
  ...CODE_ANALYSIS_TOOLS,
  ...DELEGATION_TOOLS,
  ...MEMORY_TOOLS,
  ...DATABASE_TOOLS,
];

/** All tools, including dynamic MCP tools loaded at runtime. */
export function getAllTools(): ToolDefinition[] {
  return [...TOOLS, ...mcpManager.getToolDefinitions()];
}

// ──────────── implementations ────────────

export async function readFile(path: string): Promise<ToolResult> {
  try {
    // Check cache first
    const cacheKey = `read:${path}`;
    const cached = fileCache.get(cacheKey);
    if (cached) {
      return { success: true, output: cached };
    }

    const resolvedPath = sanitizePath(path);
    if (!existsSync(resolvedPath)) {
      return { success: false, output: '', error: `File not found: ${path}` };
    }
    const content = await fsReadFile(resolvedPath, 'utf-8');

    // Cache the result
    fileCache.set(cacheKey, content);

    return { success: true, output: content };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Error reading file: ${error?.message || error}`,
    };
  }
}

export async function writeFile(path: string, content: string): Promise<ToolResult> {
  try {
    const resolvedPath = sanitizePath(path);
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await fsWriteFile(resolvedPath, content, 'utf-8');

    // Invalidate cache
    fileCache.set(`read:${path}`, content);

    return {
      success: true,
      output: `File written: ${path} (${Buffer.byteLength(content, 'utf-8')} bytes)`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Error writing file: ${error?.message || error}`,
    };
  }
}

export async function listDir(path: string = '.'): Promise<ToolResult> {
  try {
    const resolvedPath = resolve(path);
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        output: '',
        error: `Directory not found: ${path}`,
      };
    }

    const entries = await readdir(resolvedPath);
    const details = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(resolvedPath, entry);
        try {
          const stats = await stat(fullPath);
          const type = stats.isDirectory() ? 'dir' : 'file';
          const size = stats.isFile() ? stats.size : 0;
          return { name: entry, type, size };
        } catch {
          return { name: entry, type: 'file', size: 0 };
        }
      })
    );

    const output = details
      .map((d) => {
        const tag = d.type === 'dir' ? '[DIR] ' : '[FILE]';
        const sizeStr = d.type === 'file' ? `  ${d.size.toString().padStart(8)} bytes` : '';
        return `${tag} ${d.name}${sizeStr}`;
      })
      .join('\n');

    return { success: true, output: output || 'Empty directory' };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Error listing directory: ${error?.message || error}`,
    };
  }
}

export async function executeBash(command: string): Promise<ToolResult> {
  try {
    // Check rate limit
    if (!bashRateLimiter.isAllowed('bash')) {
      return {
        success: false,
        output: '',
        error: `Rate limit exceeded. ${bashRateLimiter.getRemaining('bash')} commands remaining in this minute.`,
      };
    }

    // Check for dangerous commands
    if (isDangerousCommand(command)) {
      return {
        success: false,
        output: '',
        error: `Dangerous command detected: ${command}\nThis command has been blocked for security reasons.`,
      };
    }

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10,
    });
    const output = (stdout || '') + (stderr ? `\n[stderr]\n${stderr}` : '');
    return {
      success: true,
      output: output.trim() || 'Command executed (no output)',
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Command failed: ${error?.message || error}`,
    };
  }
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  '.zipcode',
]);

async function walk(dir: string, out: string[], cap = 5000): Promise<void> {
  if (out.length >= cap) return;
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= cap) return;
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      await walk(full, out, cap);
    } else if (s.isFile()) {
      out.push(full);
    }
  }
}

function globToRegex(pattern: string): RegExp {
  // Normalise separators to forward slash for tokenisation.
  const norm = pattern.replace(/\\/g, '/');

  // Tokenise glob metacharacters into placeholders so we can safely escape
  // regex specials afterwards.
  const SGS = '\u0001'; // **/
  const GS = '\u0002'; // **
  const ST = '\u0003'; // *
  const QM = '\u0004'; // ?
  const SL = '\u0005'; // /

  let s = norm
    .replace(/\*\*\//g, SGS)
    .replace(/\*\*/g, GS)
    .replace(/\*/g, ST)
    .replace(/\?/g, QM)
    .replace(/\//g, SL);

  // Escape regex specials in literal portions (placeholders survive).
  s = s.replace(/[.+^$(){}|[\]\\]/g, '\\$&');

  // Path separator and "non-separator" classes — allow both / and \ to match
  // either path style on Windows or POSIX.
  const SEP = '[\\\\/]';
  const NONSEP = '[^\\\\/]';

  s = s
    .split(SGS)
    .join('(?:' + NONSEP + '*' + SEP + ')*')
    .split(GS)
    .join('.*')
    .split(ST)
    .join(NONSEP + '*')
    .split(QM)
    .join(NONSEP)
    .split(SL)
    .join(SEP);

  return new RegExp('^' + s + '$');
}

export async function globSearch(pattern: string, path: string = '.'): Promise<ToolResult> {
  try {
    const root = resolve(path);
    if (!existsSync(root)) {
      return { success: false, output: '', error: `Path not found: ${path}` };
    }
    const all: string[] = [];
    await walk(root, all);
    const re = globToRegex(pattern);
    const matched = all
      .map((p) => relative(root, p).split(sep).join('/'))
      .filter((p) => re.test(p))
      .slice(0, 500);

    return {
      success: true,
      output: matched.length
        ? matched.join('\n') + `\n\n${matched.length} match(es)`
        : 'No matches',
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Glob error: ${error?.message || error}`,
    };
  }
}

export async function grepSearch(
  pattern: string,
  path: string = '.',
  maxResults = 200
): Promise<ToolResult> {
  try {
    const root = resolve(path);
    if (!existsSync(root)) {
      return { success: false, output: '', error: `Path not found: ${path}` };
    }
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      return {
        success: false,
        output: '',
        error: `Invalid regex: ${pattern}`,
      };
    }

    const files: string[] = [];
    const s = await stat(root);
    if (s.isFile()) {
      files.push(root);
    } else {
      await walk(root, files);
    }

    const matches: string[] = [];
    for (const f of files) {
      if (matches.length >= maxResults) break;
      let content: string;
      try {
        content = await fsReadFile(f, 'utf-8');
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const rel = relative(root, f).split(sep).join('/') || f;
          matches.push(`${rel}:${i + 1}: ${lines[i].slice(0, 300)}`);
          if (matches.length >= maxResults) break;
        }
      }
    }

    return {
      success: true,
      output: matches.length
        ? matches.join('\n') + `\n\n${matches.length} match(es)`
        : 'No matches',
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Grep error: ${error?.message || error}`,
    };
  }
}

// ask_user is special — it must be handled by the UI layer.
// The default fallback simply returns an instruction for the model.
export async function askUser(question: string): Promise<ToolResult> {
  return {
    success: true,
    output: `[ask_user not handled in this context] Question: ${question}`,
  };
}

export type AskUserHandler = (question: string) => Promise<string>;

let askUserHandler: AskUserHandler | null = null;

export function setAskUserHandler(handler: AskUserHandler | null): void {
  askUserHandler = handler;
}

// Execute tool by name
export async function executeTool(name: string, args: any): Promise<ToolResult> {
  // Run pre-tool hooks (audit, validate, confirm, etc.)
  const preResult = await hookManager.run({
    event: 'pre-tool',
    toolName: name,
    args,
  });
  if (preResult.block) {
    return {
      success: false,
      output: '',
      error: preResult.blockReason || 'Tool execution blocked by hook',
    };
  }
  if (preResult.rewriteArgs !== undefined) {
    args = preResult.rewriteArgs;
  }

  // MCP tools are dispatched separately - they live behind the mcp__ prefix
  if (mcpManager.isMCPTool(name)) {
    const result = await mcpManager.execute(name, args);
    await hookManager.run({
      event: 'post-tool',
      toolName: name,
      args,
      result,
    });
    return result;
  }

  // Run the actual tool, then dispatch post-tool hooks afterward.
  const result = await dispatchTool(name, args);
  await hookManager.run({
    event: 'post-tool',
    toolName: name,
    args,
    result,
  });
  return result;
}

async function dispatchTool(name: string, args: any): Promise<ToolResult> {
  // Import git functions dynamically
  const { gitStatus, gitDiff, gitLog, gitBranch, gitCommit, gitPush, gitPull, gitAdd } =
    await import('./git-tools');

  // Import web functions dynamically
  const { webSearch, httpRequest, downloadFile } = await import('./web-tools');

  // Import watcher functions dynamically
  const { watchFile, stopWatch, listWatches } = await import('./watcher-tools');

  // Import code analysis functions dynamically
  const { analyzeComplexity, findTodos, analyzeDependencies, countLines } =
    await import('./code-analysis-tools');

  // Import delegation functions dynamically
  const { delegateTask, listProfilesTool } = await import('./sub-agent');

  // Import memory functions dynamically
  const { memoryAdd, memorySearch, memoryList, memoryRemove } = await import(
    './memory-tools'
  );

  switch (name) {
    case 'read_file':
      return readFile(args.path);
    case 'write_file':
      return writeFile(args.path, args.content);
    case 'list_dir':
      return listDir(args.path);
    case 'execute_bash':
      return executeBash(args.command);
    case 'grep':
      return grepSearch(args.pattern, args.path, args.maxResults);
    case 'glob':
      return globSearch(args.pattern, args.path);
    case 'git_status':
      return gitStatus(args.path);
    case 'git_diff':
      return gitDiff(args.path, args.staged);
    case 'git_log':
      return gitLog(args.limit, args.oneline);
    case 'git_branch':
      return gitBranch(args.action, args.name);
    case 'git_commit':
      return gitCommit(args.message, args.all);
    case 'git_push':
      return gitPush(args.remote, args.branch, args.force);
    case 'git_pull':
      return gitPull(args.remote, args.branch);
    case 'git_add':
      return gitAdd(args.paths);
    case 'web_search':
      return webSearch(args.query, args.limit);
    case 'http_request':
      return httpRequest(args.url, args.method, args.headers, args.body);
    case 'download_file':
      return downloadFile(args.url, args.output);
    case 'watch_file':
      return watchFile(args.path, args.recursive);
    case 'stop_watch':
      return stopWatch(args.watchId);
    case 'list_watches':
      return listWatches();
    case 'analyze_complexity':
      return analyzeComplexity(args.path);
    case 'find_todos':
      return findTodos(args.path);
    case 'analyze_dependencies':
      return analyzeDependencies(args.path);
    case 'count_lines':
      return countLines(args.path);
    case 'delegate_task':
      return delegateTask(args);
    case 'list_profiles':
      return listProfilesTool();
    case 'memory_add':
      return memoryAdd(args.content, args.category);
    case 'memory_search':
      return memorySearch(args.query, args.limit);
    case 'memory_list':
      return memoryList(args.category);
    case 'memory_remove':
      return memoryRemove(args.id);
    case 'sql_query':
      return sqlQuery(args.db_path, args.query, args.params, args.limit, args.allow_write);
    case 'sql_schema':
      return sqlSchema(args.db_path, args.table);
    case 'ask_user': {
      if (askUserHandler) {
        try {
          const answer = await askUserHandler(args.question);
          return { success: true, output: answer };
        } catch (e: any) {
          return {
            success: false,
            output: '',
            error: `ask_user cancelled: ${e?.message || e}`,
          };
        }
      }
      return askUser(args.question);
    }
    default:
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${name}`,
      };
  }
}
