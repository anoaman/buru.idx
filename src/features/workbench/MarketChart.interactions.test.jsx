import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarketChart from './MarketChart.jsx';

const { createChart } = vi.hoisted(() => ({ createChart: vi.fn() }));
vi.mock('lightweight-charts', () => ({ createChart, CandlestickSeries: {}, HistogramSeries: {}, LineSeries: {} }));

const chart = {
  candles: Array.from({ length: 140 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    open: 100 + index, high: 110 + index, low: 90 + index, close: 105 + index, volume: 1000 + index,
  })),
  movingAverages: { ma20: [{ date: '2026-01-01', value: 100 }] },
  levels: { supports: [{ price: 50 }], resistances: [{ price: 10000 }] },
};
const ticker = { symbol: 'BBCA', close: 244 };
const geometry = { bestSetup: { entry: 200, stop: 190, target: null } };
let instance;
let series;
let timeScale;
let crosshair;
let rangeChange;
let resize;

beforeEach(() => {
  createChart.mockReset();
  series = [];
  timeScale = {
    setVisibleLogicalRange: vi.fn(),
    subscribeVisibleLogicalRangeChange: vi.fn((handler) => { rangeChange = handler; }),
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
  };
  instance = {
    addSeries: vi.fn(() => {
      const item = { setData: vi.fn(), applyOptions: vi.fn(), createPriceLine: vi.fn(() => ({ applyOptions: vi.fn() })) };
      series.push(item);
      return item;
    }),
    priceScale: () => ({ applyOptions: vi.fn(), setAutoScale: vi.fn(), setVisibleRange: vi.fn() }),
    timeScale: () => timeScale,
    subscribeCrosshairMove: vi.fn((handler) => { crosshair = handler; }),
    unsubscribeCrosshairMove: vi.fn(),
    setCrosshairPosition: vi.fn(),
    applyOptions: vi.fn(), remove: vi.fn(),
  };
  createChart.mockReturnValue(instance);
  vi.stubGlobal('ResizeObserver', class {
    constructor(handler) { resize = handler; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});
const mount = () => render(<MarketChart chart={chart} ticker={ticker} geometry={geometry} />);

describe('chart interaction continuity', () => {
  it('preserves a custom viewport when overlays, theme, and dimensions change', async () => {
    mount();
    act(() => rangeChange({ from: 10, to: 40 }));
    expect(screen.getByText('Custom view')).toBeInTheDocument();
    timeScale.setVisibleLogicalRange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Show MA lines' }));
    const averages = screen.getByRole('group', { name: 'Moving averages' });
    fireEvent.click(within(averages).getByRole('button', { name: 'MA20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Levels', exact: true }));
    await act(async () => { document.documentElement.dataset.theme = 'light'; });
    act(() => resize([{ contentRect: { width: 800, height: 400 } }]));
    expect(createChart).toHaveBeenCalledTimes(1);
    expect(instance.remove).not.toHaveBeenCalled();
    expect(timeScale.setVisibleLogicalRange).not.toHaveBeenCalled();
    expect(series[2].applyOptions).toHaveBeenCalledWith({ visible: false });
  });

  it('fits only candle prices for each preset and can reset a custom view', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '20D' }));
    expect(timeScale.setVisibleLogicalRange).toHaveBeenLastCalledWith({ from: 119, to: 142 });
    expect(screen.getByText('20 sessions')).toBeInTheDocument();
    const options = series[0].applyOptions.mock.calls.at(-1)[0];
    expect(options.autoscaleInfoProvider().priceRange.maxValue).toBeLessThan(300);
    fireEvent.click(screen.getByRole('button', { name: 'All', exact: true }));
    expect(timeScale.setVisibleLogicalRange).toHaveBeenLastCalledWith({ from: -1, to: 142 });
    act(() => rangeChange({ from: 5, to: 10 }));
    expect(screen.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(timeScale.setVisibleLogicalRange).toHaveBeenLastCalledWith({ from: 79, to: 142 });
    expect(screen.getByRole('button', { name: '60D' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reads backend candle values on hover and keyboard input without changing scale', () => {
    mount();
    timeScale.setVisibleLogicalRange.mockClear();
    const candle = chart.candles[10];
    act(() => crosshair({ seriesData: new Map([[series[0], { time: candle.date }]]) }));
    const readout = screen.getByLabelText('Selected candle values');
    expect(readout.querySelector('time')).toHaveAttribute('dateTime', candle.date);
    expect(within(readout).getByText('115')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText(/Interactive price chart/), { key: 'ArrowLeft' });
    expect(readout.querySelector('time')).toHaveAttribute('dateTime', chart.candles[9].date);
    expect(instance.setCrosshairPosition).toHaveBeenLastCalledWith(114, chart.candles[9].date, series[0]);
    expect(timeScale.setVisibleLogicalRange).not.toHaveBeenCalled();
    act(() => crosshair({ seriesData: new Map() }));
    expect(readout.querySelector('time')).toHaveAttribute('dateTime', chart.candles.at(-1).date);
  });

  it('cleans up subscriptions and resets the readout for a new dataset', () => {
    const view = mount();
    const oldHandler = crosshair;
    const oldRange = rangeChange;
    act(() => crosshair({ seriesData: new Map([[series[0], { time: chart.candles[3].date }]]) }));
    const next = { ...chart, candles: chart.candles.slice(-2) };
    view.rerender(<MarketChart chart={next} ticker={ticker} geometry={geometry} />);
    expect(instance.unsubscribeCrosshairMove).toHaveBeenCalledWith(oldHandler);
    expect(timeScale.unsubscribeVisibleLogicalRangeChange).toHaveBeenCalledWith(oldRange);
    expect(screen.getByLabelText('Selected candle values').querySelector('time')).toHaveAttribute('dateTime', next.candles.at(-1).date);
    view.unmount();
    expect(instance.remove).toHaveBeenCalledTimes(2);
  });

  it('handles unavailable fullscreen and unavailable moving averages', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Full screen is unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Show MA lines' }));
    expect(screen.getByRole('button', { name: 'MA200' })).toBeDisabled();
  });
});
