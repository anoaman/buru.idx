import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import BrokerIntelligence from './BrokerIntelligence.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getBrokerArchiveHealth: vi.fn(),
  getStockBrokerIntelligence: vi.fn(),
  getBrokerStockIntelligence: vi.fn(),
  invalidateBrokerCache: vi.fn(),
  prefetchStockBrokerIntelligence: vi.fn(),
  prefetchBrokerStockIntelligence: vi.fn(),
}));

import {
  getBrokerArchiveHealth,
  getStockBrokerIntelligence,
  getBrokerStockIntelligence,
  invalidateBrokerCache,
} from '../../lib/api/client.js';

const DISCLOSURES = [
  { code: 'top25_observed', label: 'Observed broker flow from up to the top 25 buyers and sellers per stock-day.' },
  { code: 'absence_not_proof', label: 'Absence from the archive does not prove no trading activity.' },
  { code: 'estimated_inventory_window_zero', label: 'Estimated inventory starts from zero at the beginning of the selected window.' },
  { code: 'estimates_not_holdings', label: 'Estimated inventory and average cost are not actual holdings or confirmed cost basis.' },
  { code: 'regular_market_combined', label: 'Regular-market broker-summary data; all investor types combined.' },
];

const CURVE = [
  {
    date: '2026-07-15',
    netLots: 1000,
    cumulativeNetLots: 1000,
    netValue: 9_000_000_000,
    cumulativeNetValue: 9_000_000_000,
    estimatedInventoryLots: 1000,
    estimatedAverageCost: 9000,
  },
  {
    date: '2026-07-16',
    netLots: 500,
    cumulativeNetLots: 1500,
    netValue: 4_500_000_000,
    cumulativeNetValue: 13_500_000_000,
    estimatedInventoryLots: 1500,
    estimatedAverageCost: 9000,
  },
  {
    date: '2026-07-17',
    netLots: 200,
    cumulativeNetLots: 1700,
    netValue: 1_800_000_000,
    cumulativeNetValue: 15_300_000_000,
    estimatedInventoryLots: 1700,
    estimatedAverageCost: 9000,
  },
];

const HEALTH_OK = {
  success: true,
  data: {
    available: true,
    canonicalTickers: 900,
    earliestAvailableDate: '2026-01-02',
    latestAvailableDate: '2026-07-22',
    latestCompletedDate: '2026-07-21',
    verifiedTradingDates: 120,
    populatedStockDays: 100000,
    gapStockDays: 50,
    accountedStockDays: 100050,
    expectedStockDays: 108000,
    coverage: 0.926,
    latestDate: { date: '2026-07-22', accounted: 820, expected: 900, complete: true },
    serving: {
      servingAvailable: true,
      servingStatus: 'ready',
      servingReason: null,
      servingRows: 8800,
      servingEarliest: '2026-05-23',
      servingLatest: '2026-07-21',
      materializedAt: '2026-07-21T09:15:00Z',
      sourceThroughDate: '2026-07-21',
      lastFailure: null,
    },
  },
  meta: {
    calendarCoverage: { status: 'ok', reason: null, uncoveredWeekdays: [] },
    disclosures: DISCLOSURES,
  },
};

const STOCK_OK = {
  success: true,
  data: {
    ticker: 'BBCA',
    name: 'Bank Central Asia',
    window: {
      days: 30,
      from: '2026-06-22',
      to: '2026-07-21',
      asOf: '2026-07-21',
      tradingSessions: 20,
      populatedSessions: 18,
      gapSessions: 1,
      missingSessions: 1,
      complete: false,
    },
    observedFlow: {
      netValue: 50_000_000_000,
      netLots: 12000,
      buyValue: 120_000_000_000,
      sellValue: 70_000_000_000,
      daily: [],
    },
    accumulation: [{
      code: 'YP',
      sourceType: 'Foreign',
      buyValue: 10_000_000_000,
      sellValue: 1_000_000_000,
      netValue: 9_000_000_000,
      buyLots: 5000,
      sellLots: 500,
      netLots: 4500,
      frequency: 12,
      consistency: {
        observedSessions: 10,
        buySessions: 8,
        sellSessions: 2,
        neutralSessions: 0,
        dominantSide: 'accumulation',
        consistencyRatio: 0.8,
        multiDayMeaningful: true,
      },
      estimatedInventoryLots: 4500,
      estimatedAverageCost: 9000,
      curve: CURVE,
    }],
    distribution: [{
      code: 'AK',
      sourceType: 'Local',
      buyValue: 500_000_000,
      sellValue: 4_000_000_000,
      netValue: -3_500_000_000,
      buyLots: 200,
      sellLots: 1800,
      netLots: -1600,
      frequency: 8,
      consistency: {
        observedSessions: 8,
        buySessions: 1,
        sellSessions: 7,
        neutralSessions: 0,
        dominantSide: 'distribution',
        consistencyRatio: 0.875,
        multiDayMeaningful: true,
      },
      estimatedInventoryLots: -1600,
      estimatedAverageCost: null,
      curve: [],
    }],
    brokers: [],
  },
  meta: {
    archive: {
      earliestAvailableDate: '2026-01-02',
      latestAvailableDate: '2026-07-22',
      latestCompletedDate: '2026-07-21',
      topN: 25,
      calendarCoverage: { status: 'ok', reason: null, uncoveredWeekdays: [] },
    },
    disclosures: DISCLOSURES,
  },
};

const BROKER_OK = {
  success: true,
  data: {
    broker: { code: 'YP', sourceTypes: ['Foreign'] },
    window: {
      days: 30,
      from: '2026-06-22',
      to: '2026-07-21',
      asOf: '2026-07-21',
      tradingSessions: 20,
    },
    summary: {
      observedStocks: 12,
      accumulationStocks: 7,
      distributionStocks: 5,
      netValue: 15_000_000_000,
      netLots: 3200,
    },
    accumulation: [{
      ticker: 'BBCA',
      name: 'Bank Central Asia',
      observedSessions: 10,
      buyValue: 8_000_000_000,
      sellValue: 1_000_000_000,
      netValue: 7_000_000_000,
      buyLots: 4000,
      sellLots: 400,
      netLots: 3600,
      sourceType: 'Foreign',
      consistency: {
        observedSessions: 10,
        buySessions: 9,
        sellSessions: 1,
        neutralSessions: 0,
        dominantSide: 'accumulation',
        consistencyRatio: 0.9,
        multiDayMeaningful: true,
      },
      estimatedInventoryLots: 3600,
      estimatedAverageCost: 9100,
      curve: CURVE,
    }],
    distribution: [{
      ticker: 'BMRI',
      name: 'Bank Mandiri',
      observedSessions: 6,
      buyValue: 100_000_000,
      sellValue: 2_000_000_000,
      netValue: -1_900_000_000,
      buyLots: 50,
      sellLots: 900,
      netLots: -850,
      sourceType: 'Foreign',
      consistency: {
        observedSessions: 6,
        buySessions: 1,
        sellSessions: 5,
        neutralSessions: 0,
        dominantSide: 'distribution',
        consistencyRatio: 0.833,
        multiDayMeaningful: true,
      },
      estimatedInventoryLots: -850,
      estimatedAverageCost: null,
      curve: CURVE,
    }],
  },
  meta: {
    archive: {
      earliestAvailableDate: '2026-01-02',
      latestAvailableDate: '2026-07-22',
      latestCompletedDate: '2026-07-21',
      topN: 25,
      calendarCoverage: { status: 'ok', reason: null, uncoveredWeekdays: [] },
    },
    disclosures: DISCLOSURES,
  },
};

function renderAt(path = '/broker-intelligence') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BrokerIntelligence />
    </MemoryRouter>,
  );
}

describe('BrokerIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBrokerArchiveHealth.mockResolvedValue(HEALTH_OK);
    getStockBrokerIntelligence.mockResolvedValue(STOCK_OK);
    getBrokerStockIntelligence.mockResolvedValue(BROKER_OK);
  });

  it('defaults to stock lens BBCA at 30 days', async () => {
    renderAt('/broker-intelligence');
    await screen.findByText('Bank Central Asia');
    expect(getStockBrokerIntelligence).toHaveBeenCalledWith({ ticker: 'BBCA', days: 30 });
    expect(screen.getByRole('button', { name: /Stock Lens/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^30D$/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('loads health and lens independently', async () => {
    let resolveHealth;
    getBrokerArchiveHealth.mockReturnValue(new Promise((resolve) => { resolveHealth = resolve; }));
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    expect(await screen.findByText('Bank Central Asia')).toBeInTheDocument();
    expect(screen.getByText(/Loading archive health/i)).toBeInTheDocument();
    await act(async () => { resolveHealth(HEALTH_OK); });
    await waitFor(() => {
      expect(screen.getByText(/Latest completed/i)).toBeInTheDocument();
    });
  });

  it('switches between stock and broker lenses', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    fireEvent.click(screen.getByRole('button', { name: /Broker Lens/i }));
    await waitFor(() => {
      expect(getBrokerStockIntelligence).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Observed stocks/i)).toBeInTheDocument();
  });

  it('restores ticker, code, and days from URL', async () => {
    renderAt('/broker-intelligence?lens=broker&code=yp&days=14');
    await waitFor(() => {
      expect(getBrokerStockIntelligence).toHaveBeenCalledWith({ code: 'YP', days: 14, limit: 25 });
    });
    expect(screen.getByRole('button', { name: /^14D$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByDisplayValue('YP')).toBeInTheDocument();
  });

  it('validates and normalizes search input', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    const input = screen.getByLabelText(/IDX ticker/i);
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByRole('button', { name: /Analyze/i })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'tlkm' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyze/i }));
    await waitFor(() => {
      expect(getStockBrokerIntelligence).toHaveBeenCalledWith({ ticker: 'TLKM', days: 30 });
    });
  });

  it('supports 1/7/14/30/60 day controls', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    for (const d of [1, 7, 14, 60]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${d}D$`) }));
      await waitFor(() => {
        expect(getStockBrokerIntelligence).toHaveBeenCalledWith({ ticker: 'BBCA', days: d });
      });
    }
  });

  it('shows stock summary with exact coverage counts', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    expect(screen.getByText(/Populated 18/i)).toBeInTheDocument();
    expect(screen.getByText(/Gap 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Degraded/i)).toBeInTheDocument();
  });

  it('shows broker summary and observed stock counts', async () => {
    renderAt('/broker-intelligence?lens=broker&code=YP&days=30');
    expect(await screen.findByText(/Observed stocks 12/i)).toBeInTheDocument();
    expect(screen.getByText(/Acc 7/i)).toBeInTheDocument();
    expect(screen.getByText(/Dist 5/i)).toBeInTheDocument();
  });

  it('renders both accumulation and distribution rankings', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    expect(screen.getByText('Accumulation ranking')).toBeInTheDocument();
    expect(screen.getByText('Distribution ranking')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /YP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AK/i })).toBeInTheDocument();
  });

  it('changes curve/detail when ranking selection changes', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    expect(screen.getByText(/Estimated inventory changed from/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /AK/i }));
    expect(await screen.findByText(/No estimated inventory curve/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThan(0);
  });

  it('deep-links selected broker into broker lens', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    const link = screen.getByRole('link', { name: /Open Broker Lens/i });
    expect(link).toHaveAttribute('href', '/broker-intelligence?lens=broker&code=YP&days=30');
  });

  it('deep-links selected stock into Workbench', async () => {
    renderAt('/broker-intelligence?lens=broker&code=YP&days=30');
    await screen.findByText(/Observed stocks 12/i);
    const link = screen.getByRole('link', { name: /Open in Workbench/i });
    expect(link).toHaveAttribute('href', '/workbench?ticker=BBCA');
  });

  it('displays Unavailable for null estimated average cost', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    fireEvent.click(screen.getByRole('button', { name: /AK/i }));
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThan(0);
  });

  it('keeps disclosures visible', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    expect(screen.getByText(/Methodology & limitations/i)).toBeInTheDocument();
    expect(screen.getByText(/top 25 buyers and sellers/i)).toBeInTheDocument();
    expect(screen.getByText(/not actual holdings/i)).toBeInTheDocument();
  });

  it('shows degraded calendar state', async () => {
    getStockBrokerIntelligence.mockResolvedValue({
      ...STOCK_OK,
      meta: {
        ...STOCK_OK.meta,
        archive: {
          ...STOCK_OK.meta.archive,
          calendarCoverage: {
            status: 'degraded',
            reason: 'calendar_incomplete',
            uncoveredWeekdays: ['2026-07-16'],
          },
        },
      },
    });
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    expect(await screen.findByText(/Calendar degraded/i)).toBeInTheDocument();
  });

  it('shows partial latest archive state', async () => {
    getBrokerArchiveHealth.mockResolvedValue({
      ...HEALTH_OK,
      data: {
        ...HEALTH_OK.data,
        latestDate: { date: '2026-07-22', accounted: 820, expected: 900, complete: false },
      },
    });
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    expect(await screen.findByText(/Partial/i)).toBeInTheDocument();
    expect(screen.getByText(/820\/900/)).toBeInTheDocument();
  });

  it('shows empty rankings state', async () => {
    getStockBrokerIntelligence.mockResolvedValue({
      ...STOCK_OK,
      data: {
        ...STOCK_OK.data,
        accumulation: [],
        distribution: [],
        brokers: [],
      },
    });
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    expect(await screen.findByText(/No observed rankings/i)).toBeInTheDocument();
  });

  it('shows lens error with retry', async () => {
    getStockBrokerIntelligence.mockResolvedValue({ success: false, error: 'upstream down' });
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    expect(await screen.findByText(/Broker intelligence unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/upstream down/i)).toBeInTheDocument();
    getStockBrokerIntelligence.mockResolvedValue(STOCK_OK);
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText('Bank Central Asia')).toBeInTheDocument();
  });

  it('keeps lens data when health fails', async () => {
    getBrokerArchiveHealth.mockResolvedValue({ success: false, error: 'health offline' });
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    expect(await screen.findByText('Bank Central Asia')).toBeInTheDocument();
    expect(screen.getByText(/Archive health unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/health offline/i)).toBeInTheDocument();
    expect(screen.getAllByText('YP').length).toBeGreaterThan(0);
  });

  it('invalidates the client cache before retrying archive health', async () => {
    getBrokerArchiveHealth
      .mockResolvedValueOnce({ success: false, error: 'health offline' })
      .mockResolvedValueOnce(HEALTH_OK);
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    expect(await screen.findByText(/Archive health unavailable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    await waitFor(() => {
      expect(invalidateBrokerCache).toHaveBeenCalledTimes(1);
      expect(getBrokerArchiveHealth).toHaveBeenCalledTimes(2);
    });
  });

  it('renders unavailable archive state with reason instead of zero stats', async () => {
    getBrokerArchiveHealth.mockResolvedValue({
      success: true,
      data: {
        available: false,
        reason: 'database_missing',
        canonicalTickers: 0,
        earliestAvailableDate: null,
        latestAvailableDate: null,
        latestCompletedDate: null,
        verifiedTradingDates: 0,
        populatedStockDays: 0,
        gapStockDays: 0,
        accountedStockDays: 0,
        expectedStockDays: 0,
        coverage: null,
        latestDate: null,
      },
      meta: {
        calendarCoverage: { status: 'degraded', reason: 'calendar_missing' },
        disclosures: DISCLOSURES,
      },
    });
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    expect(await screen.findByText('Bank Central Asia')).toBeInTheDocument();
    expect(screen.getByText(/Archive unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/database_missing/i)).toBeInTheDocument();
    expect(screen.queryByText(/Latest completed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0\/0 stock-days/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('YP').length).toBeGreaterThan(0);
  });

  it('ignores stale responses from older requests', async () => {
    let resolveFirst;
    let resolveSecond;
    getStockBrokerIntelligence
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    fireEvent.click(screen.getByRole('button', { name: /^7D$/i }));

    const stale = {
      ...STOCK_OK,
      data: { ...STOCK_OK.data, name: 'Stale Name' },
    };
    const fresh = {
      ...STOCK_OK,
      data: { ...STOCK_OK.data, name: 'Fresh Name' },
    };

    await act(async () => { resolveSecond(fresh); });
    expect(await screen.findByText('Fresh Name')).toBeInTheDocument();
    await act(async () => { resolveFirst(stale); });
    expect(screen.queryByText('Stale Name')).not.toBeInTheDocument();
    expect(screen.getByText('Fresh Name')).toBeInTheDocument();
  });

  it('covers inventory curve empty and populated states', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    expect(screen.getByText(/Estimated inventory changed from \+1\.000 to \+1\.700 lots/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /AK/i }));
    expect(await screen.findByText(/No estimated inventory curve/i)).toBeInTheDocument();
  });

  it('shows serving layer status in archive health strip', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    expect(screen.getByText(/Serving layer/i)).toBeInTheDocument();
    // ready · 8.800 rows (Indonesian locale uses '.' as thousands sep)
    expect(screen.getByText(/ready.*rows/i)).toBeInTheDocument();
    expect(screen.getByText(/materialized 2026-07-21/i)).toBeInTheDocument();
  });

  it('shows last failure in serving layer health strip', async () => {
    getBrokerArchiveHealth.mockResolvedValue({
      ...HEALTH_OK,
      data: {
        ...HEALTH_OK.data,
        serving: {
          ...HEALTH_OK.data.serving,
          servingAvailable: true,
          servingStatus: 'stale',
          lastFailure: {
            startedAt: '2026-07-22T16:10:00Z',
            finishedAt: '2026-07-22T16:10:05Z',
            error: 'No completed broker archive date available',
            mode: 'incremental',
          },
        },
      },
    });
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    expect(await screen.findByText(/Last failure/i)).toBeInTheDocument();
    expect(screen.getByText(/No completed broker archive date available/i)).toBeInTheDocument();
  });

  it('avoids forbidden holdings/portfolio language', async () => {
    renderAt('/broker-intelligence?lens=stock&ticker=BBCA&days=30');
    await screen.findByText('Bank Central Asia');
    const body = document.body.textContent || '';
    expect(body).not.toMatch(/smart money/i);
    expect(body).not.toMatch(/\bholdings\b(?! or confirmed)/i);
    expect(body).not.toMatch(/\bportfolio\b/i);
    expect(body).toMatch(/not actual holdings/i);
  });
});
