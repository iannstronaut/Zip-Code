import { describe, it, expect } from 'vitest';
import { promptTemplates } from '../src/prompt-templates';

describe('Prompt Templates', () => {
  describe('built-in templates', () => {
    it('includes the standard library', async () => {
      const list = await promptTemplates.list();
      const names = list.map((t) => t.name);
      expect(names).toContain('review');
      expect(names).toContain('refactor');
      expect(names).toContain('debug');
      expect(names).toContain('tests');
      expect(names).toContain('explain');
      expect(names).toContain('docs');
      expect(names).toContain('optimize');
      expect(names).toContain('security');
    });

    it('detects variables in the body', async () => {
      const review = await promptTemplates.get('review');
      expect(review).toBeDefined();
      expect(review!.variables).toContain('file');
    });
  });

  describe('render', () => {
    it('substitutes variables', async () => {
      const rendered = await promptTemplates.render('review', { file: 'src/foo.ts' });
      expect(rendered).toContain('src/foo.ts');
      expect(rendered).not.toContain('{{file}}');
    });

    it('leaves missing variables as-is', async () => {
      const rendered = await promptTemplates.render('review', {});
      expect(rendered).toContain('{{file}}');
    });

    it('throws on unknown template', async () => {
      await expect(promptTemplates.render('nonexistent-template')).rejects.toThrow();
    });
  });
});
