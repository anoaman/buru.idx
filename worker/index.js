const PUBLIC_ROUTES = new Map([
  ['/api/analyze', { params: ['ticker'], force: { mode: 'delayed' } }],
  ['/api/broker-intelligence/broker', { params: ['code', 'days', 'limit', 'date', 'preset', 'from', 'to', 'maxPrice', 'minAverageValue', 'minBrokerNetValue', 'foreignDirection', 'minForeignValue', 'excludeFca', 'curves', 'curveFor'] }],
  ['/api/broker-intelligence/stock', { params: ['ticker', 'days', 'date', 'preset', 'from', 'to', 'curves', 'curveFor'] }],
  ['/api/broker-intelligence/health', { params: [] }],
  ['/api/data-health', { params: [] }],
  ['/api/market-overview', { params: [] }],
  ['/api/radar/scout/conditions', { params: [] }],
  ['/api/radar/scout', { params: [
    'recipe', 'conditions', 'asOf', 'brokerSessions', 'brokerPreset', 'brokerFrom', 'brokerTo',
    'consolidationSessions', 'supportSessions', 'maxPrice', 'minAverageValue',
    'minLeadBrokerValue', 'minBrokerAccumulation', 'brokerCode', 'limit', 'useBroker', 'useSupport', 'useSideways',
    'useMaxPrice', 'useLiquidity', 'useLeadBrokerValue',
    'minRsVsIhsgPct', 'useRsVsIhsg', 'excludeFca',
  ] }],
  ['/api/risk-simulation', { params: ['entry', 'stop', 'target', 'capital', 'maxRiskPct'] }],
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
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_REQUEST_TARGET_LENGTH = 8_192;
const MAX_QUERY_VALUE_LENGTH = 4_096;

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

function elapsedMs(startedAt) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function originTimingHeaders(startedAt, failure = null) {
  const duration = elapsedMs(startedAt);
  const headers = {
    'server-timing': `analysis-origin;dur=${duration}`,
    'x-analysis-origin-ms': String(duration),
  };
  if (failure) headers['x-analysis-failure'] = failure;
  return headers;
}

function withHeaders(response, headers) {
  const next = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) next.headers.set(name, value);
  return next;
}

const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
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

// The platform moved to bandarlab.site on 2026-11-08. The old host keeps its
// API alive for tabs that are already open, and turns page navigations into a
// handoff that carries per-browser settings across in the URL fragment.
// Keep HANDOFF_KEYS in sync with src/lib/handoff.js.
const CANONICAL_HOST = 'bandarlab.site';
const LEGACY_HOSTS = new Set(['analysis.tombaklepas.app']);
const ALIAS_HOSTS = new Set(['www.bandarlab.site']);
const HANDOFF_SCRIPT_PATH = '/__handoff.js';
const HANDOFF_KEYS = ['nalar.screener.savedScreens', 'nalar.chart.overlays', 'nalar-theme'];

function canonicalUrl(url) {
  return `https://${CANONICAL_HOST}${url.pathname}${url.search}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function handoffScript() {
  return `(function () {
  var target = 'https://${CANONICAL_HOST}' + location.pathname + location.search;
  try {
    var data = {};
    var found = false;
    ${JSON.stringify(HANDOFF_KEYS)}.forEach(function (key) {
      var value = localStorage.getItem(key);
      if (value != null) { data[key] = value; found = true; }
    });
    if (found) {
      var packed = encodeURIComponent(JSON.stringify(data));
      if (packed.length <= 200000) target += '#nalar-handoff=' + packed;
    }
  } catch (error) { /* storage blocked: move without settings */ }
  location.replace(target);
})();
`;
}

function handoffPage(url) {
  const target = escapeHtml(canonicalUrl(url));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Bandarlab has moved</title>
<link rel="canonical" href="${target}">
<noscript><meta http-equiv="refresh" content="0; url=${target}"></noscript>
<script src="${HANDOFF_SCRIPT_PATH}"></script>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:20vh auto;max-width:32rem;padding:0 1.5rem;color:#222}a{color:inherit}</style>
</head>
<body>
<p>Bandarlab now lives at <a href="${target}">bandarlab.site</a>. Taking you there now.</p>
</body>
</html>
`;
}

function legacyResponse(request, url) {
  if (url.pathname === HANDOFF_SCRIPT_PATH) {
    return new Response(handoffScript(), {
      headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const accept = request.headers.get('accept') || '';
  const isNavigation = ['GET', 'HEAD'].includes(request.method) && accept.includes('text/html');
  if (!isNavigation) return null;
  return new Response(request.method === 'HEAD' ? null : handoffPage(url), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
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
    if (ALIAS_HOSTS.has(url.hostname)) {
      return secure(Response.redirect(canonicalUrl(url), 301));
    }
    if (LEGACY_HOSTS.has(url.hostname) && !url.pathname.startsWith('/api/')
      && url.pathname !== '/healthz' && url.pathname !== '/readyz') {
      const legacy = legacyResponse(request, url);
      if (legacy) return secure(legacy);
    }
    if (url.pathname === '/healthz') {
      return secure(Response.json({ status: 'ok' }, {
        headers: { 'cache-control': 'no-store' },
      }));
    }

    if (url.pathname === '/readyz') {
      const startedAt = performance.now();
      try {
        const response = await fetch(originRequest(request, env, new URL('/readyz', url)));
        return secure(withHeaders(Response.json({ status: response.ok ? 'ready' : 'unavailable' }, {
          status: response.status,
          headers: { 'cache-control': 'no-store' },
        }), originTimingHeaders(startedAt)));
      } catch (error) {
        const failure = error?.name === 'TimeoutError' ? 'origin_timeout' : 'origin_unavailable';
        console.error(`[analysis-worker] /readyz ${failure} after ${elapsedMs(startedAt)}ms`);
        return secure(withHeaders(
          json(502, 'Analysis service is temporarily unavailable.'),
          originTimingHeaders(startedAt, failure),
        ));
      }
    }

    if (url.pathname.startsWith('/api/')) {
      const route = PUBLIC_ROUTES.get(url.pathname);
      if (!route) return secure(json(404, 'Not found.'));
      if (!(route.methods || ['GET', 'HEAD']).includes(request.method)) {
        return secure(json(405, 'This method is not allowed.'));
      }
      const startedAt = performance.now();
      let response;
      try {
        response = await fetch(originRequest(request, env, url));
      } catch (error) {
        const status = error instanceof RangeError ? 414 : 502;
        const message = status === 414 ? error.message : 'Analysis service is temporarily unavailable.';
        const failure = status === 414
          ? 'invalid_request'
          : error?.name === 'TimeoutError' ? 'origin_timeout' : 'origin_unavailable';
        if (status === 502) {
          console.error(`[analysis-worker] ${url.pathname} ${failure} after ${elapsedMs(startedAt)}ms`);
        }
        return secure(withHeaders(json(status, message), originTimingHeaders(startedAt, failure)));
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return secure(withHeaders(
          json(response.ok ? 502 : response.status, 'Analysis service returned an invalid response.'),
          originTimingHeaders(startedAt, 'invalid_origin_response'),
        ));
      }
      let payload;
      try {
        payload = sanitize(await response.json());
      } catch {
        return secure(withHeaders(
          json(502, 'Analysis service returned an invalid response.'),
          originTimingHeaders(startedAt, 'invalid_origin_response'),
        ));
      }
      // Only bounded public provenance crosses the origin boundary. Never
      // forward arbitrary headers (cookies, Access credentials or internals).
      const provenance = {};
      const rules = {
        'retry-after': /^\d{1,4}$/,
        age: /^\d{1,10}$/,
        'x-cache': /^(HIT|MISS|SHARED|STALE)$/,
        'x-computed-at': /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/,
        'x-data-as-of': /^\d{4}-\d{2}-\d{2}$/,
        'x-data-generation': /^[a-zA-Z0-9_-]{1,64}$/,
      };
      for (const [name, pattern] of Object.entries(rules)) {
        const value = response.headers.get(name);
        if (value && pattern.test(value)) provenance[name] = value;
      }
      return secure(Response.json(payload, {
        status: response.status,
        headers: {
          'cache-control': 'no-store',
          ...provenance,
          ...originTimingHeaders(startedAt),
          'x-content-type-options': 'nosniff',
        },
      }));
    }

    return secure(await env.ASSETS.fetch(request));
  },
};
