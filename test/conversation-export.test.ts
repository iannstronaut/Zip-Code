import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toMarkdown, toHtml, toJson, exportConversation } from '../src/conversation-export';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const sampleMessages = [
  {
    role: 'system' as const,
    content: 'You are a helpful coding assistant.',
    createdAt: 1700000000000,
  },
  {
    role: 'user' as const,
    content: 'Hello, can you read foo.ts?',
    createdAt: 1700000001000,
  },
  {
    role: 'assistant' as const,
    content: 'Sure, let me read it.',
    createdAt: 1700000002000,
    tool_calls: [
      {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: '{"path":"foo.ts"}',
        },
      },
    ],
  },
  {
    role: 'tool' as const,
    content: 'export const x = 1;',
    tool_call_id: 'call_1',
    createdAt: 1700000003000,
  },
];

describe('Conversation Export', () => {
  describe('toMarkdown', () => {
    it('renders user and assistant messages', () => {
      const md = toMarkdown(sampleMessages);
      expect(md).toContain('Hello, can you read foo.ts?');
      expect(md).toContain('Sure, let me read it.');
    });

    it('renders tool calls in details blocks', () => {
      const md = toMarkdown(sampleMessages);
      expect(md).toContain('Tool call');
      expect(md).toContain('read_file');
    });

    it('hides tools when hideTools is true', () => {
      const md = toMarkdown(sampleMessages, { hideTools: true });
      expect(md).not.toContain('Tool call');
      expect(md).not.toContain('Tool result');
    });

    it('hides system messages by default', () => {
      const md = toMarkdown(sampleMessages);
      expect(md).not.toContain('You are a helpful coding assistant');
    });

    it('respects since/until filters', () => {
      const since = new Date(1700000002000).toISOString();
      const md = toMarkdown(sampleMessages, { since });
      expect(md).not.toContain('Hello, can you read foo.ts?');
      expect(md).toContain('Sure, let me read it.');
    });
  });

  describe('toHtml', () => {
    it('produces a valid HTML document', () => {
      const html = toHtml(sampleMessages);
      expect(html).toMatch(/^<!DOCTYPE html>/);
      expect(html).toContain('</html>');
      expect(html).toContain('<style>');
    });

    it('escapes HTML in message content', () => {
      const html = toHtml([
        {
          role: 'user',
          content: '<script>alert(1)</script>',
          createdAt: 1700000000000,
        },
      ]);
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('toJson', () => {
    it('produces parseable JSON', () => {
      const json = toJson(sampleMessages);
      const parsed = JSON.parse(json);
      expect(parsed.messageCount).toBeGreaterThan(0);
      expect(parsed.messages).toBeDefined();
      expect(Array.isArray(parsed.messages)).toBe(true);
    });
  });

  describe('exportConversation', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await mkdtemp(join(tmpdir(), 'zipcode-export-'));
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('writes markdown file', async () => {
      const path = join(testDir, 'out.md');
      const result = await exportConversation(sampleMessages, path, 'markdown');
      expect(result.path).toBe(path);
      expect(result.format).toBe('markdown');
      const content = await readFile(path, 'utf-8');
      expect(content).toContain('# ZIP CODE Session');
    });

    it('writes html file', async () => {
      const path = join(testDir, 'out.html');
      await exportConversation(sampleMessages, path, 'html');
      const content = await readFile(path, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
    });

    it('writes json file', async () => {
      const path = join(testDir, 'out.json');
      await exportConversation(sampleMessages, path, 'json');
      const content = await readFile(path, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.title).toBe('ZIP CODE Session');
    });
  });
});
