import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

const applied = [];
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData: vi.fn(), applyOptions: vi.fn((options) => applied.push(['series', options])) });
  return {
    createChart: () => ({
      addSeries: series,
      priceScale: () => ({ applyOptions: vi.fn() }),
      timeScale: () => ({ fitContent: vi.fn(), setVisibleLogicalRange: vi.fn() }),
      applyOptions: vi.fn((options) => applied.push(['chart', options])),
      remove: vi.fn(),
    }),
    CandlestickSeries: {},
    HistogramSeries: {},
  };
});

vi.mock('../workbench/MarketChart.jsx', () => ({
  readChartTheme: () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    return { background: dark ? '#000000' : '#ffffff', text: '#888', grid: '#111', border: '#222', crosshair: '#333', up: 'green', down: 'red', volumeUp: 'g', volumeDown: 'r' };
  },
}));

import IndexChart from './IndexChart.jsx';

describe('IndexChart', () => {
  it('repaints when the theme changes', async () => {
    document.documentElement.dataset.theme = 'dark';
    render(<IndexChart bars={[{ date: '2026-11-06', open: 1, high: 2, low: 1, close: 2, volume: 1 }]} />);
    const before = applied.filter(([kind]) => kind === 'chart').at(-1)[1].layout.background.color;
    expect(before).toBe('#000000');

    await act(async () => {
      document.documentElement.dataset.theme = 'light';
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const after = applied.filter(([kind]) => kind === 'chart').at(-1)[1].layout.background.color;
    expect(after).toBe('#ffffff');
  });
});
