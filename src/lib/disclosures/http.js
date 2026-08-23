import { DISCLOSURE_PATHS, resolvePublicApiRequest } from '../public-api-allowlist.js';
import { stripLeaks } from './serialize.js';
import { validateDisclosureQuery } from './validate.js';
import { runLocalNewsDetectorScan } from './local-store.js';

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

export function handleNewsDetectorScanHttp(method, rawUrl, options = {}) {
  const decision = resolvePublicApiRequest(method, rawUrl);
  if (!decision.ok) {
    return { status: decision.status, body: { success: false, error: decision.error } };
  }
  const url = new URL(decision.path, 'http://internal');
  if (url.pathname !== '/api/news-detector/scan') {
    return { status: 404, body: { success: false, error: 'Not found.' } };
  }
  const result = runLocalNewsDetectorScan(url.searchParams.get('date'), options);
  if (result.error) {
    return { status: result.status || 400, body: { success: false, error: result.error } };
  }
  return { status: result.status || 200, body: stripLeaks(result.body) };
}
