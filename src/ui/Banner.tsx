import React from 'react';
import { Box, Text } from 'ink';
import { gradient } from './theme.js';

const ASCII = [
  ' ███████╗██╗██████╗      ██████╗ ██████╗ ██████╗ ███████╗',
  ' ╚══███╔╝██║██╔══██╗    ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
  '   ███╔╝ ██║██████╔╝    ██║     ██║   ██║██║  ██║█████╗  ',
  '  ███╔╝  ██║██╔═══╝     ██║     ██║   ██║██║  ██║██╔══╝  ',
  ' ███████╗██║██║         ╚██████╗╚██████╔╝██████╔╝███████╗',
  ' ╚══════╝╚═╝╚═╝          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
];

export interface BannerProps {
  compact?: boolean;
  subtitle?: string;
}

export function Banner({ compact = false, subtitle }: BannerProps): JSX.Element {
  const colors = gradient(ASCII.length);

  if (compact) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors[0]} bold>
          {' '}ZIP CODE
          <Text color={colors[colors.length - 1]}> · TUI</Text>
        </Text>
        {subtitle ? <Text color="gray">{subtitle}</Text> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {ASCII.map((line, i) => (
        <Text key={i} color={colors[i]}>
          {line}
        </Text>
      ))}
      {subtitle ? (
        <Box marginTop={1}>
          <Text color="gray">{subtitle}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
