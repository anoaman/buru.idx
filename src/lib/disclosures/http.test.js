import { describe, expect, it } from 'vitest';
import { officialSourceUrl, stripLeaks } from './serialize.js';
import { validateDisclosureQuery } from './validate.js';
import { handleDisclosureHttp } from './http.js';

describe('disclosure serialize', () => {
  it('keeps official IDX HTTPS links and drops filesystem paths', () => {
    expect(officialSourceUrl('https://www.idx.co.id/StaticData/a.pdf')).toBe(
      'https://www.idx.co.id/StaticData/a.pdf',
    );
    expect(officialSourceUrl('https://evil.example/idx.co.id/x')).toBe(null);
    const cleaned = stripLeaks({
      sourceUrl: 'https://www.idx.co.id/id/berita/pengumuman/',
      relative_path: '/secret/file.pdf',
      evidence: { quote: 'Koreksi', path: '/tmp/x', page: 2 },
      note: 'failed /home/kibz66/idx.db',
    });
    expect(cleaned.relative_path).toBeUndefined();
    expect(cleaned.evidence.path).toBeUndefined();
    expect(cleaned.evidence.page).toBe(2);
    expect(cleaned.note).toBe('[redacted]');
  });
});

describe('disclosure query validation', () => {
  it('accepts bounded ticker/date/category/severity filters', () => {
    const params = new URLSearchParams('ticker=bbca&from=2026-08-01&to=2026-08-14&category=dividend&severity=high&limit=10');
    const result = validateDisclosureQuery('/api/disclosures', params);
    expect(result.ok).toBe(true);
    expect(result.filters.ticker).toBe('BBCA');
    expect(result.filters.limit).toBe('10');
  });

  it('rejects invalid filters instead of forwarding them', () => {
    expect(validateDisclosureQuery('/api/disclosures', new URLSearchParams('ticker=BCA')).ok).toBe(false);
    expect(validateDisclosureQuery('/api/disclosures', new URLSearchParams('from=08-01-2026')).ok).toBe(false);
    expect(validateDisclosureQuery('/api/disclosures', new URLSearchParams('limit=500')).ok).toBe(false);
    expect(validateDisclosureQuery('/api/disclosures/detail', new URLSearchParams('eventId=../etc/passwd')).ok).toBe(false);
  });
});

describe('disclosure HTTP handler', () => {
  it('paginates, filters, and returns not-found without leaking internals', () => {
    const store = (path, filters) => {
      if (path === '/api/disclosures/detail' && filters.eventId === 'missing') {
        return { status: 404, error: 'Disclosure not found.' };
      }
      if (path === '/api/disclosures') {
        return {
          body: {
            success: true,
            data: {
              items: [{ eventId: 'div-1', ticker: filters.ticker, relative_path: '/secret' }],
              nextCursor: 1,
              total: 2,
              limit: 1,
            },
          },
        };
      }
      return { body: { success: true, data: { available: false } } };
    };

    const page = handleDisclosureHttp('GET', '/api/disclosures?ticker=TEST&limit=1&debug=1', store);
    expect(page.status).toBe(200);
    expect(page.body.data.items[0].ticker).toBe('TEST');
    expect(page.body.data.items[0].relative_path).toBeUndefined();
    expect(JSON.stringify(page)).not.toContain('/secret');

    const missing = handleDisclosureHttp('GET', '/api/disclosures/detail?eventId=missing', store);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Disclosure not found.');
    expect(JSON.stringify(missing).toLowerCase()).not.toContain('sqlite');

    const denied = handleDisclosureHttp('POST', '/api/disclosures', store);
    expect(denied.status).toBe(405);
    const traversal = handleDisclosureHttp('GET', '/api/disclosures/../analyze', store);
    expect(traversal.status).toBe(400);
  });
});
