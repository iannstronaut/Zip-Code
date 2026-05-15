import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SessionRow } from '../types.js';
import { gradient } from './theme.js';

export interface SessionListProps {
  sessions: SessionRow[];
  currentSessionId: string;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  onCancel: () => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelect,
  onNew,
  onCancel,
}: SessionListProps): JSX.Element {
  const [selected, setSelected] = useState(() => {
    const idx = sessions.findIndex((s) => s.id === currentSessionId);
    return idx >= 0 ? idx : 0;
  });

  const colors = gradient(2);

  useInput((input: string, key: any) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setSelected((s) => Math.max(0, s - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((s) => Math.min(sessions.length - 1, s + 1));
      return;
    }
    if (key.return) {
      const sess = sessions[selected];
      if (sess) onSelect(sess.id);
      return;
    }
    if (input === 'n' || input === 'N') {
      onNew();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors[0]}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={colors[0]} bold>
          ◆ Sessions
        </Text>
        <Text color="gray">
          {' '}· ↑↓ select · Enter open · n new · Esc cancel
        </Text>
      </Box>
      {sessions.length === 0 ? (
        <Text color="gray">No sessions yet. Press 'n' to start one.</Text>
      ) : (
        sessions.map((s, i) => {
          const active = i === selected;
          const current = s.id === currentSessionId;
          return (
            <Box key={s.id}>
              <Text color={active ? 'cyanBright' : current ? 'magenta' : 'gray'}>
                {active ? '› ' : '  '}
              </Text>
              <Box flexGrow={1}>
                <Text
                  color={active ? 'cyanBright' : current ? 'white' : 'white'}
                  bold={active}
                >
                  {truncate(s.title || '(untitled)', 40)}
                </Text>
              </Box>
              <Box>
                <Text color="gray">
                  {s.messageCount} msg · {timeAgo(s.updatedAt)}
                  {current ? ' · current' : ''}
                </Text>
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
