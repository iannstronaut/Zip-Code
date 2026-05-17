// Conversation export - dump a session to Markdown, HTML, or JSON.
//
// Pulls messages straight out of the SQLite store (store.ts) and renders them
// into a shareable transcript. Tool calls are folded into details/summary
// blocks so the human-readable output stays clean.

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { logger } from './logger.js';

export type ExportFormat = 'markdown' | 'html' | 'json';

export interface ExportOptions {
  /** Title shown in the document header. Defaults to the session title. */
  title?: string;
  /** Inclusive ISO timestamp filter - only export messages on/after this. */
  since?: string;
  /** Inclusive ISO timestamp filter - only export messages on/before this. */
  until?: string;
  /** Drop tool call details from the output. */
  hideTools?: boolean;
  /** Drop the system message from the output. Default true. */
  hideSystem?: boolean;
}

/**
 * Loose message shape for export. We don't extend ChatMessage because the
 * exporter accepts both stored rows (createdAt: number) and raw transcripts
 * (no timestamp at all).
 */
export interface ExportableMessage {
  id?: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content?: string;
  createdAt?: string | number;
  /** OpenAI-style tool calls. */
  tool_calls?: any[];
  /** Tool call ID for tool result messages. */
  tool_call_id?: string;
}

// ──────────── filtering ────────────

function filterMessages(
  messages: ExportableMessage[],
  opts: ExportOptions
): ExportableMessage[] {
  return messages.filter((m) => {
    if (opts.hideSystem !== false && m.role === 'system') return false;
    if (opts.since && m.createdAt) {
      const ts =
        typeof m.createdAt === 'number' ? m.createdAt : new Date(m.createdAt).getTime();
      if (ts < new Date(opts.since).getTime()) return false;
    }
    if (opts.until && m.createdAt) {
      const ts =
        typeof m.createdAt === 'number' ? m.createdAt : new Date(m.createdAt).getTime();
      if (ts > new Date(opts.until).getTime()) return false;
    }
    return true;
  });
}

// ──────────── markdown ────────────

function formatMarkdownMessage(m: ExportableMessage, opts: ExportOptions): string {
  const lines: string[] = [];
  const ts = m.createdAt
    ? `_${typeof m.createdAt === 'number' ? new Date(m.createdAt).toISOString() : m.createdAt}_\n\n`
    : '';

  switch (m.role) {
    case 'user':
      lines.push(`## 👤 User`);
      lines.push(ts);
      lines.push(String(m.content || '').trim());
      break;
    case 'assistant':
      lines.push(`## 🤖 Assistant`);
      lines.push(ts);
      if (m.content) lines.push(String(m.content).trim());
      if (!opts.hideTools && Array.isArray((m as any).tool_calls)) {
        for (const tc of (m as any).tool_calls) {
          const name = tc.function?.name || 'unknown';
          const args = tc.function?.arguments || '{}';
          lines.push(`\n<details><summary>🔧 Tool call: <code>${name}</code></summary>\n`);
          lines.push('```json');
          try {
            lines.push(JSON.stringify(JSON.parse(args), null, 2));
          } catch {
            lines.push(args);
          }
          lines.push('```');
          lines.push('</details>');
        }
      }
      break;
    case 'tool':
      if (opts.hideTools) return '';
      lines.push(`<details><summary>📦 Tool result</summary>\n`);
      lines.push('```');
      lines.push(String(m.content || '').slice(0, 4000));
      lines.push('```');
      lines.push('</details>');
      break;
    case 'system':
      lines.push(`> System: ${String(m.content || '').slice(0, 500)}`);
      break;
  }
  return lines.join('\n');
}

export function toMarkdown(messages: ExportableMessage[], opts: ExportOptions = {}): string {
  const filtered = filterMessages(messages, opts);
  const title = opts.title || 'ZIP CODE Session';
  const out = [
    `# ${title}`,
    '',
    `_Exported: ${new Date().toISOString()}_`,
    `_Messages: ${filtered.length}_`,
    '',
    '---',
    '',
  ];
  for (const m of filtered) {
    const block = formatMarkdownMessage(m, opts);
    if (block) {
      out.push(block);
      out.push('');
    }
  }
  return out.join('\n');
}

// ──────────── html ────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHtmlMessage(m: ExportableMessage, opts: ExportOptions): string {
  const ts = m.createdAt
    ? `<time>${escapeHtml(typeof m.createdAt === 'number' ? new Date(m.createdAt).toISOString() : String(m.createdAt))}</time>`
    : '';
  switch (m.role) {
    case 'user':
      return `
<section class="msg user">
  <header><span class="who">👤 User</span> ${ts}</header>
  <div class="body">${escapeHtml(String(m.content || ''))}</div>
</section>`;
    case 'assistant': {
      let toolsHtml = '';
      if (!opts.hideTools && Array.isArray((m as any).tool_calls)) {
        toolsHtml = (m as any).tool_calls
          .map((tc: any) => {
            const name = tc.function?.name || 'unknown';
            const args = tc.function?.arguments || '{}';
            let pretty = args;
            try {
              pretty = JSON.stringify(JSON.parse(args), null, 2);
            } catch {
              // ignore
            }
            return `<details><summary>🔧 ${escapeHtml(name)}</summary><pre><code>${escapeHtml(pretty)}</code></pre></details>`;
          })
          .join('');
      }
      return `
<section class="msg assistant">
  <header><span class="who">🤖 Assistant</span> ${ts}</header>
  <div class="body">${escapeHtml(String(m.content || ''))}</div>
  ${toolsHtml}
</section>`;
    }
    case 'tool':
      if (opts.hideTools) return '';
      return `<section class="msg tool"><details><summary>📦 Tool result</summary><pre><code>${escapeHtml(String(m.content || '').slice(0, 4000))}</code></pre></details></section>`;
    case 'system':
      return `<section class="msg system"><em>System:</em> ${escapeHtml(String(m.content || '').slice(0, 500))}</section>`;
    default:
      return '';
  }
}

export function toHtml(messages: ExportableMessage[], opts: ExportOptions = {}): string {
  const filtered = filterMessages(messages, opts);
  const title = opts.title || 'ZIP CODE Session';
  const styles = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1f2328; background: #fff; }
h1 { border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
.meta { color: #57606a; font-size: .9em; margin-bottom: 2em; }
.msg { margin: 1em 0; padding: 1em; border-radius: 6px; border: 1px solid #d0d7de; }
.msg header { font-weight: 600; margin-bottom: .5em; }
.msg .who { font-size: 1.05em; }
.msg time { color: #57606a; font-weight: normal; font-size: .85em; margin-left: .5em; }
.msg .body { white-space: pre-wrap; }
.msg.user { background: #f6f8fa; }
.msg.assistant { background: #ddf4ff; }
.msg.tool { background: #fff8c5; font-size: .9em; }
.msg.system { background: #fbefff; font-size: .9em; color: #57606a; }
details > summary { cursor: pointer; padding: .25em 0; }
pre { background: #f6f8fa; padding: .8em; border-radius: 4px; overflow-x: auto; font-size: .85em; }
code { font-family: "SFMono-Regular", Consolas, monospace; }
@media (prefers-color-scheme: dark) { body { color: #e6edf3; background: #0d1117; } .msg { border-color: #30363d; } .msg.user { background: #161b22; } .msg.assistant { background: #0d2d4a; } .msg.tool { background: #2d2a13; } .msg.system { background: #2a1d3b; } pre { background: #161b22; } h1 { border-color: #30363d; } }
`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Exported: ${new Date().toISOString()} · Messages: ${filtered.length}</div>
${filtered.map((m) => formatHtmlMessage(m, opts)).join('\n')}
</body>
</html>`;
}

// ──────────── json ────────────

export function toJson(messages: ExportableMessage[], opts: ExportOptions = {}): string {
  return JSON.stringify(
    {
      title: opts.title || 'ZIP CODE Session',
      exportedAt: new Date().toISOString(),
      messageCount: filterMessages(messages, opts).length,
      messages: filterMessages(messages, opts),
    },
    null,
    2
  );
}

// ──────────── facade ────────────

export async function exportConversation(
  messages: ExportableMessage[],
  outputPath: string,
  format: ExportFormat,
  opts: ExportOptions = {}
): Promise<{ path: string; size: number; format: ExportFormat }> {
  let content: string;
  switch (format) {
    case 'markdown':
      content = toMarkdown(messages, opts);
      break;
    case 'html':
      content = toHtml(messages, opts);
      break;
    case 'json':
      content = toJson(messages, opts);
      break;
    default:
      throw new Error(`Unknown export format: ${format}`);
  }

  const dir = dirname(outputPath);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(outputPath, content, 'utf-8');
  logger.info('Exported conversation', { format, path: outputPath, size: content.length });

  return { path: outputPath, size: content.length, format };
}
