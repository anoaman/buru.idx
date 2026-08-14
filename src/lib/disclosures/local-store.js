import { spawnSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const TRADING_DB_ROOT = fileURLToPath(new URL('../../../../../trading-db/', import.meta.url));
export const DISCLOSURE_API = `${TRADING_DB_ROOT}disclosure_api.py`;
export const SEED_SCRIPT = `${TRADING_DB_ROOT}seed_keterbukaan_fixture.py`;
export const FIXTURE_DB = `${TRADING_DB_ROOT}fixtures/keterbukaan-demo.sqlite`;

export function resolveDisclosureDb() {
  return process.env.TRADING_DB_PATH || FIXTURE_DB;
}

export function ensureDisclosureDb(dbPath = resolveDisclosureDb()) {
  if (existsSync(dbPath)) return dbPath;
  if (dbPath !== FIXTURE_DB) {
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

export function pythonDisclosureStore(path, filters) {
  let dbPath;
  try {
    dbPath = ensureDisclosureDb();
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
  if (result.status !== 0) {
    return { status: 503, error: 'Disclosure data is temporarily unavailable.' };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      status: parsed.status,
      body: parsed.body,
      error: parsed.body?.success === false ? parsed.body.error : undefined,
    };
  } catch {
    return { status: 503, error: 'Disclosure data is temporarily unavailable.' };
  }
}
