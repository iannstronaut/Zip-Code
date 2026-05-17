import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { exportConversation, type ExportFormat } from '../conversation-export.js';
import type { ChatMessage } from '../types.js';
import { gradient } from './theme.js';
import { join } from 'path';
import { homedir } from 'os';

export interface ExportPanelProps {
  messages: ChatMessage[];
  sessionTitle: string;
  onClose: () => void;
}

const FORMATS: Array<{ format: ExportFormat; label: string; emoji: string; ext: string }> = [
  { format: 'markdown', label: 'Markdown', emoji: '📝', ext: 'md' },
  { format: 'html', label: 'HTML (dark mode)', emoji: '🌐', ext: 'html' },
  { format: 'json', label: 'JSON', emoji: '📋', ext: 'json' },
];

type Status =
  | { type: 'idle' }
  | { type: 'exporting'; format: ExportFormat }
  | { type: 'success'; path: string; size: number }
  | { type: 'error'; message: string };

export function ExportPanel({ messages, sessionTitle, onClose }: ExportPanelProps): JSX.Element {
  const [selected, setSelected] = useState(0);
  const [hideTools, setHideTools] = useState(false);
  const [hideSystem, setHideSystem] = useState(true);
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const colors = gradient(2);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (status.type === 'exporting') return;

    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(FORMATS.length - 1, s + 1));
    if (input === 't') setHideTools((v) => !v);
    if (input === 'y') setHideSystem((v) => !v);

    if (key.return) {
      const fmt = FORMATS[selected];
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `zipcode-export-${ts}.${fmt.ext}`;
      const outPath = join(homedir(), '.zipcode', 'exports', filename);
      setStatus({ type: 'exporting', format: fmt.format });
      exportConversation(messages, outPath, fmt.format, {
        title: sessionTitle,
        hideTools,
        hideSystem,
      })
        .then((res) => setStatus({ type: 'success', path: res.path, size: res.size }))
        .catch((e) => setStatus({ type: 'error', message: e?.message || 'export failed' }));
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors[0]} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={colors[0]} bold>
          📤 Export Conversation
        </Text>
        <Text color="gray">{messages.length} messages · Esc close</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={colors[1]} bold>
          Format:
        </Text>
        {FORMATS.map((f, idx) => {
          const isSelected = idx === selected;
          return (
            <Box key={f.format}>
              <Text
                color={isSelected ? 'black' : 'white'}
                backgroundColor={isSelected ? colors[1] : undefined}
              >
                {' '}
                {isSelected ? '▶ ' : '  '}
                {f.emoji} {f.label.padEnd(20)}{' '}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={colors[1]} bold>
          Options:
        </Text>
        <Text>
          <Text color="gray">  [t] hide tool calls:    </Text>
          <Text color={hideTools ? 'green' : 'red'}>{hideTools ? '✓ on' : '✗ off'}</Text>
        </Text>
        <Text>
          <Text color="gray">  [y] hide system msgs:   </Text>
          <Text color={hideSystem ? 'green' : 'red'}>{hideSystem ? '✓ on' : '✗ off'}</Text>
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">↑↓ format · t/y toggle · Enter export · Esc cancel</Text>
      </Box>

      {status.type === 'exporting' ? (
        <Box marginTop={1}>
          <Text color="cyan">⏳ Exporting as {status.format}…</Text>
        </Box>
      ) : null}

      {status.type === 'success' ? (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="green" paddingX={1}>
          <Text color="green" bold>
            ✓ Exported successfully
          </Text>
          <Text>
            <Text color="gray">Path: </Text>
            <Text color="cyan">{status.path}</Text>
          </Text>
          <Text>
            <Text color="gray">Size: </Text>
            <Text>{formatBytes(status.size)}</Text>
          </Text>
        </Box>
      ) : null}

      {status.type === 'error' ? (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="red" paddingX={1}>
          <Text color="red" bold>
            ✗ Export failed
          </Text>
          <Text color="red">{status.message}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
