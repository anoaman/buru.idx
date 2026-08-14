import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Keterbukaan from './Keterbukaan.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getDisclosures: vi.fn(),
  getDisclosureDetail: vi.fn(),
  getDisclosureTimeline: vi.fn(),
  getDisclosureAnomalies: vi.fn(),
  getCollectorHealth: vi.fn(),
}));

import {
  getCollectorHealth,
  getDisclosureAnomalies,
  getDisclosureDetail,
  getDisclosureTimeline,
  getDisclosures,
} from '../../lib/api/client.js';

const EVENT = {
  eventId: 'div-1',
  ticker: 'BBCA',
  category: 'dividend',
  title: 'Dividend notice',
  publishedAt: '2026-08-01T03:00:00.000Z',
  sourceUrl: 'https://www.idx.co.id/news/div-1',
  groupId: 'grp-1',
  eventFamily: 'dividend',
  hasCorrection: true,
  correctionOf: 'div-0',
};

function page(items, extra = {}) {
  return { success: true, data: { items, nextCursor: null, total: items.length, ...extra } };
}

describe('Keterbukaan', () => {
  beforeEach(() => {
    getCollectorHealth.mockResolvedValue({
      success: true,
      data: {
        available: true,
        status: 'ready',
        feeds: [{ feed: 'idx-disclosure', lastSuccessAt: '2026-08-14T01:00:00.000Z' }],
      },
    });
    getDisclosures.mockResolvedValue(page([EVENT]));
    getDisclosureAnomalies.mockResolvedValue(page([{
      anomalyId: 'a-1',
      ticker: 'BBCA',
      groupId: 'grp-1',
      type: 'correction',
      severity: 'high',
      confidence: 0.9,
      reason: 'Later filing corrects the original dividend.',
      ruleVersion: 'disclosure-anomaly-v1',
      evidence: { page: 2, snippet: 'koreksi atas pengumuman', officialUrl: 'https://www.idx.co.id/news/div-1' },
    }]));
    getDisclosureDetail.mockResolvedValue({
      success: true,
      data: {
        ...EVENT,
        signals: [{
          type: 'correction',
          severity: 'high',
          confidence: 0.9,
          reason: 'Later filing corrects the original dividend.',
          ruleVersion: 'disclosure-anomaly-v1',
          evidence: { page: 2, snippet: 'koreksi atas pengumuman', officialUrl: 'https://www.idx.co.id/news/div-1' },
        }],
        facts: [{
          key: 'dividend_per_share',
          valueText: '150',
          unit: 'IDR',
          confidence: 0.8,
          evidence: { page: 1, snippet: 'DPS Rp150' },
        }],
        documents: [{
          documentId: 9,
          sourceUrl: 'https://www.idx.co.id/news/div-1.pdf',
          mimeType: 'application/pdf',
          downloadStatus: 'stored',
          observedAt: '2026-08-01T03:05:00.000Z',
        }],
        correctionChain: [
          { eventId: 'div-0', role: 'original' },
          { eventId: 'div-1', role: 'current' },
        ],
      },
    });
    getDisclosureTimeline.mockResolvedValue(page([{
      groupId: 'grp-1',
      ticker: 'BBCA',
      eventFamily: 'dividend',
      hasCorrection: true,
      members: [
        { eventId: 'div-0', role: 'original', title: 'Original dividend', publishedAt: '2026-07-20T03:00:00.000Z', sourceUrl: 'https://www.idx.co.id/news/div-0' },
        { eventId: 'div-1', role: 'correction', title: 'Dividend notice', publishedAt: '2026-08-01T03:00:00.000Z', sourceUrl: 'https://www.idx.co.id/news/div-1' },
      ],
      anomalies: [],
    }]));
  });

  it('shows loading then the feed, collector freshness, and official source', async () => {
    let resolveFeed;
    getDisclosures.mockReturnValue(new Promise((resolve) => { resolveFeed = resolve; }));
    render(<Keterbukaan />);
    expect(screen.getByTestId('keterbukaan-loading')).toBeInTheDocument();
    resolveFeed(page([EVENT]));
    expect(await screen.findByTestId('disclosure-card')).toBeInTheDocument();
    expect(screen.getByTestId('collector-health')).toHaveTextContent(/Collector ready/i);
    fireEvent.click(screen.getByTestId('disclosure-card'));
    const links = await screen.findAllByTestId('official-link');
    expect(links[0]).toHaveAttribute('href', 'https://www.idx.co.id/news/div-1');
    expect(screen.getByTestId('signal-evidence')).toHaveTextContent('koreksi atas pengumuman');
    expect(screen.getByTestId('signal-evidence')).toHaveTextContent('Page 2');
    expect(screen.getByTestId('correction-timeline')).toHaveTextContent('Original dividend');
    expect(screen.getByTestId('document-meta')).toHaveTextContent('application/pdf');
    expect(screen.queryByText(/\/home\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/idx\.db/)).not.toBeInTheDocument();
  });

  it('does not render filesystem paths as official links', async () => {
    getDisclosureDetail.mockResolvedValue({
      success: true,
      data: {
        ...EVENT,
        sourceUrl: '/home/kibz66/.openclaw/workspace/trading-db/docs/secret.pdf',
        signals: [],
        documents: [{ documentId: 1, sourceUrl: 'file:///tmp/idx.db' }],
        correctionChain: [],
      },
    });
    getDisclosureTimeline.mockResolvedValue(page([{
      groupId: 'grp-1',
      members: [{ eventId: 'div-1', role: 'current', title: 'Dividend notice', sourceUrl: '/var/lib/idx.db' }],
      anomalies: [],
    }]));
    render(<Keterbukaan />);
    fireEvent.click(await screen.findByTestId('disclosure-card'));
    await screen.findByTestId('document-meta');
    expect(screen.queryByTestId('official-link')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('official-link-missing').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /\/home\// })).not.toBeInTheDocument();
  });

  it('renders empty, error, unavailable, and partial states', async () => {
    getDisclosures.mockResolvedValueOnce(page([]));
    const { unmount } = render(<Keterbukaan />);
    expect(await screen.findByText('No disclosures')).toBeInTheDocument();
    unmount();

    getDisclosures.mockResolvedValueOnce({ success: false, error: 'upstream timeout' });
    const errorView = render(<Keterbukaan />);
    expect(await screen.findByText('Could not load disclosures')).toBeInTheDocument();
    expect(screen.getByText('upstream timeout')).toBeInTheDocument();
    errorView.unmount();

    getDisclosures.mockResolvedValueOnce({
      success: true,
      data: { available: false, status: 'unavailable', reason: 'disclosure tables are not present.' },
    });
    const unavailable = render(<Keterbukaan />);
    expect(await screen.findByText('Disclosures unavailable')).toBeInTheDocument();
    unavailable.unmount();

    getDisclosures.mockResolvedValueOnce(page([EVENT], { partial: true }));
    render(<Keterbukaan />);
    expect(await screen.findByTestId('partial-data')).toBeInTheDocument();
  });

  it('sends validated ticker, date, category, severity, and signal filters', async () => {
    render(<Keterbukaan />);
    await screen.findByTestId('disclosure-card');
    expect(screen.getByLabelText('Signal').textContent).toMatch(/Rights issue/);
    expect(screen.getByLabelText('Signal').textContent).toMatch(/UMA/);
    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'bbca' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'dividend' } });
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('Signal'), { target: { value: 'uma' } });
    fireEvent.submit(screen.getByTestId('keterbukaan-filters'));
    await waitFor(() => {
      expect(getDisclosures).toHaveBeenCalledWith(expect.objectContaining({
        ticker: 'BBCA',
        category: 'dividend',
        severity: 'high',
        signal: 'uma',
        limit: 25,
      }));
    });
  });

  it('renders a retryable error when disclosure requests reject', async () => {
    getDisclosures.mockImplementation(() => Promise.reject(new Error('network down')));
    getDisclosureAnomalies.mockImplementation(() => Promise.reject(new Error('network down')));
    getCollectorHealth.mockImplementation(() => Promise.reject(new Error('network down')));
    render(<Keterbukaan />);
    expect(await screen.findByText('Could not load disclosures')).toBeInTheDocument();
    expect(screen.getByText('Disclosure feed is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByTestId('collector-unavailable')).toBeInTheDocument();
    getDisclosures.mockResolvedValue(page([EVENT]));
    getDisclosureAnomalies.mockResolvedValue(page([]));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByTestId('disclosure-card')).toBeInTheDocument();
  });

  it('renders a retryable error when disclosure detail rejects', async () => {
    getDisclosureDetail.mockImplementation(() => Promise.reject(new Error('network down')));
    render(<Keterbukaan />);
    fireEvent.click(await screen.findByTestId('disclosure-card'));
    expect(await screen.findByText('Detail unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    getDisclosureDetail.mockResolvedValue({
      success: true,
      data: { ...EVENT, signals: [], facts: [], documents: [], correctionChain: [] },
    });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Dividend notice')).toBeInTheDocument();
  });
});
