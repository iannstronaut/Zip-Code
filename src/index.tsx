#!/usr/bin/env node

// ZIP CODE - AI TUI Agent
// Ink-powered TUI entry point.

import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { closeDb, getDb } from './store.js';

// Initialize the DB up-front so any failure surfaces before the TUI mounts.
try {
  getDb();
} catch (err: any) {
  console.error('Failed to open database:', err?.message || err);
  process.exit(1);
}

const { waitUntilExit, unmount } = render(<App />, {
  exitOnCtrlC: false,
});

const cleanup = () => {
  try {
    unmount();
  } catch {
    /* ignore */
  }
  try {
    closeDb();
  } catch {
    /* ignore */
  }
};

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

waitUntilExit().then(
  () => {
    closeDb();
    process.exit(0);
  },
  (err: unknown) => {
    console.error(err);
    closeDb();
    process.exit(1);
  }
);
