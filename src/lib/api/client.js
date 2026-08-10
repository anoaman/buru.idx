const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
const CACHE_MAX_ENTRIES = 64;
const CACHE_TTL_MS = 45_000;

const cache = new Map();
const inFlight = new Map();

function publicErrorMessage(message) {
  const text = String(message || '').trim();
  if (/401 unauthorized|token|grab-token|set-token|stockbit/i.test(text)) {
    return 'Delayed analysis is temporarily unavailable while the data cache refreshes.';
  }
  return text || 'Request failed';
}

function cacheKey(path, options = {}) {
  return `${path}::${options.method || 'GET'}::${JSON.stringify(options.body || '')}`;
}

function isCacheable(path, options = {}) {
  return (options.method || 'GET') === 'GET'
    && path.startsWith('/api/broker-intelligence/');
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

export function getBrokerArchiveHealth() {
  return request('/api/broker-intelligence/health');
}

export function getStockBrokerIntelligence({ ticker, days, date = null }) {
  const params = new URLSearchParams();
  params.set('ticker', String(ticker || '').toUpperCase());
  params.set('days', String(days));
  if (date) params.set('date', date);
  return request(`/api/broker-intelligence/stock?${params.toString()}`);
}

export function getBrokerStockIntelligence({ code, days, date = null, limit = 25 }) {
  const params = new URLSearchParams();
  params.set('code', String(code || '').toUpperCase());
  params.set('days', String(days));
  params.set('limit', String(limit));
  if (date) params.set('date', date);
  return request(`/api/broker-intelligence/broker?${params.toString()}`);
}

export function prefetchStockBrokerIntelligence({ ticker, days, date = null }) {
  return getStockBrokerIntelligence({ ticker, days, date });
}

export function prefetchBrokerStockIntelligence({ code, days, date = null, limit = 25 }) {
  return getBrokerStockIntelligence({ code, days, date, limit });
}
