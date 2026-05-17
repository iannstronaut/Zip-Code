import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface StatusBarProps {
  thinking: boolean;
  pendingTools: number;
  hint?: string;
  error?: string;
  warnings?: string[];
}

export function StatusBar({
  thinking,
  pendingTools,
  hint,
  error,
  warnings,
}: StatusBarProps): JSX.Element {
  return (
    <Box flexDirection="column">
      {warnings && warnings.length > 0 ? (
        <Box paddingX={1}>
          {warnings.map((w, i) => (
            <Text key={i} color="yellow">
              ⚠ {w}{' '}
            </Text>
          ))}
        </Box>
      ) : null}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        paddingX={1}
        borderStyle="single"
        borderColor="gray"
      >
        <Box>
          {thinking ? (
            <Text color="cyan">
              <Spinner type="dots" /> thinking…
            </Text>
          ) : pendingTools > 0 ? (
            <Text color="blue">
              <Spinner type="dots" /> running {pendingTools} tool
              {pendingTools > 1 ? 's' : ''}…
            </Text>
          ) : error ? (
            <Text color="red">⚠ {error}</Text>
          ) : (
            <Text color="green">● ready</Text>
          )}
        </Box>
        <Box>
          <Text color="gray">
            {hint ||
              '/help · Ctrl+S settings · Ctrl+T tools · Ctrl+P profiles · Ctrl+M memory · Ctrl+C quit'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
