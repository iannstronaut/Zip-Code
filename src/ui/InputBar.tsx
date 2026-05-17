import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { gradient } from './theme.js';

export interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InputBar({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: InputBarProps): JSX.Element {
  const colors = gradient(2);
  const isSlash = value.startsWith('/');
  const charCount = value.length;

  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor={disabled ? 'gray' : isSlash ? 'magenta' : colors[0]}
      paddingX={1}
    >
      <Box marginRight={1}>
        <Text color={disabled ? 'gray' : isSlash ? 'magentaBright' : colors[0]} bold>
          {disabled ? '⏳' : isSlash ? '⚡' : '▶'}
        </Text>
      </Box>
      <Box flexGrow={1}>
        {disabled ? (
          <Text color="gray" dimColor>
            {value || placeholder || '…'}
          </Text>
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder={placeholder || 'Type a message or /help…'}
          />
        )}
      </Box>
      {!disabled && charCount > 0 ? (
        <Box marginLeft={1}>
          <Text color="gray" dimColor>
            {charCount}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
