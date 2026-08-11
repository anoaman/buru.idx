import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AnalysisProvider } from '../../components/AnalysisContext.jsx';
import Radar from './Radar.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getOpportunities: vi.fn(),
  getRadarScout: vi.fn(),
}));

import { getOpportunities, getRadarScout } from '../../lib/api/client.js';

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

function renderRadar() {
  return render(
    <MemoryRouter initialEntries={['/radar']}>
      <AnalysisProvider>
        <Radar />
      </AnalysisProvider>
    </MemoryRouter>,
  );
}

describe('Radar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ranked candidates with counter-evidence and scan provenance', async () => {
    getOpportunities.mockResolvedValue({
      success: true,
      data: { run: RUN, opportunities: [candidate()] },
    });

    renderRadar();

    expect(await screen.findByText('BBRI')).toBeInTheDocument();
    expect(screen.getByText('Scan #41')).toBeInTheDocument();
    expect(screen.getByText('2026-08-07')).toBeInTheDocument();
    expect(screen.getByText('2 shortlisted / 96 eligible / 812 seen')).toBeInTheDocument();
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
    // Degraded sources are marked with a class that out-ranks the `.radar-row__*
    // span` descendant rules; a text-* utility alone would lose the cascade.
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
    expect(screen.getByText('No recorded counter-evidence')).toBeInTheDocument();
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

  it('runs deterministic Scout recipes and renders the returned evidence', async () => {
    getOpportunities.mockResolvedValue({ success: true, data: { run: RUN, opportunities: [] } });
    getRadarScout.mockResolvedValue({
      success: true,
      data: {
        recipe: { id: 'quiet_accumulation', label: 'Quiet Accumulation Near Support' },
        options: { brokerSessions: 7 },
        asOf: { priceDate: '2026-08-10', brokerFrom: '2026-07-31', brokerTo: '2026-08-10', brokerSessions: 7 },
        coverage: { evaluated: 900, matched: 1, returned: 1 },
        candidates: [{
          ticker: 'AHAP', name: 'Asuransi Harta Aman Pratama Tbk', board: 'Development', rank: 1, score: 88.4,
          price: { lastPrice: 101, priceDate: '2026-08-10', support: 98, supportTouches: 4, distanceFromSupportPct: 3.06, consolidationRangePct: 7.1, recentAtrPct: 2, priorAtrPct: 3, volatilityContracting: true, averageValue: 1_100_000_000, zeroVolumeSessions: 0 },
          broker: { observedSessions: 7, expectedSessions: 7, lead: { code: 'CC', netValue: 1_200_000_000, buySessions: 6, sellSessions: 1 }, second: { code: 'YP', netValue: 300_000_000 }, leadToSecondRatio: 4, leadSharePct: 58 },
          reasons: ['CC accumulated Rp1200M, 4.0× YP, across 6/7 sessions.'],
          risks: ['CC distributed in 1 observed session.'],
        }],
        disclosures: ['Observed flow is not a holdings ledger.'],
      },
    });

    renderRadar();
    fireEvent.click(screen.getByRole('tab', { name: 'Scout' }));
    expect(screen.getByText(/Combines persistent broker concentration/)).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum price')).toHaveValue('1,000');
    expect(screen.getByLabelText('Minimum avg value')).toHaveValue('500,000,000');
    fireEvent.click(screen.getByLabelText('Broker concentration'));
    expect(screen.getByLabelText('Broker sessions')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Run Scout' }));

    expect(await screen.findByText('AHAP')).toBeInTheDocument();
    expect(screen.getByText('CC accumulated Rp1200M, 4.0× YP, across 6/7 sessions.')).toBeInTheDocument();
    expect(screen.getByText('CC distributed in 1 observed session.')).toBeInTheDocument();
    expect(screen.getByText('1 matched / 900 evaluated')).toBeInTheDocument();
    expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({ recipe: 'quiet_accumulation', brokerSessions: 7, useBroker: false }));
  });
});
