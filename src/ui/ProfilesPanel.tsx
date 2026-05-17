import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AGENT_PROFILES, type ProfileName } from '../agent-profiles.js';
import { gradient } from './theme.js';

export interface ProfilesPanelProps {
  onClose: () => void;
}

const PROFILE_EMOJI: Record<ProfileName, string> = {
  general: '🤖',
  orchestrator: '🎭',
  coder: '💻',
  reviewer: '🔍',
  debugger: '🐛',
  researcher: '📚',
  writer: '✍️ ',
};

export function ProfilesPanel({ onClose }: ProfilesPanelProps): JSX.Element {
  const [selected, setSelected] = useState(0);
  const colors = gradient(2);

  const profileNames = Object.keys(AGENT_PROFILES) as ProfileName[];
  const current = AGENT_PROFILES[profileNames[selected]];

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(profileNames.length - 1, s + 1));
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors[0]} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={colors[0]} bold>
          🎭 Agent Profiles ({profileNames.length})
        </Text>
        <Text color="gray">↑↓ navigate · Esc close</Text>
      </Box>

      <Box flexDirection="row" marginTop={1}>
        {/* Left: profile list */}
        <Box flexDirection="column" width={24}>
          {profileNames.map((name, idx) => {
            const isSelected = idx === selected;
            return (
              <Box key={name}>
                <Text
                  color={isSelected ? 'black' : 'white'}
                  backgroundColor={isSelected ? colors[1] : undefined}
                >
                  {' '}
                  {PROFILE_EMOJI[name]} {name.padEnd(15)}{' '}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Right: profile detail */}
        <Box flexDirection="column" paddingX={2} flexGrow={1}>
          <Text color={colors[1]} bold>
            {PROFILE_EMOJI[current.name]} {current.name}
          </Text>
          <Text color="gray">{current.description}</Text>

          <Box marginTop={1} flexDirection="column">
            <Text color={colors[1]}>Configuration:</Text>
            {current.model ? (
              <Text>
                <Text color="gray">  model:       </Text>
                <Text>{current.model}</Text>
              </Text>
            ) : (
              <Text>
                <Text color="gray">  model:       </Text>
                <Text color="gray">(uses default)</Text>
              </Text>
            )}
            <Text>
              <Text color="gray">  temperature: </Text>
              <Text>{current.temperature ?? '(default)'}</Text>
            </Text>
            <Text>
              <Text color="gray">  max iter:    </Text>
              <Text>{current.maxIterations ?? '(default)'}</Text>
            </Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text color={colors[1]}>Tools:</Text>
            {current.allowedTools && current.allowedTools.length > 0 ? (
              <Text color="green">  ✓ allowed: {current.allowedTools.join(', ')}</Text>
            ) : (
              <Text color="gray">  ✓ all tools</Text>
            )}
            {current.blockedTools && current.blockedTools.length > 0 ? (
              <Text color="red">  ✗ blocked: {current.blockedTools.join(', ')}</Text>
            ) : null}
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text color={colors[1]}>System prompt (preview):</Text>
            <Text color="gray" wrap="wrap">
              {truncate(current.systemPrompt, 280)}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
