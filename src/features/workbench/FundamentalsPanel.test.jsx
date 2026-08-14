import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FundamentalsPanel, groupStatementsByPeriod } from './FundamentalsPanel.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getFundamentalStatements: vi.fn(),
}));

import { getFundamentalStatements } from '../../lib/api/client.js';

const PERIODS = [
  {
    periodLabel: 'FY2025',
    parserStatus: 'ok',
    parserMethod: 'rules',
    parserVersion: 'statement-v1',
    sourceUrl: 'https://www.idx.co.id/static/fs-2025.pdf',
    facts: [
      {
        statementType: 'income_statement',
        fieldKey: 'revenue',
        valueNumeric: 1000,
        unit: 'IDR bn',
        confidence: 0.92,
        evidence: { page: 4, snippet: 'Pendapatan usaha 1.000' },
      },
    ],
  },
  {
    periodLabel: 'FY2024',
    parserStatus: 'partial',
    sourceUrl: 'https://www.idx.co.id/static/fs-2024.pdf',
    facts: [
      {
        statementType: 'balance_sheet',
        fieldKey: 'total_assets',
        valueNumeric: 5000,
        unit: 'IDR bn',
        confidence: 0.7,
        evidence: { page: 8, snippet: 'Jumlah aset 5.000' },
      },
      {
        statementType: 'income_statement',
        fieldKey: 'pe_ratio',
        valueNumeric: 12.4,
        valueKind: 'inferred',
      },
    ],
  },
];

describe('FundamentalsPanel', () => {
  beforeEach(() => {
    getFundamentalStatements.mockResolvedValue({
      success: true,
      data: { items: PERIODS, total: 2, partial: false },
    });
  });

  it('separates statement periods and drops inferred values', async () => {
    render(<FundamentalsPanel ticker="BBCA" />);
    const periods = await screen.findAllByTestId('statement-period');
    expect(periods).toHaveLength(2);
    expect(screen.getByText('FY2025')).toBeInTheDocument();
    expect(screen.getByText('FY2024')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
    expect(screen.getByText('total_assets')).toBeInTheDocument();
    expect(screen.queryByText('pe_ratio')).not.toBeInTheDocument();
    expect(screen.queryByText('12.4')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('fundamentals-official-link')[0]).toHaveAttribute(
      'href',
      'https://www.idx.co.id/static/fs-2025.pdf',
    );
    expect(screen.getAllByTestId('fundamentals-evidence')[0]).toHaveTextContent('Pendapatan usaha 1.000');
    expect(screen.getByText(/Parser ok/)).toBeInTheDocument();
    expect(screen.getByText(/confidence 0.92/i)).toBeInTheDocument();
  });

  it('renders loading, empty, error, unavailable, and partial states', async () => {
    getFundamentalStatements.mockReturnValueOnce(new Promise(() => {}));
    const loading = render(<FundamentalsPanel ticker="BBCA" />);
    expect(screen.getByTestId('fundamentals-loading')).toBeInTheDocument();
    loading.unmount();

    getFundamentalStatements.mockResolvedValueOnce({ success: true, data: { items: [], total: 0 } });
    const empty = render(<FundamentalsPanel ticker="BBCA" />);
    expect(await screen.findByText('No statement periods')).toBeInTheDocument();
    empty.unmount();

    getFundamentalStatements.mockResolvedValueOnce({ success: false, error: 'statements offline' });
    const errored = render(<FundamentalsPanel ticker="BBCA" />);
    expect(await screen.findByText('Fundamentals unavailable')).toBeInTheDocument();
    expect(screen.getByText('statements offline')).toBeInTheDocument();
    errored.unmount();

    getFundamentalStatements.mockResolvedValueOnce({
      success: true,
      data: { available: false, status: 'unavailable', reason: 'fundamentals tables are not present.' },
    });
    const unavailable = render(<FundamentalsPanel ticker="BBCA" />);
    expect(await screen.findByText('Fundamentals unavailable')).toBeInTheDocument();
    unavailable.unmount();

    getFundamentalStatements.mockResolvedValueOnce({
      success: true,
      data: { items: PERIODS, partial: true },
    });
    render(<FundamentalsPanel ticker="BBCA" />);
    expect(await screen.findByTestId('fundamentals-partial')).toBeInTheDocument();
  });

  it('groups flat facts by period and never keeps inferred rows', () => {
    const grouped = groupStatementsByPeriod([
      { periodLabel: 'FY2025', fieldKey: 'revenue', valueNumeric: 1 },
      { periodLabel: 'FY2025', fieldKey: 'pe', valueKind: 'ratio', valueNumeric: 10 },
      { periodLabel: 'FY2024', fieldKey: 'assets', valueNumeric: 2 },
    ]);
    expect(grouped.map((row) => row.period)).toEqual(['FY2025', 'FY2024']);
    expect(grouped[0].facts.map((row) => row.fieldKey)).toEqual(['revenue']);
  });

  it('does not merge restated flat facts that share a period label', () => {
    const grouped = groupStatementsByPeriod([
      { periodLabel: 'FY2025', eventId: 'lk-restated', title: 'Restated', fieldKey: 'revenue', valueNumeric: 2 },
      { periodLabel: 'FY2025', eventId: 'lk-original', title: 'Original', fieldKey: 'revenue', valueNumeric: 1 },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped.map((row) => row.eventId)).toEqual(['lk-restated', 'lk-original']);
    expect(grouped.map((row) => row.facts[0].valueNumeric)).toEqual([2, 1]);
  });

  it('keeps two filings for the same period as separate source sections', async () => {
    getFundamentalStatements.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            periodLabel: 'FY2025',
            eventId: 'bbca-lk-fy2025-restated',
            title: 'Restated financial statements FY2025',
            facts: [{ statementType: 'income_statement', fieldKey: 'revenue', valueNumeric: 110000 }],
          },
          {
            periodLabel: 'FY2025',
            eventId: 'bbca-lk-fy2025',
            title: 'Financial statements FY2025',
            facts: [{ statementType: 'income_statement', fieldKey: 'revenue', valueNumeric: 108500 }],
          },
        ],
        total: 2,
      },
    });
    render(<FundamentalsPanel ticker="BBCA" />);
    expect(await screen.findAllByTestId('statement-period')).toHaveLength(2);
    expect(screen.getByText('Restated financial statements FY2025')).toBeInTheDocument();
    expect(screen.getByText('Financial statements FY2025')).toBeInTheDocument();
    expect(screen.getByText('110000')).toBeInTheDocument();
    expect(screen.getByText('108500')).toBeInTheDocument();
  });

  it('follows statement pages so periods are not truncated', async () => {
    getFundamentalStatements.mockImplementation(async ({ cursor = 0 } = {}) => {
      if (cursor === 0) {
        return {
          success: true,
          data: { items: [PERIODS[0]], total: 2, nextCursor: 1, limit: 1, cursor: 0 },
        };
      }
      return {
        success: true,
        data: { items: [PERIODS[1]], total: 2, nextCursor: null, limit: 1, cursor: 1 },
      };
    });
    render(<FundamentalsPanel ticker="BBCA" />);
    expect(await screen.findByText('FY2025')).toBeInTheDocument();
    expect(await screen.findByText('FY2024')).toBeInTheDocument();
    expect(getFundamentalStatements).toHaveBeenCalledWith({
      ticker: 'BBCA',
      limit: 50,
      cursor: 0,
    });
    expect(getFundamentalStatements).toHaveBeenCalledWith({
      ticker: 'BBCA',
      limit: 50,
      cursor: 1,
    });
  });

  it('renders a retryable error when statement requests reject', async () => {
    getFundamentalStatements.mockImplementation(() => Promise.reject(new Error('network down')));
    render(<FundamentalsPanel ticker="BBCA" />);
    expect(await screen.findByText('Fundamentals unavailable')).toBeInTheDocument();
    expect(screen.getByText('network down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    getFundamentalStatements.mockResolvedValue({
      success: true,
      data: { items: PERIODS, total: 2, partial: false },
    });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByTestId('fundamentals-panel')).toBeInTheDocument();
  });
});
