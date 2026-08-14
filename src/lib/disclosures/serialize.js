const LEAK_KEYS = new Set([
  'relative_path',
  'relativePath',
  'path',
  'filepath',
  'file_path',
  'local_path',
  'document_root',
  'pdf_blob',
  'bytes',
]);

const IDX_SOURCE = /^https:\/\/([^/]+\.)?idx\.co\.id\//i;

export function officialSourceUrl(url) {
  const text = String(url || '').trim();
  return IDX_SOURCE.test(text) ? text : null;
}

export function stripLeaks(value) {
  if (typeof value === 'string') {
    if (value.includes('/home/') || value.includes('idx.db') || value.includes('relative_path')) {
      return '[redacted]';
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(stripLeaks);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !LEAK_KEYS.has(key))
      .map(([key, item]) => [key, key === 'sourceUrl' ? officialSourceUrl(item) : stripLeaks(item)]),
  );
}
