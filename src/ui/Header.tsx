import React from 'react';
import { Box, Text } from 'ink';
import { gradient } from './theme.js';

export interface HeaderProps {
  providerName: string;
  model: string;
  cwd: string;
  sessionTitle: string;
}

export function Header({
  providerName,
  model,
  cwd,
  sessionTitle,
}: HeaderProps): JSX.Element {
  const colors = gradient(2);
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="round"
      borderColor={colors[0]}
      paddingX={1}
    >
      <Box flexDirection="row">
        <Text color={colors[0]} bold>
          ZIP CODE
        </Text>
        <Text color="gray"> · </Text>
        <Text color={colors[1]}>{providerName}</Text>
        <Text color="gray">/</Text>
        <Text color="white">{model}</Text>
      </Box>
      <Box>
        <Text color="gray">{sessionTitle}</Text>
      </Box>
      <Box>
        <Text color="gray">{shorten(cwd, 40)}</Text>
      </Box>
    </Box>
  );
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return '…' + s.slice(s.length - max + 1);
}
