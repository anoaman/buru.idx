import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.js';

const env = {
  API_ORIGIN: 'https://analysis-origin.example.test',
  CF_ACCESS_CLIENT_ID: 'client-id',
  CF_ACCESS_CLIENT_SECRET: 'client-secret',
  NALAR_PROXY_SECRET: 'proxy-secret',
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

    const unknown = await worker.fetch(new Request('https://analysis.example.test/api/opportunities'), env);
    const write = await worker.fetch(new Request('https://analysis.example.test/api/analyze?ticker=BBCA', {
      method: 'POST',
    }), env);

    expect(unknown.status).toBe(404);
    expect(write.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('blocks every parked product route before reaching the origin', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const paths = [
      '/api/disclosures',
      '/api/disclosures/detail',
      '/api/disclosures/timeline',
      '/api/disclosures/anomalies',
      '/api/disclosures/documents',
      '/api/fundamentals/statements',
      '/api/fundamentals/snapshot',
      '/api/fundamentals/periods',
      '/api/fundamentals/facts',
      '/api/fundamentals/filing',
      '/api/fundamentals/derived',
      '/api/fundamentals/sources',
      '/api/news-detector',
      '/api/news-detector/scan',
    ];

    for (const path of paths) {
      const response = await worker.fetch(new Request(`https://analysis.example.test${path}`), env);
      expect(response.status, `${path} must be blocked`).toBe(404);
    }
    const scan = await worker.fetch(new Request(
      'https://analysis.example.test/api/news-detector/scan?date=2026-08-15',
      { method: 'POST' },
    ), env);
    expect(scan.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps Monitored private and forwards only a hashed Access identity', async () => {
    let upstream;
    vi.stubGlobal('fetch', vi.fn(async (request) => {
      upstream = request;
      return Response.json({ success: true, data: { items: [] } });
    }));

    const denied = await worker.fetch(new Request('https://analysis.example.test/api/monitored'), env);
    expect(denied.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();

    const response = await worker.fetch(new Request('https://analysis.example.test/api/monitored', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'KIBZ@Example.com',
        authorization: 'Bearer browser-token',
      },
    }), env);
    expect(response.status).toBe(200);
    expect(upstream.headers.get('x-nalar-owner-key')).toMatch(/^[a-f0-9]{64}$/);
    expect(upstream.headers.get('x-nalar-proxy-secret')).toBe('proxy-secret');
    expect(upstream.headers.get('cf-access-authenticated-user-email')).toBeNull();
    expect(upstream.headers.get('authorization')).toBeNull();
  });
});
