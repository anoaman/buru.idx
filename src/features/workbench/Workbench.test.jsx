import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Workbench from './Workbench.jsx';

// Mock the API client
vi.mock('../../lib/api/client.js', () => ({
  analyzeTicker: vi.fn(),
  simulateRisk: vi.fn(),
  getStockBrokerIntelligence: vi.fn(),
}));

import { analyzeTicker, getStockBrokerIntelligence } from '../../lib/api/client.js';

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
      source: { name: 'stockbit-chartbit', lastDate: '2026-07-17' },
    },
    broker: {
      available: true,
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
    dataQuality: { sources: ['stockbit', 'yahoo'], warnings: [] },
    investigation: {
      question: { code: 'CONFIRMATION_TEST', title: 'What confirms the structure?', detail: 'Trending with usable geometry.' },
      timeline: [{ date: '2026-07-17', type: 'state', title: 'Current phase', detail: 'Evidence aligned.' }],
      contradictions: [{ code: 'NO_MAJOR_CONTRADICTION', title: 'No dominant contradiction', evidence: ['Recheck tomorrow'] }],
    },
  };

  beforeEach(() => {
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
  });

  it('renders loading state', () => {
    analyzeTicker.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
    expect(screen.getByText(/Analyzing BBRI/i)).toBeInTheDocument();
  });

  it('renders full analysis result with all sub-components', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    // Header
    expect(await screen.findByText('BBRI')).toBeInTheDocument();
    expect(screen.getByText(/Bank Rakyat Indonesia/i)).toBeInTheDocument();

    // Grade
    expect(screen.getByText('B+')).toBeInTheDocument();

    expect(screen.getByTitle('TradingView chart for IDX:BBRI')).toBeInTheDocument();

    // Technical Evidence
    expect(screen.getByText(/Technical Evidence/i)).toBeInTheDocument();
    // Exact match: the evidence-grade tooltip also names RSI14 when describing the method.
    expect(screen.getByText('RSI14')).toBeInTheDocument();

    // Risk geometry is consolidated into the simulator.
    expect(screen.getByText(/Invalidation simulator/i)).toBeInTheDocument();
    expect(screen.getAllByText('Support').length).toBeGreaterThan(0);

    // Broker Evidence
    expect(screen.getByText(/Broker Evidence/i)).toBeInTheDocument();

    // Redundant debate, scorecard, and quality panels are replaced by one compact summary.
    expect(screen.getAllByText('Regime').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Data').length).toBeGreaterThan(0);
    expect(screen.queryByText(/What supports or challenges the setup/i)).not.toBeInTheDocument();
  });

  it('uses TradingView as the only primary chart with NALAR levels below', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByTitle('TradingView chart for IDX:BBRI')).toBeInTheDocument();
    expect(screen.getByLabelText(/NALAR proprietary levels/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /NALAR Analysis/i })).not.toBeInTheDocument();
  });

  it('updates TradingView symbol when ticker changes', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByTitle('TradingView chart for IDX:BBRI')).toBeInTheDocument();

    const tlkmData = {
      ...mockData,
      ticker: { ...mockData.ticker, symbol: 'TLKM', name: 'Telkom Indonesia' },
    };
    analyzeTicker.mockResolvedValue({ success: true, data: tlkmData });

    const input = screen.getByPlaceholderText(/Enter ticker/i);
    fireEvent.change(input, { target: { value: 'TLKM' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyze/i }));

    expect(await screen.findByText('TLKM')).toBeInTheDocument();
    expect(screen.getByTitle('TradingView chart for IDX:TLKM')).toBeInTheDocument();
    expect(screen.getByTitle('TradingView chart for IDX:TLKM').getAttribute('src'))
      .toContain('symbol=IDX%3ATLKM');
  });

  it('loads TradingView with default volume and RSI studies', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    const iframe = await screen.findByTitle('TradingView chart for IDX:BBRI');
    expect(decodeURIComponent(iframe.getAttribute('src'))).toContain('Volume@tv-basicstudies');
    expect(decodeURIComponent(iframe.getAttribute('src'))).toContain('RSI@tv-basicstudies');
  });

  it('shows Local and Foreign broker rows with full Rupiah values', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Broker Evidence/i)).toBeInTheDocument();
    expect(screen.getAllByText('Local').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Foreign')).toBeInTheDocument();
    expect(screen.queryByText('Pemerintah')).not.toBeInTheDocument();
    expect(screen.queryByText('Lokal')).not.toBeInTheDocument();
    expect(screen.queryByText('Asing')).not.toBeInTheDocument();
    expect(screen.getAllByText('Rp229.975.060.500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-Rp229.975.060.500').length).toBeGreaterThan(0);
  });

  it('keeps TradingView available when proprietary chart history is absent', async () => {
    const noChart = { ...mockData, chart: null };
    analyzeTicker.mockResolvedValue({ success: true, data: noChart });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
    expect(await screen.findByTitle('TradingView chart for IDX:BBRI')).toBeInTheDocument();
  });

  it('renders technical evidence unavailable state', async () => {
    const noHistory = { ...mockData, priceHistory: { note: 'daily history unavailable' } };
    analyzeTicker.mockResolvedValue({ success: true, data: noHistory });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
    expect(await screen.findByText(/daily history unavailable/i)).toBeInTheDocument();
  });

  it('loads archived broker evidence when the analysis snapshot is unavailable', async () => {
    const noBroker = { ...mockData, broker: { available: false, note: 'No broker data' } };
    analyzeTicker.mockResolvedValue({ success: true, data: noBroker });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Broker Evidence/i)).toBeInTheDocument();
    expect((await screen.findAllByText('NI')).length).toBeGreaterThan(0);
  });

  it('links Broker Evidence to Broker Intelligence with encoded ticker', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );

    const link = await screen.findByRole('link', { name: /Open full Broker Map/i });
    expect(link).toHaveAttribute(
      'href',
      '/broker-intelligence?lens=stock&ticker=BBRI&days=1&date=2026-07-17',
    );
  });

  it('hides Broker Intelligence link when broker has no symbol', async () => {
    analyzeTicker.mockResolvedValue({
      success: true,
      data: {
        ...mockData,
        ticker: { ...mockData.ticker, symbol: '' },
        broker: { ...mockData.broker },
      },
    });
    render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Broker Evidence/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open full Broker Map/i })).not.toBeInTheDocument();
  });

  it('handles search form submission', async () => {
    analyzeTicker.mockResolvedValue({ success: true, data: mockData });
    render(
      <MemoryRouter>
        <Workbench />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Enter ticker/i);
    fireEvent.change(input, { target: { value: 'TLKM' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyze/i }));

    // Analysis result renders (mock data is BBRI, but form submission works)
    expect(await screen.findByTitle('TradingView chart for IDX:BBRI')).toBeInTheDocument();
  });

  it('shows error for invalid ticker format', () => {
    render(
      <MemoryRouter>
        <Workbench />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Enter ticker/i);
    fireEvent.change(input, { target: { value: 'INVALID' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyze/i }));

    expect(screen.getByText(/Enter a four-letter ticker/i)).toBeInTheDocument();
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
});
