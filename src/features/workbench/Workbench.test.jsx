import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router';
import Workbench from './Workbench.jsx';
import RiskSimulator from './RiskSimulator.jsx';

// Workbench has no control that removes the ticker, but the shell and deep
// links can leave the route without one.
function ClearTicker() {
  const [, setSearchParams] = useSearchParams();
  return (
    <button type="button" onClick={() => setSearchParams({})}>clear ticker</button>
  );
}

function SetTicker({ ticker }) {
  const [, setSearchParams] = useSearchParams();
  return (
    <button
      type="button"
      onClick={() => setSearchParams(ticker ? { ticker } : {})}
    >
      open {ticker || 'none'}
    </button>
  );
}

// Mock the API client
vi.mock('../../lib/api/client.js', () => ({
  privateWritesEnabled: false,
  analyzeTicker: vi.fn(),
  simulateRisk: vi.fn(),
  getStockBrokerIntelligence: vi.fn(),
}));

import { analyzeTicker, getStockBrokerIntelligence, simulateRisk } from '../../lib/api/client.js';

describe('Workbench', () => {
  const mockData = {
    ticker: {
      symbol: 'BBRI',
      name: 'Bank Rakyat Indonesia',
      close: 4500,
      change: 50,
      changePct: 1.12,
      open: 4450,
      high: 4550,
      low: 4400,
      volume: 12500000,
      frequency: 3421,
      vwap: 4480,
      tier: 'liquid',
      notations: [],
      volumeVsBaseline: { ratio: 1.2, avgVolume: 10400000, days: 20 },
    },
    priceHistory: {
      ret5d: 2.5,
      ret20d: 5.1,
      ret60d: 12.3,
      rsi14: 58.4,
      atr14Pct: 1.8,
      streak: 3,
      movingAverages: {
        ma5: { value: 4480, vsPricePct: -0.44 },
        ma20: { value: 4350, vsPricePct: 3.44 },
        ma50: { value: 4200, vsPricePct: 7.14 },
        ma200: { value: 3900, vsPricePct: 15.38 },
        stack: 'above all MAs',
      },
    },
    grade: { grade: 'B+', confidence: 0.72, regime: 'trending', structurePhase: 'established' },
    stance: { stance: 'LONG_LEAN', reason: 'Price above all MAs with positive momentum' },
    scenario: {
      scenario: 'trend_pullback',
      fitScore: 75,
      structure: { trend: 'up', compression: false, nearSupport: true },
      confirmations: ['moving-average trend is rising', 'price remains near support'],
      contradictions: [],
    },
    scenarioGeometry: {
      scenario: 'trend_pullback',
      available: true,
      framing: 'long_setup',
      trigger: { price: 4480, event: 'close_above', basis: 'close' },
      confirmation: { price: 4480, event: 'close_above', basis: 'close' },
      invalidation: { price: 4300, event: 'close_below', basis: 'close' },
      target: { price: 4700 },
      risk: { netRR: 0.85, costPct: 0.3 },
      labels: {
        confirmation: 'Hold/reclaim of MA/support/last higher low',
        invalidation: 'Close below the last defensible higher low',
        target: 'Next resistance',
        summary: 'Hold the pullback structure; last close is not the entry',
      },
    },
    scorecard: {
      factors: [
        { factor: 'Momentum', signal: 1, reason: 'RSI above 50' },
        { factor: 'Trend', signal: 1, reason: 'Above MA200' },
      ],
      summary: { leaning: 'bullish', bullish: 2, bearish: 0, neutral: 0 },
    },
    riskGeometry: {
      nearestSupport: 4300,
      nearestResistance: 4700,
      downsidePct: 4.44,
      upsidePct: 4.44,
      rewardRisk: 1.0,
      netRewardRisk: 0.85,
      bestSetup: {
        stop: 4300,
        target: 4700,
        rr: 1.0,
        netRR: 0.85,
        costPct: 0.3,
      },
      note: 'Risk-reward is balanced',
    },
    chart: {
      candles: [
        { date: '2026-07-15', open: 4400, high: 4450, low: 4380, close: 4420, volume: 10000000 },
        { date: '2026-07-16', open: 4420, high: 4480, low: 4400, close: 4450, volume: 11000000 },
        { date: '2026-07-17', open: 4450, high: 4520, low: 4430, close: 4500, volume: 12500000 },
      ],
      movingAverages: {
        ma5: [
          { date: '2026-07-15', value: null },
          { date: '2026-07-16', value: 4423 },
          { date: '2026-07-17', value: 4457 },
        ],
      },
      levels: {
        supports: [{ price: 4300, touches: 3, volWeight: 2.1 }],
        resistances: [{ price: 4700, touches: 2, volWeight: 1.5 }],
      },
      source: { name: 'market-data-provider', lastDate: '2026-07-17' },
    },
    broker: {
      available: true,
      symbol: 'BBRI',
      from: '2026-07-17',
      bandar: { signal: 'accumulating', top5: { percent: 42.3 } },
      multiDay: {
        d5: { sessions: 5 },
        d20: { sessions: 20 },
        d60: { sessions: 60 },
        consistency: [{ code: 'NI', signal: 'buy', sessions: 5 }],
      },
      buyers: [
        { code: 'NI', sourceType: 'Local', netValue: 229975060500 },
        { code: 'PD', sourceType: 'Local', netValue: 2500000000 },
      ],
      sellers: [
        { code: 'YU', sourceType: 'Foreign', netValue: -229975060500 },
      ],
    },
    debate: {
      bull: [{ factor: 'Trend', reason: 'Above all MAs' }],
      bear: [{ factor: 'Valuation', reason: 'P/E above sector median' }],
    },
    investigation: {
      question: { code: 'CONFIRMATION_TEST', title: 'What confirms the structure?', detail: 'Trending with usable geometry.' },
      timeline: [
        { date: '2026-07-17', type: 'state', title: 'Current phase', detail: 'Evidence aligned.' },
        {
          date: '2026-07-17',
          type: 'official',
          category: 'dividend',
          title: 'Dividend: Cash dividend',
          detail: 'Official IDX disclosure.',
          sourceUrl: 'https://www.idx.co.id/id/berita/pengumuman/',
          brokerContext: { available: false, note: 'Broker summary unavailable for this session.' },
        },
      ],
      contradictions: [{ code: 'NO_MAJOR_CONTRADICTION', title: 'No dominant contradiction', evidence: ['Recheck tomorrow'] }],
    },
    storyIntelligence: {
      available: true,
      events: [{
        category: 'dividend',
        categoryLabel: 'Dividend',
        title: 'Cash dividend',
        publishedAt: '2026-07-17',
        sourceUrl: 'https://www.idx.co.id/id/berita/pengumuman/',
        sourceRef: 'idx:ca:dividend:BBRI:20260717',
      }],
      health: { available: true, freshness: 'healthy', warnings: [], counts: { events: 1, unmapped: 0, superseded: 0 } },
    },
    macro: {
      regime: { state: 'risk_on', asOf: '2026-07-17' },
      relativeStrength: {
        lineState: 'outperforming',
        matchedSessions: 60,
        periods: {
          20: { excessReturnPct: 2.4 },
          60: { excessReturnPct: 5.1 },
        },
        sector: { available: false },
      },
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    getStockBrokerIntelligence.mockResolvedValue({
      success: true,
      data: {
        ticker: 'BBRI',
        name: 'Bank Rakyat Indonesia',
        window: { days: 1, from: '2026-07-17', to: '2026-07-17', tradingSessions: 1, populatedSessions: 1, gapSessions: 0, missingSessions: 0, complete: true },
        observedFlow: {}, preferredBroker: {},
        accumulation: mockData.broker.buyers,
        distribution: mockData.broker.sellers,
      },
    });
  });

  it('renders empty state when no ticker', () => {
    render(
      <MemoryRouter>
        <Workbench />
      </MemoryRouter>
    );
    expect(screen.getByText(/Enter a ticker to analyze/i)).toBeInTheDocument();
    expect(screen.getByText(/command bar/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/TICKER/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^OPEN$/i })).not.toBeInTheDocument();
  });

  it('renders loading state', () => {
    analyzeTicker.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
    expect(screen.getByText(/Loading BBRI/i)).toBeInTheDocument();
  });

  it('renders full analysis result with all sub-components', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('BBRI')).toBeInTheDocument();
    expect(screen.getByText(/Bank Rakyat Indonesia/i)).toBeInTheDocument();
    expect(screen.getByText('Setup type')).toBeInTheDocument();
    expect(screen.getByText(/Pullback in an uptrend/)).toBeInTheDocument();
    expect(screen.getAllByText('Clears above').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fails below').length).toBeGreaterThan(0);
    expect(screen.queryByText('What confirms the structure?')).not.toBeInTheDocument();
    expect(screen.getByText('Price & volume')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /market vs ihsg/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Cost drag/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Indicators/i }));
    expect(screen.getByText(/Technical indicators/i)).toBeInTheDocument();
    expect(screen.getByText('RSI14')).toBeInTheDocument();
    expect(screen.getByText('B+')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Risk Simulator/i }));
    expect(screen.getByRole('heading', { name: /Risk Simulator/i })).toBeInTheDocument();
    expect(screen.getAllByText('Support').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /^Broker Flow$/i }));
    expect(await screen.findByRole('heading', { name: /^Broker Flow$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Methodology/i }));
    expect(screen.getAllByText('Price trend').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lean').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pattern')).not.toBeInTheDocument();
    expect(screen.getAllByText('B+').length).toBeGreaterThan(0);
    expect(screen.queryByText('Data')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /What Changed/i }));
    expect(screen.getByText(/What supports or challenges the setup/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Official IDX source/i }).length).toBeGreaterThan(0);
  });

  it('exposes analysis detail tabs', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    const tablist = screen.getByRole('tablist', { name: /Analysis detail sections/i });
    expect(within(tablist).getByRole('tab', { name: /^Levels$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^Indicators$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^IHSG$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^Broker Flow$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^What Changed$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^Risk Simulator$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^Methodology$/i })).toBeInTheDocument();
    fireEvent.click(within(tablist).getByRole('tab', { name: /^IHSG$/i }));
    expect(screen.getByLabelText('Market versus IHSG')).toBeInTheDocument();
    expect(screen.getByText('Vs IHSG')).toBeInTheDocument();
    expect(screen.getByText(/2\.4% · 20 sessions/)).toBeInTheDocument();
  });

  it('shows cost drag on the Levels tab', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Cost drag/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Levels$/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('does not treat last close as a confirmation entry for distribution risk', async () => {
    analyzeTicker.mockResolvedValue({
      success: true,
      data: {
        ...mockData,
        scenario: {
          scenario: 'distribution_risk',
          fitScore: 75,
          structure: { trend: 'down', compression: false, nearSupport: false },
          confirmations: [],
          contradictions: ['observed broker flow is distributing'],
        },
        scenarioGeometry: {
          scenario: 'distribution_risk',
          available: true,
          framing: 'defensive',
          trigger: null,
          confirmation: null,
          invalidation: { price: 4300 },
          target: null,
          defensiveExit: { price: 4300 },
          risk: { netRR: null },
          labels: {
            confirmation: 'Not a long entry',
            invalidation: 'Damage if this structure is lost',
            target: 'No long target under distribution risk',
            summary: 'Distribution risk is avoid/exit framing only; it is not a green long setup',
          },
        },
      },
    });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>,
    );
    expect((await screen.findAllByText(/not a long entry/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Selling pressure/)).toBeInTheDocument();
    expect(screen.queryByText(/Breakout above last close/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/What confirms the structure/i)).not.toBeInTheDocument();
  });

  it('uses one TradingView-powered NALAR market chart', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /market vs ihsg/i })).not.toBeInTheDocument();
    expect(screen.queryByText('MA5')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show MA lines' }));
    expect(screen.getAllByText('MA5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MA200').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /NALAR Analysis/i })).not.toBeInTheDocument();
  });

  it('updates TradingView symbol when ticker changes', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <SetTicker ticker="TLKM" />
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open full TradingView/i }).getAttribute('href')).toContain('IDX%3ABBRI');

    const tlkmData = {
      ...mockData,
      ticker: { ...mockData.ticker, symbol: 'TLKM', name: 'Telkom Indonesia' },
      broker: { ...mockData.broker, symbol: 'TLKM' },
    };
    analyzeTicker.mockResolvedValue({ success: true, data: tlkmData });
    fireEvent.click(screen.getByRole('button', { name: /open TLKM/i }));

    expect(await screen.findByText('TLKM')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open full TradingView/i }).getAttribute('href')).toContain('IDX%3ATLKM');
  });

  it('loads the market chart with volume and moving-average legend', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    expect(screen.queryByText('MA20')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show MA lines' }));
    expect(screen.getAllByText('MA20').length).toBeGreaterThan(0);
  });

  it('shows Local and Foreign broker rows with full Rupiah values', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Broker Flow$/i }));

    expect((await screen.findAllByText('Local')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Foreign').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Pemerintah')).not.toBeInTheDocument();
    expect(screen.queryByText('Lokal')).not.toBeInTheDocument();
    expect(screen.queryByText('Asing')).not.toBeInTheDocument();
    expect(screen.getAllByText('Rp229.975.060.500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-Rp229.975.060.500').length).toBeGreaterThan(0);
  });

  it('shows a clear chart empty state when history is absent', async () => {
    const noChart = { ...mockData, chart: null };
    analyzeTicker.mockResolvedValue({ success: true, data: noChart });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
    expect(await screen.findByText('Chart history unavailable.')).toBeInTheDocument();
  });

  it('renders technical evidence unavailable state', async () => {
    const noHistory = { ...mockData, priceHistory: { note: 'daily history unavailable' } };
    analyzeTicker.mockResolvedValue({ success: true, data: noHistory });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Indicators/i }));
    expect(await screen.findByText(/daily history unavailable/i)).toBeInTheDocument();
  });

  it('loads archived broker evidence when the analysis snapshot is unavailable', async () => {
    const noBroker = {
      ...mockData,
      broker: { available: false, note: 'No broker data', symbol: 'BBRI' },
    };
    analyzeTicker.mockResolvedValue({ success: true, data: noBroker });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Broker Flow$/i }));
    expect((await screen.findAllByText('NI')).length).toBeGreaterThan(0);
  });

  it('links Broker Flow to the full broker page with encoded ticker', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Broker Flow$/i }));

    const link = await screen.findByRole('link', { name: /Open Broker Flow/i });
    expect(link.getAttribute('href')).toMatch(
      /^\/broker-intelligence\?lens=stock&ticker=BBRI&days=1(?:&date=2026-07-17)?$/,
    );
  });

  it('hides Broker Intelligence link when broker has no symbol', async () => {
    analyzeTicker.mockResolvedValue({
      success: true,
      data: {
        ...mockData,
        ticker: { ...mockData.ticker, symbol: '' },
        broker: { ...mockData.broker, symbol: '' },
      },
    });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Broker Flow$/i }));
    expect(await screen.findByRole('heading', { name: /^Broker Flow$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Broker Flow/i })).not.toBeInTheDocument();
  });

  it('loads analysis from the URL ticker param', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter>
        <SetTicker ticker="BBRI" />
        <Workbench />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /open BBRI/i }));
    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    expect(analyzeTicker).toHaveBeenCalledWith('BBRI');
  });

  it('shows error for invalid ticker format', async () => {
    render(
      <MemoryRouter>
        <SetTicker ticker="ABC" />
        <Workbench />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /open ABC/i }));
    expect(await screen.findByText(/Enter a four-letter ticker/i)).toBeInTheDocument();
  });

  it('shows analysis error state', async () => {
    analyzeTicker.mockRejectedValue(new Error('upstream unavailable'));
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Analysis failed/i)).toBeInTheDocument();
    expect(screen.getByText(/upstream unavailable/i)).toBeInTheDocument();
  });

  it('discards an older analysis that resolves after a newer ticker search', async () => {
    let resolveFirst;
    let resolveSecond;
    analyzeTicker
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <SetTicker ticker="TLKM" />
        <Workbench />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading BBRI/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open TLKM/i }));
    expect(screen.getByText(/Loading TLKM/i)).toBeInTheDocument();

    const tlkm = {
      ...mockData,
      ticker: { ...mockData.ticker, symbol: 'TLKM', name: 'Telkom Indonesia' },
      broker: { ...mockData.broker, symbol: 'TLKM' },
    };
    await act(async () => { resolveSecond({ success: true, data: tlkm }); });
    expect(await screen.findByText('Telkom Indonesia')).toBeInTheDocument();

    await act(async () => { resolveFirst({ success: true, data: mockData }); });
    expect(screen.queryByText(/Bank Rakyat Indonesia/i)).not.toBeInTheDocument();
    expect(screen.getByText('Telkom Indonesia')).toBeInTheDocument();
  });

  it('keeps previous result dimmed while a warm ticker switch loads', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <SetTicker ticker="TLKM" />
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Bank Rakyat Indonesia/i)).toBeInTheDocument();
    expect(document.querySelector('[data-displayed-ticker="BBRI"]')).toBeInTheDocument();

    analyzeTicker.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: /open TLKM/i }));

    expect(await screen.findByText(/Loading TLKM/i)).toBeInTheDocument();
    expect(screen.getByText(/Bank Rakyat Indonesia/i)).toBeInTheDocument();
    expect(document.querySelector('[data-displayed-ticker="BBRI"]')).toBeInTheDocument();
    expect(document.querySelector('.wb-analysis-frame.is-stale')).toBeInTheDocument();
  });

  it('retries the ticker that failed', async () => {
    analyzeTicker.mockRejectedValue(new Error('upstream unavailable'));
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Analysis failed for BBRI/i)).toBeInTheDocument();

    analyzeTicker.mockClear();
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    await waitFor(() => expect(analyzeTicker).toHaveBeenCalledWith('BBRI'));
    expect(await screen.findByText(/Bank Rakyat Indonesia/i)).toBeInTheDocument();
  });

  it('drops the analysis when the ticker leaves the URL', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <ClearTicker />
        <Workbench />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Bank Rakyat Indonesia/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear ticker/i }));
    expect(await screen.findByText(/Enter a ticker to analyze/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bank Rakyat Indonesia/i)).not.toBeInTheDocument();
  });

  it('reports the observed trading-day count for the broker range', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^Broker Flow$/i }));

    await waitFor(() => {
      const meta = document.querySelector('.wb-broker__meta');
      expect(meta?.textContent).toMatch(/· 1 trading day\b/);
    });
    expect(document.querySelector('.wb-broker__meta').textContent).not.toMatch(/undefined/);
  });

  it('ignores a position size that resolves after the setup changed', async () => {
    let resolveSimulation;
    simulateRisk.mockImplementation(() => new Promise((resolve) => { resolveSimulation = resolve; }));

    const { rerender } = render(
      <RiskSimulator ticker={mockData.ticker} geometry={mockData.riskGeometry} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Calculate size/i }));

    rerender(
      <RiskSimulator ticker={{ ...mockData.ticker, close: 4600 }} geometry={mockData.riskGeometry} />
    );

    await act(async () => {
      resolveSimulation({
        success: true,
        data: {
          entry: 4500, stop: 4300, target: 4700, capital: 100000000, maxRiskPct: 1,
          lots: 111, shares: 11100, deployedCapital: 49950000, estimatedRisk: 999000,
          estimatedRiskPct: 1, netRR: 0.85, bindingConstraint: 'risk',
        },
      });
    });

    expect(screen.queryByText(/111 lots/)).not.toBeInTheDocument();
  });

  it('recovers when the risk simulation request rejects', async () => {
    simulateRisk.mockRejectedValue(new Error('risk service unavailable'));
    render(<RiskSimulator ticker={mockData.ticker} geometry={mockData.riskGeometry} />);

    fireEvent.click(screen.getByRole('button', { name: /Calculate size/i }));

    expect(await screen.findByText(/risk service unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calculate size/i })).toBeEnabled();
  });
});
