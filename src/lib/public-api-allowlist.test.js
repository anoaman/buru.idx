import { describe, it, expect } from 'vitest';
import { resolvePublicApiRequest, checkRateLimit } from './public-api-allowlist.js';

describe('public API allowlist', () => {
  it('forwards the routes the public product actually uses', () => {
    expect(resolvePublicApiRequest('GET', '/api/analyze?ticker=BBCA')).toEqual({
      ok: true,
      path: '/api/analyze?ticker=BBCA&mode=delayed',
    });
    expect(resolvePublicApiRequest('GET', '/api/broker-intelligence/health')).toEqual({
      ok: true,
      path: '/api/broker-intelligence/health',
    });
    expect(resolvePublicApiRequest('GET', '/api/risk-simulation?entry=100&stop=90&target=120&capital=1000000&maxRiskPct=1')).toEqual({
      ok: true,
      path: '/api/risk-simulation?entry=100&stop=90&target=120&capital=1000000&maxRiskPct=1',
    });
    expect(resolvePublicApiRequest('GET', '/api/broker-intelligence/stock?ticker=BBCA&days=7')).toEqual({
      ok: true,
      path: '/api/broker-intelligence/stock?ticker=BBCA&days=7',
    });
    expect(resolvePublicApiRequest('GET', '/api/opportunities').ok).toBe(true);
    expect(resolvePublicApiRequest('GET', '/api/radar/scout?recipe=quiet_accumulation&brokerSessions=7')).toEqual({
      ok: true,
      path: '/api/radar/scout?recipe=quiet_accumulation&brokerSessions=7',
    });
    expect(resolvePublicApiRequest('GET', '/api/watchlist').ok).toBe(true);
  });

  it('forwards Scout custom broker dates and lead-broker minimum to upstream', () => {
    const result = resolvePublicApiRequest(
      'GET',
      '/api/radar/scout?recipe=quiet_accumulation&brokerPreset=custom&brokerFrom=2026-01-01&brokerTo=2026-08-01&minLeadBrokerValue=500000000&useLeadBrokerValue=true&limit=25',
    );
    expect(result.ok).toBe(true);
    const sent = new URL(result.path, 'http://internal').searchParams;
    expect(sent.get('brokerPreset')).toBe('custom');
    expect(sent.get('brokerFrom')).toBe('2026-01-01');
    expect(sent.get('brokerTo')).toBe('2026-08-01');
    expect(sent.get('minLeadBrokerValue')).toBe('500000000');
    expect(sent.get('useLeadBrokerValue')).toBe('true');
    expect(sent.get('limit')).toBe('25');
  });

  it('drops unknown Scout parameters while keeping the route GET/HEAD-only', () => {
    const result = resolvePublicApiRequest(
      'GET',
      '/api/radar/scout?recipe=quiet_accumulation&brokerSessions=7&debug=1&dbPath=/etc/passwd',
    );
    expect(result.ok).toBe(true);
    const sent = new URL(result.path, 'http://internal').searchParams;
    expect(sent.get('recipe')).toBe('quiet_accumulation');
    expect(sent.get('brokerSessions')).toBe('7');
    expect(sent.get('debug')).toBeNull();
    expect(sent.get('dbPath')).toBeNull();
    expect(resolvePublicApiRequest('POST', '/api/radar/scout').status).toBe(405);
    expect(resolvePublicApiRequest('HEAD', '/api/radar/scout?recipe=quiet_accumulation').ok).toBe(true);
  });

  // An allowlist that silently drops a parameter the app depends on is a broken
  // app, and it fails at runtime rather than in the build. The first version of
  // this list guessed "asOf" and "broker"; the client sends "date" and "code",
  // which took out the whole broker lens with a 400.
  it('preserves every parameter the client actually sends', () => {
    const clientRequests = [
      '/api/analyze?ticker=BBCA&mode=delayed',
      '/api/broker-intelligence/health',
      '/api/broker-intelligence/stock?ticker=BBCA&days=30',
      '/api/broker-intelligence/stock?ticker=BBCA&days=7&date=2026-08-07',
      '/api/broker-intelligence/stock?ticker=BBCA&days=1&preset=3m',
      '/api/broker-intelligence/stock?ticker=BBCA&days=1&from=2026-01-01&to=2026-08-07',
      '/api/broker-intelligence/broker?code=ZP&days=30&limit=25',
      '/api/broker-intelligence/broker?code=ZP&days=7&limit=25&date=2026-08-07',
      '/api/radar/scout?recipe=dominant_broker&brokerSessions=7&consolidationSessions=10&supportSessions=20&maxPrice=1000&minAverageValue=500000000&limit=10&useBroker=true&useSupport=false&useSideways=false&useMaxPrice=true&useLiquidity=true',
      '/api/radar/scout?recipe=quiet_accumulation&brokerPreset=custom&brokerFrom=2026-01-01&brokerTo=2026-08-01&minLeadBrokerValue=1000000&useLeadBrokerValue=true&limit=50',
    ];
    for (const requested of clientRequests) {
      const result = resolvePublicApiRequest('GET', requested);
      expect(result.ok, `${requested} must be allowed`).toBe(true);
      const sent = new URL(result.path, 'http://internal').searchParams;
      for (const [name, value] of new URL(requested, 'http://internal').searchParams) {
        expect(sent.get(name), `${requested} lost ${name}`).toBe(value);
      }
    }
  });

  it('refuses to serve live data through the delayed product', () => {
    // Asking for live is the obvious first thing anyone would try.
    const result = resolvePublicApiRequest('GET', '/api/analyze?ticker=BBCA&mode=live');
    expect(result.path).toBe('/api/analyze?ticker=BBCA&mode=delayed');
  });

  it('closes the private workflow store to writes', () => {
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) {
      const result = resolvePublicApiRequest(method, '/api/watchlist');
      expect(result.ok).toBe(false);
      expect(result.status).toBe(405);
    }
  });

  it('hides workflow mutation and internal routes from the read-only workstation proxy', () => {
    for (const path of [
      '/api/trade-plans',
      '/api/journal',
      '/api/calibration',
      '/api/market-overview',
      '/api/data-health',
      '/api/fca',
    ]) {
      const result = resolvePublicApiRequest('GET', path);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
    }
  });

  it('drops query parameters that are not part of the route', () => {
    const result = resolvePublicApiRequest('GET', '/api/analyze?ticker=BBCA&mode=live&debug=1&dbPath=/etc/passwd');
    expect(result.path).toBe('/api/analyze?ticker=BBCA&mode=delayed');
  });

  it('does not treat a prefix match as the allowlisted route', () => {
    expect(resolvePublicApiRequest('GET', '/api/analyze/../watchlist').ok).toBe(false);
    expect(resolvePublicApiRequest('GET', '/api/broker-intelligence/stock/extra').ok).toBe(false);
  });

  it('rejects a malformed target instead of forwarding it', () => {
    expect(resolvePublicApiRequest('GET', '//%').ok).toBe(false);
  });

  it('rejects oversized request targets and allowed parameter values', () => {
    expect(resolvePublicApiRequest('GET', `/api/analyze?ticker=${'A'.repeat(8_192)}`).status).toBe(414);
    expect(resolvePublicApiRequest('GET', `/api/radar/scout?recipe=${'x'.repeat(4_097)}`).status).toBe(414);
  });
});

describe('rate limiting', () => {
  it('allows a normal burst and then refuses with a retry hint', () => {
    const buckets = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 120; i += 1) {
      expect(checkRateLimit('1.2.3.4', now, buckets).allowed).toBe(true);
    }
    const blocked = checkRateLimit('1.2.3.4', now, buckets);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('counts each caller separately', () => {
    const buckets = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 120; i += 1) checkRateLimit('1.2.3.4', now, buckets);
    expect(checkRateLimit('5.6.7.8', now, buckets).allowed).toBe(true);
  });

  it('reopens the window once it has passed', () => {
    const buckets = new Map();
    const now = 1_000_000;
    for (let i = 0; i < 130; i += 1) checkRateLimit('1.2.3.4', now, buckets);
    expect(checkRateLimit('1.2.3.4', now + 60_001, buckets).allowed).toBe(true);
  });

  // The sweep used to sit on the increment branch, which only runs for a caller
  // that already has a bucket. A flood from many distinct addresses — the only
  // traffic shape that can grow this map without bound — never reached it.
  it('does not grow without bound under traffic from many distinct callers', () => {
    const buckets = new Map();
    let now = 1_000_000;
    for (let i = 0; i < 20_000; i += 1) {
      now += 10;
      checkRateLimit(`10.0.${Math.floor(i / 256) % 256}.${i % 256}`, now, buckets);
    }
    expect(buckets.size).toBeLessThan(20_000);
  });

  it('keeps live callers when it sweeps', () => {
    const buckets = new Map();
    const now = 1_000_000;
    checkRateLimit('1.2.3.4', now, buckets);
    for (let i = 0; i < 6000; i += 1) checkRateLimit(`9.9.${i >> 8}.${i & 255}`, now, buckets);
    expect(buckets.has('1.2.3.4')).toBe(true);
    expect(checkRateLimit('1.2.3.4', now, buckets).remaining).toBe(118);
  });
});
