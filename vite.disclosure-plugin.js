import { DISCLOSURE_PATHS } from './src/lib/public-api-allowlist.js';
import { handleDisclosureHttp } from './src/lib/disclosures/http.js';
import { pythonDisclosureStore } from './src/lib/disclosures/local-store.js';

export function disclosureLocalApi() {
  return {
    name: 'disclosure-local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '/';
        const pathname = url.split('?')[0];
        if (!DISCLOSURE_PATHS.has(pathname)) return next();
        const handled = handleDisclosureHttp(req.method || 'GET', url, pythonDisclosureStore);
        res.statusCode = handled.status;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.setHeader('x-content-type-options', 'nosniff');
        res.end(JSON.stringify(handled.body));
      });
    },
  };
}
