// Markdown -> Ink-renderable lines (with picocolors).
// Lightweight inline renderer to avoid a full markdown library.

import pc from 'picocolors';

export interface RenderedLine {
  type: 'text' | 'code' | 'rule' | 'heading' | 'list' | 'quote';
  text: string;
  lang?: string;
}

export function renderMarkdownLines(input: string): RenderedLine[] {
  const lines = input.split(/\r?\n/);
  const out: RenderedLine[] = [];
  let inCode = false;
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    const fence = raw.match(/^```(\w*)\s*$/);
    if (fence) {
      inCode = !inCode;
      codeLang = inCode ? fence[1] : '';
      continue;
    }

    if (inCode) {
      out.push({ type: 'code', text: raw, lang: codeLang });
      continue;
    }

    if (/^---+\s*$/.test(raw)) {
      out.push({ type: 'rule', text: '' });
      continue;
    }

    const heading = raw.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      out.push({ type: 'heading', text: heading[2] });
      continue;
    }

    const bullet = raw.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      out.push({ type: 'list', text: inlineFormat(bullet[1]) });
      continue;
    }
    const numbered = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      out.push({ type: 'list', text: inlineFormat(numbered[1]) });
      continue;
    }

    if (/^>\s+/.test(raw)) {
      out.push({ type: 'quote', text: inlineFormat(raw.replace(/^>\s+/, '')) });
      continue;
    }

    out.push({ type: 'text', text: inlineFormat(raw) });
  }

  return out;
}

function inlineFormat(s: string): string {
  // bold **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, t) => pc.bold(t));
  // italic *text*
  s = s.replace(/(^|\W)\*([^*\n]+)\*/g, (_, p, t) => `${p}${pc.italic(t)}`);
  // inline code `code`
  s = s.replace(/`([^`]+)`/g, (_, t) => pc.cyan(t));
  // links [text](url)
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, t, u) => `${pc.underline(pc.blue(t))} (${pc.dim(u)})`
  );
  return s;
}
