// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveStaticPath } from './server.js';

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
    expect(resolveStaticPath('/')).toMatch(/index\.html$/);
  });
});
