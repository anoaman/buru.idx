import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.js';

const env = {
  API_ORIGIN: 'https://analysis-origin.example.test',
  CF_ACCESS_CLIENT_ID: 'client-id',
  CF_ACCESS_CLIENT_SECRET: 'client-secret',
};

afterEach(() => vi.unstubAllGlobals());

describe('public Worker API boundary', () => {
  it('preserves retry and cache provenance but drops private origin headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, error: 'Busy' }, {
      status: 503,
      headers: { 'Retry-After': '2', 'X-Cache': 'STALE', Age: '62',
        'X-Computed-At': '2026-10-16T03:00:00.000Z', 'X-Data-As-Of': '2026-10-15',
        'X-Data-Generation': 'abc123', 'Set-Cookie': 'private=secret', 'X-Internal': 'secret' },
    })));
    const response = await worker.fetch(new Request('https://analysis.example.test/api/analyze?ticker=BBCA'), env);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(response.headers.get('age')).toBe('62');
    expect(response.headers.get('x-cache')).toBe('STALE');
    expect(response.headers.get('x-data-generation')).toBe('abc123');
    expect(response.headers.get('x-data-as-of')).toBe('2026-10-15');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-internal')).toBeNull();
  });

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
    expect(unavailable.headers.get('server-timing')).toMatch(/^analysis-origin;dur=\d+$/);
    expect(unavailable.headers.get('x-analysis-origin-ms')).toMatch(/^\d+$/);
    expect(unavailable.headers.get('x-analysis-failure')).toBe('origin_unavailable');
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
    expect((await worker.fetch(new Request('https://analysis.example.test/api/radar/scout/conditions'), env))
      .headers.get('server-timing')).toMatch(/^analysis-origin;dur=\d+$/);
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
});

describe('domain move to bandarlab.site', () => {
  const assets = { fetch: vi.fn(async () => new Response('<html>app</html>', { headers: { 'content-type': 'text/html' } })) };
  const moveEnv = { ...env, ASSETS: assets };
  const nav = (url, method = 'GET') => new Request(url, { method, headers: { accept: 'text/html,application/xhtml+xml' } });

  it('redirects www to the apex, keeping path and query', async () => {
    const response = await worker.fetch(nav('https://www.bandarlab.site/workbench?ticker=BBCA'), moveEnv);
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://bandarlab.site/workbench?ticker=BBCA');
  });

  it('turns legacy page navigations into a settings handoff', async () => {
    const response = await worker.fetch(nav('https://analysis.tombaklepas.app/radar?x=%22%3E'), moveEnv);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<script src="/__handoff.js"></script>');
    expect(body).toContain('https://bandarlab.site/radar?x=%22%3E');
    expect(response.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it('serves the handoff script on the legacy host only', async () => {
    const script = await worker.fetch(new Request('https://analysis.tombaklepas.app/__handoff.js'), moveEnv);
    expect(script.headers.get('content-type')).toContain('javascript');
    const text = await script.text();
    expect(text).toContain("'https://bandarlab.site' + location.pathname + location.search");
    expect(text).toContain('nalar.screener.savedScreens');
    new Function(text); // must at least parse
  });

  it('keeps the legacy API and static assets working for open tabs', async () => {
    const asset = await worker.fetch(new Request('https://analysis.tombaklepas.app/assets/index.js', { headers: { accept: '*/*' } }), moveEnv);
    expect(assets.fetch).toHaveBeenCalledTimes(1);
    expect(asset.status).toBe(200);
    const health = await worker.fetch(nav('https://analysis.tombaklepas.app/healthz'), moveEnv);
    expect(await health.json()).toEqual({ status: 'ok' });
  });

  it('serves the app normally on the canonical host', async () => {
    assets.fetch.mockClear();
    const response = await worker.fetch(nav('https://bandarlab.site/radar'), moveEnv);
    expect(await response.text()).toBe('<html>app</html>');
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('crawler metadata on the SPA shell', () => {
  const shell = '<html><head><meta\n  name="description"\n  content="old" />\n<meta property="og:title" content="Bandarlab" />\n<meta\n  property="og:description"\n  content="old" />\n<meta property="og:url" content="https://bandarlab.site/" /><title>Bandarlab</title></head><body><div id="root"></div></body></html>';
  const seoEnv = { ...env, ASSETS: { fetch: vi.fn(async () => new Response(shell, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '999' } })) } };
  const get = (path, method = 'GET') => worker.fetch(new Request(`https://bandarlab.site${path}`, { method }), seoEnv);

  it('gives each public route its own title, canonical, schema and readable summary', async () => {
    const html = await (await get('/radar?recipe=x')).text();
    expect(html).toContain('<title>IDX stock screener · Bandarlab</title>');
    expect(html).toContain('<link rel="canonical" href="https://bandarlab.site/radar">');
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('<noscript><h1>IDX stock screener · Bandarlab</h1>');
    expect(html).not.toContain('noindex');
  });

  it('describes the app on the home page', async () => {
    const html = await (await get('/')).text();
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    expect(ld['@graph'].map((node) => node['@type'])).toEqual(['WebSite', 'WebApplication']);
    expect(ld['@graph'][0].sameAs).toEqual(['https://www.instagram.com/bandar_lab/']);
  });

  it('keeps unknown paths usable but out of the index', async () => {
    const response = await get('/does-not-exist');
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('rel="canonical"');
  });

  it('serves the full Indonesian article for a glossary term', async () => {
    const response = await get('/glossary/bandarmologi');
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<title>Apa itu Bandarmologi? · Bandarlab</title>');
    expect(html).toContain('<link rel="canonical" href="https://bandarlab.site/glossary/bandarmologi">');
    expect(html).toMatch(/<div id="root"><article class="seo-static" lang="id"><p><a href="\/glossary">Glossary<\/a><\/p><h1>Bandarmologi<\/h1>/);
    expect(html).toContain('bukan rekomendasi investasi atau ajakan jual/beli');
    expect(html).toContain('<aside><p><strong>Bandarmologi bukan ilmu pasti.</strong>');
    expect(html).not.toContain('<noscript>');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    const term = ld['@graph'].find((node) => node['@type'] === 'DefinedTerm');
    expect(term).toMatchObject({ name: 'Bandarmologi', alternateName: 'Broker-flow analysis', inLanguage: 'id' });
  });

  it('marks Indonesian pages with lang="id" and lists every term on the glossary index', async () => {
    const shellEn = shell.replace('<html>', '<html lang="en">');
    const idEnv = { ...env, ASSETS: { fetch: async () => new Response(shellEn, { headers: { 'content-type': 'text/html' } }) } };
    const html = await (await worker.fetch(new Request('https://bandarlab.site/glossary/'), idEnv)).text();
    expect(html).toContain('<html lang="id">');
    expect(html).toContain('<link rel="canonical" href="https://bandarlab.site/glossary">');
    expect(html).toContain('"@type":"DefinedTermSet"');
    expect(html).toContain('<a href="/glossary/fca">');
    const guide = await (await worker.fetch(new Request('https://bandarlab.site/metodologi'), idEnv)).text();
    expect(guide).toContain('<h1>Metodologi dan batasan Bandarlab</h1>');
    expect(guide).toContain('Analisis teknikal tetap rajanya, analisis fundamental ratunya');
  });

  it('returns a real 404 for unknown glossary terms', async () => {
    const response = await get('/glossary/not-a-term');
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('<meta name="robots" content="noindex">');
  });

  it('generates the sitemap from the page registry', async () => {
    const response = await get('/sitemap.xml');
    expect(response.headers.get('content-type')).toContain('application/xml');
    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs).toContain('https://bandarlab.site/');
    expect(locs).toContain('https://bandarlab.site/glossary/arb');
    expect(locs).toContain('https://bandarlab.site/cara-kerja');
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs.length).toBeGreaterThan(40);
  });

  it('leaves HEAD and non-HTML responses untouched', async () => {
    expect(await (await get('/radar', 'HEAD')).text()).toBe(shell);
    const css = { ...env, ASSETS: { fetch: async () => new Response('a{}', { headers: { 'content-type': 'text/css' } }) } };
    expect(await (await worker.fetch(new Request('https://bandarlab.site/x.css'), css)).text()).toBe('a{}');
  });
});
