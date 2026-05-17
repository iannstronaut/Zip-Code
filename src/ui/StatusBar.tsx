import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { StreamingIndicator } from './StreamingIndicator.js';
import { gradient } from './theme.js';

export interface StatusBarProps {
  thinking: boolean;
  pendingTools: number;
  hint?: string;
  error?: string;
  warnings?: string[];
  // Streaming progress for the active assistant message
  streaming?: boolean;
  streamCharCount?: number;
  streamStartedAt?: number;
  streamLastDeltaAt?: number;
  // Optional: current profile name shown in left status
  profile?: string;
}

export function StatusBar({
  thinking,
  pendingTools,
  hint,
  error,
  warnings,
  streaming,
  streamCharCount,
  streamStartedAt,
  streamLastDeltaAt,
  profile,
}: StatusBarProps): JSX.Element {
  const colors = gradient(2);

  return (
    <Box flexDirection="column">
      {/* Warnings row */}
      {warnings && warnings.length > 0 ? (
        <Box paddingX={1} flexDirection="column">
          {warnings.map((w, i) => (
            <Text key={i} color="yellow">
              ⚠ {w}
            </Text>
          ))}
        </Box>
      ) : null}

      {/* Streaming progress row - only when actively streaming */}
      {streaming ? (
        <Box paddingX={1}>
          <StreamingIndicator
            streaming={streaming}
            charCount={streamCharCount}
            startedAt={streamStartedAt}
            lastDeltaAt={streamLastDeltaAt}
            label="receiving response"
          />
        </Box>
      ) : null}

      {/* Main status row */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        paddingX={1}
        borderStyle="single"
        borderColor={
          error
            ? 'red'
            : thinking || pendingTools > 0 || streaming
            ? colors[1]
            : 'gray'
        }
      >
        <Box>
          {thinking ? (
            <Text color="cyan">
              <Spinner type="dots12" /> thinking…
            </Text>
          ) : pendingTools > 0 ? (
            <Text color="blue">
              <Spinner type="dots12" /> running {pendingTools} tool
              {pendingTools > 1 ? 's' : ''}…
            </Text>
          ) : streaming ? (
            <Text color="cyan">⟳ streaming</Text>
          ) : error ? (
            <Text color="red" bold>
              ⚠ {error}
            </Text>
          ) : (
            <>
              <Text color="green" bold>● ready</Text>
              {profile && profile !== 'general' ? (
                <Text color="gray"> · profile: <Text color="magentaBright">{profile}</Text></Text>
              ) : null}
            </>
          )}
        </Box>
        <Box>
          <Text color="gray">
            {hint ||
              '/help · Ctrl+T tools · Ctrl+P profiles · Ctrl+M memory · Ctrl+E export · Ctrl+C quit'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
