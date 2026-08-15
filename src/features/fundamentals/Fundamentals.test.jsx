import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AnalysisProvider } from '../../components/AnalysisContext.jsx';
import Fundamentals from './Fundamentals.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getFundamentalsSnapshot: vi.fn(),
  getFundamentalsSources: vi.fn(),
  getFundamentalsDerived: vi.fn(),
  getFundamentalsFacts: vi.fn(),
  getFundamentalStatements: vi.fn(),
}));

import {
  getFundamentalsSnapshot,
  getFundamentalsSources,
  getFundamentalsDerived,
  getFundamentalsFacts,
  getFundamentalStatements,
} from '../../lib/api/client.js';

const SNAPSHOT_AVAILABLE = {
  success: true,
  data: {
    available: true,
    ticker: 'BBCA',
    companyType: 'bank',
    filingCount: 2,
    latestPeriod: 'FY2024',
    latestFiscalYear: 2024,
    latestFilingId: 'BBCA-2024-A-financial_statement',
    latestExtractionStatus: 'success',
    latestFactCount: 120,
    latestParsedAt: '2025-03-01T00:00:00Z',
    periods: ['FY2024', 'FY2023'],
    filings: [
      {
        filingId: 'BBCA-2024-A-financial_statement',
        companyType: 'bank',
        fiscalYear: 2024,
        fiscalPeriod: 'A',
        periodLabel: 'FY2024',
        extractionStatus: 'success',
        factCount: 120,
        parsedAt: '2025-03-01T00:00:00Z',
        sourceUrl: 'https://www.idx.co.id/fs-bbca-2024.pdf',
        publishedAt: '2025-02-28T00:00:00Z',
        title: 'Annual Financial Statements 2024',
      },
      {
        filingId: 'BBCA-2023-A-financial_statement',
        companyType: 'bank',
        fiscalYear: 2023,
        fiscalPeriod: 'A',
        periodLabel: 'FY2023',
        extractionStatus: 'success',
        factCount: 115,
        parsedAt: '2024-03-01T00:00:00Z',
        sourceUrl: 'https://www.idx.co.id/fs-bbca-2023.pdf',
        publishedAt: '2024-02-28T00:00:00Z',
        title: 'Annual Financial Statements 2023',
      },
    ],
  },
};

const SOURCES_AVAILABLE = {
  success: true,
  data: {
    available: true,
    ticker: 'BBCA',
    sources: [
      {
        filingId: 'BBCA-2024-A-financial_statement',
        periodLabel: 'FY2024',
        fiscalYear: 2024,
        fiscalPeriod: 'A',
        eventId: 'evt-bbca-lk-2024',
        sourceUrl: 'https://www.idx.co.id/fs-bbca-2024.pdf',
        publishedAt: '2025-02-28T00:00:00Z',
        title: 'Annual Financial Statements 2024',
      },
    ],
  },
};

const DERIVED_AVAILABLE = {
  success: true,
  data: {
    available: true,
    filingId: 'BBCA-2024-A-financial_statement',
    periodLabel: 'FY2024',
    companyType: 'bank',
    metrics: [
      {
        key: 'net_margin',
        label: 'Net Profit Margin',
        formula: 'net_income / revenue × 100',
        unit: '%',
        section: 'profitability',
        available: true,
        value: 31.5,
        inputs: {
          numerator: {
            factId: 1,
            fieldKey: 'net_income',
            valueNumeric: 48600000000000,
            unit: 'IDR',
            confidence: 0.95,
            evidence: { page: 45, snippet: 'Laba bersih 48,6 T', officialUrl: 'https://www.idx.co.id/fs-bbca-2024.pdf' },
            periodLabel: 'FY2024',
          },
          denominator: {
            factId: 2,
            fieldKey: 'net_revenue',
            valueNumeric: 154300000000000,
            unit: 'IDR',
            confidence: 0.95,
            evidence: { page: 40, officialUrl: 'https://www.idx.co.id/fs-bbca-2024.pdf' },
            periodLabel: 'FY2024',
          },
        },
        rejectionReason: null,
      },
      {
        key: 'gross_margin',
        label: 'Gross Margin',
        formula: 'gross_profit / revenue × 100',
        unit: '%',
        section: 'profitability',
        available: false,
        value: null,
        inputs: { numerator: null, denominator: null },
        rejectionReason: 'numerator unavailable (tried: gross_profit, laba_kotor, gross_income)',
      },
      {
        key: 'nim',
        label: 'Net Interest Margin',
        formula: 'net_interest_income / interest_earning_assets × 100',
        unit: '%',
        section: 'profitability',
        available: true,
        value: 5.32,
        inputs: {
          numerator: { factId: 3, fieldKey: 'net_interest_income', valueNumeric: 62000000000000, unit: 'IDR', confidence: 0.9, evidence: {}, periodLabel: 'FY2024' },
          denominator: { factId: 4, fieldKey: 'interest_earning_assets', valueNumeric: 1165000000000000, unit: 'IDR', confidence: 0.9, evidence: {}, periodLabel: 'FY2024' },
        },
        rejectionReason: null,
      },
      {
        key: 'eps',
        label: 'Earnings Per Share',
        formula: 'net_income / shares',
        unit: 'IDR',
        section: 'per_share',
        available: true,
        value: 1974,
        inputs: {
          numerator: { factId: 1, fieldKey: 'net_income', valueNumeric: 48600000000000, unit: 'IDR', confidence: 0.95, evidence: {}, periodLabel: 'FY2024' },
          denominator: { factId: 5, fieldKey: 'weighted_average_shares', valueNumeric: 24630000000, unit: 'shares', confidence: 0.9, evidence: {}, periodLabel: 'FY2024' },
        },
        rejectionReason: null,
      },
      {
        key: 'debt_to_equity',
        label: 'Debt to Equity',
        formula: 'total_liabilities / total_equity',
        unit: 'x',
        section: 'health',
        available: true,
        value: 6.12,
        inputs: {
          numerator: { factId: 6, fieldKey: 'total_liabilities', valueNumeric: 1100000000000000, unit: 'IDR', confidence: 0.9, evidence: {}, periodLabel: 'FY2024' },
          denominator: { factId: 7, fieldKey: 'total_equity', valueNumeric: 179600000000000, unit: 'IDR', confidence: 0.9, evidence: {}, periodLabel: 'FY2024' },
        },
        rejectionReason: null,
      },
      {
        key: 'operating_cf_margin',
        label: 'Operating CF Margin',
        formula: 'operating_cash_flow / revenue × 100',
        unit: '%',
        section: 'cash_quality',
        available: false,
        value: null,
        inputs: { numerator: null, denominator: null },
        rejectionReason: 'denominator unavailable (tried: net_revenue, revenue, pendapatan_neto)',
      },
    ],
  },
};

function renderWithContext(initialPath = '/fundamentals') {
  return render(
    <MemoryRouter initialEntries={[`${initialPath}?ticker=BBCA`]}>
      <AnalysisProvider>
        <Fundamentals />
      </AnalysisProvider>
    </MemoryRouter>,
  );
}

describe('Fundamentals page', () => {
  beforeEach(() => {
    getFundamentalsSnapshot.mockResolvedValue(SNAPSHOT_AVAILABLE);
    getFundamentalsSources.mockResolvedValue(SOURCES_AVAILABLE);
    getFundamentalsDerived.mockResolvedValue(DERIVED_AVAILABLE);
    getFundamentalsFacts.mockResolvedValue({ success: true, data: { available: true, filingId: 'BBCA-2024-A-financial_statement', items: [], total: 0, cursor: 0, limit: 50, nextCursor: null } });
    getFundamentalStatements.mockResolvedValue({ success: true, data: { available: false, reason: 'v15 tables not available.' } });
  });

  it('renders the page with snapshot and company type badge', async () => {
    renderWithContext();
    expect(await screen.findByTestId('fundamentals-page')).toBeInTheDocument();
    expect(await screen.findByTestId('fundamentals-snapshot')).toBeInTheDocument();
    expect(screen.getByTestId('company-type-badge')).toHaveTextContent('BANK');
    expect(screen.getByText('2 filings')).toBeInTheDocument();
    expect(screen.getByText(/Latest: FY2024/)).toBeInTheDocument();
  });

  it('renders profitability metrics including bank-specific NIM', async () => {
    renderWithContext();
    await screen.findByTestId('profitability-section');
    const metrics = screen.getAllByTestId('derived-metric');
    const labels = metrics.map((el) => el.textContent);
    expect(labels.some((t) => t.includes('Net Profit Margin'))).toBe(true);
    expect(labels.some((t) => t.includes('Net Interest Margin'))).toBe(true);
    expect(screen.getByText('31.50%')).toBeInTheDocument();
    expect(screen.getByText('5.32%')).toBeInTheDocument();
  });

  it('shows rejection reason for unavailable metrics', async () => {
    renderWithContext();
    await screen.findByTestId('profitability-section');
    const rejections = screen.getAllByTestId('rejection-reason');
    expect(rejections.length).toBeGreaterThan(0);
    expect(rejections[0].textContent).toMatch(/numerator unavailable/);
  });

  it('expands metric inputs on button click', async () => {
    renderWithContext();
    await screen.findByTestId('profitability-section');
    const expandBtn = screen.getAllByText('Show inputs')[0];
    fireEvent.click(expandBtn);
    expect(await screen.findByTestId('metric-inputs')).toBeInTheDocument();
    expect(screen.getAllByText('net_income').length).toBeGreaterThan(0);
  });

  it('renders health and per-share sections', async () => {
    renderWithContext();
    expect(await screen.findByTestId('health-section')).toBeInTheDocument();
    expect(await screen.findByTestId('per_share-section')).toBeInTheDocument();
    expect(screen.getByText('6.12x')).toBeInTheDocument();
    expect(screen.getByText('Rp 1.974')).toBeInTheDocument();
  });

  it('renders cash quality section with rejection reason for missing CF', async () => {
    renderWithContext();
    expect(await screen.findByTestId('cash_quality-section')).toBeInTheDocument();
    expect(screen.getAllByTestId('rejection-reason').some(
      (el) => el.textContent.includes('denominator unavailable'),
    )).toBe(true);
  });

  it('shows filing selector with two filings', async () => {
    renderWithContext();
    await screen.findByTestId('fundamentals-snapshot');
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select.options).toHaveLength(2);
    expect(select.options[0].text).toContain('FY2024');
    expect(select.options[1].text).toContain('FY2023');
  });

  it('fetches derived metrics for the new filing when selector changes', async () => {
    renderWithContext();
    await screen.findByTestId('fundamentals-snapshot');
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'BBCA-2023-A-financial_statement' } });
    await waitFor(() => {
      expect(getFundamentalsDerived).toHaveBeenCalledWith(
        expect.objectContaining({ filingId: 'BBCA-2023-A-financial_statement' }),
      );
    });
  });

  it('shows trends table with multiple filings', async () => {
    renderWithContext();
    expect(await screen.findByTestId('trends-section')).toBeInTheDocument();
    expect(screen.getAllByText('FY2024').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FY2023').length).toBeGreaterThan(0);
  });

  it('shows sources list with official IDX link', async () => {
    renderWithContext();
    await screen.findByTestId('sources-list');
    const link = screen.getByRole('link', { name: 'Official IDX source' });
    expect(link.href).toBe('https://www.idx.co.id/fs-bbca-2024.pdf');
  });

  it('expands and collapses full statements section', async () => {
    renderWithContext();
    await screen.findByTestId('statements-section');
    const toggleBtn = screen.getByText('Show full statements');
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Hide full statements')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hide full statements'));
    expect(screen.getByText('Show full statements')).toBeInTheDocument();
  });

  it('expands and collapses learning section', async () => {
    renderWithContext();
    await screen.findByTestId('learning-section');
    const toggleBtn = screen.getByText('Show metric explanations');
    fireEvent.click(toggleBtn);
    expect(await screen.findByText('Hide explanations')).toBeInTheDocument();
    expect(screen.getAllByText('Gross Margin').length).toBeGreaterThan(0);
    await waitFor(() => expect(getFundamentalsDerived).toHaveBeenCalled());
  });

  it('renders unavailable state when snapshot reports available=false', async () => {
    getFundamentalsSnapshot.mockResolvedValue({
      success: true,
      data: { available: false, reason: 'v18 fundamentals tables are not present.', ticker: 'BBCA' },
    });
    renderWithContext();
    expect(await screen.findByTestId('fundamentals-unavailable')).toBeInTheDocument();
    expect(screen.getByText(/v18 Fundamentals data not yet loaded/)).toBeInTheDocument();
  });

  it('uses the workstation default ticker when none is supplied', async () => {
    render(
      <MemoryRouter initialEntries={['/fundamentals']}>
        <AnalysisProvider>
          <Fundamentals />
        </AnalysisProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /Fundamentals.*BBCA/ })).toBeInTheDocument();
  });

  it('shows error state and retry when snapshot fetch fails', async () => {
    getFundamentalsSnapshot.mockResolvedValue({ success: false, error: 'Database offline' });
    renderWithContext();
    expect(await screen.findByText('Fundamentals unavailable')).toBeInTheDocument();
    expect(screen.getByText('Database offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    getFundamentalsSnapshot.mockResolvedValue(SNAPSHOT_AVAILABLE);
    getFundamentalsSources.mockResolvedValue(SOURCES_AVAILABLE);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByTestId('fundamentals-snapshot')).toBeInTheDocument();
  });
});
