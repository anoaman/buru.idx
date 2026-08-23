import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AnalysisProvider } from '../../components/AnalysisContext.jsx';
import Radar from './Radar.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getOpportunities: vi.fn(),
  getRadarScout: vi.fn(),
  getRadarScoutConditions: vi.fn(),
}));

import { getOpportunities, getRadarScout, getRadarScoutConditions } from '../../lib/api/client.js';

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

const RUN = {
  id: 41,
  scanned_at: '2026-08-10T02:15:00.000Z',
  data_as_of: '2026-08-07',
  universe: 'idx-all',
  config_version: '1.4.0',
  total_seen: 812,
  total_eligible: 96,
  total_shortlisted: 2,
  market_cache_as_of: '2026-08-07',
};

function candidate(overrides = {}) {
  return {
    ticker: 'bbri',
    lane: 'first-liner',
    eligible: true,
    rank: 1,
    score: 74.25,
    dataQuality: 'high',
    confidence: 'high',
    levels: { support: 4200, resistance: 5000, trigger: 4550, invalidation: 4180, netRewardRisk: 2.4 },
    features: { isFca: false },
    reasons: ['compression resolved on rising volume'],
    risks: ['thin traded value raises exit risk'],
    freshness: { priceDate: '2026-08-07', priceAgeDays: 1 },
    ...overrides,
  };
}

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

function scoutResponse({ candidates = [], nearMisses = [], coverage, dailyDiff } = {}) {
  return {
    success: true,
    data: {
      recipe: { id: 'quiet_accumulation', label: 'Quiet Accumulation Near Support' },
      options: { brokerSessions: 7 },
      asOf: { priceDate: '2026-08-10', brokerFrom: '2026-07-31', brokerTo: '2026-08-10', brokerSessions: 7 },
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
  // Market Shortlist tests opt into the second tab; production defaults to Custom Screener.
  fireEvent.click(screen.getByRole('tab', { name: 'Market Shortlist' }));
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

  it('renders ranked candidates with counter-evidence and scan provenance', async () => {
    getOpportunities.mockResolvedValue({
      success: true,
      data: { run: RUN, opportunities: [candidate()] },
    });

    renderRadar();

    expect(await screen.findByText('BBRI')).toBeInTheDocument();
    expect(screen.getByText('August 7, 2026')).toBeInTheDocument();
    expect(screen.getByText('1 stocks')).toBeInTheDocument();
    expect(screen.getByText('How stocks qualify')).toBeInTheDocument();
    expect(screen.queryByText(/Scan #41/)).not.toBeInTheDocument();
    expect(screen.getByText('74.3')).toBeInTheDocument();
    // Risks are the falsifying half of the evidence and must be visible on the row.
    expect(screen.getByText('Against: thin traded value raises exit risk')).toBeInTheDocument();
    expect(screen.getByText('2.40x')).toBeInTheDocument();
  });

  it('labels the backend grade as data quality and never as confidence', async () => {
    getOpportunities.mockResolvedValue({
      success: true,
      data: { run: RUN, opportunities: [candidate({ dataQuality: 'medium', confidence: 'medium' })] },
    });

    renderRadar();

    const grade = await screen.findByText('medium data quality');
    expect(grade).toBeInTheDocument();
    expect(screen.queryByText(/medium confidence/i)).not.toBeInTheDocument();
    // Degraded sources are marked with a class that out-ranks the default
    // secondary-text color; a text-* utility alone would lose the cascade.
    expect(grade).toHaveClass('is-degraded');
  });

  it('survives a candidate with no score, rank, levels or reasons', async () => {
    getOpportunities.mockResolvedValue({
      success: true,
      data: {
        run: RUN,
        opportunities: [candidate({
          ticker: 'ADRO',
          score: null,
          rank: null,
          levels: null,
          reasons: null,
          risks: null,
          dataQuality: null,
          confidence: null,
        })],
      },
    });

    renderRadar();

    expect(await screen.findByText('ADRO')).toBeInTheDocument();
    expect(screen.queryByText('No recorded counter-evidence')).not.toBeInTheDocument();
    expect(screen.getByText('unknown data quality')).toBeInTheDocument();
  });

  it('marks FCA and explicitly gated candidates', async () => {
    getOpportunities.mockResolvedValue({
      success: true,
      data: {
        run: RUN,
        opportunities: [candidate({ features: { isFca: true }, eligible: false })],
      },
    });

    renderRadar();

    expect(await screen.findByText(/first-liner · FCA · gated/)).toBeInTheDocument();
  });

  it('separates an empty shortlist from a missing scan', async () => {
    getOpportunities.mockResolvedValue({
      success: true,
      data: { run: RUN, opportunities: [] },
    });

    const { unmount } = renderRadar();
    expect(await screen.findByText('Scan completed with no candidates')).toBeInTheDocument();
    unmount();

    getOpportunities.mockResolvedValue({ success: true, data: { run: null, opportunities: [] } });
    renderRadar();
    expect(await screen.findByText('No scan has been recorded')).toBeInTheDocument();
  });

  it('filters by lane without dropping the ranking, and can be reset', async () => {
    getOpportunities.mockResolvedValue({
      success: true,
      data: {
        run: RUN,
        opportunities: [
          candidate({ ticker: 'BBRI', lane: 'first-liner', rank: 1 }),
          candidate({ ticker: 'PTBA', lane: 'second-liner', rank: 2 }),
        ],
      },
    });

    renderRadar();

    expect(await screen.findByText('BBRI')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'second-liner' }));
    expect(screen.queryByText('BBRI')).not.toBeInTheDocument();
    expect(screen.getByText('PTBA')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'all (2)' }));
    expect(screen.getByText('BBRI')).toBeInTheDocument();
  });

  it('reports a failed scan read and retries on demand', async () => {
    getOpportunities.mockResolvedValueOnce({ success: false, error: 'scan store unavailable' });
    getOpportunities.mockResolvedValueOnce({
      success: true,
      data: { run: RUN, opportunities: [candidate()] },
    });

    renderRadar();

    expect(await screen.findByText('scan store unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('BBRI')).toBeInTheDocument());
  });

  it('does not hang on a rejected request', async () => {
    getOpportunities.mockRejectedValue(new Error('network down'));
    renderRadar();
    expect(await screen.findByText('network down')).toBeInTheDocument();
    expect(screen.queryByText(/Loading the latest qualified scan/)).not.toBeInTheDocument();
  });

  it('runs deterministic Scout recipes and renders the returned evidence behind a disclosure', async () => {
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate()] }));

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
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
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: [scoutCandidate()],
      dailyDiff: {
        new: [scoutCandidate({ ticker: 'AHAP' })],
        still: [scoutCandidate({ ticker: 'BBCA', qualificationStreak: 3 })],
        dropped: [scoutCandidate({ ticker: 'ELSA', failedCondition: 'liquidity floor' })],
      },
    }));

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
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
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [] }));

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
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
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [] }));

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
    await selectQuietTemplate();
    fireEvent.change(screen.getByLabelText('Broker window'), { target: { value: '14d' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    await waitFor(() => expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({
      brokerPreset: '14d',
      brokerSessions: 14,
    })));
  });

  it('submits the lead-broker minimum once the condition is enabled', async () => {
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [] }));

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
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
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate({ evidenceBand: 'medium' })] }));

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
    await selectQuietTemplate();
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    expect(await screen.findByText('Medium signal')).toBeInTheDocument();
  });

  it('renders the score breakdown behind the row disclosure without dropping it', async () => {
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: [scoutCandidate({ scoreBreakdown: { broker: 41, supportCompression: 19 } })],
    }));

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
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
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
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
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
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
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    const manyCandidates = Array.from({ length: 100 }, (_, index) => scoutCandidate({
      ticker: `T${String(index).padStart(3, '0')}`,
      rank: index + 1,
    }));
    getRadarScout.mockResolvedValue(scoutResponse({
      candidates: manyCandidates,
      coverage: { evaluated: 900, matched: 100, returned: 100, nearMisses: 0 },
    }));

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
    await selectQuietTemplate();
    fireEvent.change(screen.getByLabelText('Return'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Screener' }));

    expect(await screen.findByText('T099')).toBeInTheDocument();
    expect(screen.getByText('T000')).toBeInTheDocument();
    expect(screen.getByText('Showing 100')).toBeInTheDocument();
    expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('preserves the new-tab Analysis / Broker Flow handoffs from both tables', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [candidate()] } });
    getRadarScout.mockResolvedValue(scoutResponse({ candidates: [scoutCandidate()] }));

    renderRadar();

    fireEvent.click(await screen.findByRole('button', { name: 'Open BBRI analysis' }));
    expect(openSpy.mock.calls.at(-1)[0]).toBe('/workbench?ticker=BBRI');
    expect(openSpy.mock.calls.at(-1)[1]).toBe('_blank');

    fireEvent.click(screen.getByRole('button', { name: 'Open BBRI broker flow' }));
    expect(openSpy.mock.calls.at(-1)[0]).toContain('/broker-intelligence?');
    expect(openSpy.mock.calls.at(-1)[0]).toContain('ticker=BBRI');

    fireEvent.click(screen.getByRole('tab', { name: 'Custom Screener' }));
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
});
