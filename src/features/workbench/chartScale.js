/**
 * Candle-only vertical scale helpers shared by MarketChart.
 * Kept in a tiny module so tests can exercise the scale contract without
 * mounting the canvas chart.
 */

export function computeCandleOnlyScale(candles, visibleBars = 60) {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  const visibleCount = Math.min(visibleBars, candles.length);
  const visibleCandles = candles.slice(-visibleCount);
  const lows = visibleCandles.map((row) => row.low).filter(Number.isFinite);
  const highs = visibleCandles.map((row) => row.high).filter(Number.isFinite);
  if (!lows.length || !highs.length) return null;
  const visibleLow = Math.min(...lows);
  const visibleHigh = Math.max(...highs);
  const padding = Math.max((visibleHigh - visibleLow) * 0.08, visibleHigh * 0.01);
  return {
    visibleCount,
    logical: {
      from: candles.length - visibleCount - 1,
      to: candles.length + 2,
    },
    price: {
      from: visibleLow - padding,
      to: visibleHigh + padding,
    },
  };
}

function lockPriceScale(priceScale, range) {
  if (!priceScale || !range) return;
  if (typeof priceScale.applyOptions === 'function') {
    priceScale.applyOptions({ autoScale: false });
  }
  if (typeof priceScale.setAutoScale === 'function') {
    priceScale.setAutoScale(false);
  }
  if (typeof priceScale.setVisibleRange === 'function') {
    priceScale.setVisibleRange(range);
  }
}

/** True when a price line should be drawn inside the candle-only window. */
export function isPriceInCandleWindow(price, scale) {
  if (!Number.isFinite(price)) return false;
  if (!scale?.price) return true;
  return price >= scale.price.from && price <= scale.price.to;
}

export function applyCandleOnlyScale(instance, candleSeries, scale) {
  if (!instance || !scale) return;
  const timeScale = instance.timeScale?.();
  if (timeScale && typeof timeScale.setVisibleLogicalRange === 'function') {
    timeScale.setVisibleLogicalRange(scale.logical);
  }

  const provider = () => ({
    priceRange: {
      minValue: scale.price.from,
      maxValue: scale.price.to,
    },
  });

  if (candleSeries && typeof candleSeries.applyOptions === 'function') {
    candleSeries.applyOptions({ autoscaleInfoProvider: provider });
  }

  // Prefer the series-attached scale when available — this is the scale price
  // lines live on, and locking it is what keeps overlays from widening the view.
  const seriesScale = typeof candleSeries?.priceScale === 'function'
    ? candleSeries.priceScale()
    : null;
  lockPriceScale(seriesScale, scale.price);
  lockPriceScale(instance.priceScale?.('right'), scale.price);
}
