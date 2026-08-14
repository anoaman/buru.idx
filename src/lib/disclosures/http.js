import { DISCLOSURE_PATHS, resolvePublicApiRequest } from '../public-api-allowlist.js';
import { stripLeaks } from './serialize.js';
import { validateDisclosureQuery } from './validate.js';

export function handleDisclosureHttp(method, rawUrl, store) {
  const decision = resolvePublicApiRequest(method, rawUrl);
  if (!decision.ok) {
    return { status: decision.status, body: { success: false, error: decision.error } };
  }
  const url = new URL(decision.path, 'http://internal');
  if (!DISCLOSURE_PATHS.has(url.pathname)) {
    return { status: 404, body: { success: false, error: 'Not found.' } };
  }
  const parsed = validateDisclosureQuery(url.pathname, url.searchParams);
  if (!parsed.ok) {
    return { status: parsed.status, body: { success: false, error: parsed.error } };
  }
  const result = store(url.pathname, parsed.filters);
  if (!result) {
    return { status: 404, body: { success: false, error: 'Not found.' } };
  }
  if (result.error) {
    const status = result.status || 400;
    return { status, body: { success: false, error: result.error } };
  }
  return { status: result.status || 200, body: stripLeaks(result.body || { success: true, data: result.data }) };
}
