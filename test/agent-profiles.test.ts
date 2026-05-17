import { describe, it, expect } from 'vitest';
import {
  AGENT_PROFILES,
  filterToolsForProfile,
  getProfile,
  listProfiles,
} from '../src/agent-profiles';
import type { ToolDefinition } from '../src/types';

const fakeTool = (name: string): ToolDefinition => ({
  type: 'function',
  function: {
    name,
    description: name,
    parameters: { type: 'object', properties: {}, required: [] },
  },
});

const ALL_TOOLS: ToolDefinition[] = [
  fakeTool('read_file'),
  fakeTool('write_file'),
  fakeTool('execute_bash'),
  fakeTool('delegate_task'),
  fakeTool('git_commit'),
  fakeTool('web_search'),
];

describe('Agent Profiles', () => {
  describe('listProfiles', () => {
    it('returns all known profiles', () => {
      const names = listProfiles();
      expect(names).toContain('general');
      expect(names).toContain('orchestrator');
      expect(names).toContain('coder');
      expect(names).toContain('reviewer');
      expect(names).toContain('debugger');
      expect(names).toContain('researcher');
      expect(names).toContain('writer');
    });
  });

  describe('getProfile', () => {
    it('returns the requested profile', () => {
      expect(getProfile('coder').name).toBe('coder');
      expect(getProfile('reviewer').name).toBe('reviewer');
    });

    it('falls back to general for unknown', () => {
      expect(getProfile('nonexistent').name).toBe('general');
      expect(getProfile().name).toBe('general');
    });
  });

  describe('AGENT_PROFILES', () => {
    it('every profile has a system prompt', () => {
      for (const name of listProfiles()) {
        expect(AGENT_PROFILES[name].systemPrompt.length).toBeGreaterThan(50);
      }
    });

    it('reviewer is read-only (no write_file or execute_bash)', () => {
      const allowed = AGENT_PROFILES.reviewer.allowedTools || [];
      expect(allowed).not.toContain('write_file');
      expect(allowed).not.toContain('execute_bash');
    });

    it('orchestrator allows delegate_task', () => {
      const allowed = AGENT_PROFILES.orchestrator.allowedTools || [];
      expect(allowed).toContain('delegate_task');
    });

    it('coder cannot delegate (prevents recursion)', () => {
      const blocked = AGENT_PROFILES.coder.blockedTools || [];
      expect(blocked).toContain('delegate_task');
    });

    it('coder uses low temperature', () => {
      expect(AGENT_PROFILES.coder.temperature).toBeLessThanOrEqual(0.3);
    });
  });

  describe('filterToolsForProfile', () => {
    it('respects allowedTools allowlist', () => {
      const filtered = filterToolsForProfile(ALL_TOOLS, AGENT_PROFILES.reviewer);
      const names = filtered.map((t) => t.function.name);
      expect(names).toContain('read_file');
      expect(names).not.toContain('write_file');
      expect(names).not.toContain('execute_bash');
    });

    it('respects blockedTools denylist', () => {
      const filtered = filterToolsForProfile(ALL_TOOLS, AGENT_PROFILES.coder);
      const names = filtered.map((t) => t.function.name);
      expect(names).not.toContain('delegate_task');
      // coder has no allowlist so other tools should pass through
      expect(names).toContain('read_file');
      expect(names).toContain('write_file');
    });

    it('general profile passes all tools through', () => {
      const filtered = filterToolsForProfile(ALL_TOOLS, AGENT_PROFILES.general);
      expect(filtered.length).toBe(ALL_TOOLS.length);
    });
  });
});
