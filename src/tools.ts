// Tool implementations for ZIP CODE

import type { ToolDefinition, ToolResult } from './types';
import { existsSync } from 'fs';
import { readdir, stat, readFile as fsReadFile, writeFile as fsWriteFile } from 'fs/promises';
import { join, resolve } from 'path';
import enquirer from 'enquirer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Tool definitions for LLM
export const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file from the filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to read (relative or absolute)',
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
      description: 'Write content to a file (creates new file or overwrites existing)',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to write',
          },
          content: {
            type: 'string',
            description: 'The content to write to the file',
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
      description: 'List contents of a directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The directory path to list (defaults to current directory)',
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
      description: 'Execute a bash/shell command. Use with caution.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Ask the user a question and wait for their response',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask the user',
          },
        },
        required: ['question'],
      },
    },
  },
];

// Tool implementations
export async function readFile(path: string): Promise<ToolResult> {
  try {
    const resolvedPath = resolve(path);
    
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        output: '',
        error: `File not found: ${path}`,
      };
    }

    const content = await fsReadFile(resolvedPath, 'utf-8');

    return {
      success: true,
      output: content,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Error reading file: ${error}`,
    };
  }
}

export async function writeFile(path: string, content: string): Promise<ToolResult> {
  try {
    const resolvedPath = resolve(path);
    
    await fsWriteFile(resolvedPath, content, 'utf-8');

    return {
      success: true,
      output: `File written successfully: ${path}`,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Error writing file: ${error}`,
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
        const stats = await stat(fullPath);
        const type = stats.isDirectory() ? 'dir' : 'file';
        const size = stats.isFile() ? stats.size : 0;
        return { name: entry, type, size };
      })
    );

    const output = details
      .map((d) => {
        const sizeStr = d.type === 'file' ? ` (${d.size} bytes)` : '';
        return `${d.type === 'dir' ? '📁' : '📄'} ${d.name}${sizeStr}`;
      })
      .join('\n');

    return {
      success: true,
      output: output || 'Empty directory',
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Error listing directory: ${error}`,
    };
  }
}

export async function executeBash(command: string): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    return {
      success: true,
      output: stdout || 'Command executed successfully (no output)',
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message || 'Command execution failed',
    };
  }
}

export async function askUser(question: string): Promise<ToolResult> {
  try {
    const response: any = await enquirer.prompt({
      type: 'input',
      name: 'answer',
      message: question,
    });

    return {
      success: true,
      output: response.answer,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: 'User cancelled or error occurred',
    };
  }
}

// Execute tool by name
export async function executeTool(name: string, args: any): Promise<ToolResult> {
  switch (name) {
    case 'read_file':
      return readFile(args.path);
    case 'write_file':
      return writeFile(args.path, args.content);
    case 'list_dir':
      return listDir(args.path);
    case 'execute_bash':
      return executeBash(args.command);
    case 'ask_user':
      return askUser(args.question);
    default:
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${name}`,
      };
  }
}
