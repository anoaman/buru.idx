// The public surface, stated explicitly.
//
// This proxy used to forward every method and every /api/ path straight through
// to the private API. The frontend not calling /api/watchlist is not the same as
// that route being closed: anything that could reach this port could POST to the
// watchlist, PATCH a trade plan, write to the journal, or read /api/calibration
// and /api/opportunities — the shortlist and the calibration work are the edge,
// not the product. An allowlist is the only version of this that survives being
// put on the internet, which is the entire remaining question for Phase E.
//
// Keys are exact pathnames. `params` is the complete set of query parameters
// forwarded; anything else is dropped rather than passed along. `force` overrides
// caller-supplied values.
const PUBLIC_ROUTES = new Map([
  // mode is forced: the public product is delayed/EOD by decision, and without
  // this a caller could simply ask for mode=live and get the live read.
  ['/api/analyze', { params: ['ticker'], force: { mode: 'delayed' } }],
  ['/api/risk-simulation', { params: ['entry', 'stop', 'target', 'capital', 'maxRiskPct'] }],
  ['/api/opportunities', { params: [] }],
  ['/api/watchlist', { params: [] }],
  ['/api/broker-intelligence/health', { params: [] }],
  ['/api/broker-intelligence/stock', { params: ['ticker', 'days', 'date', 'preset', 'from', 'to'] }],
  ['/api/broker-intelligence/broker', { params: ['code', 'days', 'limit', 'date', 'preset', 'from', 'to'] }],
]);

// Per-IP token bucket. Cheap, in-process, and enough to stop one client hammering
// SQLite. Not a substitute for an edge limiter if this ever fronts real traffic.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.STOCK_ANALYSIS_RATE_LIMIT || 120);
export const UPSTREAM_TIMEOUT_MS = Number(process.env.STOCK_ANALYSIS_UPSTREAM_TIMEOUT_MS || 30_000);
const rateBuckets = new Map();

export function checkRateLimit(key, nowMs, buckets = rateBuckets) {
  const bucket = buckets.get(key);
  if (!bucket || nowMs >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: nowMs + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, retryAfterSec: 0 };
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - nowMs) / 1000)),
    };
  }
  bucket.count += 1;
  // Unbounded growth is its own denial of service. Sweep expired buckets while
  // we are already here rather than running a timer.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (nowMs >= b.resetAt) buckets.delete(k);
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - bucket.count, retryAfterSec: 0 };
}

/**
 * Decide what, if anything, this request is allowed to ask the private API.
 * Returns the exact upstream path or a refusal. No request shape reaches the
 * backend that was not built here.
 */
export function resolvePublicApiRequest(method, rawUrl) {
  if (method !== 'GET' && method !== 'HEAD') {
    return { ok: false, status: 405, error: 'This endpoint is read-only.' };
  }
  let url;
  const rawPath = String(rawUrl || '').split('?')[0];
  if (/(^|\/)\.\.?($|\/)/.test(rawPath)) {
    return { ok: false, status: 400, error: 'Malformed request.' };
  }
  try {
    url = new URL(rawUrl, 'http://internal');
  } catch {
    return { ok: false, status: 400, error: 'Malformed request.' };
  }
  const route = PUBLIC_ROUTES.get(url.pathname);
  if (!route) {
    return { ok: false, status: 404, error: 'Not found.' };
  }
  const forwarded = new URLSearchParams();
  for (const name of route.params) {
    const value = url.searchParams.get(name);
    if (value != null && value !== '') forwarded.set(name, value);
  }
  for (const [name, value] of Object.entries(route.force || {})) {
    forwarded.set(name, value);
  }
  const query = forwarded.toString();
  return { ok: true, path: query ? `${url.pathname}?${query}` : url.pathname };
}
