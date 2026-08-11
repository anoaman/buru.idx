import { describe, expect, it, vi } from 'vitest';
import { computeCandleOnlyScale, isPriceInCandleWindow } from './MarketChart.jsx';

// Re-import apply helper by exercising compute + the scale contract the chart applies.
describe('computeCandleOnlyScale', () => {
  const candles = [
    { date: '2026-07-01', open: 100, high: 110, low: 95, close: 105, volume: 1 },
    { date: '2026-07-02', open: 105, high: 120, low: 100, close: 118, volume: 1 },
    { date: '2026-07-03', open: 118, high: 125, low: 115, close: 122, volume: 1 },
    { date: '2026-07-04', open: 122, high: 130, low: 120, close: 128, volume: 1 },
    { date: '2026-07-05', open: 128, high: 135, low: 126, close: 132, volume: 1 },
  ];

  it('derives the initial price range from visible candle highs/lows only', () => {
    const scale = computeCandleOnlyScale(candles, 3);
    expect(scale.visibleCount).toBe(3);
    expect(scale.price.from).toBeLessThan(115);
    expect(scale.price.to).toBeGreaterThan(135);
    const span = scale.price.to - scale.price.from;
    const candleSpan = 135 - 115;
    expect(span).toBeGreaterThan(candleSpan);
    expect(scale.price.from).toBeGreaterThan(100);
    expect(scale.price.to).toBeLessThan(200);
  });

  it('stays inside candle bounds even when overlays would be far outside', () => {
    const scale = computeCandleOnlyScale(candles, 5);
    expect(scale.price.to).toBeLessThan(500);
    expect(scale.price.from).toBeGreaterThan(10);
  });

  it('returns null for empty input', () => {
    expect(computeCandleOnlyScale([])).toBeNull();
    expect(computeCandleOnlyScale(null)).toBeNull();
  });
});

describe('isPriceInCandleWindow', () => {
  it('keeps in-range overlays and drops out-of-range ones so they stay offscreen', () => {
    const scale = computeCandleOnlyScale([
      { date: '2026-07-01', open: 100, high: 110, low: 90, close: 105, volume: 1 },
      { date: '2026-07-02', open: 105, high: 120, low: 100, close: 118, volume: 1 },
    ]);
    expect(isPriceInCandleWindow(105, scale)).toBe(true);
    expect(isPriceInCandleWindow(scale.price.from, scale)).toBe(true);
    expect(isPriceInCandleWindow(scale.price.to, scale)).toBe(true);
    expect(isPriceInCandleWindow(500, scale)).toBe(false);
    expect(isPriceInCandleWindow(10, scale)).toBe(false);
    expect(isPriceInCandleWindow(NaN, scale)).toBe(false);
  });
});

describe('candle-only scale API contract', () => {
  it('uses setAutoScale(false) and setVisibleRange when those APIs exist', async () => {
    const { applyCandleOnlyScale } = await import('./chartScale.js');
    const candles = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      open: 100 + i,
      high: 110 + i,
      low: 90 + i,
      close: 105 + i,
      volume: 1,
    }));
    const scale = computeCandleOnlyScale(candles, 60);
    const setAutoScale = vi.fn();
    const setVisibleRange = vi.fn();
    const setVisibleLogicalRange = vi.fn();
    const applyOptions = vi.fn();
    const instance = {
      timeScale: () => ({ setVisibleLogicalRange }),
      priceScale: () => ({ setAutoScale, setVisibleRange }),
    };
    const series = { applyOptions };
    applyCandleOnlyScale(instance, series, scale);
    expect(setVisibleLogicalRange).toHaveBeenCalledWith(scale.logical);
    expect(applyOptions).toHaveBeenCalledWith(expect.objectContaining({
      autoscaleInfoProvider: expect.any(Function),
    }));
    const provider = applyOptions.mock.calls[0][0].autoscaleInfoProvider;
    expect(provider()).toEqual({
      priceRange: { minValue: scale.price.from, maxValue: scale.price.to },
    });
    expect(setAutoScale).toHaveBeenCalledWith(false);
    expect(setVisibleRange).toHaveBeenCalledWith(scale.price);
  });

  it('locks both series and right price scales when both exist', async () => {
    const { applyCandleOnlyScale } = await import('./chartScale.js');
    const scale = computeCandleOnlyScale([
      { date: '2026-07-01', open: 100, high: 110, low: 90, close: 105, volume: 1 },
      { date: '2026-07-02', open: 105, high: 115, low: 100, close: 112, volume: 1 },
    ]);
    const seriesScale = { applyOptions: vi.fn(), setAutoScale: vi.fn(), setVisibleRange: vi.fn() };
    const rightScale = { applyOptions: vi.fn(), setAutoScale: vi.fn(), setVisibleRange: vi.fn() };
    applyCandleOnlyScale(
      {
        timeScale: () => ({ setVisibleLogicalRange: vi.fn() }),
        priceScale: () => rightScale,
      },
      {
        applyOptions: vi.fn(),
        priceScale: () => seriesScale,
      },
      scale,
    );
    expect(seriesScale.setAutoScale).toHaveBeenCalledWith(false);
    expect(seriesScale.setVisibleRange).toHaveBeenCalledWith(scale.price);
    expect(rightScale.setAutoScale).toHaveBeenCalledWith(false);
    expect(rightScale.setVisibleRange).toHaveBeenCalledWith(scale.price);
  });
});
