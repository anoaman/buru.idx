import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { formatDate, formatPrice } from '../../lib/format/market.js';
import { applyCandleOnlyScale, computeCandleOnlyScale, isPriceInCandleWindow } from './chartScale.js';

export { computeCandleOnlyScale, isPriceInCandleWindow } from './chartScale.js';

const DEFAULT_CHART_HEIGHT = 480;

const MA_TOKEN_KEYS = {
  ma5: '--chart-ma-5',
  ma10: '--chart-ma-10',
  ma20: '--chart-ma-20',
  ma50: '--chart-ma-50',
  ma200: '--chart-ma-200',
};

function readChartTheme(element) {
  const styles = getComputedStyle(element || document.documentElement);
  const token = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    background: token('--chart-bg', '#08090b'),
    text: token('--chart-text', '#98a0a8'),
    grid: token('--chart-grid', 'rgba(255,255,255,.04)'),
    border: token('--chart-border', 'rgba(255,255,255,.10)'),
    crosshair: token('--chart-crosshair', 'rgba(228,231,234,.55)'),
    up: token('--chart-up', '#3fae6f'),
    down: token('--chart-down', '#d9564d'),
    volumeUp: token('--chart-volume-up', 'rgba(52,211,153,.3)'),
    volumeDown: token('--chart-volume-down', 'rgba(248,113,113,.3)'),
    support: token('--chart-support', '#77828a'),
    resistance: token('--chart-resistance', '#77828a'),
    target: token('--chart-target', '#3fae6f'),
    stop: token('--chart-stop', '#d99a34'),
    ma: Object.fromEntries(
      Object.entries(MA_TOKEN_KEYS).map(([key, cssVar]) => [key, token(cssVar, '#98a0a8')]),
    ),
  };
}

export default function MarketChart({ chart, geometry, ticker }) {
  const containerRef = useRef(null);
  const sectionRef = useRef(null);
  const chartRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showMovingAverages, setShowMovingAverages] = useState(false);
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const sync = () => {
      const active = document.fullscreenElement === sectionRef.current;
      setFullscreen(active);
      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container || !chartRef.current) return;
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: active ? container.clientHeight : DEFAULT_CHART_HEIGHT,
        });
      });
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-theme')) {
        setThemeVersion((value) => value + 1);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !chart?.candles?.length) return undefined;
    const colors = readChartTheme(sectionRef.current || document.documentElement);
    const candleScale = computeCandleOnlyScale(chart.candles);
    const instance = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || DEFAULT_CHART_HEIGHT,
      layout: { background: { color: colors.background }, textColor: colors.text, fontSize: 12 },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: {
        borderColor: colors.border,
        autoScale: false,
      },
      timeScale: { borderColor: colors.border, timeVisible: false },
      crosshair: {
        mode: 1,
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.border },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.border },
      },
    });
    chartRef.current = instance;
    const candles = instance.addSeries(CandlestickSeries, {
      upColor: colors.up, downColor: colors.down, borderUpColor: colors.up,
      borderDownColor: colors.down, wickUpColor: colors.up, wickDownColor: colors.down,
      autoscaleInfoProvider: candleScale
        ? () => ({
          priceRange: {
            minValue: candleScale.price.from,
            maxValue: candleScale.price.to,
          },
        })
        : undefined,
    });
    candles.setData(chart.candles.map((row) => ({ time: row.date, open: row.open, high: row.high, low: row.low, close: row.close })));

    const volume = instance.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    instance.priceScale('volume').applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
    volume.setData(chart.candles.map((row) => ({
      time: row.date,
      value: row.volume,
      color: row.close >= row.open ? colors.volumeUp : colors.volumeDown,
    })));

    Object.entries(showMovingAverages ? chart.movingAverages || {} : {}).forEach(([key, points]) => {
      const data = (points || []).filter((point) => Number.isFinite(point.value)).map((point) => ({ time: point.date, value: point.value }));
      if (!data.length) return;
      const line = instance.addSeries(LineSeries, {
        color: colors.ma[key] || colors.text,
        lineWidth: key === 'ma20' ? 2 : 1,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        autoscaleInfoProvider: () => null,
      });
      line.setData(data);
    });

    // Overlays live on a transparent series that never contributes to autoscaling.
    // Price lines on the candle series itself can still widen the visible range
    // even after setAutoScale(false) / setVisibleRange in some layout passes.
    // Lines outside the candle-only window are omitted so LWC cannot clamp their
    // axis labels to the chart edges (which looks like overlay-driven autoscaling).
    const overlays = instance.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      lineWidth: 0,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    });
    overlays.setData(chart.candles.map((row) => ({ time: row.date, value: row.close })));

    const addOverlayLine = (price, options) => {
      if (!isPriceInCandleWindow(price, candleScale)) return;
      overlays.createPriceLine({ price, ...options });
    };

    (chart.levels?.supports || []).slice(0, 3).forEach((level) => addOverlayLine(level.price, { color: colors.support, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `S ${formatPrice(level.price)}` }));
    (chart.levels?.resistances || []).slice(0, 3).forEach((level) => addOverlayLine(level.price, { color: colors.resistance, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `R ${formatPrice(level.price)}` }));
    if (!(chart.levels?.resistances || []).length && ticker?.high > ticker?.close) {
      addOverlayLine(ticker.high, { color: colors.stop, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `DAY HIGH · UNCONFIRMED ${formatPrice(ticker.high)}` });
    }
    const best = geometry?.bestSetup;
    const tradeLines = [
      [best?.stop, colors.stop, 'SETUP FAILS BELOW'], [best?.target, colors.target, `TARGET · R:R ${(best?.netRR ?? best?.rr)?.toFixed(2) || '—'}`],
    ];
    tradeLines.forEach(([price, color, title]) => addOverlayLine(price, { color, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title }));

    const lockScale = () => applyCandleOnlyScale(instance, candles, candleScale);
    lockScale();
    requestAnimationFrame(() => {
      if (chartRef.current === instance) lockScale();
    });
    // Layout/theme passes can briefly re-open autoscaling; re-assert candle-only bounds.
    const relockTimers = [80, 250].map((ms) => setTimeout(() => {
      if (chartRef.current === instance) lockScale();
    }, ms));

    const observer = new ResizeObserver(([entry]) => {
      if (!entry?.contentRect.width || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: entry.contentRect.width,
        height: entry.contentRect.height || DEFAULT_CHART_HEIGHT,
      });
      lockScale();
    });
    observer.observe(containerRef.current);
    return () => {
      relockTimers.forEach(clearTimeout);
      observer.disconnect();
      chartRef.current = null;
      instance.remove();
    };
  }, [chart, geometry, ticker, showMovingAverages, themeVersion]);

  if (!chart?.candles?.length) return <div className="wb-market-chart wb-market-chart--empty">Chart history unavailable.</div>;

  const legendColors = readChartTheme(typeof document !== 'undefined' ? document.documentElement : null);

  return (
    <section className="wb-market-chart" ref={sectionRef}>
      <header>
        <div><strong>Price & volume</strong><span>Data through {formatDate(chart.source?.lastDate)}</span></div>
        <div className="wb-market-chart__actions">
          <button type="button" aria-pressed={showMovingAverages} onClick={() => setShowMovingAverages((visible) => !visible)}>{showMovingAverages ? 'Hide MA lines' : 'Show MA lines'}</button>
          <button type="button" onClick={() => (fullscreen ? document.exitFullscreen() : sectionRef.current?.requestFullscreen())}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <a href={`https://www.tradingview.com/chart/?symbol=IDX%3A${encodeURIComponent(ticker?.symbol || '')}`} target="_blank" rel="noopener noreferrer">Open full TradingView ↗</a>
        </div>
      </header>
      <div className="wb-market-chart__canvas" ref={containerRef} />
      <footer>
        <div className="wb-market-chart__legend">
          {showMovingAverages && Object.entries(legendColors.ma).map(([key, color]) => <span key={key}><i style={{ background: color }} />{key.toUpperCase()}</span>)}
          <span><i style={{ background: legendColors.support }} />Support</span><span><i style={{ background: legendColors.resistance }} />Resistance</span>
        </div>
        <div className="wb-market-chart__setup">
          <span>Confirmation entry <strong className="tabular">{formatPrice(geometry?.bestSetup?.entry)}</strong></span>
          <span>Setup fails below <strong className="tabular text-negative">{formatPrice(geometry?.bestSetup?.stop)}</strong></span>
          <span>Target <strong className="tabular">{formatPrice(geometry?.bestSetup?.target)}</strong></span>
          <span>Reward / risk <strong className="tabular">{(geometry?.bestSetup?.netRR ?? geometry?.bestSetup?.rr)?.toFixed(2) || '—'}</strong></span>
        </div>
      </footer>
    </section>
  );
}
