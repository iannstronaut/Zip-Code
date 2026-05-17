import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { budgetGuard } from '../budget-guard.js';
import { gradient } from './theme.js';

export interface BudgetPanelProps {
  onClose: () => void;
}

export function BudgetPanel({ onClose }: BudgetPanelProps): JSX.Element {
  const [snapshot, setSnapshot] = useState(() => budgetGuard.snapshot());
  const colors = gradient(2);

  useEffect(() => {
    const id = setInterval(() => setSnapshot(budgetGuard.snapshot()), 1000);
    return () => clearInterval(id);
  }, []);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
    }
  });

  const { limits, percentages } = snapshot;
  const isActive = budgetGuard.isActive();

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors[0]} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={colors[0]} bold>
          💰 Budget Guard
        </Text>
        <Text color="gray">live · Esc close</Text>
      </Box>

      {!isActive ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">⚠ No budget limits configured</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Set environment variables to enable caps:</Text>
            <Text>
              <Text color="cyan">  ZIPCODE_BUDGET_USD</Text>
              <Text color="gray">=5.00       </Text>
              <Text color="gray"># stop after $5</Text>
            </Text>
            <Text>
              <Text color="cyan">  ZIPCODE_BUDGET_TOKENS</Text>
              <Text color="gray">=200000  </Text>
              <Text color="gray"># stop after 200k tokens</Text>
            </Text>
            <Text>
              <Text color="cyan">  ZIPCODE_BUDGET_TOOLCALLS</Text>
              <Text color="gray">=200  </Text>
              <Text color="gray"># stop after 200 calls</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Soft warnings fire at 75% and 90% of each limit.</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {limits.usd !== undefined ? (
            <Box flexDirection="column">
              <Text>
                <Text color="gray">USD:        </Text>
                <Text bold>${snapshot.usdSpent.toFixed(4)}</Text>
                <Text color="gray"> / </Text>
                <Text>${limits.usd.toFixed(2)}</Text>
                <Text color="gray"> ({(percentages.usd || 0).toFixed(1)}%)</Text>
              </Text>
              {progressBar(percentages.usd || 0)}
            </Box>
          ) : null}

          {limits.tokens !== undefined ? (
            <Box flexDirection="column" marginTop={1}>
              <Text>
                <Text color="gray">Tokens:     </Text>
                <Text bold>{snapshot.tokensUsed.toLocaleString()}</Text>
                <Text color="gray"> / </Text>
                <Text>{limits.tokens.toLocaleString()}</Text>
                <Text color="gray"> ({(percentages.tokens || 0).toFixed(1)}%)</Text>
              </Text>
              {progressBar(percentages.tokens || 0)}
            </Box>
          ) : null}

          {limits.toolCalls !== undefined ? (
            <Box flexDirection="column" marginTop={1}>
              <Text>
                <Text color="gray">Tool calls: </Text>
                <Text bold>{snapshot.toolCallsMade}</Text>
                <Text color="gray"> / </Text>
                <Text>{limits.toolCalls}</Text>
                <Text color="gray"> ({(percentages.toolCalls || 0).toFixed(1)}%)</Text>
              </Text>
              {progressBar(percentages.toolCalls || 0)}
            </Box>
          ) : null}

          <Box marginTop={1}>
            <Text color="gray">Type /budget reset to clear counters</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function progressBar(percent: number): JSX.Element {
  const width = 40;
  const filled = Math.round((Math.min(100, percent) / 100) * width);
  const color = percent >= 90 ? 'red' : percent >= 75 ? 'yellow' : 'green';
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return (
    <Text color={color}>{bar}</Text>
  );
}
