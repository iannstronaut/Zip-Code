import React from 'react';
import { Box, Text } from 'ink';
import { gradient } from './theme.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ASCII = [
  ' ███████╗██╗██████╗      ██████╗ ██████╗ ██████╗ ███████╗',
  ' ╚══███╔╝██║██╔══██╗    ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
  '   ███╔╝ ██║██████╔╝    ██║     ██║   ██║██║  ██║█████╗  ',
  '  ███╔╝  ██║██╔═══╝     ██║     ██║   ██║██║  ██║██╔══╝  ',
  ' ███████╗██║██║         ╚██████╗╚██████╔╝██████╔╝███████╗',
  ' ╚══════╝╚═╝╚═╝          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
];

// Read version from package.json once at module load
function readPackageVersion(): string {
  try {
    // dist/ui/Banner.js is at dist/ui/, package.json is two levels up
    const here = dirname(fileURLToPath(import.meta.url));
    // Walk up looking for package.json (handles both src/ui/ and dist/ui/)
    const candidates = [
      join(here, '..', '..', 'package.json'),
      join(here, '..', 'package.json'),
      join(here, '..', '..', '..', 'package.json'),
    ];
    for (const p of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf-8'));
        if (pkg.name === 'zipcode' && pkg.version) return pkg.version;
      } catch {
        // try next
      }
    }
  } catch {
    // fall through
  }
  return '2.7.0';
}

const PACKAGE_VERSION = readPackageVersion();

export interface BannerProps {
  compact?: boolean;
  subtitle?: string;
  version?: string;
}

export function Banner({
  compact = false,
  subtitle,
  version,
}: BannerProps): JSX.Element {
  const colors = gradient(ASCII.length);
  const v = version || PACKAGE_VERSION;

  if (compact) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors[0]} bold>
          {' '}ZIP CODE
          <Text color={colors[colors.length - 1]}> · TUI v{v}</Text>
        </Text>
        {subtitle ? <Text color="gray">{subtitle}</Text> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {ASCII.map((line, i) => (
        <Text key={i} color={colors[i]}>
          {line}
        </Text>
      ))}
      <Box marginTop={1} flexDirection="column" paddingX={1}>
        <Box>
          <Text color={colors[0]} bold>
            {' '}AI Coding Agent
          </Text>
          <Text color="gray"> · </Text>
          <Text color={colors[colors.length - 1]}>v{v}</Text>
          <Text color="gray"> · </Text>
          <Text color="gray">multi-agent · MCP · 33+ tools</Text>
        </Box>
        {subtitle ? (
          <Box marginTop={1}>
            <Text color="gray"> {subtitle}</Text>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
