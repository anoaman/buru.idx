const TICKER = /^[A-Z]{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_ID = /^[A-Za-z0-9:_-]{1,80}$/;
const PERIOD = /^[A-Za-z0-9_-]{1,32}$/;
const FILING_ID = /^[A-Za-z0-9:_\-]{1,120}$/;
const PERIOD_LABEL = /^[A-Za-z0-9_\-\.]{1,40}$/;
const CATEGORIES = new Set([
  'rights_issue', 'private_placement', 'dividend', 'stock_split', 'reverse_split',
  'warrant', 'acquisition', 'divestment', 'debt_funding', 'management_change',
  'control_change', 'suspension', 'uma', 'notation', 'operational_update',
  'other_material',
]);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const SIGNALS = new Set([
  'correction', 'repeat_filing', 'contradictory_state', 'unusual_frequency',
  'rights_issue', 'private_placement', 'dividend', 'suspension', 'uma',
]);
const STATEMENT_TYPES = new Set([
  'income_statement', 'balance_sheet', 'cash_flow', 'equity_changes', 'notes',
]);
const V18_STATEMENT_TYPES = new Set([
  'income_statement', 'balance_sheet', 'cash_flow', 'changes_in_equity', 'notes',
]);

export const DISCLOSURE_PARAMS = {
  '/api/disclosures': ['ticker', 'from', 'to', 'category', 'severity', 'signal', 'cursor', 'limit'],
  '/api/disclosures/detail': ['eventId'],
  '/api/disclosures/timeline': ['ticker', 'from', 'to', 'limit'],
  '/api/disclosures/anomalies': ['ticker', 'severity', 'signal', 'from', 'to', 'cursor', 'limit'],
  '/api/disclosures/documents': ['documentId', 'eventId'],
  '/api/fundamentals/statements': ['ticker', 'period', 'statementType', 'cursor', 'limit'],
  '/api/fundamentals/snapshot': ['ticker'],
  '/api/fundamentals/periods': ['ticker'],
  '/api/fundamentals/facts': ['ticker', 'filingId', 'statementType', 'periodLabel', 'cursor', 'limit'],
  '/api/fundamentals/filing': ['ticker', 'filingId'],
  '/api/fundamentals/derived': ['ticker', 'filingId', 'periodLabel'],
  '/api/fundamentals/sources': ['ticker', 'filingId'],
  '/api/news-detector': ['date'],
  '/api/collector/health': [],
};

export function validateDisclosureQuery(path, searchParams) {
  const allowed = DISCLOSURE_PARAMS[path];
  if (!allowed) return { ok: false, status: 404, error: 'Not found.' };
  const filters = {};
  for (const name of allowed) {
    const value = searchParams.get(name);
    if (value == null || value === '') continue;
    filters[name] = value;
  }
  if (filters.ticker) {
    filters.ticker = String(filters.ticker).toUpperCase();
    if (!TICKER.test(filters.ticker)) return { ok: false, status: 400, error: 'Invalid ticker.' };
  }
  for (const key of ['from', 'to', 'date']) {
    if (filters[key] && !DATE.test(filters[key])) {
      return { ok: false, status: 400, error: 'Invalid date.' };
    }
  }
  if (path === '/api/news-detector' && !filters.date) {
    return { ok: false, status: 400, error: 'Invalid date.' };
  }
  if (filters.category && !CATEGORIES.has(filters.category)) {
    return { ok: false, status: 400, error: 'Invalid category.' };
  }
  if (filters.severity && !SEVERITIES.has(filters.severity)) {
    return { ok: false, status: 400, error: 'Invalid severity.' };
  }
  if (filters.signal && !SIGNALS.has(filters.signal)) {
    return { ok: false, status: 400, error: 'Invalid signal.' };
  }
  if (filters.eventId && !EVENT_ID.test(filters.eventId)) {
    return { ok: false, status: 400, error: 'Invalid event id.' };
  }
  if (filters.documentId && !/^\d+$/.test(filters.documentId)) {
    return { ok: false, status: 400, error: 'Invalid document id.' };
  }
  if (filters.period && !PERIOD.test(filters.period)) {
    return { ok: false, status: 400, error: 'Invalid period.' };
  }
  if (filters.filingId && !FILING_ID.test(filters.filingId)) {
    return { ok: false, status: 400, error: 'Invalid filing id.' };
  }
  if (filters.periodLabel && !PERIOD_LABEL.test(filters.periodLabel)) {
    return { ok: false, status: 400, error: 'Invalid period label.' };
  }
  const stmtTypes = path === '/api/fundamentals/facts' ? V18_STATEMENT_TYPES : STATEMENT_TYPES;
  if (filters.statementType && !stmtTypes.has(filters.statementType)) {
    return { ok: false, status: 400, error: 'Invalid statement type.' };
  }
  if (filters.limit) {
    const limit = Number(filters.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return { ok: false, status: 400, error: 'Invalid limit.' };
    }
  }
  if (filters.cursor) {
    const cursor = Number(filters.cursor);
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > 10_000) {
      return { ok: false, status: 400, error: 'Invalid cursor.' };
    }
  }
  return { ok: true, filters };
}
