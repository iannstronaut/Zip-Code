import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { promptTemplates, type PromptTemplate } from '../prompt-templates.js';
import { gradient } from './theme.js';

export interface TemplatesPanelProps {
  onClose: () => void;
  onUse?: (rendered: string) => void;
}

const SOURCE_EMOJI: Record<PromptTemplate['source'], string> = {
  builtin: '📦',
  user: '👤',
  project: '📁',
};

export function TemplatesPanel({ onClose, onUse }: TemplatesPanelProps): JSX.Element {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const colors = gradient(2);

  useEffect(() => {
    promptTemplates
      .list()
      .then((list) => {
        setTemplates(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (templates.length === 0) return;
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(templates.length - 1, s + 1));
    if (key.return && onUse) {
      const t = templates[selected];
      onUse(`/template ${t.name}`);
      onClose();
    }
  });

  if (loading) {
    return (
      <Box borderStyle="round" borderColor={colors[0]} paddingX={1}>
        <Text color="cyan">
          <Spinner type="dots" /> Loading templates…
        </Text>
      </Box>
    );
  }

  const current = templates[selected];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors[0]} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={colors[0]} bold>
          📝 Prompt Templates ({templates.length})
        </Text>
        <Text color="gray">↑↓ navigate · Enter use · Esc close</Text>
      </Box>

      <Box flexDirection="row" marginTop={1}>
        {/* Left: templates list */}
        <Box flexDirection="column" width={28}>
          {templates.map((t, idx) => {
            const isSelected = idx === selected;
            return (
              <Box key={t.name}>
                <Text
                  color={isSelected ? 'black' : 'white'}
                  backgroundColor={isSelected ? colors[1] : undefined}
                >
                  {' '}
                  {SOURCE_EMOJI[t.source]} {t.name.padEnd(20)}{' '}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Right: detail */}
        {current ? (
          <Box flexDirection="column" paddingX={2} flexGrow={1}>
            <Text color={colors[1]} bold>
              {SOURCE_EMOJI[current.source]} {current.name}
            </Text>
            <Text color="gray">{current.description}</Text>

            <Box marginTop={1}>
              <Text>
                <Text color="gray">Source:    </Text>
                <Text>{current.source}</Text>
              </Text>
            </Box>
            {current.variables.length > 0 ? (
              <Box>
                <Text>
                  <Text color="gray">Variables: </Text>
                  <Text color="yellow">
                    {current.variables.map((v) => `{{${v}}}`).join(', ')}
                  </Text>
                </Text>
              </Box>
            ) : (
              <Box>
                <Text color="gray">Variables: (none)</Text>
              </Box>
            )}

            <Box marginTop={1} flexDirection="column">
              <Text color={colors[1]}>Body:</Text>
              <Text color="gray" wrap="wrap">
                {truncate(current.body, 400)}
              </Text>
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
