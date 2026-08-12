const ALLOWED_API_PATHS = new Set([
  '/api/analyze',
  '/api/broker-intelligence/broker',
  '/api/broker-intelligence/health',
  '/api/broker-intelligence/stock',
  '/api/opportunities',
  '/api/radar/scout',
  '/api/risk-simulation',
  '/api/watchlist',
]);

function json(status, error) {
  return Response.json({ success: false, error }, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function originRequest(request, env, url) {
  const origin = new URL(env.API_ORIGIN);
  origin.pathname = url.pathname;
  origin.search = url.search;
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
      return new Response(response.body, {
        status: response.status,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return json(405, 'This endpoint is read-only.');
      }
      if (!ALLOWED_API_PATHS.has(url.pathname)) return json(404, 'Not found.');
      const response = await fetch(originRequest(request, env, url));
      return new Response(response.body, {
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
