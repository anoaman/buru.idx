import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.js';

const env = {
  API_ORIGIN: 'https://analysis-origin.example.test',
  CF_ACCESS_CLIENT_ID: 'client-id',
  CF_ACCESS_CLIENT_SECRET: 'client-secret',
};

afterEach(() => vi.unstubAllGlobals());

describe('public Worker API boundary', () => {
  it('forces delayed analysis and drops unapproved query parameters', async () => {
    let upstream;
    vi.stubGlobal('fetch', vi.fn(async (request) => {
      upstream = request;
      return Response.json({ success: true, data: {} });
    }));

    const response = await worker.fetch(new Request(
      'https://analysis.example.test/api/analyze?ticker=BBCA&mode=live&internal=secret',
    ), env);

    expect(response.status).toBe(200);
    const url = new URL(upstream.url);
    expect(url.origin).toBe(env.API_ORIGIN);
    expect(url.searchParams.get('ticker')).toBe('BBCA');
    expect(url.searchParams.get('mode')).toBe('delayed');
    expect(url.searchParams.has('internal')).toBe(false);
  });

  it('blocks unknown routes and write methods before reaching the origin', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const unknown = await worker.fetch(new Request('https://analysis.example.test/api/data-health'), env);
    const write = await worker.fetch(new Request('https://analysis.example.test/api/analyze?ticker=BBCA', {
      method: 'POST',
    }), env);

    expect(unknown.status).toBe(404);
    expect(write.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards disclosure reads and drops path-like query parameters', async () => {
    let upstream;
    vi.stubGlobal('fetch', vi.fn(async (request) => {
      upstream = request;
      return Response.json({ success: true, data: { items: [] } });
    }));

    const response = await worker.fetch(new Request(
      'https://analysis.example.test/api/disclosures?ticker=BBCA&path=/etc/passwd',
    ), env);

    expect(response.status).toBe(200);
    const url = new URL(upstream.url);
    expect(url.pathname).toBe('/api/disclosures');
    expect(url.searchParams.get('ticker')).toBe('BBCA');
    expect(url.searchParams.has('path')).toBe(false);
  });

  it('allows only the bounded News Detector scan write', async () => {
    let upstream;
    vi.stubGlobal('fetch', vi.fn(async (request) => {
      upstream = request;
      return Response.json({ success: true, data: { items: [] } });
    }));

    const response = await worker.fetch(new Request(
      'https://analysis.example.test/api/news-detector/scan?date=2026-08-15&path=/etc/passwd',
      { method: 'POST' },
    ), env);

    expect(response.status).toBe(200);
    expect(upstream.method).toBe('POST');
    const url = new URL(upstream.url);
    expect(url.pathname).toBe('/api/news-detector/scan');
    expect(url.searchParams.get('date')).toBe('2026-08-15');
    expect(url.searchParams.has('path')).toBe(false);
  });
});
