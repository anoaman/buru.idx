import { spawnSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const TRADING_DB_ROOT = fileURLToPath(new URL('../../../../../trading-db/', import.meta.url));
export const DISCLOSURE_API = `${TRADING_DB_ROOT}disclosure_api.py`;
export const SEED_SCRIPT = `${TRADING_DB_ROOT}seed_keterbukaan_fixture.py`;
export const FIXTURE_DB = `${TRADING_DB_ROOT}fixtures/keterbukaan-demo.sqlite`;
export const DISCLOSURE_FIXTURE_FLAG = 'STOCK_ANALYSIS_DISCLOSURE_FIXTURE';
const PROJECTS_ROOT = fileURLToPath(new URL('../../../../../projects/', import.meta.url));

export function resolveNewsDetectorModule(env = process.env) {
  const candidates = [
    env.STOCKBIT_SCRAPER_ROOT && join(env.STOCKBIT_SCRAPER_ROOT, 'src/news-detector.js'),
    join(PROJECTS_ROOT, 'stockbit-scraper-fundamentals-news/src/news-detector.js'),
    join(PROJECTS_ROOT, 'stockbit-scraper/src/news-detector.js'),
  ].filter(Boolean);
  return candidates.find((path) => existsSync(path)) || null;
}

export function disclosureFixtureEnabled(env = process.env) {
  const value = String(env[DISCLOSURE_FIXTURE_FLAG] || '').toLowerCase();
  return value === '1' || value === 'true';
}

export function resolveDisclosureDb({ allowFixture = false, env = process.env } = {}) {
  if (env.TRADING_DB_PATH) return env.TRADING_DB_PATH;
  if (allowFixture && disclosureFixtureEnabled(env)) return FIXTURE_DB;
  return null;
}

function parseJsonStdout(stdout) {
  const line = String(stdout || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .at(-1);
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function ensureDisclosureDb({ allowFixture = false, env = process.env } = {}) {
  const dbPath = resolveDisclosureDb({ allowFixture, env });
  if (!dbPath) {
    throw new Error('Disclosure database is not available.');
  }
  if (existsSync(dbPath)) return dbPath;
  if (!allowFixture || !disclosureFixtureEnabled(env) || dbPath !== FIXTURE_DB) {
    throw new Error('Disclosure database is not available.');
  }
  mkdirSync(dirname(FIXTURE_DB), { recursive: true });
  const result = spawnSync('python3', [SEED_SCRIPT, '--db', FIXTURE_DB], {
    encoding: 'utf8',
    cwd: TRADING_DB_ROOT,
    timeout: 30_000,
  });
  if (result.status !== 0 || !existsSync(FIXTURE_DB)) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || 'Failed to seed disclosure fixture.');
  }
  return FIXTURE_DB;
}

export function pythonDisclosureStore(path, filters, options = {}) {
  let dbPath;
  try {
    dbPath = ensureDisclosureDb(options);
  } catch {
    return { status: 503, error: 'Disclosure data is temporarily unavailable.' };
  }
  const result = spawnSync('python3', [
    DISCLOSURE_API,
    '--db', dbPath,
    '--path', path,
    '--query', JSON.stringify(filters || {}),
  ], {
    encoding: 'utf8',
    cwd: TRADING_DB_ROOT,
    timeout: 15_000,
  });
  const parsed = parseJsonStdout(result.stdout);
  if (result.status !== 0 || !parsed) {
    return { status: 503, error: 'Disclosure data is temporarily unavailable.' };
  }
  return {
    status: parsed.status,
    body: parsed.body,
    error: parsed.body?.success === false ? parsed.body.error : undefined,
  };
}

export function createPythonDisclosureStore({ allowFixture = false } = {}) {
  return (path, filters) => pythonDisclosureStore(path, filters, { allowFixture });
}

export function runLocalNewsDetectorScan(date, options = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return { status: 400, error: 'Date must be YYYY-MM-DD.' };
  }
  let dbPath;
  try {
    dbPath = ensureDisclosureDb(options);
  } catch {
    return { status: 503, error: 'Disclosure data is temporarily unavailable.' };
  }
  const modulePath = resolveNewsDetectorModule(options.env || process.env);
  if (!modulePath) {
    return { status: 503, error: 'News Detector engine is unavailable.' };
  }
  const result = spawnSync('node', [modulePath, '--db', dbPath, '--date', date], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  const parsed = parseJsonStdout(result.stdout);
  if (!parsed) {
    return { status: 503, error: 'News Detector scan failed.' };
  }
  if (parsed.success === false) {
    return {
      status: parsed.status || 400,
      error: parsed.error || 'News Detector scan failed.',
    };
  }
  return { status: 200, body: parsed };
}
