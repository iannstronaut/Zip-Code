import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

export interface StreamingIndicatorProps {
  /** Active when delta events are flowing. */
  streaming: boolean;
  /** Total chars streamed so far for the current message. */
  charCount?: number;
  /** Timestamp (ms) when streaming started. */
  startedAt?: number;
  /** Timestamp (ms) of last delta — used to detect stalls. */
  lastDeltaAt?: number;
  /** Optional label override (e.g. "thinking"). */
  label?: string;
}

const FRAMES_FAST = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAMES_PULSE = ['◐', '◓', '◑', '◒'];

/**
 * Visible streaming indicator: animated spinner, elapsed time, char count,
 * and chars/sec. Detects stalls (no delta for >2s) and warns the user so it's
 * obvious if the connection has hung.
 */
export function StreamingIndicator({
  streaming,
  charCount = 0,
  startedAt,
  lastDeltaAt,
  label = 'streaming',
}: StreamingIndicatorProps): JSX.Element | null {
  const [frame, setFrame] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES_FAST.length);
      setNow(Date.now());
    }, 80);
    return () => clearInterval(id);
  }, [streaming]);

  if (!streaming) return null;

  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  const elapsedSec = elapsedMs / 1000;
  const stallMs = lastDeltaAt ? now - lastDeltaAt : 0;
  const stalled = stallMs > 2000;

  const cps = elapsedSec > 0.2 && charCount > 0 ? Math.round(charCount / elapsedSec) : 0;

  const spinner = stalled
    ? FRAMES_PULSE[frame % FRAMES_PULSE.length]
    : FRAMES_FAST[frame];

  const color = stalled ? 'yellow' : 'cyan';

  return (
    <Box>
      <Text color={color} bold>
        {spinner}
      </Text>
      <Text color={color}> {label}</Text>
      {charCount > 0 ? (
        <Text color="gray">
          {' '}
          · <Text color="white">{charCount}</Text> chars
        </Text>
      ) : null}
      {cps > 0 ? (
        <Text color="gray">
          {' '}
          · <Text color="white">{cps}</Text>/s
        </Text>
      ) : null}
      {elapsedSec >= 0.5 ? (
        <Text color="gray">
          {' '}
          · <Text color="white">{elapsedSec.toFixed(1)}s</Text>
        </Text>
      ) : null}
      {stalled ? (
        <Text color="yellow">
          {' '}
          ⚠ stalled {(stallMs / 1000).toFixed(1)}s
        </Text>
      ) : null}
    </Box>
  );
}

/**
 * Compact inline streaming dot - used at the end of a streaming message
 * to make it obvious where the cursor is.
 */
export function StreamingCursor({ active }: { active: boolean }): JSX.Element | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;
  return <Text color="cyanBright">{visible ? '▊' : ' '}</Text>;
}
