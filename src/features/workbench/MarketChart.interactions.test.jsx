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
const plan = { available: true, stop: 190, target: 260, alt: null };
const buyerCost = { code: 'DR', avg: 230 };
let instance;
let series;
let timeScale;
let crosshair;
let rangeChange;
let resize;

beforeEach(() => {
  localStorage.clear();
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
const mount = (props = {}) => render(<MarketChart chart={chart} ticker={ticker} plan={plan} buyerCost={buyerCost} {...props} />);
// Series order: candles, volume, foreign, MA lines (ma20 only here), level overlay.
const VOLUME = 1;
const MA20 = 3;

describe('chart interaction continuity', () => {
  it('preserves a custom viewport when overlays, theme, and dimensions change', async () => {
    mount();
    act(() => rangeChange({ from: 10, to: 40 }));
    expect(screen.getByText('Custom view')).toBeInTheDocument();
    timeScale.setVisibleLogicalRange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'MA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
    fireEvent.click(screen.getByRole('button', { name: 'Support' }));
    await act(async () => { document.documentElement.dataset.theme = 'light'; });
    act(() => resize([{ contentRect: { width: 800, height: 400 } }]));
    expect(createChart).toHaveBeenCalledTimes(1);
    expect(instance.remove).not.toHaveBeenCalled();
    expect(timeScale.setVisibleLogicalRange).not.toHaveBeenCalled();
    expect(series[MA20].applyOptions).toHaveBeenCalledWith({ visible: true });
    expect(series[VOLUME].applyOptions).toHaveBeenCalledWith({ visible: false });
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
    view.rerender(<MarketChart chart={next} ticker={ticker} plan={plan} buyerCost={buyerCost} />);
    expect(instance.unsubscribeCrosshairMove).toHaveBeenCalledWith(oldHandler);
    expect(timeScale.unsubscribeVisibleLogicalRangeChange).toHaveBeenCalledWith(oldRange);
    expect(screen.getByLabelText('Selected candle values').querySelector('time')).toHaveAttribute('dateTime', next.candles.at(-1).date);
    view.unmount();
    expect(instance.remove).toHaveBeenCalledTimes(2);
  });

  it('handles unavailable fullscreen', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Full screen is unavailable');
  });

  it('splits support and resistance, names the buyer, and disables overlays without data', () => {
    mount({ plan: { available: false, alt: null }, buyerCost: null });
    const overlays = screen.getByRole('group', { name: 'Chart overlays' });
    expect(within(overlays).getAllByRole('button').map((button) => button.textContent))
      .toEqual(['Support', 'Resistance', 'Plan', 'Buyer cost', 'MA', 'Volume', 'Foreign']);
    expect(within(overlays).getByRole('button', { name: 'Plan' })).toBeDisabled();
    expect(within(overlays).getByRole('button', { name: 'Buyer cost' })).toBeDisabled();
    expect(within(overlays).getByRole('button', { name: 'Foreign' })).toBeDisabled();
    expect(within(overlays).getByRole('button', { name: 'Support' })).toHaveAttribute('aria-pressed', 'true');
    cleanup();

    mount();
    expect(screen.getByRole('button', { name: 'DR cost' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Resistance' }));
    expect(screen.getByRole('button', { name: 'Support' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Resistance' })).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(localStorage.getItem('nalar.chart.overlays'))).toEqual(expect.objectContaining({ support: true, resistance: false }));
  });

  it('draws a level shared by the plan and a resistance only once', () => {
    mount({ chart: { ...chart, levels: { supports: [], resistances: [{ price: 200 }] } }, plan: { available: true, stop: 150, target: 200, alt: null } });
    const lines = series[4].createPriceLine.mock.results.map((result, index) => ({ args: series[4].createPriceLine.mock.calls[index][0], line: result.value }));
    const resistance = lines.find((item) => item.args.title === 'R');
    const target = lines.find((item) => item.args.title === 'Target');
    expect(resistance.line.applyOptions).toHaveBeenLastCalledWith(expect.objectContaining({ lineVisible: false }));
    expect(target.line.applyOptions).toHaveBeenLastCalledWith(expect.objectContaining({ lineVisible: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    expect(resistance.line.applyOptions).toHaveBeenLastCalledWith(expect.objectContaining({ lineVisible: true }));
  });

  it('draws daily foreign net when the history carries it', () => {
    const withForeign = { ...chart, candles: chart.candles.map((row, index) => ({ ...row, foreignNet: index % 2 ? 5e8 : -2e8 })) };
    mount({ chart: withForeign });
    const foreignToggle = screen.getByRole('button', { name: 'Foreign' });
    expect(foreignToggle).toBeEnabled();
    fireEvent.click(foreignToggle);
    expect(series[2].setData).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ value: 5e8 })]));
    expect(series[2].applyOptions).toHaveBeenLastCalledWith({ visible: true });
  });
});
