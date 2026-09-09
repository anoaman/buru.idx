import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AnalysisProvider } from '../../components/AnalysisContext.jsx';
import Cases from './Cases.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getMonitored: vi.fn(),
  removeMonitored: vi.fn(),
}));

import { getMonitored, removeMonitored } from '../../lib/api/client.js';

function caseItem(overrides = {}) {
  return {
    id: 7,
    ticker: 'bbri',
    status: 'watching',
    thesis: 'Compression above reclaimed support',
    triggerPrice: 4550,
    invalidationPrice: 4180,
    snapshot: {
      lane: 'first-liner',
      score: 71.5,
      confidence: 'high',
      reasons: ['compression resolved on rising volume'],
      risks: ['broker cache is stale as of 2026-08-01'],
      levels: { trigger: 4550, invalidation: 4180 },
      freshness: { priceDate: '2026-08-05' },
    },
    monitoring: {
      state: 'no_material_change',
      material: false,
      snapshotStale: false,
      snapshotAgeDays: 1.2,
      current: null,
    },
    addedAt: '2026-08-06T04:00:00.000Z',
    updatedAt: '2026-08-06T04:00:00.000Z',
    ...overrides,
  };
}

function renderCases() {
  return render(
    <MemoryRouter initialEntries={['/cases']}>
      <AnalysisProvider>
        <Cases />
      </AnalysisProvider>
    </MemoryRouter>,
  );
}

describe('Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the frozen thesis, trigger and invalidation of a saved case', async () => {
    getMonitored.mockResolvedValue({ success: true, data: { items: [caseItem()] } });

    renderCases();

    expect(await screen.findByText('BBRI')).toBeInTheDocument();
    expect(screen.getByText('Compression above reclaimed support')).toBeInTheDocument();
    expect(screen.getByText('4.550')).toBeInTheDocument();
    expect(screen.getByText('4.180')).toBeInTheDocument();
    expect(screen.getByText('71.5')).toBeInTheDocument();
    expect(screen.getByText('Against: broker cache is stale as of 2026-08-01')).toBeInTheDocument();
  });

  it('discloses a material change against the frozen snapshot', async () => {
    getMonitored.mockResolvedValue({
      success: true,
      data: {
        items: [caseItem({
          monitoring: {
            state: 'meaningful_change',
            material: true,
            snapshotStale: true,
            snapshotAgeDays: 6.4,
            current: {
              runId: 42,
              scannedAt: '2026-08-10T02:15:00.000Z',
              lane: 'second-liner',
              eligible: true,
              score: 58.5,
              confidence: 'medium',
              scoreDelta: -13,
              reasons: [],
              risks: [],
            },
          },
        })],
      },
    });

    renderCases();

    expect(await screen.findByText('Changed since freeze')).toBeInTheDocument();
    expect(screen.getByText('-13.0')).toBeInTheDocument();
    expect(screen.getByText('Analysis is stale · 6.4d old')).toBeInTheDocument();
    expect(screen.getByText('1 changed since freeze')).toBeInTheDocument();
    expect(screen.getByText('1 on stale evidence')).toBeInTheDocument();
  });

  it('distinguishes a case absent from the latest scan from an unchanged one', async () => {
    getMonitored.mockResolvedValue({
      success: true,
      data: {
        items: [caseItem({
          monitoring: {
            state: 'unavailable',
            material: false,
            snapshotStale: null,
            snapshotAgeDays: null,
            current: null,
          },
        })],
      },
    });

    renderCases();

    expect(await screen.findByText('Not in latest scan')).toBeInTheDocument();
    expect(screen.getByText('Analysis date unavailable')).toBeInTheDocument();
  });

  it('falls back to the frozen reason when no thesis was recorded', async () => {
    getMonitored.mockResolvedValue({
      success: true,
      data: { items: [caseItem({ thesis: null })] },
    });

    renderCases();

    expect(await screen.findByText('compression resolved on rising volume')).toBeInTheDocument();
  });

  it('renders an empty state when nothing is being tracked', async () => {
    getMonitored.mockResolvedValue({ success: true, data: { items: [] } });
    renderCases();
    expect(await screen.findByText('Nothing monitored yet')).toBeInTheDocument();
    expect(screen.getByText(/Freeze a setup from Stock Analysis/i)).toBeInTheDocument();
  });

  it('reports a failed read and retries on demand', async () => {
    getMonitored.mockResolvedValueOnce({ success: false, error: 'case store unavailable' });
    getMonitored.mockResolvedValueOnce({ success: true, data: { items: [caseItem()] } });

    renderCases();

    expect(await screen.findByText('case store unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('BBRI')).toBeInTheDocument());
  });

  it('does not hang on a rejected request', async () => {
    getMonitored.mockRejectedValue(new Error('network down'));
    renderCases();
    expect(await screen.findByText('network down')).toBeInTheDocument();
    expect(screen.queryByText('Loading cases…')).not.toBeInTheDocument();
  });

  it('removes an owned monitored setup and refreshes the list', async () => {
    getMonitored
      .mockResolvedValueOnce({ success: true, data: { items: [caseItem()] } })
      .mockResolvedValueOnce({ success: true, data: { items: [] } });
    removeMonitored.mockResolvedValue({ success: true });
    renderCases();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove BBRI from Monitored' }));
    await waitFor(() => expect(removeMonitored).toHaveBeenCalledWith(7));
    expect(await screen.findByText('Nothing monitored yet')).toBeInTheDocument();
  });
});
