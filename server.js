import { createReadStream, existsSync, statSync } from 'fs';
import { createServer, request as httpRequest } from 'http';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('./dist/', import.meta.url));
const HOST = process.env.STOCK_ANALYSIS_HOST || '127.0.0.1';
const PORT = Number(process.env.STOCK_ANALYSIS_PORT || 8792);
const API_ORIGIN = new URL(process.env.STOCK_ANALYSIS_API_ORIGIN || 'http://127.0.0.1:8787');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function proxyApi(req, res) {
  const upstream = httpRequest({
    protocol: API_ORIGIN.protocol,
    hostname: API_ORIGIN.hostname,
    port: API_ORIGIN.port,
    method: req.method,
    path: req.url,
    headers: { accept: req.headers.accept || 'application/json' },
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, {
      'content-type': upstreamRes.headers['content-type'] || 'application/json',
      'cache-control': 'public, max-age=60, stale-while-revalidate=300',
      'x-content-type-options': 'nosniff',
    });
    upstreamRes.pipe(res);
  });
  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: `API unavailable: ${error.message}` }));
  });
  req.pipe(upstream);
}

function resolveStaticPath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = join(ROOT, clean === '/' ? 'index.html' : clean);
  if (!candidate.startsWith(ROOT)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return join(ROOT, 'index.html');
}

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) return proxyApi(req, res);
  const path = resolveStaticPath(req.url || '/');
  if (!path || !existsSync(path)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  res.writeHead(200, {
    'content-type': contentTypes[extname(path)] || 'application/octet-stream',
    'cache-control': path.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  createReadStream(path).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`stock analysis listening on http://${HOST}:${PORT}`);
});
