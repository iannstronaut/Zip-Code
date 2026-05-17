import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { memoryStore } from '../memory-tools.js';
import { gradient } from './theme.js';

export interface MemoryPanelProps {
  onClose: () => void;
}

interface MemoryEntry {
  id: string;
  category: string;
  content: string;
  createdAt?: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  user: '👤',
  project: '📁',
  tech: '🛠️ ',
  preference: '⚙️ ',
  fact: '📝',
};

export function MemoryPanel({ onClose }: MemoryPanelProps): JSX.Element {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const colors = gradient(2);

  useEffect(() => {
    memoryStore
      .list()
      .then((list) => {
        setEntries(list as MemoryEntry[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (entries.length === 0) return;
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(entries.length - 1, s + 1));
    if (key.pageUp) setSelected((s) => Math.max(0, s - 10));
    if (key.pageDown) setSelected((s) => Math.min(entries.length - 1, s + 10));
  });

  if (loading) {
    return (
      <Box borderStyle="round" borderColor={colors[0]} paddingX={1}>
        <Text color="cyan">
          <Spinner type="dots" /> Loading memory…
        </Text>
      </Box>
    );
  }

  // Group by category for stats
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + 1);
  }

  const VISIBLE = 14;
  const start = Math.max(0, Math.min(selected - Math.floor(VISIBLE / 2), entries.length - VISIBLE));
  const visible = entries.slice(Math.max(0, start), Math.max(0, start) + VISIBLE);

  const current = entries[selected];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors[0]} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={colors[0]} bold>
          🧠 Memory ({entries.length})
        </Text>
        <Text color="gray">↑↓ navigate · Esc close</Text>
      </Box>

      {/* Category stats */}
      {byCategory.size > 0 ? (
        <Box marginTop={1}>
          {Array.from(byCategory.entries()).map(([cat, count], i) => (
            <Text key={cat} color="gray">
              {i > 0 ? '  ' : ''}
              {CATEGORY_EMOJI[cat] || '•'} {cat}: <Text color="white">{count}</Text>
            </Text>
          ))}
        </Box>
      ) : null}

      {entries.length === 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">⚠ No memory entries yet</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Ask the agent to remember something:</Text>
            <Text color="cyan">  "remember that I prefer pnpm over npm"</Text>
            <Text color="gray">It will use the memory_add tool.</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {visible.map((entry, idx) => {
            const realIdx = Math.max(0, start) + idx;
            const isSelected = realIdx === selected;
            const emoji = CATEGORY_EMOJI[entry.category] || '•';
            return (
              <Box key={entry.id}>
                <Text
                  color={isSelected ? 'black' : 'white'}
                  backgroundColor={isSelected ? colors[1] : undefined}
                >
                  {' '}
                  {emoji} [{entry.category.padEnd(10)}] {truncate(entry.content, 60).padEnd(62)}{' '}
                </Text>
              </Box>
            );
          })}

          {current ? (
            <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
              <Text color={colors[1]} bold>
                {CATEGORY_EMOJI[current.category] || '•'} {current.category}
              </Text>
              <Text color="gray">id: {current.id}</Text>
              {current.createdAt ? (
                <Text color="gray">added: {new Date(current.createdAt).toISOString()}</Text>
              ) : null}
              <Box marginTop={1}>
                <Text wrap="wrap">{current.content}</Text>
              </Box>
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
