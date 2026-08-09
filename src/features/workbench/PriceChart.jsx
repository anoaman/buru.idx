import { useEffect, useRef } from 'react';
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries,
} from 'lightweight-charts';
import {
  formatPrice, formatDate,
} from '../../lib/format/market.js';

/** Explicit palette — canvas libraries do not resolve CSS custom properties. */
const CHART_COLORS = {
  text: '#9aa0b4',
  bullish: '#34d399',
  bearish: '#f87171',
  volumeBullish: 'rgba(52, 211, 153, 0.35)',
  volumeBearish: 'rgba(248, 113, 113, 0.35)',
  support: 'rgba(52, 211, 153, 0.4)',
  resistance: 'rgba(248, 113, 113, 0.4)',
  grid: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
};

/**
 * PriceChart — candle, volume, MA, and S/R overlay chart.
 *
 * Uses lightweight-charts to render the bounded chart payload from the
 * analysis API.  No analysis or scoring logic lives here — this is
 * presentation only.  All data comes from the server-side chart contract.
 *
 * @param {object} props
 * @param {object|null} props.chart - The chart payload from guardAnalyze.
 *   Expected shape: { candles, movingAverages, levels, source }
 */
export default function PriceChart({ chart }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !chart || !chart.candles?.length) return;

    // Clean up any existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const c = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { color: 'transparent' },
        textColor: CHART_COLORS.text,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    });

    chartRef.current = c;

    // Candlestick series
    const candleData = chart.candles.map((candle) => ({
      time: candle.date,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    const candleSeries = c.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.bullish,
      downColor: CHART_COLORS.bearish,
      borderUpColor: CHART_COLORS.bullish,
      borderDownColor: CHART_COLORS.bearish,
      wickUpColor: CHART_COLORS.bullish,
      wickDownColor: CHART_COLORS.bearish,
    });
    candleSeries.setData(candleData);

    // Volume histogram on a separate price scale (shares, not lots)
    const volumeData = chart.candles.map((candle) => ({
      time: candle.date,
      value: candle.volume,
      color: candle.close >= candle.open
        ? CHART_COLORS.volumeBullish
        : CHART_COLORS.volumeBearish,
    }));
    const volumeSeries = c.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    c.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(volumeData);

    // Moving average overlay lines
    const maColors = {
      ma5: '#60a5fa',
      ma10: '#a78bfa',
      ma20: '#fbbf24',
      ma50: '#f97316',
      ma200: '#ef4444',
    };
    for (const [key, series] of Object.entries(chart.movingAverages || {})) {
      if (!Array.isArray(series) || !series.length) continue;
      const lineData = series
        .filter((point) => point.value != null)
        .map((point) => ({ time: point.date, value: point.value }));
      if (!lineData.length) continue;
      const lineSeries = c.addSeries(LineSeries, {
        color: maColors[key] || '#9aa0b4',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      lineSeries.setData(lineData);
    }

    // Support/resistance level lines
    for (const support of chart.levels?.supports || []) {
      candleSeries.createPriceLine({
        price: support.price,
        color: CHART_COLORS.support,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `S ${support.price}`,
      });
    }
    for (const resistance of chart.levels?.resistances || []) {
      candleSeries.createPriceLine({
        price: resistance.price,
        color: CHART_COLORS.resistance,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `R ${resistance.price}`,
      });
    }

    c.timeScale().fitContent();

    // Responsive resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width && chartRef.current) {
          chartRef.current.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chart]);

  if (!chart || !chart.candles?.length) {
    return (
      <div className="wb-chart wb-chart--empty">
        <h3 className="wb-section__title text-tertiary">Price Chart</h3>
        <div className="text-tertiary">No chart data available</div>
      </div>
    );
  }

  // Preserve source.name in the payload for diagnostics; do not expose the provider in the header.
  const lastDateLabel = formatDate(chart.source?.lastDate);

  return (
    <div className="wb-chart" data-chart-source={chart.source?.name || undefined}>
      <div className="wb-chart__header">
        <h3 className="wb-section__title text-tertiary">Price Chart</h3>
        <span className="wb-chart__source text-tertiary">
          Data through {lastDateLabel}
        </span>
      </div>
      <div className="wb-chart__canvas" ref={containerRef} />
      <div className="wb-chart__volume-note text-tertiary">
        Volume (shares) · 1 lot = 100 shares
      </div>
      <div className="wb-chart__legend">
        {chart.levels?.supports?.length > 0 && (
          <span className="text-positive">
            Support: {chart.levels.supports.map((l) => formatPrice(l.price)).join(', ')}
          </span>
        )}
        {chart.levels?.resistances?.length > 0 && (
          <span className="text-negative">
            Resistance: {chart.levels.resistances.map((l) => formatPrice(l.price)).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
