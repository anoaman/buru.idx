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
  ['/api/disclosures', { params: ['ticker', 'from', 'to', 'category', 'severity', 'signal', 'cursor', 'limit'] }],
  ['/api/disclosures/detail', { params: ['eventId'] }],
  ['/api/disclosures/timeline', { params: ['ticker', 'from', 'to', 'limit'] }],
  ['/api/disclosures/anomalies', { params: ['ticker', 'severity', 'signal', 'from', 'to', 'cursor', 'limit'] }],
  ['/api/disclosures/documents', { params: ['documentId', 'eventId'] }],
  ['/api/fundamentals/statements', { params: ['ticker', 'period', 'statementType', 'cursor', 'limit'] }],
  ['/api/collector/health', { params: [] }],
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

function publicText(value) {
  return value
    .replace(/stockbit(?:[- ][a-z0-9]+)?/gi, 'market data')
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
  const origin = new URL(env.API_ORIGIN);
  origin.pathname = url.pathname;
  const route = PUBLIC_ROUTES.get(url.pathname);
  const query = new URLSearchParams();
  for (const name of route?.params || []) {
    const value = url.searchParams.get(name);
    if (value != null && value !== '') query.set(name, value);
  }
  for (const [name, value] of Object.entries(route?.force || {})) query.set(name, value);
  origin.search = query.toString();
  const headers = new Headers(request.headers);
  headers.set('accept', 'application/json');
  headers.set('cf-access-client-id', env.CF_ACCESS_CLIENT_ID);
  headers.set('cf-access-client-secret', env.CF_ACCESS_CLIENT_SECRET);
  headers.delete('cookie');
  return new Request(origin, {
    method: request.method,
    headers,
    redirect: 'manual',
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      return Response.json({ status: 'ok' }, {
        headers: { 'cache-control': 'no-store' },
      });
    }

    if (url.pathname === '/readyz') {
      const response = await fetch(originRequest(request, env, new URL('/readyz', url)));
      return Response.json({ status: response.ok ? 'ready' : 'unavailable' }, {
        status: response.status,
        headers: { 'cache-control': 'no-store' },
      });
    }

    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return json(405, 'This endpoint is read-only.');
      }
      if (!PUBLIC_ROUTES.has(url.pathname)) return json(404, 'Not found.');
      const response = await fetch(originRequest(request, env, url));
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return json(response.ok ? 502 : response.status, 'Analysis service returned an invalid response.');
      }
      const payload = sanitize(await response.json());
      return Response.json(payload, {
        status: response.status,
        headers: {
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    return secure(await env.ASSETS.fetch(request));
  },
};
