import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AnalysisProvider } from '../../components/AnalysisContext.jsx';
import Fundamentals from './Fundamentals.jsx';

vi.mock('../../lib/api/client.js', () => ({
  getFundamentals: vi.fn(),
}));

import { getFundamentals } from '../../lib/api/client.js';

function emptyPayload(overrides = {}) {
  return {
    success: true,
    data: {
      available: false,
      ticker: 'BBCA',
      reason: 'No official, fully attributed statement rows yet. The Fundamentals tab stays empty until a first-party filing pipeline is connected.',
      sections: {
        performance: { available: false, reason: 'Official financial-statement rows are not loaded yet. This section stays empty rather than inventing figures.' },
        valuation: { available: false, reason: 'Valuation context is withheld until official, same-period denominators exist. This is not a price target.' },
        balanceSheet: { available: false, reason: 'Official financial-statement rows are not loaded yet. This section stays empty rather than inventing figures.' },
        dilution: { available: false, reason: 'Share-count and dilution events are not ingested yet.' },
        sources: { available: false, reason: 'No official statement URL is attached until a filing pipeline is connected.' },
      },
      coverage: { usable: 0, mixedAnnualQuarterly: false, recommendation: 'stay empty' },
      sourcesConsidered: [
        'IDX company disclosures / financial statements (first-party, preferred)',
        'Stockbit financials (vendor, not first-party; not used as official evidence)',
      ],
      ...overrides,
    },
  };
}

function renderPage(path = '/fundamentals?ticker=BBCA') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AnalysisProvider>
        <Fundamentals />
      </AnalysisProvider>
    </MemoryRouter>,
  );
}

describe('Fundamentals', () => {
  beforeEach(() => {
    getFundamentals.mockReset();
  });

  it('renders the empty official-source shell without inventing figures', async () => {
    getFundamentals.mockResolvedValue(emptyPayload());
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Fundamentals' })).toBeInTheDocument();
    });
    expect(getFundamentals).toHaveBeenCalledWith('BBCA');
    expect(screen.getByText(/BBCA statements are not loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Performance trend' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Valuation context' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Balance sheet & cash flow' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dilution & share count' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Source attribution' })).toBeInTheDocument();
    expect(screen.getAllByText(/not a price target/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/IDX company disclosures/i)).toBeInTheDocument();
    expect(screen.queryByText(/P\/E|ROE|12\.4|5,?200/)).not.toBeInTheDocument();
  });

  it('does not render leaked ratio fields from a malformed payload', async () => {
    getFundamentals.mockResolvedValue(emptyPayload({
      pe: 12.4,
      ratios: { roe: 0.18 },
      sections: {
        performance: { available: true, pe: 12.4, reason: 'should stay empty' },
      },
    }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('should stay empty')).toBeInTheDocument();
    });
    expect(screen.queryByText('12.4')).not.toBeInTheDocument();
    expect(screen.queryByText('0.18')).not.toBeInTheDocument();
  });
});
