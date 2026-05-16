// Web search and HTTP tools for ZIP CODE

import type { ToolDefinition, ToolResult } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Web tools definitions
export const WEB_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web using DuckDuckGo. Returns search results with titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 5, max: 20).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'http_request',
      description:
        'Make an HTTP request using curl. Supports GET, POST, PUT, DELETE methods.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to request.',
          },
          method: {
            type: 'string',
            description: 'HTTP method (default: GET).',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          },
          headers: {
            type: 'object',
            description: 'HTTP headers as key-value pairs.',
          },
          body: {
            type: 'string',
            description: 'Request body (for POST/PUT/PATCH).',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'download_file',
      description: 'Download a file from a URL using curl.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL of the file to download.',
          },
          output: {
            type: 'string',
            description: 'Output file path.',
          },
        },
        required: ['url', 'output'],
      },
    },
  },
];

// ──────────── implementations ────────────

export async function webSearch(
  query: string,
  limit: number = 5
): Promise<ToolResult> {
  try {
    // Use DuckDuckGo instant answer API
    const maxResults = Math.min(limit, 20);
    const encodedQuery = encodeURIComponent(query);

    // Try using curl with DuckDuckGo HTML (simple scraping)
    const command = `curl -s "https://html.duckduckgo.com/html/?q=${encodedQuery}" | grep -oP '(?<=<a class="result__a" href=")[^"]*' | head -n ${maxResults}`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 15000,
      shell: '/bin/bash',
    });

    if (stderr && !stdout) {
      return {
        success: false,
        output: '',
        error: `Web search failed: ${stderr}`,
      };
    }

    if (!stdout.trim()) {
      return {
        success: true,
        output: `No results found for: ${query}`,
      };
    }

    const urls = stdout
      .trim()
      .split('\n')
      .filter((url) => url.startsWith('http'));

    const results = urls
      .map((url, i) => `${i + 1}. ${decodeURIComponent(url)}`)
      .join('\n');

    return {
      success: true,
      output: `Search results for "${query}":\n\n${results}\n\nNote: Use http_request to fetch content from these URLs.`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Web search failed: ${error?.message || error}`,
    };
  }
}

export async function httpRequest(
  url: string,
  method: string = 'GET',
  headers?: Record<string, string>,
  body?: string
): Promise<ToolResult> {
  try {
    let command = `curl -s -X ${method}`;

    // Add headers
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        command += ` -H "${key}: ${value}"`;
      }
    }

    // Add body for POST/PUT/PATCH
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      command += ` -d '${body.replace(/'/g, "'\\''")}'`;
    }

    command += ` "${url}"`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000,
    });

    if (stderr && !stdout) {
      return {
        success: false,
        output: '',
        error: `HTTP request failed: ${stderr}`,
      };
    }

    return {
      success: true,
      output: stdout || 'Request completed (no response body)',
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `HTTP request failed: ${error?.message || error}`,
    };
  }
}

export async function downloadFile(
  url: string,
  output: string
): Promise<ToolResult> {
  try {
    const command = `curl -L -o "${output}" "${url}"`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000,
    });

    return {
      success: true,
      output: `File downloaded: ${output}\n${stderr || stdout}`,
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: `Download failed: ${error?.message || error}`,
    };
  }
}
