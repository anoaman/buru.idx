// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveStaticPath, server } from './server.js';

// The static handler is the only place in the process that decodes attacker-
// supplied text. decodeURIComponent throws on malformed percent-encoding, and an
// uncaught throw inside a request handler ends the process — so `GET /%` used to
// take the whole workstation down until systemd restarted it.
describe('static path resolution', () => {
  it('refuses a malformed escape instead of throwing', () => {
    for (const url of ['/%', '/%zz', '/assets/%E0%A4%A', '/%C0%80']) {
      expect(() => resolveStaticPath(url)).not.toThrow();
      expect(resolveStaticPath(url)).toBe(null);
    }
  });

  it('keeps traversal inside the build directory', () => {
    expect(resolveStaticPath('/../../etc/passwd')).not.toContain('etc/passwd');
    expect(resolveStaticPath('/../../../../etc/passwd')).not.toContain('etc/passwd');
  });

  it('falls back to the SPA entry for unknown in-app routes', () => {
    expect(resolveStaticPath('/radar')).toMatch(/index\.html$/);
    expect(resolveStaticPath('/keterbukaan')).toMatch(/index\.html$/);
    expect(resolveStaticPath('/fundamentals')).toMatch(/index\.html$/);
    expect(resolveStaticPath('/news-detector')).toMatch(/index\.html$/);
    expect(resolveStaticPath('/glossary')).toMatch(/index\.html$/);
    expect(resolveStaticPath('/')).toMatch(/index\.html$/);
  });
});

describe('private Monitored boundary', () => {
  it('fails closed when local private identity is not configured', async () => {
    delete process.env.NALAR_PRIVATE_OWNER_EMAIL;
    delete process.env.NALAR_PROXY_SECRET;
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/monitored`);
      expect(response.status).toBe(404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
