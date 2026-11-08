import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Home from './Home.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getMarketOverview: vi.fn(),
  getRadarScout: vi.fn(),
}));

import { getMarketOverview, getRadarScout } from '../../lib/api/client.js';

const overview = {
  success: true,
  data: {
    session: { date: '2026-11-06' },
    ihsg: { close: 5050.429, changePct: 0.4, value: 7.83e12, frequency: 1101486 },
    foreignFlow: { net: 109.3e9 },
    indices: [{ symbol: 'LQ45', name: 'LQ45', close: 518.28, changePct: 0.9 }],
    breadth: { available: true, advanced: 229, declined: 437, unchanged: 291 },
    movers: {
      mostActive: [{ code: 'BBCA', name: 'Bank Central Asia Tbk.', price: 5200, changePct: 1.46, value: 817e9, fnet: 219e9 }],
      gainers: [{ code: 'AIMS', name: 'Artha Mahiya', price: 1175, changePct: 25, value: 6.5e9, fnet: 0.25e9 }],
      losers: [],
    },
    home: {
      snapshotDate: '2026-11-06',
      limits: { araCount: 2, arbCount: 1, ara: [{ code: 'AIMS', name: 'Artha Mahiya', price: 1175, changePct: 25, value: 6.5e9 }], arb: [], excludedFca: 6 },
      foreign: { net: 108e9, inflowNames: 300, outflowNames: 280, topInflowSharePct: 68.7, topOutflowSharePct: 40,
        inflow: [{ code: 'BBCA', net: 219e9, changePct: 1.46 }], outflow: [{ code: 'GOTO', net: -127e9, changePct: 0 }] },
      valueBreadth: { total: 7.8e12, advancingValue: 3.6e12, decliningValue: 3.2e12, unchangedValue: 1e12 },
      trends: {
        ihsg: { d1: 0.4, d5: -0.13, d20: -17.1 },
        sectors: [
          { symbol: 'IDXENERGY', name: 'Energy', returns: { d1: -1, d5: -3, d20: -20 }, vsIhsg: { d5: -2.9, d20: -2.9 } },
          { symbol: 'IDXFINANCE', name: 'Financials', returns: { d1: 1.5, d5: 2, d20: -10 }, vsIhsg: { d5: 2.1, d20: 7.1 } },
        ],
      },
      ihsgChart: [{ date: '2026-11-05', open: 1, high: 1, low: 1, close: 1, volume: 1 }, { date: '2026-11-06', open: 1, high: 2, low: 1, close: 2, volume: 1 }],
    },
  },
  meta: { freshness: 'fresh' },
};

const scout = { data: { candidates: [
  { ticker: 'SMALL', isFca: false, price: { changePct: 1 }, broker: { lead: { code: 'YP', netValue: 1.2e9 }, leadSharePct: 60 } },
  { ticker: 'ALII', isFca: false, price: { changePct: 4 }, broker: { lead: { code: 'ZP', netValue: 7.56e9 }, leadSharePct: 97.7 } },
] } };

function renderHome() {
  return render(<MemoryRouter initialEntries={['/']}><Home /></MemoryRouter>);
}

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMarketOverview.mockResolvedValue(overview);
    getRadarScout.mockResolvedValue(scout);
  });

  it('leads with a plain read built from the numbers, using the exchange foreign total', async () => {
    renderHome();
    const read = await screen.findByTestId('market-read');
    expect(read).toHaveTextContent('IHSG rose +0.40% to 5,050, but the move was narrow: 437 stocks fell against 229 that rose.');
    expect(read).toHaveTextContent("Foreigners were net buyers of Rp109.3B, and BBCA alone took Rp219B, more than the whole market's net.");
    expect(read).toHaveTextContent('2 stocks closed at ARA and 1 at ARB; over five sessions Financials led IHSG');
    expect(screen.getByText(/Session November 6, 2026/)).toBeInTheDocument();
  });

  it('ranks Bandar today by lead broker net buy and links into Broker Flow', async () => {
    renderHome();
    const panel = await screen.findByRole('region', { name: 'Bandar today' });
    const rows = await within(panel).findAllByRole('row');
    expect(rows[1]).toHaveTextContent('ALII');
    expect(rows[1]).toHaveTextContent('ZP');
    expect(within(rows[1]).getByRole('link', { name: 'ALII' })).toHaveAttribute('href', '/broker-intelligence?preset=latest&lens=stock&ticker=ALII');
    expect(getRadarScout).toHaveBeenCalledWith(expect.objectContaining({ brokerPreset: 'latest', minBrokerAccumulation: 1_000_000_000 }));
  });

  it('shows foreign leaders, sector rotation ranked by 5D lead, and ARA movers', async () => {
    renderHome();
    const flow = await screen.findByRole('region', { name: 'Foreign flow' });
    expect(within(flow).getByRole('link', { name: 'GOTO' })).toHaveAttribute('href', '/workbench?ticker=GOTO');
    const sectors = screen.getByRole('region', { name: 'Sector rotation' });
    expect(within(sectors).getAllByRole('row')[1]).toHaveTextContent('Financials');
    const movers = screen.getByRole('region', { name: 'Movers' });
    fireEvent.click(within(movers).getByRole('tab', { name: /At ARA/ }));
    expect(within(movers).getByRole('link', { name: 'AIMS' })).toBeInTheDocument();
    expect(screen.getByText(/excludes 6 FCA counters/)).toBeInTheDocument();
  });

  it('shows a retryable error when the overview fails', async () => {
    getMarketOverview.mockRejectedValueOnce(new Error('down'));
    renderHome();
    expect(await screen.findByText('Market overview is unavailable')).toBeInTheDocument();
  });
});
