const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
const CACHE_MAX_ENTRIES = 64;
const CACHE_TTL_MS = 45_000;

const cache = new Map();
const inFlight = new Map();

function publicErrorMessage(message) {
  const text = String(message || '').trim();
  if (/401 unauthorized|token|grab-token|set-token/i.test(text)) {
    return 'Delayed analysis is temporarily unavailable while the data cache refreshes.';
  }
  return text || 'Request failed';
}

function cacheKey(path, options = {}) {
  return `${path}::${options.method || 'GET'}::${JSON.stringify(options.body || '')}`;
}

function isCacheable(path, options = {}) {
  return (options.method || 'GET') === 'GET'
    && (path.startsWith('/api/broker-intelligence/') || path.startsWith('/api/analyze?'));
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size >= CACHE_MAX_ENTRIES) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const key = cacheKey(path, options);

  if (isCacheable(path, options)) {
    pruneCache();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }
  }

  const promise = (async () => {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        ...options,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          error: publicErrorMessage(body?.error || `HTTP ${response.status}: ${response.statusText}`),
          status: response.status,
        };
      }
      return body || {
        success: false,
        error: 'Invalid JSON response',
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: publicErrorMessage(error.message || 'Network error'),
        status: null,
      };
    }
  })();

  if (isCacheable(path, options)) {
    inFlight.set(key, promise);
    promise.then((result) => {
      inFlight.delete(key);
      if (result && result.success !== false) {
        pruneCache();
        cache.set(key, { payload: result, expiresAt: Date.now() + CACHE_TTL_MS });
      }
    }).catch(() => {
      inFlight.delete(key);
    });
  }

  return promise;
}

export function invalidateBrokerCache() {
  for (const key of cache.keys()) {
    if (key.includes('/broker-intelligence/')) cache.delete(key);
  }
}

export function analyzeTicker(ticker) {
  const params = new URLSearchParams();
  params.set('ticker', ticker);
  params.set('mode', 'delayed');
  return request(`/api/analyze?${params.toString()}`);
}

export function simulateRisk({ entry, stop, target, capital, maxRiskPct }) {
  const params = new URLSearchParams({
    entry: String(entry),
    stop: String(stop),
    target: String(target),
    capital: String(capital),
    maxRiskPct: String(maxRiskPct),
  });
  return request(`/api/risk-simulation?${params.toString()}`);
}

export function getDataHealth() {
  return request('/api/data-health');
}

export function getRadarScout(options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value != null && value !== '') params.set(key, key === 'conditions' ? JSON.stringify(value) : String(value));
  }
  return request(`/api/radar/scout?${params.toString()}`);
}

export function getRadarScoutConditions() {
  return request('/api/radar/scout/conditions');
}

export function getBrokerArchiveHealth() {
  return request('/api/broker-intelligence/health');
}

export function getStockBrokerIntelligence({ ticker, days = 1, date = null, preset = null, from = null, to = null }) {
  const params = new URLSearchParams();
  params.set('ticker', String(ticker || '').toUpperCase());
  params.set('days', String(days));
  if (date) params.set('date', date);
  if (preset) params.set('preset', preset);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request(`/api/broker-intelligence/stock?${params.toString()}`);
}

export function getBrokerStockIntelligence({ code, days = 1, date = null, preset = null, from = null, to = null, limit = 25, filters = {} }) {
  const params = new URLSearchParams();
  params.set('code', String(code || '').toUpperCase());
  params.set('days', String(days));
  params.set('limit', String(limit));
  if (date) params.set('date', date);
  if (preset) params.set('preset', preset);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== false && value != null) params.set(key, String(value));
  }
  return request(`/api/broker-intelligence/broker?${params.toString()}`);
}

export function prefetchStockBrokerIntelligence({ ticker, days, date = null }) {
  return getStockBrokerIntelligence({ ticker, days, date });
}

export function prefetchBrokerStockIntelligence({ code, days, date = null, limit = 25 }) {
  return getBrokerStockIntelligence({ code, days, date, limit });
}

function withQuery(path, params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function getDisclosures(filters = {}) {
  return request(withQuery('/api/disclosures', filters));
}

export function getDisclosureDetail(eventId) {
  return request(withQuery('/api/disclosures/detail', { eventId }));
}

export function getDisclosureTimeline(filters = {}) {
  return request(withQuery('/api/disclosures/timeline', filters));
}

export function getDisclosureAnomalies(filters = {}) {
  return request(withQuery('/api/disclosures/anomalies', filters));
}

export function getDisclosureDocuments(filters = {}) {
  return request(withQuery('/api/disclosures/documents', filters));
}

export function getFundamentalStatements(filters = {}) {
  return request(withQuery('/api/fundamentals/statements', filters));
}

export function getFundamentalsSnapshot(ticker) {
  return request(withQuery('/api/fundamentals/snapshot', { ticker }));
}

export function getFundamentalsPeriods(ticker) {
  return request(withQuery('/api/fundamentals/periods', { ticker }));
}

export function getFundamentalsFacts(filters = {}) {
  return request(withQuery('/api/fundamentals/facts', filters));
}

export function getFundamentalsFiling(filters = {}) {
  return request(withQuery('/api/fundamentals/filing', filters));
}

export function getFundamentalsDerived(filters = {}) {
  return request(withQuery('/api/fundamentals/derived', filters));
}

export function getFundamentalsSources(filters = {}) {
  return request(withQuery('/api/fundamentals/sources', filters));
}

export function getCollectorHealth() {
  return request('/api/collector/health');
}

export function getNewsDetector(date) {
  return request(withQuery('/api/news-detector', { date }));
}

export function runNewsDetector(date) {
  return request(withQuery('/api/news-detector/scan', { date }), { method: 'POST' });
}
