// MCP (Model Context Protocol) client
// Connects to external MCP servers via stdio transport and exposes their tools.
// Spec: https://modelcontextprotocol.io
//
// Supports:
// - stdio transport (spawns a child process and speaks JSON-RPC over stdin/stdout)
// - tools/list and tools/call
// - Multiple servers configured at ~/.zipcode/mcp-servers.json
//
// Each MCP tool is exposed as a regular ToolDefinition with name `mcp__<server>__<tool>`.

import { spawn, ChildProcess } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ToolDefinition, ToolResult } from './types';
import { logger } from './logger';

export interface MCPServerConfig {
  name: string;
  /** Command to spawn the server (e.g. ["npx", "-y", "@modelcontextprotocol/server-filesystem"]). */
  command: string[];
  /** Optional environment variables. */
  env?: Record<string, string>;
  /** Whether this server is enabled. */
  enabled?: boolean;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any;
}

const CONFIG_DIR = join(homedir(), '.zipcode');
const CONFIG_FILE = join(CONFIG_DIR, 'mcp-servers.json');

// ──────────── connection ────────────

class MCPConnection {
  private proc: ChildProcess | null = null;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (err: Error) => void }
  >();
  private tools: MCPTool[] = [];
  public initialized = false;

  constructor(public config: MCPServerConfig) {}

  async start(): Promise<void> {
    if (this.proc) return;

    const [cmd, ...args] = this.config.command;
    if (!cmd) throw new Error(`Empty command for MCP server '${this.config.name}'`);

    this.proc = spawn(cmd, args, {
      env: { ...process.env, ...(this.config.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8');
      this.flushBuffer();
    });

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      logger.debug(`[mcp:${this.config.name}] stderr`, { data: chunk.toString('utf-8') });
    });

    this.proc.on('exit', (code) => {
      logger.warn(`MCP server '${this.config.name}' exited`, { code });
      this.cleanup();
    });

    this.proc.on('error', (err) => {
      logger.error(`MCP server '${this.config.name}' error`, err);
      this.cleanup();
    });

    // Initialize handshake
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'zipcode', version: '2.5.0' },
    });
    await this.notify('notifications/initialized', {});

    // Discover tools
    const result = await this.request('tools/list', {});
    this.tools = result?.tools || [];
    this.initialized = true;

    logger.info(`MCP server '${this.config.name}' connected`, {
      toolCount: this.tools.length,
    });
  }

  private flushBuffer(): void {
    let newlineIdx;
    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);
      if (!line) continue;

      try {
        const msg: JsonRpcResponse = JSON.parse(line);
        if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(`${msg.error.code}: ${msg.error.message}`));
          } else {
            resolve(msg.result);
          }
        }
      } catch (e: any) {
        logger.debug(`[mcp:${this.config.name}] parse error`, { line, error: e?.message });
      }
    }
  }

  private async request(method: string, params: any): Promise<any> {
    if (!this.proc?.stdin) throw new Error(`MCP server '${this.config.name}' not running`);

    const id = this.nextId++;
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc!.stdin!.write(JSON.stringify(req) + '\n');

      // Timeout after 30s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private async notify(method: string, params: any): Promise<void> {
    if (!this.proc?.stdin) return;
    const msg = { jsonrpc: '2.0', method, params };
    this.proc.stdin.write(JSON.stringify(msg) + '\n');
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.request('tools/call', { name, arguments: args });
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  cleanup(): void {
    this.initialized = false;
    this.pending.forEach(({ reject }) => {
      reject(new Error(`MCP server '${this.config.name}' disconnected`));
    });
    this.pending.clear();
    this.proc = null;
  }

  shutdown(): void {
    if (this.proc) {
      this.proc.kill();
      this.cleanup();
    }
  }
}

// ──────────── manager ────────────

class MCPManager {
  private connections = new Map<string, MCPConnection>();

  async loadConfig(): Promise<MCPServerConfig[]> {
    if (!existsSync(CONFIG_FILE)) return [];
    try {
      const raw = await readFile(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : parsed.servers || [];
    } catch (e: any) {
      logger.error('Failed to load MCP config', e);
      return [];
    }
  }

  async saveConfig(servers: MCPServerConfig[]): Promise<void> {
    if (!existsSync(CONFIG_DIR)) await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify({ servers }, null, 2), 'utf-8');
  }

  async connectAll(): Promise<{ connected: string[]; failed: string[] }> {
    const servers = await this.loadConfig();
    const connected: string[] = [];
    const failed: string[] = [];

    for (const config of servers) {
      if (config.enabled === false) continue;
      try {
        const conn = new MCPConnection(config);
        await conn.start();
        this.connections.set(config.name, conn);
        connected.push(config.name);
      } catch (e: any) {
        logger.error(`Failed to connect to MCP server '${config.name}'`, e);
        failed.push(`${config.name}: ${e?.message || e}`);
      }
    }

    return { connected, failed };
  }

  /** Get all tools from all connected servers, namespaced as mcp__<server>__<tool>. */
  getToolDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    this.connections.forEach((conn, serverName) => {
      if (!conn.initialized) return;
      for (const tool of conn.getTools()) {
        defs.push({
          type: 'function',
          function: {
            name: `mcp__${serverName}__${tool.name}`,
            description: `[MCP:${serverName}] ${tool.description || tool.name}`,
            parameters: tool.inputSchema || {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        });
      }
    });
    return defs;
  }

  /** Execute an MCP tool. Returns ToolResult. */
  async execute(toolName: string, args: any): Promise<ToolResult> {
    // Parse mcp__<server>__<tool>
    const match = toolName.match(/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/);
    if (!match) {
      return {
        success: false,
        output: '',
        error: `Invalid MCP tool name: ${toolName}`,
      };
    }

    const [, serverName, actualTool] = match;
    const conn = this.connections.get(serverName);
    if (!conn || !conn.initialized) {
      return {
        success: false,
        output: '',
        error: `MCP server '${serverName}' not connected`,
      };
    }

    try {
      const result = await conn.callTool(actualTool, args);
      const content = result?.content || [];
      const text = Array.isArray(content)
        ? content
            .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
            .join('\n')
        : JSON.stringify(result);

      return { success: !result?.isError, output: text };
    } catch (e: any) {
      return {
        success: false,
        output: '',
        error: `MCP call failed: ${e?.message || e}`,
      };
    }
  }

  isMCPTool(toolName: string): boolean {
    return toolName.startsWith('mcp__');
  }

  listConnections(): { name: string; toolCount: number; initialized: boolean }[] {
    return Array.from(this.connections.entries()).map(([name, conn]) => ({
      name,
      toolCount: conn.getTools().length,
      initialized: conn.initialized,
    }));
  }

  shutdown(): void {
    this.connections.forEach((conn) => {
      conn.shutdown();
    });
    this.connections.clear();
  }
}

export const mcpManager = new MCPManager();

// Cleanup on exit
process.on('exit', () => mcpManager.shutdown());
process.on('SIGINT', () => {
  mcpManager.shutdown();
  process.exit(0);
});
