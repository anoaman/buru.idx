import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { formatDate, formatPrice } from '../../lib/format/market.js';
import { applyCandleOnlyScale, computeCandleOnlyScale, isPriceInCandleWindow } from './chartScale.js';
import { LABELS, priceLevelCaption } from '../../lib/copy/terms.js';

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

function MarketContextStrip({ macro }) {
  const regime = macro?.regime;
  const strength = macro?.relativeStrength;
  if (!regime && !strength) return null;
  const excess20 = strength?.periods?.[20]?.excessReturnPct;
  const excess60 = strength?.periods?.[60]?.excessReturnPct;
  return (
    <div className="wb-market-context" aria-label="Market versus IHSG">
      <div><span>{LABELS.ihsg}</span><strong>{String(regime?.state || 'unknown').replace('_', ' ')}</strong><small>as of {regime?.asOf || '—'}</small></div>
      <div><span>{LABELS.vsIhsg}</span><strong>{Number.isFinite(excess20) ? `${excess20 >= 0 ? '+' : ''}${excess20.toFixed(1)}% · 20 sessions` : 'Unavailable'}</strong><small>{Number.isFinite(excess60) ? `${excess60 >= 0 ? '+' : ''}${excess60.toFixed(1)}% over 60 sessions` : '60-session history unavailable'}</small></div>
      <div><span>Relative line</span><strong>{strength?.lineState || 'unavailable'}</strong><small>{strength?.matchedSessions || 0} matched sessions</small></div>
      <div><span>Sector</span><strong>{strength?.sector?.available ? 'Available' : 'Not claimed'}</strong><small>{strength?.sector?.available ? strength.sector.symbol : 'Awaiting verified issuer mapping'}</small></div>
    </div>
  );
}

export default function MarketChart({ chart, geometry, scenarioGeometry, ticker, macro = null }) {
  const containerRef = useRef(null);
  const sectionRef = useRef(null);
  const chartRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showMovingAverages, setShowMovingAverages] = useState(false);
  const [showMarket, setShowMarket] = useState(true);
  const [themeVersion, setThemeVersion] = useState(0);
  const [hoverBar, setHoverBar] = useState(null);

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
    const onCrosshairMove = (param) => {
      const bar = param?.seriesData?.get?.(candles);
      if (!bar || !param?.time) {
        setHoverBar(null);
        return;
      }
      setHoverBar({ date: String(param.time), open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    };
    instance.subscribeCrosshairMove?.(onCrosshairMove);

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
    const longSetup = scenarioGeometry?.framing === 'long_setup';
    const failPrice = scenarioGeometry?.invalidation?.price
      ?? scenarioGeometry?.defensiveExit?.price
      ?? best?.stop;
    const targetPrice = longSetup ? scenarioGeometry?.target?.price ?? best?.target : null;
    const triggerPrice = longSetup ? scenarioGeometry?.trigger?.price ?? scenarioGeometry?.confirmation?.price : null;
    const tradeLines = scenarioGeometry?.framing === 'defensive'
      ? [[failPrice, colors.stop, 'DAMAGE IF LOST']]
      : [
          triggerPrice ? [triggerPrice, colors.resistance, 'CONFIRMATION'] : null,
          [failPrice, colors.stop, 'SETUP FAILS BELOW'],
          targetPrice ? [targetPrice, colors.target, `TARGET · R:R ${(scenarioGeometry?.risk?.netRR ?? best?.netRR ?? best?.rr)?.toFixed(2) || '—'}`] : null,
        ].filter(Boolean);
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
      instance.unsubscribeCrosshairMove?.(onCrosshairMove);
      setHoverBar(null);
      chartRef.current = null;
      instance.remove();
    };
  }, [chart, geometry, scenarioGeometry, ticker, showMovingAverages, themeVersion]);

  if (!chart?.candles?.length) return <div className="wb-market-chart wb-market-chart--empty">Chart history unavailable.</div>;

  const legendColors = readChartTheme(typeof document !== 'undefined' ? document.documentElement : null);

  return (
    <section className="wb-market-chart" ref={sectionRef}>
      <header>
        <div>
          <strong>Price & volume</strong>
          {hoverBar
            ? <span className="tabular">{formatDate(hoverBar.date)} · O {formatPrice(hoverBar.open)} · H {formatPrice(hoverBar.high)} · L {formatPrice(hoverBar.low)} · C {formatPrice(hoverBar.close)}</span>
            : <span>Data through {formatDate(chart.source?.lastDate)} · hover chart for OHLC</span>}
        </div>
        <div className="wb-market-chart__actions">
          {(macro?.regime || macro?.relativeStrength) && (
            <button
              type="button"
              aria-pressed={showMarket}
              onClick={() => setShowMarket((visible) => !visible)}
            >
              {showMarket ? `Hide ${LABELS.marketVsIhsg.toLowerCase()}` : `Show ${LABELS.marketVsIhsg.toLowerCase()}`}
            </button>
          )}
          <button type="button" aria-pressed={showMovingAverages} onClick={() => setShowMovingAverages((visible) => !visible)}>{showMovingAverages ? 'Hide MA lines' : 'Show MA lines'}</button>
          <button type="button" onClick={() => (fullscreen ? document.exitFullscreen() : sectionRef.current?.requestFullscreen())}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <a href={`https://www.tradingview.com/chart/?symbol=IDX%3A${encodeURIComponent(ticker?.symbol || '')}`} target="_blank" rel="noopener noreferrer">Open full TradingView ↗</a>
        </div>
      </header>
      {showMarket && <MarketContextStrip macro={macro} />}
      <div className="wb-market-chart__canvas" ref={containerRef} />
      <footer>
        <div className="wb-market-chart__legend">
          {showMovingAverages && Object.entries(legendColors.ma).map(([key, color]) => <span key={key}><i style={{ background: color }} />{key.toUpperCase()}</span>)}
          <span><i style={{ background: legendColors.support }} />Support</span><span><i style={{ background: legendColors.resistance }} />Resistance</span>
        </div>
        <div className="wb-market-chart__setup">
          <span>{LABELS.clearsAbove} <strong className="tabular">{formatPrice(scenarioGeometry?.framing === 'long_setup' ? (scenarioGeometry?.confirmation?.price ?? scenarioGeometry?.trigger?.price) : null)}</strong></span>
          <span>{priceLevelCaption(scenarioGeometry?.framing, { longLabel: LABELS.failsBelow, defensiveLabel: LABELS.damageIfLost })} <strong className="tabular">{formatPrice(scenarioGeometry?.invalidation?.price ?? scenarioGeometry?.defensiveExit?.price ?? geometry?.bestSetup?.stop)}</strong></span>
          <span>{LABELS.upsideTo} <strong className="tabular">{formatPrice(scenarioGeometry?.framing === 'long_setup' ? scenarioGeometry?.target?.price : null)}</strong></span>
          <span>{LABELS.rewardRisk} <strong className="tabular">{scenarioGeometry?.framing === 'long_setup' ? ((scenarioGeometry?.risk?.netRR ?? scenarioGeometry?.risk?.rr)?.toFixed(2) || '—') : '—'}</strong></span>
        </div>
      </footer>
    </section>
  );
}
