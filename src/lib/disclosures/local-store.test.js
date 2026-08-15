// @vitest-environment node
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DISCLOSURE_FIXTURE_FLAG,
  pythonDisclosureStore,
  resolveDisclosureDb,
  runLocalNewsDetectorScan,
  SEED_SCRIPT,
} from './local-store.js';

describe('local disclosure store', () => {
  const previousDb = process.env.TRADING_DB_PATH;
  const previousFlag = process.env[DISCLOSURE_FIXTURE_FLAG];

  afterEach(() => {
    if (previousDb == null) delete process.env.TRADING_DB_PATH;
    else process.env.TRADING_DB_PATH = previousDb;
    if (previousFlag == null) delete process.env[DISCLOSURE_FIXTURE_FLAG];
    else process.env[DISCLOSURE_FIXTURE_FLAG] = previousFlag;
  });

  it('serves fixture disclosures without the analysis API or production idx.db', () => {
    const db = join(mkdtempSync(join(tmpdir(), 'ki-')), 'demo.sqlite');
    const seeded = spawnSync('python3', [SEED_SCRIPT, '--db', db], {
      encoding: 'utf8',
      cwd: dirname(SEED_SCRIPT),
      timeout: 30_000,
    });
    expect(seeded.status, seeded.stderr || seeded.stdout).toBe(0);
    process.env.TRADING_DB_PATH = db;

    const feed = pythonDisclosureStore('/api/disclosures', { limit: 25 });
    expect(feed.status).toBe(200);
    expect(feed.body.data.items.length).toBeGreaterThan(0);
    expect(feed.body.data.items.every((item) => item.eventId !== 'bbca-lk-fy2025')).toBe(true);
    expect(JSON.stringify(feed)).not.toContain('/secret/');
    expect(JSON.stringify(feed)).not.toContain('idx.db');

    const detail = pythonDisclosureStore('/api/disclosures/detail', { eventId: 'bbca-div-1-corr' });
    expect(detail.status).toBe(200);
    expect(detail.body.data.sourceUrl).toMatch(/^https:\/\/([^/]+\.)?idx\.co\.id\//i);

    const statements = pythonDisclosureStore('/api/fundamentals/statements', { ticker: 'BBCA' });
    expect(statements.status).toBe(200);
    const labels = statements.body.data.items.map((item) => item.periodLabel);
    expect(labels).toEqual(expect.arrayContaining(['FY2025', 'FY2024']));

    const snapshot = pythonDisclosureStore('/api/fundamentals/snapshot', { ticker: 'BBCA' });
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.data.companyType).toBe('bank');
    expect(snapshot.body.data.filingCount).toBeGreaterThanOrEqual(2);

    const unread = pythonDisclosureStore('/api/news-detector', { date: '2026-08-04' });
    expect(unread.status).toBe(200);
    expect(unread.body.data.run).toBeNull();

    const scan = runLocalNewsDetectorScan('2026-08-04');
    expect(scan.status, scan.error).toBe(200);
    expect(scan.body.data.run.materialCount).toBeGreaterThan(0);
    expect(scan.body.data.items.some((item) => item.disposition === 'suppressed')).toBe(true);
    expect(JSON.stringify(scan)).not.toContain('/secret/');
  });

  it('fails closed in production when TRADING_DB_PATH is missing', () => {
    delete process.env.TRADING_DB_PATH;
    delete process.env[DISCLOSURE_FIXTURE_FLAG];
    expect(resolveDisclosureDb({ allowFixture: false })).toBeNull();
    const result = pythonDisclosureStore('/api/disclosures', { limit: 25 }, { allowFixture: false });
    expect(result.status).toBe(503);
    expect(result.error).toBe('Disclosure data is temporarily unavailable.');
    expect(result.body).toBeUndefined();
  });

  it('does not fall back to the demo fixture without an explicit flag', () => {
    delete process.env.TRADING_DB_PATH;
    delete process.env[DISCLOSURE_FIXTURE_FLAG];
    expect(resolveDisclosureDb({ allowFixture: true })).toBeNull();
    const result = pythonDisclosureStore('/api/disclosures', { limit: 25 }, { allowFixture: true });
    expect(result.status).toBe(503);
  });
});
