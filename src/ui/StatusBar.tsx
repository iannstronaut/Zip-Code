import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface StatusBarProps {
  thinking: boolean;
  pendingTools: number;
  hint?: string;
  error?: string;
}

export function StatusBar({
  thinking,
  pendingTools,
  hint,
  error,
}: StatusBarProps): JSX.Element {
  return (
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
            'Enter send · Ctrl+S settings · Ctrl+N new · Ctrl+L list · Ctrl+C quit'}
        </Text>
      </Box>
    </Box>
  );
}
