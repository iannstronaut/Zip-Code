import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ChatMessage } from '../types.js';

export interface ToolCallViewProps {
  message: ChatMessage;
}

const ICONS: Record<string, string> = {
  // Filesystem & shell
  read_file: '📖',
  write_file: '✏️ ',
  list_dir: '📂',
  execute_bash: '⚡',
  grep: '🔎',
  glob: '🔍',
  ask_user: '❓',
  // Git
  git_status: '🔀',
  git_diff: '📝',
  git_log: '📜',
  git_branch: '🌿',
  git_commit: '💾',
  git_push: '⬆️ ',
  git_pull: '⬇️ ',
  git_add: '➕',
  // Web
  web_search: '🌐',
  http_request: '📡',
  download_file: '⬇️ ',
  // Watcher
  watch_file: '👁️ ',
  stop_watch: '🛑',
  list_watches: '👀',
  // Code analysis
  analyze_complexity: '📊',
  find_todos: '📋',
  analyze_dependencies: '📦',
  count_lines: '🔢',
  // Database
  sql_query: '🗄️ ',
  sql_schema: '🏛️ ',
  // Multi-agent
  delegate_task: '🤝',
  list_profiles: '🎭',
  // Memory
  memory_add: '🧠',
  memory_search: '🔍',
  memory_list: '📚',
  memory_remove: '🗑️ ',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  success: 'green',
  error: 'red',
};

const STATUS_BADGES: Record<string, string> = {
  pending: '⏳',
  success: '✓',
  error: '✗',
};

export function ToolCallView({ message }: ToolCallViewProps): JSX.Element {
  const name = message.toolName || 'tool';
  const status = message.toolStatus || 'pending';
  const args = message.toolArgs || {};
  const icon = ICONS[name] || '🔧';
  const color = STATUS_COLORS[status] || 'gray';
  const badge = STATUS_BADGES[status] || '•';

  // For MCP tools, strip the prefix for display
  const displayName = name.startsWith('mcp__')
    ? name.replace(/^mcp__([^_]+(?:_[^_]+)*?)__/, '🔌 $1::')
    : name;

  // Track elapsed time for pending tools
  const [, setTick] = useState(0);
  const startTime = (message as any).toolStartedAt || message.createdAt || Date.now();
  useEffect(() => {
    if (status !== 'pending') return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [status]);

  const elapsed = Date.now() - startTime;
  const elapsedSec = (elapsed / 1000).toFixed(1);

  return (
    <Box flexDirection="column" marginTop={0}>
      <Box>
        {status === 'pending' ? (
          <Text color={color}>
            <Spinner type="dots12" />
          </Text>
        ) : (
          <Text color={color} bold>
            {badge}
          </Text>
        )}
        <Text> </Text>
        <Text>{icon}</Text>
        <Text color={color} bold>
          {' '}{displayName}
        </Text>
        <Text color="gray"> {summarize(name, args)}</Text>
        {status === 'pending' && elapsed > 500 ? (
          <Text color="gray"> · {elapsedSec}s</Text>
        ) : null}
        {status !== 'pending' && message.content && elapsed > 100 ? (
          <Text color="gray"> · {formatBytes(message.content.length)}</Text>
        ) : null}
      </Box>
      {status !== 'pending' && message.content ? (
        <Box marginLeft={3} flexDirection="column">
          {previewContent(message.content, status === 'error').map((l, i) => (
            <Box key={i}>
              <Text color="gray">│ </Text>
              <Text color={status === 'error' ? 'red' : 'gray'}>{l}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function summarize(name: string, args: any): string {
  if (!args || typeof args !== 'object') return '';
  switch (name) {
    case 'read_file':
    case 'write_file':
      return args.path || '';
    case 'list_dir':
      return args.path || '.';
    case 'execute_bash':
      return truncate(args.command || '', 80);
    case 'grep':
      return `"${truncate(args.pattern || '', 40)}" in ${args.path || '.'}`;
    case 'glob':
      return `${args.pattern || ''}${args.path ? ' in ' + args.path : ''}`;
    case 'ask_user':
      return truncate(args.question || '', 80);
    case 'git_commit':
      return truncate(args.message || '', 60);
    case 'git_branch':
      return args.action ? `${args.action} ${args.name || ''}` : '';
    case 'web_search':
      return `"${truncate(args.query || '', 50)}"`;
    case 'http_request':
      return `${args.method || 'GET'} ${truncate(args.url || '', 60)}`;
    case 'sql_query':
      return truncate(args.query || '', 70);
    case 'sql_schema':
      return args.db_path || '';
    case 'delegate_task':
      return `→ ${args.profile || 'general'}: ${truncate(args.task || '', 50)}`;
    case 'memory_add':
    case 'memory_search':
      return truncate(args.content || args.query || '', 60);
    default:
      return truncate(JSON.stringify(args), 80);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function previewContent(s: string, isError: boolean): string[] {
  const max = isError ? 6 : 8;
  const lines = s.split(/\r?\n/);
  if (lines.length <= max) return lines;
  return [...lines.slice(0, max), `… (+${lines.length - max} lines)`];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
