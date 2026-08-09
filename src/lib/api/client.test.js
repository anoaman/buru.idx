import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeTicker,
  getStockBrokerIntelligence,
  invalidateBrokerCache,
} from './client.js';

function response(body, { ok = true, status = 200, statusText = 'OK' } = {}) {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('Stock Analysis API client', () => {
  beforeEach(() => {
    invalidateBrokerCache();
    vi.restoreAllMocks();
  });

  it('encodes ticker analysis requests', async () => {
    global.fetch = vi.fn().mockResolvedValue(response({ success: true, data: {} }));
    await analyzeTicker('BB RI');
    expect(global.fetch.mock.calls[0][0]).toContain('/api/analyze?ticker=BB+RI');
    expect(global.fetch.mock.calls[0][0]).toContain('mode=delayed');
  });

  it('deduplicates concurrent broker reads and caches successful responses', async () => {
    let resolveFetch;
    global.fetch = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const first = getStockBrokerIntelligence({ ticker: 'BBCA', days: 30 });
    const second = getStockBrokerIntelligence({ ticker: 'BBCA', days: 30 });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch(response({ success: true, data: { ticker: 'BBCA' } }));
    await expect(first).resolves.toMatchObject({ success: true });
    await expect(second).resolves.toMatchObject({ success: true });
    await getStockBrokerIntelligence({ ticker: 'BBCA', days: 30 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache failed broker responses', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(response({ error: 'offline' }, {
        ok: false,
        status: 503,
        statusText: 'Unavailable',
      }))
      .mockResolvedValueOnce(response({ success: true, data: { ticker: 'BBCA' } }));

    await expect(
      getStockBrokerIntelligence({ ticker: 'BBCA', days: 7 }),
    ).resolves.toMatchObject({ success: false });
    await expect(
      getStockBrokerIntelligence({ ticker: 'BBCA', days: 7 }),
    ).resolves.toMatchObject({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('sanitizes private Stockbit auth errors for the public surface', async () => {
    global.fetch = vi.fn().mockResolvedValue(response({
      error: '401 Unauthorized — token likely expired. Run: npm run grab-token',
    }, {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    await expect(analyzeTicker('BBCA')).resolves.toMatchObject({
      success: false,
      error: 'Delayed analysis is temporarily unavailable while the data cache refreshes.',
    });
  });
});
