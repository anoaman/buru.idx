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
  ['/api/radar/scout', { params: [
    'recipe',
    'asOf',
    'brokerSessions',
    'brokerPreset',
    'brokerFrom',
    'brokerTo',
    'consolidationSessions',
    'supportSessions',
    'maxPrice',
    'minAverageValue',
    'minLeadBrokerValue',
    'limit',
    'useBroker',
    'useSupport',
    'useSideways',
    'useMaxPrice',
    'useLiquidity',
    'useLeadBrokerValue',
    'minRsVsIhsgPct',
    'useRsVsIhsg',
    'excludeFca',
  ] }],
  ['/api/watchlist', { params: [] }],
  ['/api/broker-intelligence/health', { params: [] }],
  ['/api/broker-intelligence/stock', { params: ['ticker', 'days', 'date', 'preset', 'from', 'to'] }],
  ['/api/broker-intelligence/broker', { params: ['code', 'days', 'limit', 'date', 'preset', 'from', 'to'] }],
  ['/api/disclosures', { params: ['ticker', 'from', 'to', 'category', 'severity', 'signal', 'cursor', 'limit'] }],
  ['/api/disclosures/detail', { params: ['eventId'] }],
  ['/api/disclosures/timeline', { params: ['ticker', 'from', 'to', 'limit'] }],
  ['/api/disclosures/anomalies', { params: ['ticker', 'severity', 'signal', 'from', 'to', 'cursor', 'limit'] }],
  ['/api/disclosures/documents', { params: ['documentId', 'eventId'] }],
  ['/api/fundamentals/statements', { params: ['ticker', 'period', 'statementType', 'cursor', 'limit'] }],
  ['/api/fundamentals/snapshot', { params: ['ticker'] }],
  ['/api/fundamentals/periods', { params: ['ticker'] }],
  ['/api/fundamentals/facts', { params: ['ticker', 'filingId', 'statementType', 'periodLabel', 'cursor', 'limit'] }],
  ['/api/fundamentals/filing', { params: ['ticker', 'filingId'] }],
  ['/api/fundamentals/derived', { params: ['ticker', 'filingId', 'periodLabel'] }],
  ['/api/fundamentals/sources', { params: ['ticker', 'filingId'] }],
  ['/api/news-detector', { params: ['date'] }],
  ['/api/news-detector/scan', { params: ['date'], methods: ['POST'] }],
  ['/api/collector/health', { params: [] }],
]);

export const DISCLOSURE_PATHS = new Set([
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
  '/api/collector/health',
]);

// Per-IP token bucket. Cheap, in-process, and enough to stop one client hammering
// SQLite. Not a substitute for an edge limiter if this ever fronts real traffic.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.STOCK_ANALYSIS_RATE_LIMIT || 120);
export const UPSTREAM_TIMEOUT_MS = Number(process.env.STOCK_ANALYSIS_UPSTREAM_TIMEOUT_MS || 30_000);
const rateBuckets = new Map();

const RATE_LIMIT_MAX_BUCKETS = 5000;
const RATE_LIMIT_SWEEP_INTERVAL_MS = 1_000;
const nextSweepAt = new WeakMap();

// Unbounded growth is its own denial of service. Sweep expired buckets while we
// are already here rather than running a timer.
//
// This has to run on the path that *adds* keys. It used to sit on the increment
// branch, which only ever runs for a caller that already has a bucket, so the
// one traffic shape that grows the map without bound — a flood from many
// distinct addresses — was also the one shape that never triggered the sweep.
//
// Rate-limited to one pass a second because the sweep is O(size): running it on
// every arrival once the map is large turns a flood into quadratic work, which
// is the same denial of service arriving through the defence.
function sweepExpired(buckets, nowMs) {
  if (buckets.size <= RATE_LIMIT_MAX_BUCKETS) return;
  if (nowMs < (nextSweepAt.get(buckets) ?? 0)) return;
  nextSweepAt.set(buckets, nowMs + RATE_LIMIT_SWEEP_INTERVAL_MS);
  for (const [key, bucket] of buckets) {
    if (nowMs >= bucket.resetAt) buckets.delete(key);
  }
}

export function checkRateLimit(key, nowMs, buckets = rateBuckets) {
  const bucket = buckets.get(key);
  if (!bucket || nowMs >= bucket.resetAt) {
    sweepExpired(buckets, nowMs);
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
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - bucket.count, retryAfterSec: 0 };
}

/**
 * Decide what, if anything, this request is allowed to ask the private API.
 * Returns the exact upstream path or a refusal. No request shape reaches the
 * backend that was not built here.
 */
export function resolvePublicApiRequest(method, rawUrl) {
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
  const allowedMethods = route.methods || ['GET', 'HEAD'];
  if (!allowedMethods.includes(method)) {
    return { ok: false, status: 405, error: 'This method is not allowed.' };
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
