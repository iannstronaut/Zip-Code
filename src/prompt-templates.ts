// Prompt templates - reusable, parameterized prompts for common tasks.
//
// Built-in library covers the patterns I keep retyping: code review, debug,
// refactor, write tests, explain code, generate docs, etc.
//
// User templates live at ~/.zipcode/prompts/<name>.md and override built-ins.
// Project-local templates at ./.zipcode/prompts/<name>.md override user-global.
//
// Variable syntax: {{name}} or {{name|default}}.

import { readFile, readdir, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';
import { logger } from './logger';

export interface PromptTemplate {
  name: string;
  description: string;
  /** Variable names extracted from the body. */
  variables: string[];
  body: string;
  source: 'builtin' | 'user' | 'project';
}

const USER_DIR = join(homedir(), '.zipcode', 'prompts');
const PROJECT_DIR = join(process.cwd(), '.zipcode', 'prompts');

// ──────────── built-in library ────────────

const BUILTIN_TEMPLATES: Array<Omit<PromptTemplate, 'variables' | 'source'>> = [
  {
    name: 'review',
    description: 'Code review with focus on bugs, security, and maintainability.',
    body: `Review {{file}} as if it were a pull request. Focus on:
1. Correctness — bugs, edge cases, off-by-one errors
2. Security — input validation, injection risks, secret handling
3. Maintainability — naming, complexity, dead code
4. Tests — coverage gaps for new logic

Read the file first, then return a numbered list of findings with severity (CRITICAL / HIGH / MEDIUM / LOW). Suggest concrete fixes for each.`,
  },
  {
    name: 'refactor',
    description: 'Refactor code without changing behavior.',
    body: `Refactor {{file}} to improve readability and structure WITHOUT changing observable behavior.

Rules:
- Extract long functions (>50 lines) into named helpers
- Replace magic numbers with constants
- Add JSDoc/docstrings to public APIs
- Keep all existing tests passing
- Do not introduce new dependencies

Show me the diff before applying.`,
  },
  {
    name: 'debug',
    description: 'Systematic debugging of an issue.',
    body: `Debug this issue: {{issue}}

Follow this process:
1. Read the relevant code paths
2. Identify the SMALLEST reproduction
3. Form a hypothesis about the root cause
4. Verify the hypothesis with a probe (log, test, or manual run)
5. Propose a fix

Do not jump to a fix until step 4 confirms your hypothesis.`,
  },
  {
    name: 'tests',
    description: 'Write tests for a file or function.',
    body: `Write thorough tests for {{target}}.

Coverage required:
- Happy path
- Edge cases (empty input, null, max values, unicode)
- Error paths (invalid input, missing dependencies)
- Concurrency if applicable

Use the project's existing test framework. Read an existing test file first to match the style.`,
  },
  {
    name: 'explain',
    description: 'Explain code in plain language.',
    body: `Explain how {{file}} works as if I were a junior dev joining the team.

Cover:
- The PURPOSE of the file (what business problem)
- The DATA FLOW (inputs → transformations → outputs)
- Any NON-OBVIOUS DECISIONS or trade-offs
- HOW IT FITS into the rest of the codebase

Skip line-by-line narration. Focus on the mental model.`,
  },
  {
    name: 'docs',
    description: 'Generate or update documentation for a module.',
    body: `Generate clear, concise documentation for {{target}}.

Include:
- Overview (1-2 sentences)
- Public API reference with parameter types and return shapes
- 1-2 usage examples per function
- Any caveats or gotchas

Output as markdown suitable for a README section.`,
  },
  {
    name: 'optimize',
    description: 'Optimize code for performance.',
    body: `Profile and optimize {{target}} for performance.

Steps:
1. Read the code and identify hot paths
2. Measure (or estimate) the current cost
3. Propose specific optimizations ordered by impact
4. Apply the highest-impact change FIRST
5. Verify behavior is unchanged with tests

Do not micro-optimize without measurement.`,
  },
  {
    name: 'security',
    description: 'Security audit of a file or feature.',
    body: `Security audit of {{target}}.

Look for:
- Injection (SQL, command, XSS, prototype pollution)
- Auth/authz weaknesses
- Sensitive data exposure (logs, error messages, API responses)
- Insecure deserialization
- SSRF, path traversal, race conditions
- Outdated dependencies with known CVEs

For each finding, give: severity, file:line, description, exploitation scenario, suggested fix.`,
  },
];

// ──────────── parsing ────────────

function extractVariables(body: string): string[] {
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\|\s*[^}]*)?\s*\}\}/g;
  const vars = new Set<string>();
  let m;
  while ((m = re.exec(body)) !== null) {
    vars.add(m[1]);
  }
  return Array.from(vars);
}

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

async function loadDir(
  dir: string,
  source: 'user' | 'project'
): Promise<PromptTemplate[]> {
  if (!existsSync(dir)) return [];
  try {
    const files = await readdir(dir);
    const templates: PromptTemplate[] = [];
    for (const file of files) {
      if (extname(file).toLowerCase() !== '.md') continue;
      const filePath = join(dir, file);
      try {
        const raw = await readFile(filePath, 'utf-8');
        const { meta, body } = parseFrontmatter(raw);
        const name = basename(file, '.md');
        templates.push({
          name,
          description: meta.description || `Template: ${name}`,
          variables: extractVariables(body),
          body: body.trim(),
          source,
        });
      } catch (e: any) {
        logger.warn(`Failed to load prompt template '${file}'`, { error: e?.message });
      }
    }
    return templates;
  } catch (e: any) {
    logger.warn(`Failed to read prompt template dir '${dir}'`, { error: e?.message });
    return [];
  }
}

// ──────────── manager ────────────

class PromptTemplateManager {
  private cache: Map<string, PromptTemplate> | null = null;

  async ensureLoaded(): Promise<void> {
    if (this.cache) return;
    await this.reload();
  }

  async reload(): Promise<void> {
    const builtins: PromptTemplate[] = BUILTIN_TEMPLATES.map((t) => ({
      ...t,
      variables: extractVariables(t.body),
      source: 'builtin' as const,
    }));
    const userTemplates = await loadDir(USER_DIR, 'user');
    const projectTemplates = await loadDir(PROJECT_DIR, 'project');

    this.cache = new Map();
    // Precedence: builtin < user < project
    for (const t of builtins) this.cache.set(t.name, t);
    for (const t of userTemplates) this.cache.set(t.name, t);
    for (const t of projectTemplates) this.cache.set(t.name, t);
  }

  async get(name: string): Promise<PromptTemplate | undefined> {
    await this.ensureLoaded();
    return this.cache!.get(name);
  }

  async list(): Promise<PromptTemplate[]> {
    await this.ensureLoaded();
    return Array.from(this.cache!.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Render a template with given variables. Missing required variables are
   * substituted with their default (if specified) or left as-is with a warning.
   */
  async render(name: string, vars: Record<string, string> = {}): Promise<string> {
    const tmpl = await this.get(name);
    if (!tmpl) throw new Error(`Template not found: ${name}`);

    return tmpl.body.replace(
      /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\|\s*([^}]*))?\s*\}\}/g,
      (_match, varName, defaultValue) => {
        if (vars[varName] !== undefined) return vars[varName];
        if (defaultValue !== undefined) return defaultValue.trim();
        return `{{${varName}}}`; // leave unsubstituted
      }
    );
  }

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
    await writeFile(filePath, content, 'utf-8');
    this.cache = null;
    return filePath;
  }
}

export const promptTemplates = new PromptTemplateManager();
