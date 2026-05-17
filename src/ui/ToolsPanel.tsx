import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TOOLS } from '../tools.js';
import { mcpManager } from '../mcp-client.js';
import { gradient } from './theme.js';

export interface ToolsPanelProps {
  onClose: () => void;
}

interface ToolGroup {
  category: string;
  prefix: string | RegExp;
  emoji: string;
}

// Categories ordered for the panel. Anything that doesn't match falls into "Other".
const GROUPS: ToolGroup[] = [
  { category: 'Filesystem & Shell', prefix: /^(read_file|write_file|list_dir|execute_bash|grep|glob|ask_user)$/, emoji: '📁' },
  { category: 'Git', prefix: /^git_/, emoji: '🔀' },
  { category: 'Web', prefix: /^(web_search|http_request|download_file)$/, emoji: '🌐' },
  { category: 'File Watcher', prefix: /^(watch_file|stop_watch|list_watches)$/, emoji: '👁️ ' },
  { category: 'Code Analysis', prefix: /^(analyze_complexity|find_todos|analyze_dependencies|count_lines)$/, emoji: '🔍' },
  { category: 'Database', prefix: /^sql_/, emoji: '🗄️ ' },
  { category: 'Multi-Agent', prefix: /^(delegate_task|list_profiles)$/, emoji: '🤖' },
  { category: 'Memory', prefix: /^memory_/, emoji: '🧠' },
  { category: 'MCP (External)', prefix: /^mcp__/, emoji: '🔌' },
];

function groupOf(name: string): ToolGroup {
  for (const g of GROUPS) {
    if (typeof g.prefix === 'string') {
      if (name.startsWith(g.prefix)) return g;
    } else {
      if (g.prefix.test(name)) return g;
    }
  }
  return { category: 'Other', prefix: '', emoji: '🔧' };
}

export function ToolsPanel({ onClose }: ToolsPanelProps): JSX.Element {
  const [selected, setSelected] = useState(0);
  const colors = gradient(2);

  const allTools = useMemo(() => {
    const native = TOOLS.map((t) => ({
      name: t.function.name,
      description: t.function.description || '',
      source: 'native' as const,
    }));
    const mcp = mcpManager.getToolDefinitions().map((t) => ({
      name: t.function.name,
      description: t.function.description || '',
      source: 'mcp' as const,
    }));
    return [...native, ...mcp];
  }, []);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, typeof allTools>();
    for (const tool of allTools) {
      const g = groupOf(tool.name);
      const list = byCategory.get(g.category) || [];
      list.push(tool);
      byCategory.set(g.category, list);
    }
    return GROUPS.filter((g) => byCategory.has(g.category)).map((g) => ({
      ...g,
      tools: byCategory.get(g.category)!,
    }));
  }, [allTools]);

  const flatList = useMemo(() => {
    return grouped.flatMap((g) =>
      g.tools.map((t) => ({ ...t, category: g.category, emoji: g.emoji }))
    );
  }, [grouped]);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(flatList.length - 1, s + 1));
    if (key.pageUp) setSelected((s) => Math.max(0, s - 10));
    if (key.pageDown) setSelected((s) => Math.min(flatList.length - 1, s + 10));
  });

  const total = allTools.length;
  const nativeCount = allTools.filter((t) => t.source === 'native').length;
  const mcpCount = allTools.filter((t) => t.source === 'mcp').length;

  // Show window of items around selected
  const VISIBLE = 18;
  const start = Math.max(0, Math.min(selected - Math.floor(VISIBLE / 2), flatList.length - VISIBLE));
  const visibleStart = Math.max(0, start);
  const visibleEnd = Math.min(flatList.length, visibleStart + VISIBLE);

  let lastCategory = '';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors[0]} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={colors[0]} bold>
          🔧 Tools ({total})
        </Text>
        <Text color="gray">
          native: {nativeCount} · mcp: {mcpCount} · ↑↓ navigate · Esc close
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {flatList.slice(visibleStart, visibleEnd).map((tool, idx) => {
          const realIdx = visibleStart + idx;
          const isSelected = realIdx === selected;
          const showHeader = tool.category !== lastCategory;
          lastCategory = tool.category;
          return (
            <Box key={`${tool.source}-${tool.name}`} flexDirection="column">
              {showHeader ? (
                <Box marginTop={realIdx > 0 ? 1 : 0}>
                  <Text color={colors[1]} bold>
                    {tool.emoji} {tool.category}
                  </Text>
                </Box>
              ) : null}
              <Box>
                <Text color={isSelected ? 'black' : 'white'} backgroundColor={isSelected ? colors[1] : undefined}>
                  {' '}
                  {tool.name.padEnd(28)}{' '}
                </Text>
                <Text color="gray"> {truncate(tool.description, 60)}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {flatList.length > VISIBLE ? (
        <Box marginTop={1}>
          <Text color="gray">
            {selected + 1} / {flatList.length}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
