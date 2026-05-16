// Git integration tools for ZIP CODE

import type { ToolDefinition, ToolResult } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Git tool definitions
export const GIT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Get the current git status of the repository.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Repository path (defaults to CWD).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Show git diff for staged or unstaged changes.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File or directory path to diff.',
          },
          staged: {
            type: 'boolean',
            description: 'Show staged changes (default: false).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Show git commit history.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of commits to show (default: 10).',
          },
          oneline: {
            type: 'boolean',
            description: 'Show one line per commit (default: true).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_branch',
      description: 'List, create, or switch git branches.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action: "list", "create", "switch", or "delete".',
            enum: ['list', 'create', 'switch', 'delete'],
          },
          name: {
            type: 'string',
            description: 'Branch name (required for create/switch/delete).',
          },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Create a git commit with staged changes.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Commit message.',
          },
          all: {
            type: 'boolean',
            description: 'Stage all changes before committing (default: false).',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_push',
      description: 'Push commits to remote repository.',
      parameters: {
        type: 'object',
        properties: {
          remote: {
            type: 'string',
            description: 'Remote name (default: origin).',
          },
          branch: {
            type: 'string',
            description: 'Branch name (defaults to current branch).',
          },
          force: {
            type: 'boolean',
            description: 'Force push (default: false).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_pull',
      description: 'Pull changes from remote repository.',
      parameters: {
        type: 'object',
        properties: {
          remote: {
            type: 'string',
            description: 'Remote name (default: origin).',
          },
          branch: {
            type: 'string',
            description: 'Branch name (defaults to current branch).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_add',
      description: 'Stage files for commit.',
      parameters: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'File paths to stage. Use ["."] for all files.',
          },
        },
        required: ['paths'],
      },
    },
  },
];

// ──────────── implementations ────────────

export async function gitStatus(path?: string): Promise<ToolResult> {
  try {
    const cwd = path || process.cwd();
    const { stdout, stderr } = await execAsync('git status --short --branch', {
      cwd,
      timeout: 10000,
    });

    if (stderr && !stdout) {
      return { success: false, output: '', error: stderr };
    }

    const fullStatus = await execAsync('git status', { cwd, timeout: 10000 });

    return {
      success: true,
      output: `${stdout}\n\n${fullStatus.stdout}`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Git status failed: ${error?.message || error}`,
    };
  }
}

export async function gitDiff(
  path?: string,
  staged: boolean = false
): Promise<ToolResult> {
  try {
    const cwd = process.cwd();
    const stagedFlag = staged ? '--staged' : '';
    const pathArg = path ? `-- ${path}` : '';
    const command = `git diff ${stagedFlag} ${pathArg}`.trim();

    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 15000,
    });

    if (stderr && !stdout) {
      return { success: false, output: '', error: stderr };
    }

    if (!stdout.trim()) {
      return {
        success: true,
        output: staged ? 'No staged changes.' : 'No unstaged changes.',
      };
    }

    return { success: true, output: stdout };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Git diff failed: ${error?.message || error}`,
    };
  }
}

export async function gitLog(
  limit: number = 10,
  oneline: boolean = true
): Promise<ToolResult> {
  try {
    const format = oneline
      ? '--oneline'
      : '--pretty=format:"%h - %an, %ar : %s"';
    const command = `git log ${format} -n ${limit}`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 10000,
    });

    if (stderr && !stdout) {
      return { success: false, output: '', error: stderr };
    }

    return { success: true, output: stdout };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Git log failed: ${error?.message || error}`,
    };
  }
}

export async function gitBranch(
  action: 'list' | 'create' | 'switch' | 'delete',
  name?: string
): Promise<ToolResult> {
  try {
    let command: string;

    switch (action) {
      case 'list':
        command = 'git branch -a';
        break;
      case 'create':
        if (!name) {
          return {
            success: false,
            output: '',
            error: 'Branch name required for create action',
          };
        }
        command = `git branch ${name}`;
        break;
      case 'switch':
        if (!name) {
          return {
            success: false,
            output: '',
            error: 'Branch name required for switch action',
          };
        }
        command = `git checkout ${name}`;
        break;
      case 'delete':
        if (!name) {
          return {
            success: false,
            output: '',
            error: 'Branch name required for delete action',
          };
        }
        command = `git branch -d ${name}`;
        break;
      default:
        return {
          success: false,
          output: '',
          error: `Unknown action: ${action}`,
        };
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 10000,
    });

    return {
      success: true,
      output: stdout || stderr || `Branch ${action} completed`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Git branch ${action} failed: ${error?.message || error}`,
    };
  }
}

export async function gitCommit(
  message: string,
  all: boolean = false
): Promise<ToolResult> {
  try {
    const allFlag = all ? '-a' : '';
    const command = `git commit ${allFlag} -m "${message.replace(/"/g, '\\"')}"`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 15000,
    });

    return {
      success: true,
      output: stdout || stderr || 'Commit created successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Git commit failed: ${error?.message || error}`,
    };
  }
}

export async function gitPush(
  remote: string = 'origin',
  branch?: string,
  force: boolean = false
): Promise<ToolResult> {
  try {
    const forceFlag = force ? '--force' : '';
    const branchArg = branch || '';
    const command = `git push ${forceFlag} ${remote} ${branchArg}`.trim();

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 30000,
    });

    return {
      success: true,
      output: stdout || stderr || 'Push completed successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Git push failed: ${error?.message || error}`,
    };
  }
}

export async function gitPull(
  remote: string = 'origin',
  branch?: string
): Promise<ToolResult> {
  try {
    const branchArg = branch || '';
    const command = `git pull ${remote} ${branchArg}`.trim();

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 30000,
    });

    return {
      success: true,
      output: stdout || stderr || 'Pull completed successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Git pull failed: ${error?.message || error}`,
    };
  }
}

export async function gitAdd(paths: string[]): Promise<ToolResult> {
  try {
    if (!paths || paths.length === 0) {
      return {
        success: false,
        output: '',
        error: 'At least one path required',
      };
    }

    const pathsStr = paths.join(' ');
    const command = `git add ${pathsStr}`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 15000,
    });

    return {
      success: true,
      output: stdout || stderr || `Files staged: ${pathsStr}`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Git add failed: ${error?.message || error}`,
    };
  }
}
