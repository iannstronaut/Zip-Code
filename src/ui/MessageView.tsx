import React from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../types.js';
import { renderMarkdownLines } from './markdown.js';
import { ToolCallView } from './ToolCallView.js';
import { gradient } from './theme.js';

export interface MessageViewProps {
  messages: ChatMessage[];
  maxHeight?: number;
}

export function MessageView({
  messages,
  maxHeight,
}: MessageViewProps): JSX.Element {
  // Skip empty messages and system messages (handled elsewhere)
  const visible = messages.filter((m) => {
    if (m.role === 'system') return false;
    if (m.role === 'assistant' && !m.content && !m.toolCalls?.length)
      return false;
    return true;
  });

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {visible.length === 0 ? <EmptyState /> : null}
      {visible.map((m) => (
        <MessageRow key={m.id} message={m} />
      ))}
    </Box>
  );
}

function EmptyState(): JSX.Element {
  const colors = gradient(2);
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color={colors[0]} bold>
        Welcome to ZIP CODE.
      </Text>
      <Text color="gray">
        Ask anything, or try: "list files in src/", "read package.json", or
        "what does agent.ts do?"
      </Text>
      <Box marginTop={1}>
        <Text color="gray">Press </Text>
        <Text color={colors[1]} bold>
          Ctrl+S
        </Text>
        <Text color="gray"> to configure your provider.</Text>
      </Box>
    </Box>
  );
}

function MessageRow({ message }: { message: ChatMessage }): JSX.Element {
  if (message.role === 'tool') {
    return <ToolCallView message={message} />;
  }

  const isUser = message.role === 'user';
  const label = isUser ? 'You' : 'ZIP CODE';
  const labelColor = isUser ? 'magentaBright' : 'cyanBright';
  const accent = isUser ? 'magenta' : 'cyan';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={accent}>▎</Text>
        <Text color={labelColor} bold>
          {' '}
          {label}
        </Text>
        {message.streaming ? (
          <Text color="gray"> · streaming…</Text>
        ) : null}
      </Box>
      {message.content ? (
        <Box marginLeft={2} flexDirection="column">
          {renderMarkdownLines(message.content).map((line, i) => (
            <RenderedLine key={i} line={line} />
          ))}
        </Box>
      ) : null}
      {message.toolCalls && message.toolCalls.length > 0 ? (
        <Box marginLeft={2} flexDirection="column">
          {message.toolCalls.map((tc) => (
            <Text key={tc.id} color="gray">
              → calling{' '}
              <Text color="blueBright" bold>
                {tc.function.name}
              </Text>
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function RenderedLine({
  line,
}: {
  line: ReturnType<typeof renderMarkdownLines>[number];
}): JSX.Element {
  switch (line.type) {
    case 'code':
      return (
        <Box>
          <Text color="gray">│ </Text>
          <Text color="cyan">{line.text}</Text>
        </Box>
      );
    case 'heading':
      return (
        <Text color="yellow" bold>
          {line.text}
        </Text>
      );
    case 'rule':
      return <Text color="gray">────────────────────────────────────</Text>;
    case 'list':
      return (
        <Box>
          <Text color="gray">  • </Text>
          <Text>{line.text}</Text>
        </Box>
      );
    case 'quote':
      return (
        <Box>
          <Text color="gray">│ </Text>
          <Text color="gray">{line.text}</Text>
        </Box>
      );
    default:
      return <Text>{line.text}</Text>;
  }
}
