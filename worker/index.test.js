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
      { headers: { authorization: 'Bearer browser-token', cookie: 'session=private' } },
    ), env);

    expect(response.status).toBe(200);
    const url = new URL(upstream.url);
    expect(url.origin).toBe(env.API_ORIGIN);
    expect(url.searchParams.get('ticker')).toBe('BBCA');
    expect(url.searchParams.get('mode')).toBe('delayed');
    expect(url.searchParams.has('internal')).toBe(false);
    expect(upstream.headers.get('authorization')).toBeNull();
    expect(upstream.headers.get('cookie')).toBeNull();
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it('fails closed on oversized inputs and unavailable upstreams', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('private origin details'); });
    vi.stubGlobal('fetch', fetchMock);

    const oversized = await worker.fetch(new Request(
      `https://analysis.example.test/api/radar/scout?conditions=${'x'.repeat(4_097)}`,
    ), env);
    const unavailable = await worker.fetch(new Request(
      'https://analysis.example.test/api/analyze?ticker=BBCA',
    ), env);

    expect(oversized.status).toBe(414);
    expect(unavailable.status).toBe(502);
    expect(await unavailable.json()).toEqual({
      success: false,
      error: 'Analysis service is temporarily unavailable.',
    });
  });

  it('fails closed when origin configuration or JSON is invalid', async () => {
    const missingConfig = await worker.fetch(new Request(
      'https://analysis.example.test/api/analyze?ticker=BBCA',
    ), { API_ORIGIN: env.API_ORIGIN });
    expect(missingConfig.status).toBe(502);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', {
      headers: { 'content-type': 'application/json' },
    })));
    const invalidJson = await worker.fetch(new Request(
      'https://analysis.example.test/api/analyze?ticker=BBCA',
    ), env);
    expect(invalidJson.status).toBe(502);
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

  it('forwards the Scout catalog and explicit condition payload', async () => {
    const upstream = [];
    vi.stubGlobal('fetch', vi.fn(async (request) => {
      upstream.push(request);
      return Response.json({ success: true, data: {} });
    }));
    const conditions = JSON.stringify([{ id: 'max_price', value: 1000 }]);
    await worker.fetch(new Request('https://analysis.example.test/api/radar/scout/conditions'), env);
    await worker.fetch(new Request(`https://analysis.example.test/api/radar/scout?conditions=${encodeURIComponent(conditions)}`), env);
    expect(new URL(upstream[0].url).pathname).toBe('/api/radar/scout/conditions');
    expect(new URL(upstream[1].url).searchParams.get('conditions')).toBe(conditions);
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
