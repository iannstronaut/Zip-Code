// Code analysis tools for ZIP CODE

import type { ToolDefinition, ToolResult } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const execAsync = promisify(exec);

// Code analysis tool definitions
export const CODE_ANALYSIS_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'analyze_complexity',
      description:
        'Analyze code complexity metrics (cyclomatic complexity, lines of code, etc.).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File or directory path to analyze.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_todos',
      description: 'Find TODO, FIXME, HACK, and NOTE comments in code.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to search (defaults to CWD).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_dependencies',
      description:
        'Analyze project dependencies from package.json, requirements.txt, or go.mod.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Project root path (defaults to CWD).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_lines',
      description: 'Count lines of code by file type.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to analyze (defaults to CWD).',
          },
        },
        required: [],
      },
    },
  },
];

// ──────────── implementations ────────────

export async function analyzeComplexity(path: string): Promise<ToolResult> {
  try {
    const resolvedPath = resolve(path);

    // Simple complexity analysis using wc and grep
    const command = `find "${resolvedPath}" -type f \\( -name "*.ts" -o -name "*.js" -o -name "*.py" \\) -exec wc -l {} + | sort -rn | head -20`;

    const { stdout } = await execAsync(command, {
      timeout: 15000,
    });

    if (!stdout.trim()) {
      return {
        success: true,
        output: 'No code files found.',
      };
    }

    return {
      success: true,
      output: `Top 20 largest files by line count:\n\n${stdout}`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Complexity analysis failed: ${error?.message || error}`,
    };
  }
}

export async function findTodos(path?: string): Promise<ToolResult> {
  try {
    const searchPath = path ? resolve(path) : process.cwd();

    const command = `grep -rn --include="*.ts" --include="*.js" --include="*.py" --include="*.go" --include="*.java" -E "(TODO|FIXME|HACK|NOTE):" "${searchPath}" 2>/dev/null || true`;

    const { stdout } = await execAsync(command, {
      timeout: 15000,
      shell: '/bin/bash',
    });

    if (!stdout.trim()) {
      return {
        success: true,
        output: 'No TODO/FIXME/HACK/NOTE comments found.',
      };
    }

    const lines = stdout.trim().split('\n');
    const grouped: Record<string, string[]> = {
      TODO: [],
      FIXME: [],
      HACK: [],
      NOTE: [],
    };

    for (const line of lines) {
      if (line.includes('TODO:')) grouped.TODO.push(line);
      else if (line.includes('FIXME:')) grouped.FIXME.push(line);
      else if (line.includes('HACK:')) grouped.HACK.push(line);
      else if (line.includes('NOTE:')) grouped.NOTE.push(line);
    }

    let output = 'Code annotations found:\n\n';
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length > 0) {
        output += `${type} (${items.length}):\n`;
        output += items.slice(0, 10).join('\n') + '\n\n';
        if (items.length > 10) {
          output += `... and ${items.length - 10} more\n\n`;
        }
      }
    }

    return {
      success: true,
      output,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `TODO search failed: ${error?.message || error}`,
    };
  }
}

export async function analyzeDependencies(path?: string): Promise<ToolResult> {
  try {
    const projectPath = path ? resolve(path) : process.cwd();
    let output = 'Dependency Analysis:\n\n';

    // Check for package.json (Node.js)
    try {
      const packageJson = await readFile(
        resolve(projectPath, 'package.json'),
        'utf-8'
      );
      const pkg = JSON.parse(packageJson);

      if (pkg.dependencies) {
        output += `Dependencies (${Object.keys(pkg.dependencies).length}):\n`;
        for (const [name, version] of Object.entries(pkg.dependencies)) {
          output += `  ${name}: ${version}\n`;
        }
        output += '\n';
      }

      if (pkg.devDependencies) {
        output += `Dev Dependencies (${Object.keys(pkg.devDependencies).length}):\n`;
        for (const [name, version] of Object.entries(pkg.devDependencies)) {
          output += `  ${name}: ${version}\n`;
        }
        output += '\n';
      }
    } catch {
      // package.json not found or invalid
    }

    // Check for requirements.txt (Python)
    try {
      const requirements = await readFile(
        resolve(projectPath, 'requirements.txt'),
        'utf-8'
      );
      const lines = requirements.split('\n').filter((l) => l.trim() && !l.startsWith('#'));

      if (lines.length > 0) {
        output += `Python Requirements (${lines.length}):\n`;
        output += lines.join('\n') + '\n\n';
      }
    } catch {
      // requirements.txt not found
    }

    // Check for go.mod (Go)
    try {
      const goMod = await readFile(resolve(projectPath, 'go.mod'), 'utf-8');
      const lines = goMod.split('\n').filter((l) => l.trim().startsWith('require'));

      if (lines.length > 0) {
        output += `Go Dependencies:\n`;
        output += lines.join('\n') + '\n\n';
      }
    } catch {
      // go.mod not found
    }

    if (output === 'Dependency Analysis:\n\n') {
      return {
        success: true,
        output: 'No dependency files found (package.json, requirements.txt, go.mod).',
      };
    }

    return {
      success: true,
      output,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Dependency analysis failed: ${error?.message || error}`,
    };
  }
}

export async function countLines(path?: string): Promise<ToolResult> {
  try {
    const searchPath = path ? resolve(path) : process.cwd();

    const command = `find "${searchPath}" -type f \\( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.c" -o -name "*.cpp" -o -name "*.rs" \\) -exec wc -l {} + | tail -1`;

    const { stdout } = await execAsync(command, {
      timeout: 15000,
    });

    if (!stdout.trim()) {
      return {
        success: true,
        output: 'No code files found.',
      };
    }

    // Count by extension
    const extCommand = `find "${searchPath}" -type f \\( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.c" -o -name "*.cpp" -o -name "*.rs" \\) | sed 's/.*\\.//' | sort | uniq -c | sort -rn`;

    const { stdout: extStats } = await execAsync(extCommand, {
      timeout: 15000,
    });

    return {
      success: true,
      output: `Total lines: ${stdout.trim()}\n\nFiles by extension:\n${extStats}`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Line count failed: ${error?.message || error}`,
    };
  }
}
