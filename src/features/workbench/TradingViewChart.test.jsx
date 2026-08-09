import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TradingViewChart from './TradingViewChart.jsx';

describe('TradingViewChart', () => {
  it('maps ticker to IDX:TICKER embed and accessible title', () => {
    render(<TradingViewChart ticker="BBRI" />);
    const iframe = screen.getByTitle('TradingView chart for IDX:BBRI');
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toContain('symbol=IDX%3ABBRI');
    expect(screen.getByText('IDX:BBRI')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open on TradingView/i })).toHaveAttribute(
      'href',
      'https://www.tradingview.com/chart/?symbol=IDX%3ABBRI',
    );
    expect(screen.getByRole('link', { name: /Open on TradingView/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.getByRole('link', { name: /Open on TradingView/i })).toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('updates symbol when ticker changes', () => {
    const { rerender } = render(<TradingViewChart ticker="BBRI" />);
    expect(screen.getByTitle('TradingView chart for IDX:BBRI')).toBeInTheDocument();
    rerender(<TradingViewChart ticker="TLKM" />);
    const iframe = screen.getByTitle('TradingView chart for IDX:TLKM');
    expect(iframe.getAttribute('src')).toContain('symbol=IDX%3ATLKM');
  });

  it('shows empty state without ticker', () => {
    render(<TradingViewChart ticker="" />);
    expect(screen.getByText(/Enter a ticker to load the TradingView chart/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/TradingView chart/i)).not.toBeInTheDocument();
  });
});
