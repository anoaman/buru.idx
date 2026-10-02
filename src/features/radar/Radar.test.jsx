import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AnalysisProvider } from '../../components/AnalysisContext.jsx';
import Radar from './Radar.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getRadarScout: vi.fn(),
  getRadarScoutConditions: vi.fn(),
}));

import { getRadarScout, getRadarScoutConditions } from '../../lib/api/client.js';

const CONDITION_CATALOG = {
  success: true,
  data: {
    conditions: [
      { id: 'max_price', label: 'Maximum price', category: 'Universe', type: 'number', comparison: 'at_most', unit: 'IDR', defaultValue: 1000, min: 1, max: 100000, step: 1 },
      { id: 'exclude_fca', label: 'Exclude FCA', category: 'Universe', type: 'boolean', comparison: 'equals', defaultValue: true, options: [] },
      { id: 'fca_only', label: 'FCA only', category: 'Universe', type: 'boolean', comparison: 'equals', defaultValue: true, options: [] },
      { id: 'near_support', label: 'Near Support', category: 'Price setup', type: 'boolean', comparison: 'equals', defaultValue: true, options: [] },
      { id: 'tight_base', label: 'Tight Base', category: 'Price setup', type: 'boolean', comparison: 'equals', defaultValue: true, options: [] },
      { id: 'breakout_above_base', label: 'Breakout', category: 'Price setup', type: 'boolean', comparison: 'equals', defaultValue: true, options: [] },
      { id: 'broker_accumulation', label: 'Broker Accumulation', category: 'Confirmation', type: 'boolean', comparison: 'equals', defaultValue: true, options: [] },
      { id: 'volume_breakout_baseline', label: 'Volume Breakout', category: 'Confirmation', type: 'select', comparison: 'equals', options: ['MA5', 'MA10', 'MA20'] },
      { id: 'outperforming_ihsg', label: 'Relative Strength vs IHSG', category: 'Confirmation', type: 'boolean', comparison: 'equals', defaultValue: true, options: [] },
    ],
    templates: {
      quiet_accumulation: [{ id: 'max_price', value: 1000 }, { id: 'min_average_value', value: 500_000_000 }, { id: 'near_support', value: true }, { id: 'broker_accumulation', value: true }],
      dominant_broker: [{ id: 'max_price', value: 1000 }, { id: 'min_average_value', value: 500_000_000 }, { id: 'broker_accumulation', value: true }],
      support_compression: [{ id: 'max_price', value: 1000 }, { id: 'min_average_value', value: 500_000_000 }, { id: 'tight_base', value: true }],
    },
  },
};

function scoutCandidate(overrides = {}) {
  return {
    ticker: 'AHAP',
    name: 'Asuransi Harta Aman Pratama Tbk',
    board: 'Development',
    rank: 1,
    score: 88.4,
    evidenceBand: 'high',
    failedCondition: null,
    scoreBreakdown: { broker: 41, support: 32, compression: 12.5 },
    price: {
      lastPrice: 101, priceDate: '2026-08-10', support: 98, supportTouches: 4, distanceFromSupportPct: 3.06,
      consolidationRangePct: 7.1, recentAtrPct: 2, priorAtrPct: 3, volatilityContracting: true,
      averageValue: 1_100_000_000, zeroVolumeSessions: 0,
    },
    broker: {
      observedSessions: 7, expectedSessions: 7,
      lead: { code: 'CC', netValue: 1_200_000_000, buySessions: 6, sellSessions: 1 },
      focus: { code: 'CC', netValue: 1_200_000_000, buySessions: 6, sellSessions: 1 },
      second: { code: 'YP', netValue: 300_000_000 },
      leadToSecondRatio: 4, leadSharePct: 58,
    },
    reasons: ['CC accumulated Rp1200M, 4.0× YP, across 6/7 sessions.'],
    risks: ['CC distributed in 1 observed session.'],
    ...overrides,
  };
}

function scoutResponse({ candidates = [], nearMisses = [], coverage, dailyDiff, asOf, ranking = 'blended' } = {}) {
  return {
    success: true,
    data: {
      recipe: { id: 'quiet_accumulation', label: 'Quiet Accumulation Near Support' },
      ranking,
      options: { brokerSessions: 7 },
      asOf: {
        priceDate: '2026-08-10',
        brokerFrom: '2026-07-31',
        brokerTo: '2026-08-10',
        requestedBrokerSessions: 7,
        brokerSessions: 7,
        ...asOf,
      },
      coverage: coverage || { evaluated: 900, matched: candidates.length, returned: candidates.length, nearMisses: nearMisses.length },
      candidates,
      nearMisses,
      dailyDiff: dailyDiff || { new: [], still: [], dropped: [] },
      disclosures: ['Observed flow is not a holdings ledger.'],
    },
  };
}

function renderRadar() {
  const result = render(
    <MemoryRouter initialEntries={['/radar']}>
      <AnalysisProvider>
        <Radar />
      </AnalysisProvider>
    </MemoryRouter>,
  );
  return result;
}

function lastRequest() {
  return getRadarScout.mock.calls.at(-1)[0];
}

function chip(label) {
  return screen.getAllByRole('button').find((button) => button.classList.contains('sf-chip') && button.textContent.startsWith(label));
}

function choose(chipLabel, option) {
  fireEvent.click(chip(chipLabel));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${option}`) }));
}

async function waitForRun(count = 1) {
  await waitFor(() => expect(getRadarScout).toHaveBeenCalledTimes(count));
}

describe('Radar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getRadarScoutConditions.mockResolvedValue(CONDITION_CATALOG);
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [] }));
  });

  it('runs the default Quiet Accumulation filters on load and keeps evidence behind a disclosure', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate()] }));
    renderRadar();

    expect(await screen.findByText('AHAP')).toBeInTheDocument();
    expect(screen.getByText('1 matched')).toBeInTheDocument();
    expect(screen.getByText('Ranked by broker + setup')).toBeInTheDocument();
    await waitFor(() => expect(chip('Preset')).toHaveTextContent('Quiet accumulation'));
    expect(lastRequest()).toEqual({
      conditions: [
        { id: 'max_price', value: 1000 },
        { id: 'min_average_value', value: 500_000_000 },
        { id: 'near_support', value: true },
        { id: 'broker_accumulation', value: true },
      ],
      useBroker: true,
      useSupport: true,
      useSideways: false,
      brokerPreset: '7d',
      minBrokerAccumulation: 1_000_000_000,
      limit: 100,
    });
    expect(screen.queryByRole('button', { name: 'Run Screener' })).not.toBeInTheDocument();
    expect(screen.queryByText('CC accumulated Rp1200M, 4.0× YP, across 6/7 sessions.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show AHAP evidence' }));
    expect(screen.getByText('CC accumulated Rp1200M, 4.0× YP, across 6/7 sessions.')).toBeInTheDocument();
    expect(screen.getByText('CC distributed in 1 observed session.')).toBeInTheDocument();
  });

  it('treats setup as a single choice and shows Custom once the slots leave a preset', async () => {
    renderRadar();
    await waitForRun();
    await waitFor(() => expect(chip('Preset')).toHaveTextContent('Quiet accumulation'));

    choose('Setup', 'Tight base');
    await waitForRun(2);
    const ids = lastRequest().conditions.map((item) => item.id);
    expect(ids).toContain('tight_base');
    expect(ids).not.toContain('near_support');
    expect(chip('Preset')).toHaveTextContent('Custom');

    choose('Preset', 'Support compression');
    await waitForRun(3);
    expect(lastRequest().conditions.map((item) => item.id)).toEqual(['max_price', 'min_average_value', 'tight_base']);
    expect(lastRequest().useBroker).toBe(false);
    expect(chip('Broker')).toHaveTextContent('Off');
  });

  it('keeps the FCA board modes in one slot', async () => {
    renderRadar();
    await waitForRun();
    choose('Board', 'Exclude FCA');
    await waitForRun(2);
    choose('Board', 'FCA only');
    await waitForRun(3);
    const ids = lastRequest().conditions.map((item) => item.id);
    expect(ids).toContain('fca_only');
    expect(ids).not.toContain('exclude_fca');
  });

  it('configures a specific broker, net-buy floor and period inside the Broker slot', async () => {
    renderRadar();
    await waitForRun();
    fireEvent.click(chip('Broker'));
    fireEvent.change(screen.getByLabelText('Who'), { target: { value: 'code' } });
    fireEvent.change(screen.getByLabelText('Broker code'), { target: { value: 'cc' } });
    fireEvent.change(screen.getByLabelText('Net buy at least'), { target: { value: '2500000000' } });
    fireEvent.change(screen.getByLabelText('Over'), { target: { value: '14d' } });

    await waitFor(() => expect(lastRequest()).toEqual(expect.objectContaining({
      brokerCode: 'CC',
      minBrokerAccumulation: 2_500_000_000,
      brokerPreset: '14d',
    })));
    expect(lastRequest()).not.toHaveProperty('brokerSessions');
    expect(chip('Broker')).toHaveTextContent('CC · ≥ 2.5B · 14D');
  });

  it('waits for a start date before screening a custom broker period', async () => {
    renderRadar();
    await waitForRun();
    fireEvent.click(chip('As of'));
    fireEvent.change(screen.getByLabelText('Analysis date'), { target: { value: '2026-07-31' } });
    fireEvent.click(chip('Broker'));
    fireEvent.change(screen.getByLabelText('Over'), { target: { value: 'custom' } });
    expect(await screen.findByText('Pick a start date for the custom broker period.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Starting'), { target: { value: '2026-07-01' } });
    await waitFor(() => expect(lastRequest()).toEqual(expect.objectContaining({
      brokerPreset: 'custom', brokerFrom: '2026-07-01', asOf: '2026-07-31',
    })));
  });

  it('adds the volume and IHSG confirmations from their own slots', async () => {
    renderRadar();
    await waitForRun();
    choose('Volume', 'vs 10-day average');
    fireEvent.click(screen.getByRole('button', { name: 'Beats IHSG' }));
    await waitFor(() => expect(lastRequest().conditions).toEqual(expect.arrayContaining([
      { id: 'volume_breakout_baseline', value: 'MA10' },
      { id: 'outperforming_ihsg', value: true },
    ])));
    expect(screen.getByRole('button', { name: 'Beats IHSG' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not screen when every filter is off', async () => {
    renderRadar();
    await waitForRun();
    fireEvent.click(chip('Price'));
    fireEvent.change(screen.getByLabelText('Max price'), { target: { value: '' } });
    fireEvent.blur(screen.getByLabelText('Max price'));
    choose('Liquidity', 'Any');
    choose('Setup', 'Any');
    fireEvent.click(chip('Broker'));
    fireEvent.change(screen.getByLabelText('Who'), { target: { value: 'off' } });

    expect(await screen.findByText('Turn on at least one filter.')).toBeInTheDocument();
    const calls = getRadarScout.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(getRadarScout).toHaveBeenCalledTimes(calls);
  });

  it('labels setup-only rankings and shows support evidence for them', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate()], ranking: 'structure' }));
    renderRadar();
    expect(await screen.findByText('Ranked by setup quality')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Support / range' })).toBeInTheDocument();
  });

  it('renders the selected broker instead of an unrelated lead broker', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate({
      broker: {
        observedSessions: 5,
        expectedSessions: 5,
        lead: { code: 'AK', netValue: 10_000_000_000, buySessions: 5, sellSessions: 0 },
        focus: { code: 'CC', netValue: 4_000_000_000, buySessions: 4, sellSessions: 1 },
        second: { code: 'CC', netValue: 4_000_000_000 },
        leadToSecondRatio: 2.5,
        leadSharePct: 60,
        focusSharePct: 24,
      },
    })] }));
    renderRadar();
    expect(await screen.findByText(/CC · Rp4\.0B/)).toBeInTheDocument();
    expect(screen.queryByText(/AK · Rp10\.0B/)).not.toBeInTheDocument();
  });

  it('renders the evidence band as a signal-strength badge on every qualified row', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate({ evidenceBand: 'medium' })] }));
    renderRadar();
    expect(await screen.findByText('Medium signal')).toBeInTheDocument();
  });

  it('renders the score breakdown behind the row disclosure without dropping it', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: [scoutCandidate({ scoreBreakdown: { broker: 41, supportCompression: 19 } })],
    }));
    renderRadar();

    expect(await screen.findByText('AHAP')).toBeInTheDocument();
    expect(screen.queryByText('41')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show AHAP evidence' }));
    expect(within(screen.getByLabelText('Score breakdown')).getByText('Broker')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.getByText('Support Compression')).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();
  });

  it('keeps near-miss stocks visually separate and shows the failed condition', async () => {
    const nearMiss = scoutCandidate({
      ticker: 'ELSA',
      evidenceBand: 'low',
      failedCondition: 'liquidity floor ≥ Rp500M/day',
      scoreBreakdown: { broker: 20, liquidity: null },
      reasons: [],
      risks: ['thin average value'],
    });
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate()], nearMisses: [nearMiss] }));
    renderRadar();

    expect(await screen.findByText('Almost Matched')).toBeInTheDocument();
    expect(screen.getByText('ELSA')).toBeInTheDocument();
    expect(screen.getByText('Missed: liquidity floor ≥ Rp500M/day')).toBeInTheDocument();

    const qualifiedTable = screen.getByRole('table', { name: 'Scout candidates' });
    const nearMissTable = screen.getByRole('table', { name: 'Almost matched stocks' });
    expect(nearMissTable.querySelectorAll('thead th').length).toBeGreaterThan(qualifiedTable.querySelectorAll('thead th').length);

    fireEvent.click(screen.getByRole('button', { name: 'Show ELSA evidence' }));
    expect(screen.getByText('thin average value')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Score breakdown')).getByText('Broker')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders every match up to the 100-result ceiling', async () => {
    const manyCandidates = Array.from({ length: 100 }, (_, index) => scoutCandidate({
      ticker: `T${String(index).padStart(3, '0')}`,
      rank: index + 1,
    }));
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: manyCandidates,
      coverage: { evaluated: 900, matched: 100, returned: 100, nearMisses: 0 },
    }));
    renderRadar();

    expect(await screen.findByText('T099')).toBeInTheDocument();
    expect(screen.getByText('T000')).toBeInTheDocument();
    expect(screen.getByText('Showing 100')).toBeInTheDocument();
    expect(lastRequest()).toEqual(expect.objectContaining({ limit: 100 }));
  });

  it('preserves the new-tab Analysis / Broker Flow handoffs, carrying the broker window', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate()] }));
    renderRadar();

    fireEvent.click(await screen.findByRole('button', { name: 'Open AHAP analysis' }));
    expect(openSpy.mock.calls.at(-1)[0]).toBe('/workbench?ticker=AHAP');

    fireEvent.click(screen.getByRole('button', { name: 'Open AHAP broker flow' }));
    expect(openSpy.mock.calls.at(-1)[0]).toContain('/broker-intelligence?');
    expect(openSpy.mock.calls.at(-1)[0]).toContain('ticker=AHAP');
    expect(openSpy.mock.calls.at(-1)[0]).toContain('preset=7d');

    openSpy.mockRestore();
  });

  it('reports how far a near miss fell short, not just which condition it failed', async () => {
    const nearMiss = scoutCandidate({
      ticker: 'ELSA',
      evidenceBand: 'low',
      failedCondition: 'min_average_value',
      failedDetail: {
        id: 'min_average_value',
        label: 'Liquidity floor',
        unit: 'IDR',
        comparison: 'min',
        available: true,
        expected: 500_000_000,
        observed: 40_000_000,
        gap: 460_000_000,
        gapPct: 92,
        reason: 'threshold',
      },
    });
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [], nearMisses: [nearMiss] }));
    renderRadar();

    expect(await screen.findByText('Liquidity floor')).toBeInTheDocument();
    expect(screen.getByText(/Rp40M vs Rp500M · off by Rp460M \(92%\)/)).toBeInTheDocument();
  });

  it('marks a narrow miss apart from a wide one so it reads as a tuning decision', async () => {
    const detail = (gapPct) => ({
      id: 'min_lead_ratio',
      label: 'Minimum lead-to-second ratio',
      unit: 'x',
      comparison: 'min',
      available: true,
      expected: 4,
      observed: 3.6,
      gap: 0.4,
      gapPct,
      reason: 'threshold',
    });
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: [],
      nearMisses: [
        scoutCandidate({ ticker: 'ELSA', rank: 1, failedDetail: detail(10) }),
        scoutCandidate({ ticker: 'BBCA', rank: 2, failedDetail: detail(60) }),
      ],
    }));
    renderRadar();

    const rows = await screen.findAllByText('Minimum lead-to-second ratio');
    expect(rows[0].closest('.scout-near-miss__missed')).toHaveClass('scout-near-miss__missed--close');
    expect(rows[1].closest('.scout-near-miss__missed')).not.toHaveClass('scout-near-miss__missed--close');
  });

  it('reports observed trading sessions without treating weekends as missing data', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: [scoutCandidate()],
      asOf: { requestedBrokerSessions: 7, brokerSessions: 5 },
    }));
    renderRadar();

    expect(await screen.findByText(/5 trading days/)).toBeInTheDocument();
    expect(screen.queryByText(/sessions available/)).not.toBeInTheDocument();
  });
});
