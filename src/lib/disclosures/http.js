import { stripLeaks } from './serialize.js';
import { validateDisclosureQuery } from './validate.js';
import { runLocalNewsDetectorScan } from './local-store.js';

export const DISCLOSURE_PATHS = new Set([
  '/api/disclosures',
  '/api/disclosures/detail',
  '/api/disclosures/timeline',
  '/api/disclosures/anomalies',
  '/api/disclosures/documents',
  '/api/fundamentals/statements',
  '/api/fundamentals/snapshot',
  '/api/fundamentals/periods',
  '/api/fundamentals/facts',
  '/api/fundamentals/filing',
  '/api/fundamentals/derived',
  '/api/fundamentals/sources',
  '/api/news-detector',
  '/api/collector/health',
]);

export function handleDisclosureHttp(method, rawUrl, store) {
  if (!['GET', 'HEAD'].includes(method)) {
    return { status: 405, body: { success: false, error: 'This method is not allowed.' } };
  }
  const rawPath = String(rawUrl || '').split('?')[0];
  if (/(^|\/)\.\.?($|\/)/.test(rawPath)) {
    return { status: 400, body: { success: false, error: 'Malformed request.' } };
  }
  const url = new URL(rawUrl, 'http://internal');
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
  if (method !== 'POST') {
    return { status: 405, body: { success: false, error: 'This method is not allowed.' } };
  }
  const url = new URL(rawUrl, 'http://internal');
  if (url.pathname !== '/api/news-detector/scan') {
    return { status: 404, body: { success: false, error: 'Not found.' } };
  }
  const result = runLocalNewsDetectorScan(url.searchParams.get('date'), options);
  if (result.error) {
    return { status: result.status || 400, body: { success: false, error: result.error } };
  }
  return { status: result.status || 200, body: stripLeaks(result.body) };
}
