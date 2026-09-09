import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      { id: 'min_lead_net_buy', label: 'Lead broker net buy', category: 'Confirmation', type: 'number', comparison: 'at_least', unit: 'IDR', defaultValue: 1000000000, min: 0, max: 1000000000000, step: 100000000 },
    ],
    templates: {
      quiet_accumulation: [{ id: 'max_price', value: 1000 }],
      dominant_broker: [{ id: 'min_lead_net_buy', value: 1000000000 }],
      support_compression: [{ id: 'max_price', value: 1500 }],
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
      second: { code: 'YP', netValue: 300_000_000 },
      leadToSecondRatio: 4, leadSharePct: 58,
    },
    reasons: ['CC accumulated Rp1200M, 4.0× YP, across 6/7 sessions.'],
    risks: ['CC distributed in 1 observed session.'],
    ...overrides,
  };
}

function scoutResponse({ candidates = [], nearMisses = [], coverage, dailyDiff, asOf } = {}) {
  return {
    success: true,
    data: {
      recipe: { id: 'quiet_accumulation', label: 'Quiet Accumulation Near Support' },
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

async function selectQuietTemplate() {
  fireEvent.click(await screen.findByRole('radio', { name: /Quiet accumulation/i }));
}

describe('Radar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getRadarScoutConditions.mockResolvedValue(CONDITION_CATALOG);
  });

  it('runs deterministic Scout recipes and renders the returned evidence behind a disclosure', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate()] }));

    renderRadar();
    await selectQuietTemplate();
    expect(screen.getByLabelText('Maximum price value')).toHaveValue('1,000');
    expect(screen.queryByText(/Range resolution/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Foreign flow divergence/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Capitulation reversal/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    expect(await screen.findByText('AHAP')).toBeInTheDocument();
    expect(screen.getByText('1 matched')).toBeInTheDocument();
    // The dense results row shows primary metrics without the full narrative.
    expect(screen.queryByText('CC accumulated Rp1200M, 4.0× YP, across 6/7 sessions.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show AHAP evidence' }));
    expect(screen.getByText('CC accumulated Rp1200M, 4.0× YP, across 6/7 sessions.')).toBeInTheDocument();
    expect(screen.getByText('CC distributed in 1 observed session.')).toBeInTheDocument();

    expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({ recipe: 'quiet_accumulation', brokerPreset: '7d', conditions: [{ id: 'max_price', value: 1000 }] }));
  });

  it('keeps advanced controls secondary and renders session changes as ticker cards', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: [scoutCandidate()],
      dailyDiff: {
        new: [scoutCandidate({ ticker: 'AHAP' })],
        still: [scoutCandidate({ ticker: 'BBCA', qualificationStreak: 3 })],
        dropped: [scoutCandidate({ ticker: 'ELSA', failedCondition: 'liquidity floor' })],
      },
    }));

    renderRadar();
    await selectQuietTemplate();
    expect(document.querySelector('.scout-advanced')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Exclude FCA/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    const changes = await screen.findByRole('region', { name: 'Daily qualification changes' });
    expect(changes).toHaveTextContent('New1AHAP');
    expect(changes).toHaveTextContent('Still qualified1BBCA3d');
    expect(changes).toHaveTextContent('Dropped1ELSA');
    expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({ conditions: expect.arrayContaining([{ id: 'exclude_fca', value: true }]) }));
  });

  it('submits a custom broker date range through the client', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [] }));

    renderRadar();
    await selectQuietTemplate();
    fireEvent.change(screen.getByLabelText('Broker window'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    await waitFor(() => expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({
      brokerPreset: 'custom',
      brokerFrom: '2026-07-01',
      brokerTo: '2026-07-31',
    })));
    const payload = getRadarScout.mock.calls.at(-1)[0];
    expect(payload).not.toHaveProperty('brokerSessions');
  });

  it('syncs brokerSessions from the named Scout preset', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [] }));

    renderRadar();
    await selectQuietTemplate();
    fireEvent.change(screen.getByLabelText('Broker window'), { target: { value: '14d' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    await waitFor(() => expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({
      brokerPreset: '14d',
      brokerSessions: 14,
    })));
  });

  it('submits the lead-broker minimum once the condition is enabled', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [] }));

    renderRadar();
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('checkbox', { name: /Lead broker net buy/ }));
    fireEvent.change(screen.getByLabelText('Lead broker net buy value'), { target: { value: '2.5B' } });
    fireEvent.blur(screen.getByLabelText('Lead broker net buy value'));
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    await waitFor(() => expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({
      conditions: expect.arrayContaining([{ id: 'min_lead_net_buy', value: 2_500_000_000 }]),
    })));
  });

  it('renders the evidence band as a signal-strength badge on every qualified row', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate({ evidenceBand: 'medium' })] }));

    renderRadar();
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    expect(await screen.findByText('Medium signal')).toBeInTheDocument();
  });

  it('renders the score breakdown behind the row disclosure without dropping it', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: [scoutCandidate({ scoreBreakdown: { broker: 41, supportCompression: 19 } })],
    }));

    renderRadar();
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    expect(await screen.findByText('AHAP')).toBeInTheDocument();
    expect(screen.queryByText('41')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show AHAP evidence' }));
    expect(screen.getByText('Broker')).toBeInTheDocument();
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
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    expect(await screen.findByText('Almost Matched')).toBeInTheDocument();
    expect(screen.getByText('ELSA')).toBeInTheDocument();
    expect(screen.getByText('Missed: liquidity floor ≥ Rp500M/day')).toBeInTheDocument();

    // A near-miss keeps its own table (fewer columns, no lead-broker/support
    // metrics) so it never reads as a qualified row.
    const qualifiedTable = screen.getByRole('table', { name: 'Scout candidates' });
    const nearMissTable = screen.getByRole('table', { name: 'Almost matched stocks' });
    expect(qualifiedTable.querySelectorAll('thead th').length).toBeGreaterThan(nearMissTable.querySelectorAll('thead th').length);

    fireEvent.click(screen.getByRole('button', { name: 'Show ELSA evidence' }));
    expect(screen.getByText('thin average value')).toBeInTheDocument();
    expect(screen.getByText('Broker')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders qualified results at the 100-result limit', async () => {
    const manyCandidates = Array.from({ length: 100 }, (_, index) => scoutCandidate({
      ticker: `T${String(index).padStart(3, '0')}`,
      rank: index + 1,
    }));
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: manyCandidates,
      coverage: { evaluated: 900, matched: 100, returned: 100, nearMisses: 0 },
    }));

    renderRadar();
    await selectQuietTemplate();
    fireEvent.change(screen.getByLabelText('Return'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    expect(await screen.findByText('T099')).toBeInTheDocument();
    expect(screen.getByText('T000')).toBeInTheDocument();
    expect(screen.getByText('Showing 100')).toBeInTheDocument();
    expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('preserves the new-tab Analysis / Broker Flow handoffs, carrying the broker window', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate()] }));

    renderRadar();
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

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
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

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
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    const rows = await screen.findAllByText('Minimum lead-to-second ratio');
    expect(rows[0].closest('.scout-near-miss__missed')).toHaveClass('scout-near-miss__missed--close');
    expect(rows[1].closest('.scout-near-miss__missed')).not.toHaveClass('scout-near-miss__missed--close');
  });

  it('says when the broker archive returned fewer sessions than were asked for', async () => {
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: [scoutCandidate()],
      asOf: { requestedBrokerSessions: 7, brokerSessions: 5 },
    }));

    renderRadar();
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    // Scoring on five sessions while the screen says seven is the kind of quiet
    // degradation that makes a result look stronger than its evidence.
    expect(await screen.findByText(/5 of 7 sessions available/)).toBeInTheDocument();
  });
});
