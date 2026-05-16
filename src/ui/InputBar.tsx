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
  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor={disabled ? 'gray' : colors[0]}
      paddingX={1}
    >
      <Box marginRight={1}>
        <Text color={colors[0]} bold>
          ▶
        </Text>
      </Box>
      <Box flexGrow={1}>
        {disabled ? (
          <Text color="gray">{value || placeholder || '…'}</Text>
        ) : (
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder={placeholder || 'Type a message…  (Enter to send)'}
          />
        )}
      </Box>
    </Box>
  );
}
