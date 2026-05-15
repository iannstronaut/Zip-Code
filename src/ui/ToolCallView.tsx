import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ChatMessage } from '../types.js';

export interface ToolCallViewProps {
  message: ChatMessage;
}

const ICONS: Record<string, string> = {
  read_file: '📖',
  write_file: '✏️ ',
  list_dir: '📂',
  execute_bash: '⚡',
  grep: '🔎',
  glob: '🔍',
  ask_user: '❓',
};

export function ToolCallView({ message }: ToolCallViewProps): JSX.Element {
  const name = message.toolName || 'tool';
  const status = message.toolStatus || 'pending';
  const args = message.toolArgs || {};
  const icon = ICONS[name] || '🔧';

  const color =
    status === 'success' ? 'green' : status === 'error' ? 'red' : 'yellow';

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        <Text color={color}>
          {status === 'pending' ? <Spinner type="dots" /> : icon}{' '}
        </Text>
        <Text color={color} bold>
          {name}
        </Text>
        <Text color="gray"> {summarize(name, args)}</Text>
      </Box>
      {status !== 'pending' && message.content ? (
        <Box marginLeft={2} flexDirection="column">
          {previewContent(message.content, status === 'error').map((l, i) => (
            <Text key={i} color={status === 'error' ? 'red' : 'gray'}>
              {l}
            </Text>
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
