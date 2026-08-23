import { describe, expect, it } from 'vitest';
import { evidencePage, evidenceSnippet, officialSourceHref } from '../../lib/disclosures/links.js';

describe('Keterbukaan official links', () => {
  it('accepts official IDX HTTPS URLs only', () => {
    expect(officialSourceHref('https://www.idx.co.id/StaticData/News/a.pdf')).toBe(
      'https://www.idx.co.id/StaticData/News/a.pdf',
    );
    expect(officialSourceHref('https://idx.co.id/news/a')).toBe('https://idx.co.id/news/a');
    expect(officialSourceHref('http://www.idx.co.id/news/a')).toBe('');
    expect(officialSourceHref('/home/kibz66/.openclaw/workspace/trading-db/idx.db')).toBe('');
    expect(officialSourceHref('file:///tmp/secret.pdf')).toBe('');
  });

  it('reads page and snippet evidence without inventing text', () => {
    expect(evidencePage({ page: 3, snippet: 'koreksi' })).toBe(3);
    expect(evidenceSnippet({ page: 3, snippet: 'koreksi' })).toBe('koreksi');
    expect(evidenceSnippet({ quote: 'Pendapatan usaha' })).toBe('Pendapatan usaha');
    expect(evidencePage(null)).toBeNull();
  });
});
