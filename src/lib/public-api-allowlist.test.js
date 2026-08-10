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
      '/api/broker-intelligence/broker?code=ZP&days=30&limit=25',
      '/api/broker-intelligence/broker?code=ZP&days=7&limit=25&date=2026-08-07',
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

  it('hides the private routes entirely, not just from the frontend', () => {
    for (const path of [
      '/api/watchlist',
      '/api/trade-plans',
      '/api/journal',
      '/api/calibration',
      '/api/opportunities',
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
});
