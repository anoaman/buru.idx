import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { AnalysisProvider } from './AnalysisContext.jsx';
import AnalysisShell from './AnalysisShell.jsx';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="location">{`${location.pathname}${location.search}`}</output>;
}

function renderShell(path = '/workbench?ticker=BBCA') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AnalysisProvider>
        <AnalysisShell>
          <Routes>
            <Route path="/workbench" element={<div>Investigation page</div>} />
            <Route path="/broker-intelligence" element={<div>Broker page</div>} />
            <Route path="/radar" element={<div>Radar page</div>} />
          </Routes>
          <LocationProbe />
        </AnalysisShell>
      </AnalysisProvider>
    </MemoryRouter>,
  );
}

describe('AnalysisShell', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('opens a ticker from the global command bar and preserves it as context', async () => {
    renderShell();
    const input = screen.getByLabelText(/Open ticker investigation/i);
    fireEvent.change(input, { target: { value: 'tlkm' } });
    fireEvent.click(screen.getByRole('button', { name: 'OPEN' }));
    await waitFor(() => {
      expect(screen.getByLabelText('location')).toHaveTextContent('/workbench?ticker=TLKM');
    });
    expect(screen.getByText('TLKM')).toBeInTheDocument();
  });

  it('changes the Broker Map window without dropping ticker, lens, or date', async () => {
    renderShell('/broker-intelligence?lens=stock&ticker=BBRI&days=1&date=2026-08-07');
    fireEvent.click(screen.getByRole('button', { name: '30D' }));
    await waitFor(() => {
      expect(screen.getByLabelText('location')).toHaveTextContent(
        '/broker-intelligence?lens=stock&ticker=BBRI&days=30&date=2026-08-07',
      );
    });
  });

  it('exposes all four private workstation destinations', () => {
    renderShell('/radar');
    expect(screen.getByRole('link', { name: /Screener/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Stock Analysis/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Broker Flow/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Watchlist/i })).toBeInTheDocument();
  });

  it('defaults to Paper Ledger and persists the optional dark theme', () => {
    renderShell();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('nalar-theme')).toBe('dark');
  });
});
