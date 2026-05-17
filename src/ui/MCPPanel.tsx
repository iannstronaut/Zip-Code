import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { mcpManager } from '../mcp-client.js';
import { gradient } from './theme.js';
import { homedir } from 'os';
import { join } from 'path';

export interface MCPPanelProps {
  onClose: () => void;
}

interface ServerInfo {
  name: string;
  connected: boolean;
  toolCount: number;
  command?: string[];
}

export function MCPPanel({ onClose }: MCPPanelProps): JSX.Element {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selected, setSelected] = useState(0);
  const colors = gradient(2);

  useEffect(() => {
    setServers(mcpManager.getServerStatus());
    const id = setInterval(() => setServers(mcpManager.getServerStatus()), 2000);
    return () => clearInterval(id);
  }, []);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (servers.length === 0) return;
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(servers.length - 1, s + 1));
  });

  const configPath = join(homedir(), '.zipcode', 'mcp-servers.json');
  const totalTools = servers.reduce((sum, s) => sum + s.toolCount, 0);
  const connectedCount = servers.filter((s) => s.connected).length;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors[0]} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={colors[0]} bold>
          🔌 MCP Servers
        </Text>
        <Text color="gray">
          {connectedCount}/{servers.length} connected · {totalTools} tools · Esc close
        </Text>
      </Box>

      {servers.length === 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">⚠ No MCP servers configured</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Configure servers at:</Text>
            <Text color="cyan">  {configPath}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Example config:</Text>
            <Text color="white">{`{`}</Text>
            <Text color="white">{`  "servers": [`}</Text>
            <Text color="white">{`    {`}</Text>
            <Text color="white">{`      "name": "filesystem",`}</Text>
            <Text color="white">
              {`      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path"]`}
            </Text>
            <Text color="white">{`    }`}</Text>
            <Text color="white">{`  ]`}</Text>
            <Text color="white">{`}`}</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {servers.map((server, idx) => {
            const isSelected = idx === selected;
            const statusEmoji = server.connected ? '🟢' : '🔴';
            const statusText = server.connected ? 'connected' : 'disconnected';
            return (
              <Box key={server.name}>
                <Text
                  color={isSelected ? 'black' : 'white'}
                  backgroundColor={isSelected ? colors[1] : undefined}
                >
                  {' '}
                  {statusEmoji} {server.name.padEnd(20)} {statusText.padEnd(14)}{' '}
                  {server.toolCount} tools{' '}
                </Text>
              </Box>
            );
          })}

          {servers[selected] ? (
            <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
              <Text color={colors[1]} bold>
                {servers[selected].name}
              </Text>
              <Text>
                <Text color="gray">Status:    </Text>
                <Text color={servers[selected].connected ? 'green' : 'red'}>
                  {servers[selected].connected ? '● connected' : '○ disconnected'}
                </Text>
              </Text>
              <Text>
                <Text color="gray">Tools:     </Text>
                <Text>{servers[selected].toolCount}</Text>
              </Text>
              {servers[selected].command ? (
                <Text>
                  <Text color="gray">Command:   </Text>
                  <Text color="cyan">{servers[selected].command!.join(' ')}</Text>
                </Text>
              ) : null}
              <Box marginTop={1}>
                <Text color="gray">
                  Tools registered as: <Text color="yellow">mcp__{servers[selected].name}__&lt;tool&gt;</Text>
                </Text>
              </Box>
            </Box>
          ) : null}

          <Box marginTop={1}>
            <Text color="gray">Config: </Text>
            <Text color="cyan">{configPath}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
