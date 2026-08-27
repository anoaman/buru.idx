const PUBLIC_ROUTES = new Map([
  ['/api/analyze', { params: ['ticker'], force: { mode: 'delayed' } }],
  ['/api/broker-intelligence/broker', { params: ['code', 'days', 'limit', 'date', 'preset', 'from', 'to'] }],
  ['/api/broker-intelligence/stock', { params: ['ticker', 'days', 'date', 'preset', 'from', 'to'] }],
  ['/api/opportunities', { params: [] }],
  ['/api/radar/scout', { params: [
    'recipe', 'brokerSessions', 'brokerPreset', 'brokerFrom', 'brokerTo',
    'consolidationSessions', 'supportSessions', 'maxPrice', 'minAverageValue',
    'minLeadBrokerValue', 'limit', 'useBroker', 'useSupport', 'useSideways',
    'useMaxPrice', 'useLiquidity', 'useLeadBrokerValue',
  ] }],
  ['/api/risk-simulation', { params: ['entry', 'stop', 'target', 'capital', 'maxRiskPct'] }],
]);

const PRIVATE_KEYS = new Set([
  'archive',
  'earliestAvailableDate',
  'fetchedAt',
  'materializedAt',
  'priceSource',
  'serving',
  'servingAvailable',
  'servingEarliest',
  'servingLatest',
  'servingReason',
  'servingRows',
  'servingStatus',
  'sourceLatestDate',
  'sourceThroughDate',
  'sources',
]);
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_REQUEST_TARGET_LENGTH = 8_192;
const MAX_QUERY_VALUE_LENGTH = 4_096;

function publicText(value) {
  return value
    .replace(/\barchive\b/gi, 'dataset')
    .replace(/\bserving layer\b/gi, 'data service')
    .replace(/\bmaterialized\b/gi, 'updated');
}

function sanitize(value) {
  if (typeof value === 'string') return publicText(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !PRIVATE_KEYS.has(key))
    .filter(([key]) => key !== 'name' || !('lastDate' in value))
    .map(([key, item]) => [key, sanitize(item)]));
}

function json(status, error) {
  return Response.json({ success: false, error }, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function secure(response) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  return secured;
}

function originRequest(request, env, url) {
  if (!env.API_ORIGIN || !env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET) {
    throw new Error('Origin configuration is unavailable.');
  }
  const origin = new URL(env.API_ORIGIN);
  origin.pathname = url.pathname;
  const route = PUBLIC_ROUTES.get(url.pathname);
  const query = new URLSearchParams();
  for (const name of route?.params || []) {
    const value = url.searchParams.get(name);
    if (value != null && value.length > MAX_QUERY_VALUE_LENGTH) {
      throw new RangeError('Request parameter is too long.');
    }
    if (value != null && value !== '') query.set(name, value);
  }
  for (const [name, value] of Object.entries(route?.force || {})) query.set(name, value);
  origin.search = query.toString();
  const headers = new Headers({
    accept: 'application/json',
    'cf-access-client-id': env.CF_ACCESS_CLIENT_ID,
    'cf-access-client-secret': env.CF_ACCESS_CLIENT_SECRET,
  });
  return new Request(origin, {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.length + url.search.length > MAX_REQUEST_TARGET_LENGTH) {
      return secure(json(414, 'Request target is too long.'));
    }
    if (url.pathname === '/healthz') {
      return secure(Response.json({ status: 'ok' }, {
        headers: { 'cache-control': 'no-store' },
      }));
    }

    if (url.pathname === '/readyz') {
      try {
        const response = await fetch(originRequest(request, env, new URL('/readyz', url)));
        return secure(Response.json({ status: response.ok ? 'ready' : 'unavailable' }, {
          status: response.status,
          headers: { 'cache-control': 'no-store' },
        }));
      } catch {
        return secure(json(502, 'Analysis service is temporarily unavailable.'));
      }
    }

    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return secure(json(405, 'This endpoint is read-only.'));
      }
      if (!PUBLIC_ROUTES.has(url.pathname)) return secure(json(404, 'Not found.'));
      let response;
      try {
        response = await fetch(originRequest(request, env, url));
      } catch (error) {
        const status = error instanceof RangeError ? 414 : 502;
        const message = status === 414 ? error.message : 'Analysis service is temporarily unavailable.';
        return secure(json(status, message));
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return secure(json(response.ok ? 502 : response.status, 'Analysis service returned an invalid response.'));
      }
      let payload;
      try {
        payload = sanitize(await response.json());
      } catch {
        return secure(json(502, 'Analysis service returned an invalid response.'));
      }
      return secure(Response.json(payload, {
        status: response.status,
        headers: {
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      }));
    }

    return secure(await env.ASSETS.fetch(request));
  },
};
