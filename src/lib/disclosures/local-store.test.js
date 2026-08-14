// @vitest-environment node
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pythonDisclosureStore, SEED_SCRIPT } from './local-store.js';

describe('local disclosure store', () => {
  const previous = process.env.TRADING_DB_PATH;

  afterEach(() => {
    if (previous == null) delete process.env.TRADING_DB_PATH;
    else process.env.TRADING_DB_PATH = previous;
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
  });
});
