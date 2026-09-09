import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FreshnessBar from './FreshnessBar.jsx';

vi.mock('../lib/api/client.js', () => ({ getDataHealth: vi.fn() }));

import { getDataHealth } from '../lib/api/client.js';

/**
 * Payload shaped exactly like /api/data-health so the bar is tested against the
 * real contract, including lastCompletedSession living under tradingCalendar
 * rather than at the top level.
 */
function health({ priceBehind, brokerBehind, priceDate = '2026-08-14', brokerDate = '2026-08-12' }) {
  return {
    success: true,
    data: {
      overall: 'stale',
      tradingCalendar: { lastCompletedSession: '2026-08-25', observedThrough: '2026-08-25', degraded: false },
      priceCache: { freshness: 'stale', ageDays: 11.9, sessionsBehind: priceBehind, lastDate: priceDate, tickers: 957 },
      brokerCache: { freshness: 'stale', ageDays: 13.9, sessionsBehind: brokerBehind, lastDate: brokerDate, tickers: 228 },
    },
  };
}

describe('FreshnessBar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports the worst cache, not the average, and names the oldest input', async () => {
    getDataHealth.mockResolvedValue(health({ priceBehind: 2, brokerBehind: 9 }));
    render(<FreshnessBar />);

    const bar = await screen.findByRole('status');
    // 9 and 2 must surface as 9. Averaging to 5 would let the fresh price cache
    // disguise a broker cache nine sessions behind, which is the whole point.
    expect(bar).toHaveTextContent('9 sessions behind');
    expect(bar).toHaveTextContent('August 12, 2026');
    expect(bar).toHaveTextContent('last IDX session August 25, 2026');
    expect(bar.className).toContain('is-critical');
  });

  it('warns rather than alarms when the lag is small', async () => {
    getDataHealth.mockResolvedValue(health({ priceBehind: 2, brokerBehind: 3 }));
    render(<FreshnessBar />);

    const bar = await screen.findByRole('status');
    expect(bar).toHaveTextContent('3 sessions behind');
    expect(bar.className).toContain('is-warning');
  });

  it('stays silent on current data so the bar keeps meaning something', async () => {
    getDataHealth.mockResolvedValue(health({ priceBehind: 1, brokerBehind: 1 }));
    const { container } = render(<FreshnessBar />);
    await waitFor(() => expect(getDataHealth).toHaveBeenCalled());
    expect(container.querySelector('.freshness-bar')).toBeNull();
  });

  it('stays silent when sessionsBehind is unavailable', async () => {
    getDataHealth.mockResolvedValue(health({ priceBehind: null, brokerBehind: null }));
    const { container } = render(<FreshnessBar />);
    await waitFor(() => expect(getDataHealth).toHaveBeenCalled());
    expect(container.querySelector('.freshness-bar')).toBeNull();
  });

  it('does not take the surfaces down when data-health fails', async () => {
    getDataHealth.mockRejectedValue(new Error('proxy unreachable'));
    const { container } = render(<FreshnessBar />);
    await waitFor(() => expect(getDataHealth).toHaveBeenCalled());
    expect(container.querySelector('.freshness-bar')).toBeNull();
  });
});
