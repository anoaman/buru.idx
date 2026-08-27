import { createReadStream, existsSync, statSync } from 'fs';
import { createServer, request as httpRequest } from 'http';
import { extname, join, normalize } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  checkRateLimit,
  resolvePublicApiRequest,
  UPSTREAM_TIMEOUT_MS,
} from './src/lib/public-api-allowlist.js';

const ROOT = fileURLToPath(new URL('./dist/', import.meta.url));
const HOST = process.env.STOCK_ANALYSIS_HOST || '127.0.0.1';
const PORT = Number(process.env.STOCK_ANALYSIS_PORT || 8792);
const API_ORIGIN = new URL(process.env.STOCK_ANALYSIS_API_ORIGIN || 'http://127.0.0.1:8787');
const BASE_SECURITY_HEADERS = {
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...BASE_SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function clientKey(req) {
  return req.socket.remoteAddress || 'unknown';
}

function proxyApi(req, res) {
  const limit = checkRateLimit(clientKey(req), Date.now());
  if (!limit.allowed) {
    return sendJson(res, 429, { success: false, error: 'Too many requests. Try again shortly.' }, {
      'retry-after': String(limit.retryAfterSec),
    });
  }

  const decision = resolvePublicApiRequest(req.method, req.url || '/');
  if (!decision.ok) {
    return sendJson(res, decision.status, { success: false, error: decision.error });
  }

  const upstream = httpRequest({
    protocol: API_ORIGIN.protocol,
    hostname: API_ORIGIN.hostname,
    port: API_ORIGIN.port,
    method: 'GET',
    path: decision.path,
    headers: { accept: 'application/json' },
  }, (upstreamRes) => {
    const status = upstreamRes.statusCode || 502;
    // A 5xx body from the private API may contain internal authentication or
    // operator-runbook details. 4xx bodies are caller-facing validation text,
    // so those pass through.
    if (status >= 500) {
      upstreamRes.resume();
      console.error(`[proxy] upstream ${status} for ${decision.path}`);
      return sendJson(res, status, {
        success: false,
        error: 'Analysis is temporarily unavailable while the data cache refreshes.',
      });
    }
    res.writeHead(status, {
      'content-type': upstreamRes.headers['content-type'] || 'application/json',
      'cache-control': status === 200
        ? 'public, max-age=60, stale-while-revalidate=300'
        : 'no-store',
      ...BASE_SECURITY_HEADERS,
    });
    upstreamRes.pipe(res);
  });
  upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
    upstream.destroy(new Error('upstream timed out'));
  });
  upstream.on('error', (error) => {
    if (res.headersSent) return res.destroy();
    // The upstream message can name internal hosts, ports and maintenance
    // commands. The caller gets the status, not the internals.
    console.error(`[proxy] ${decision.path}: ${error.message}`);
    sendJson(res, 502, { success: false, error: 'Analysis service is temporarily unavailable.' });
  });
  // Nothing from the client body is forwarded; only allowlisted GETs get here.
  upstream.end();
}

export function resolveStaticPath(urlPath) {
  let decoded;
  try {
    // decodeURIComponent throws on malformed percent-encoding. Unhandled, that
    // throw escapes the request handler and takes the whole process down, so a
    // single GET /% was enough to stop the workstation serving anything.
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const clean = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = join(ROOT, clean === '/' ? 'index.html' : clean);
  if (!candidate.startsWith(ROOT)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return join(ROOT, 'index.html');
}

function handle(req, res) {
  if (req.url?.startsWith('/api/')) return proxyApi(req, res);
  const path = resolveStaticPath(req.url || '/');
  if (!path || !existsSync(path)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  res.writeHead(200, {
    'content-type': contentTypes[extname(path)] || 'application/octet-stream',
    'cache-control': path.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    ...BASE_SECURITY_HEADERS,
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  });
  createReadStream(path).pipe(res);
}

export const server = createServer((req, res) => {
  // A throw from a request handler is an uncaught exception, and an uncaught
  // exception ends the process. One malformed request should cost that request,
  // not the workstation.
  try {
    handle(req, res);
  } catch (error) {
    console.error(`[server] ${req.method} ${req.url}: ${error.message}`);
    if (res.headersSent) return res.destroy();
    sendJson(res, 500, { success: false, error: 'Request failed.' });
  }
});

// Importing this module for its allowlist must not open a socket.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, HOST, () => {
    console.log(`stock analysis listening on http://${HOST}:${PORT}`);
  });
}
