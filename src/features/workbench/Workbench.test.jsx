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
  analyzeTicker: vi.fn(),
  simulateRisk: vi.fn(),
  getStockBrokerIntelligence: vi.fn(),
  getFundamentalStatements: vi.fn(),
}));

import { analyzeTicker, getFundamentalStatements, getStockBrokerIntelligence, simulateRisk } from '../../lib/api/client.js';

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
    scenarioGeometry: {
      available: true,
      framing: 'long_setup',
      scenario: 'compression_breakout',
      confirmation: { price: 4550 },
      trigger: { price: 4550 },
      invalidation: { price: 4300 },
      target: { price: 4700 },
      risk: { stopDistPct: 5.49, targetDistPct: 3.3, rr: 0.6, netRR: 0.52, costPct: 0.3 },
      labels: { confirmation: 'Close above range resistance' },
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
    dataQuality: { sources: ['stockbit', 'yahoo'], warnings: [] },
    investigation: {
      question: { code: 'CONFIRMATION_TEST', title: 'What confirms the structure?', detail: 'Trending with usable geometry.' },
      timeline: [{ date: '2026-07-17', type: 'state', title: 'Current phase', detail: 'Evidence aligned.' }],
      contradictions: [{ code: 'NO_MAJOR_CONTRADICTION', title: 'No dominant contradiction', evidence: ['Recheck tomorrow'] }],
    },
    read: {
      setup: { id: 'accumulation_support', label: 'Accumulation at support', why: 'NI bought on 5 of 5 days.' },
      summary: 'NI keeps buying: 5 of the last 5 days, average 4,420. Price is just above support 4,300.',
      outlook: {
        sessions: 10, range: { low: 4250, mid: 4500, high: 4800 }, support: 4300, resistance: 4900,
        resistanceFirstPct: 31, supportFirstPct: 58, neitherPct: 11, closeBelowSupportPct: 27,
      },
      track: { cases: 3530, sessions: 10, upPct: 41, medianPct: -1.2, vsIhsgPct: 0.8, from: '2025-12-29', to: '2026-09-18' },
      checks: [
        { status: 'ok', label: 'Uptrend', detail: 'above MA20, MA50 and MA200' },
        { status: 'warn', label: 'Weak market', detail: 'IHSG -9.0% in 20 days' },
        { status: 'bad', label: 'Foreign selling', detail: '−Rp2.6T in 20 days' },
      ],
      changes: ['New buyer: PD bought Rp2.5B today at ~4,500.'],
      leadBuyer: { code: 'NI', avg: 4420, days: 5, of: 5 },
      limits: { ara: 5625, arb: 3830 },
      brokers: {
        today: {
          sessions: 1, from: '2026-07-17', to: '2026-07-17',
          buyers: [{ code: 'PD', type: 'D', net: 2.5e9, avg: 4500, days: 1, of: 1 }],
          sellers: [{ code: 'YU', type: 'F', net: -1e9, avg: 4510, days: 1, of: 1 }],
        },
        d5: {
          sessions: 5, from: '2026-07-11', to: '2026-07-17',
          buyers: [{ code: 'NI', type: 'D', net: 23e9, avg: 4420, days: 5, of: 5 }],
          sellers: [{ code: 'YU', type: 'F', net: -20e9, avg: 4450, days: 4, of: 5 }],
        },
        m1: null,
      },
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    getFundamentalStatements.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
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

  const renderBBRI = (data = mockData) => {
    analyzeTicker.mockResolvedValue({ success: true, data });
    return render(
      <MemoryRouter initialEntries={['/?ticker=BBRI']}>
        <Workbench />
      </MemoryRouter>
    );
  };

  it('leads with one setup, a plain read and an outlook, never a trade plan', async () => {
    renderBBRI();
    expect(await screen.findByText('Accumulation at support')).toBeInTheDocument();
    expect(screen.getByText(/NI keeps buying: 5 of the last 5 days/)).toBeInTheDocument();
    expect(screen.getByText('New buyer: PD bought Rp2.5B today at ~4,500.')).toBeInTheDocument();
    const outlook = screen.getByLabelText('Next 10 sessions');
    expect(within(outlook).getByText('4.250–4.800')).toBeInTheDocument();
    expect(within(outlook).getByText('Reaches 4.900 first')).toBeInTheDocument();
    expect(within(outlook).getByText('31%')).toHaveClass('is-positive');
    expect(within(outlook).getByText('58%')).toHaveClass('is-negative');
    expect(within(outlook).getByText(/Ends below support in 27%/)).toBeInTheDocument();
    expect(within(outlook).getByText(/Past “Accumulation at support” reads/).textContent)
      .toBe('Past “Accumulation at support” reads: up after 10 sessions in 41% of 3,530 cases, median −1.2%, +0.8% vs IHSG (Dec 2025 – Sep 2026).');
    expect(screen.getByText('ARA 5.625 · ARB 3.830')).toBeInTheDocument();
    for (const gone of ['Grade', 'Regime', 'Pattern', 'Bias', 'Scorecard', 'Contradictions', 'B+', 'Buy', 'Stop', 'Target', 'R:R']) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText('Trade plan')).not.toBeInTheDocument();
  });

  it('shows only the track record when the outlook cannot be simulated', async () => {
    renderBBRI({ ...mockData, read: { ...mockData.read, outlook: null } });
    const outlook = await screen.findByLabelText('Next 10 sessions');
    expect(within(outlook).queryByText(/Likely range/)).not.toBeInTheDocument();
    expect(within(outlook).getByText(/up after 10 sessions in 41%/)).toBeInTheDocument();
  });

  it('lists checks with their numbers, ordered as the read sends them', async () => {
    renderBBRI();
    const checks = await screen.findByRole('region', { name: 'Checks' });
    expect(within(checks).getAllByRole('listitem').map((item) => [item.className, item.textContent])).toEqual([
      ['is-ok', 'Uptrend · above MA20, MA50 and MA200'],
      ['is-warn', 'Weak market · IHSG -9.0% in 20 days'],
      ['is-bad', 'Foreign selling · −Rp2.6T in 20 days'],
    ]);
  });

  it('switches broker windows, skips missing ones, and links to the full broker flow', async () => {
    renderBBRI();
    const brokers = await screen.findByRole('region', { name: 'Brokers' });
    expect(within(brokers).getByRole('button', { name: '5D' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(brokers).getByText('NI')).toBeInTheDocument();
    expect(within(brokers).getByText('5/5d')).toBeInTheDocument();
    expect(within(brokers).getByText(/11 Jul – 17 Jul · 5 sessions/)).toBeInTheDocument();
    expect(within(brokers).getByRole('button', { name: '1M' })).toBeDisabled();
    expect(within(brokers).getByRole('link', { name: /Full broker flow/ }).getAttribute('href')).toBe('/broker-intelligence?lens=stock&ticker=BBRI&days=7');

    fireEvent.click(within(brokers).getByRole('button', { name: 'Today' }));
    expect(within(brokers).getByText('PD')).toBeInTheDocument();
    expect(within(brokers).queryByText('1/1d')).not.toBeInTheDocument();
    expect(within(brokers).getByRole('link', { name: /Full broker flow/ }).getAttribute('href')).toBe('/broker-intelligence?lens=stock&ticker=BBRI&days=1');
  });

  it('keeps indicators and the risk calculator behind one collapsed section', async () => {
    renderBBRI();
    expect(await screen.findByText('Price & volume')).toBeInTheDocument();
    const tablist = screen.getByRole('tablist', { name: /Analysis detail sections/i });
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Indicators', 'Risk calculator']);
    fireEvent.click(within(tablist).getByRole('tab', { name: 'Risk calculator' }));
    expect(screen.getByRole('heading', { name: /Risk Simulator/i })).toBeInTheDocument();
  });

  it('still shows the chart and indicators when the API has no read block', async () => {
    renderBBRI({ ...mockData, read: undefined });
    expect(await screen.findByText(/The read for this stock is unavailable/)).toBeInTheDocument();
    expect(screen.getByText('Price & volume')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Brokers' })).not.toBeInTheDocument();
  });

  it('labels the buyer-cost overlay with the lead buyer', async () => {
    renderBBRI();
    expect(await screen.findByRole('button', { name: 'NI cost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
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

  it('ignores a position size that resolves after the setup changed', async () => {
    let resolveSimulation;
    simulateRisk.mockImplementation(() => new Promise((resolve) => { resolveSimulation = resolve; }));

    const { rerender } = render(
      <RiskSimulator ticker={mockData.ticker} />
    );
    fireEvent.click(screen.getByRole('button', { name: /CALCULATE SIZE/i }));

    rerender(
      <RiskSimulator ticker={{ ...mockData.ticker, close: 4600 }} />
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

  it('starts sizing from the close with stop and target left to the user', () => {
    render(<RiskSimulator ticker={mockData.ticker} />);
    expect(screen.getByLabelText('Entry')).toHaveValue(mockData.ticker.close);
    expect(screen.getByLabelText('Invalidation')).toHaveValue(null);
    expect(screen.getByLabelText('Target')).toHaveValue(null);
    expect(screen.getByText(/Enter your own stop and target/)).toBeInTheDocument();
  });

  it('recovers when the risk simulation request rejects', async () => {
    simulateRisk.mockRejectedValue(new Error('risk service unavailable'));
    render(<RiskSimulator ticker={mockData.ticker} />);

    fireEvent.click(screen.getByRole('button', { name: /CALCULATE SIZE/i }));

    expect(await screen.findByText(/risk service unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CALCULATE SIZE/i })).toBeEnabled();
  });
});
