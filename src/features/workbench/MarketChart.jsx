import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { formatDate, formatPrice, formatVolume } from '../../lib/format/market.js';
import { OutlookHorizon } from './StockRead.jsx';
import { applyCandleOnlyScale, computeCandleOnlyScale, isPriceInCandleWindow } from './chartScale.js';

export { computeCandleOnlyScale, isPriceInCandleWindow } from './chartScale.js';

const DEFAULT_CHART_HEIGHT = 480;
const MA_KEYS = ['ma5', 'ma10', 'ma20', 'ma50', 'ma200'];
const RANGES = [[20, '20D'], [60, '60D'], [120, '120D'], ['all', 'All']];
// Each toggle owns one kind of line, so support and resistance switch separately.
export const OVERLAYS = [
  { key: 'support', label: 'Support', on: true },
  { key: 'resistance', label: 'Resistance', on: true },
  { key: 'range', label: 'Outlook range', on: true },
  { key: 'cost', label: 'Buyer cost', on: true },
  { key: 'ma', label: 'MA', on: false },
  { key: 'volume', label: 'Volume', on: true },
  { key: 'foreign', label: 'Foreign', on: false },
];
const OVERLAY_STORAGE_KEY = 'nalar.chart.overlays';

function readOverlays() {
  const defaults = Object.fromEntries(OVERLAYS.map((item) => [item.key, item.on]));
  try {
    const saved = JSON.parse(localStorage.getItem(OVERLAY_STORAGE_KEY) || '{}');
    return Object.fromEntries(OVERLAYS.map(({ key }) => [key, typeof saved[key] === 'boolean' ? saved[key] : defaults[key]]));
  } catch {
    return defaults;
  }
}

function readChartTheme(element) {
  const styles = getComputedStyle(element || document.documentElement);
  const token = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    background: token('--chart-bg', '#08090b'),
    text: token('--chart-text', '#98a0a8'),
    grid: token('--chart-grid', 'rgba(255,255,255,.04)'),
    border: token('--chart-border', 'rgba(255,255,255,.10)'),
    crosshair: token('--chart-crosshair', '#98a0a8'),
    up: token('--chart-up', '#3fae6f'),
    down: token('--chart-down', '#d9564d'),
    volumeUp: token('--chart-volume-up', 'rgba(52,211,153,.3)'),
    volumeDown: token('--chart-volume-down', 'rgba(248,113,113,.3)'),
    support: token('--chart-support', '#2dd4bf'),
    resistance: token('--chart-resistance', '#fb923c'),
    range: token('--color-accent', '#a8c93a'),
    cost: token('--chart-cost', '#c084fc'),
    foreignBuy: token('--chart-volume-up', 'rgba(52,211,153,.3)'),
    foreignSell: token('--chart-volume-down', 'rgba(248,113,113,.3)'),
    ma: Object.fromEntries(MA_KEYS.map((key) => [key, token('--chart-ma-' + key.slice(2), '#98a0a8')])),
  };
}

export default function MarketChart({ chart, outlook, outlooks, onHorizonChange, buyerCost, ticker }) {
  const containerRef = useRef(null);
  const sectionRef = useRef(null);
  const controlsRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [overlays, setOverlays] = useState(readOverlays);
  const [range, setRange] = useState(60);
  const [customRange, setCustomRange] = useState(false);
  const [inspectedIndex, setInspectedIndex] = useState(null);
  const rows = chart?.candles || [];

  // Only a new analysis creates a chart. Theme, overlays, resizing and candle
  // inspection update the existing instance, preserving manual zoom and pan.
  useEffect(() => {
    if (!containerRef.current || !chart?.candles?.length) return undefined;
    const data = chart.candles;
    let colors = readChartTheme(sectionRef.current);
    let currentScale = computeCandleOnlyScale(data);
    let shown = readOverlays();
    let choosingRange = false;
    setRange(60);
    setCustomRange(false);
    setInspectedIndex(null);

    const instance = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || DEFAULT_CHART_HEIGHT,
      layout: { background: { color: colors.background }, textColor: colors.text, fontSize: 12 },
      localization: { priceFormatter: formatPrice },
      grid: { vertLines: { visible: false }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border, autoScale: false },
      timeScale: { borderColor: colors.border, timeVisible: false, lockVisibleTimeRangeOnResize: true },
      crosshair: {
        mode: 1,
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.background },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.background },
      },
    });
    const candles = instance.addSeries(CandlestickSeries, {
      upColor: colors.up, downColor: colors.down, borderUpColor: colors.up,
      borderDownColor: colors.down, wickUpColor: colors.up, wickDownColor: colors.down,
    });
    candles.setData(data.map((row) => ({ time: row.date, open: row.open, high: row.high, low: row.low, close: row.close })));
    const volume = instance.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false });
    const foreign = instance.addSeries(HistogramSeries, { priceScaleId: 'foreign', lastValueVisible: false, priceLineVisible: false, visible: false });
    const hasForeign = data.some((row) => Number.isFinite(row.foreignNet));
    const updateForeignColors = () => foreign.setData(data.filter((row) => Number.isFinite(row.foreignNet)).map((row) => ({
      time: row.date, value: row.foreignNet, color: row.foreignNet >= 0 ? colors.foreignBuy : colors.foreignSell,
    })));
    updateForeignColors();
    // Volume and foreign share the bottom of the pane; when both show, foreign sits just above volume.
    const layoutBands = () => {
      instance.priceScale('volume').applyOptions({ scaleMargins: { top: .84, bottom: 0 } });
      instance.priceScale('foreign').applyOptions({ scaleMargins: shown.volume ? { top: .7, bottom: .17 } : { top: .84, bottom: 0 } });
      volume.applyOptions({ visible: shown.volume });
      foreign.applyOptions({ visible: shown.foreign && hasForeign });
    };
    const updateVolumeColors = () => volume.setData(data.map((row) => ({
      time: row.date, value: row.volume,
      color: row.close >= row.open ? colors.volumeUp : colors.volumeDown,
    })));
    updateVolumeColors();

    const averages = new Map();
    for (const key of MA_KEYS) {
      const points = (chart.movingAverages?.[key] || []).filter((point) => Number.isFinite(point.value));
      if (!points.length) continue;
      const line = instance.addSeries(LineSeries, {
        color: colors.ma[key], lineWidth: key === 'ma20' ? 2 : 1,
        visible: false, priceLineVisible: false, lastValueVisible: false,
        crosshairMarkerVisible: false, autoscaleInfoProvider: () => null,
      });
      line.setData(points.map((point) => ({ time: point.date, value: point.value })));
      averages.set(key, line);
    }

    // Levels never expand the price scale. A wider range preset can reveal
    // levels omitted from the default view, without clamping labels at its edges.
    const overlays = instance.addSeries(LineSeries, {
      color: 'transparent', lastValueVisible: false, priceLineVisible: false,
      crosshairMarkerVisible: false, autoscaleInfoProvider: () => null,
    });
    overlays.setData(data.map((row) => ({ time: row.date, value: row.close })));
    const priceLines = [];
    // lineStyle: 0 solid, 1 dotted, 2 dashed.
    const addLevel = (group, price, colorKey, title, { width = 1, style = 2 } = {}) => {
      if (!Number.isFinite(price)) return;
      const line = overlays.createPriceLine({ price, color: colors[colorKey], title, lineWidth: width, lineStyle: style, lineVisible: false, axisLabelVisible: false });
      const item = { group, price, colorKey, line };
      priceLines.push(item);
      return item;
    };
    (chart.levels?.supports || []).slice(0, 3).forEach((level) => addLevel('support', level.price, 'support', 'S'));
    (chart.levels?.resistances || []).slice(0, 3).forEach((level) => addLevel('resistance', level.price, 'resistance', 'R'));
    const rangeLines = ['high', 'low'].map((key) => ({ key, item: addLevel('range', 0, 'range', '', { width: 1, style: 1 }) }));
    if (buyerCost?.avg) addLevel('cost', buyerCost.avg, 'cost', `${buyerCost.code} cost`, { width: 2, style: 1 });
    const updateLevels = () => priceLines.forEach(({ group, price, colorKey, line }) => {
      const visible = Number.isFinite(price) && shown[group] && isPriceInCandleWindow(price, currentScale);
      line?.applyOptions({ color: colors[colorKey], lineVisible: visible, axisLabelVisible: visible });
    });
    const chooseRange = (value) => {
      currentScale = computeCandleOnlyScale(data, value === 'all' ? data.length : value);
      choosingRange = true;
      applyCandleOnlyScale(instance, candles, currentScale);
      choosingRange = false;
      updateLevels();
      setRange(value);
      setCustomRange(false);
    };
    chooseRange(60);

    const dates = new Map(data.map((row, index) => [row.date, index]));
    const onCrosshair = (event) => {
      const time = event.seriesData?.get(candles)?.time;
      const date = typeof time === 'object' && time
        ? time.year + '-' + String(time.month).padStart(2, '0') + '-' + String(time.day).padStart(2, '0')
        : time;
      setInspectedIndex(dates.get(date) ?? null);
    };
    const onRange = (visible) => {
      if (!visible || choosingRange || !currentScale) return;
      setCustomRange(Math.abs(visible.from - currentScale.logical.from) > .5 || Math.abs(visible.to - currentScale.logical.to) > .5);
    };
    instance.subscribeCrosshairMove(onCrosshair);
    instance.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    const resize = new ResizeObserver(([entry]) => {
      if (!entry?.contentRect.width) return;
      instance.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height || DEFAULT_CHART_HEIGHT });
    });
    resize.observe(containerRef.current);

    const themeObserver = new MutationObserver(() => {
      colors = readChartTheme(sectionRef.current);
      instance.applyOptions({
        layout: { background: { color: colors.background }, textColor: colors.text },
        grid: { horzLines: { color: colors.grid } },
        rightPriceScale: { borderColor: colors.border },
        timeScale: { borderColor: colors.border },
        crosshair: {
          vertLine: { color: colors.crosshair, labelBackgroundColor: colors.background },
          horzLine: { color: colors.crosshair, labelBackgroundColor: colors.background },
        },
      });
      candles.applyOptions({ upColor: colors.up, downColor: colors.down, borderUpColor: colors.up, borderDownColor: colors.down, wickUpColor: colors.up, wickDownColor: colors.down });
      updateVolumeColors();
      updateForeignColors();
      averages.forEach((line, key) => line.applyOptions({ color: colors.ma[key] }));
      updateLevels();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    controlsRef.current = {
      chooseRange,
      setOutlook: (next) => {
        rangeLines.forEach(({ key, item }) => {
          item.price = next?.range?.[key] ?? null;
          if (Number.isFinite(item.price)) item.line?.applyOptions({ price: item.price, title: `${next.sessions ?? 10}S ${key}` });
        });
        updateLevels();
      },
      setOverlays: (next) => {
        shown = next;
        averages.forEach((line) => line.applyOptions({ visible: next.ma }));
        layoutBands();
        updateLevels();
      },
      inspect: (index) => {
        const row = data[index];
        if (row) instance.setCrosshairPosition(row.close, row.date, candles);
      },
    };
    return () => {
      resize.disconnect();
      themeObserver.disconnect();
      instance.unsubscribeCrosshairMove(onCrosshair);
      instance.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      controlsRef.current = null;
      instance.remove();
    };
  }, [chart, buyerCost, ticker]);

  useEffect(() => {
    controlsRef.current?.setOutlook(outlook);
  }, [chart, buyerCost, ticker, outlook]);

  useEffect(() => {
    controlsRef.current?.setOverlays(overlays);
    try { localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlays)); } catch { /* storage blocked */ }
  }, [chart, outlook, buyerCost, ticker, overlays]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === sectionRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = async () => {
    setFullscreenError('');
    try {
      if (fullscreen) await document.exitFullscreen();
      else if (sectionRef.current?.requestFullscreen) await sectionRef.current.requestFullscreen();
      else setFullscreenError('Full screen is unavailable in this browser.');
    } catch {
      setFullscreenError('Full screen is unavailable. You can continue using the chart here.');
    }
  };
  const inspect = (direction) => {
    const next = Math.max(0, Math.min(rows.length - 1, (inspectedIndex ?? rows.length - 1) + direction));
    controlsRef.current?.inspect(next);
    setInspectedIndex(next);
  };

  if (!rows.length) return <div className="wb-market-chart wb-market-chart--empty">Chart history unavailable.</div>;
  const candle = rows[inspectedIndex ?? rows.length - 1] || rows[rows.length - 1];
  const available = {
    cost: Boolean(buyerCost?.avg),
    range: Boolean(outlook?.range),
    foreign: rows.some((row) => Number.isFinite(row.foreignNet)),
  };

  return (
    <section className="wb-market-chart" ref={sectionRef} aria-label="Price and volume chart">
      <header className="wb-market-chart__header">
        <div><strong><span className="wb-chart-title">Price & volume</span> <small>1D · IDR</small></strong><span>Data through {formatDate(chart.source?.lastDate || rows.at(-1)?.date)}</span></div>
        <div className="wb-market-chart__actions">
          <button type="button" onClick={() => controlsRef.current?.chooseRange(60)} title="Restore the latest 60 trading sessions and price scale">Reset view</button>
          <button type="button" onClick={toggleFullscreen}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <a href={'https://www.tradingview.com/chart/?symbol=IDX%3A' + encodeURIComponent(ticker?.symbol || '')} target="_blank" rel="noopener noreferrer" aria-label="Open full TradingView in a new tab">TradingView ↗</a>
        </div>
      </header>
      <div className="wb-chart-toolbar">
        <div className="wb-chart-ranges" role="group" aria-label="Chart range in trading sessions">
          {RANGES.map(([value, label]) => <button type="button" key={value} aria-pressed={!customRange && range === value} onClick={() => controlsRef.current?.chooseRange(value)}>{label}</button>)}
          <span>{customRange ? 'Custom view' : Math.min(range === 'all' ? rows.length : range, rows.length) + ' sessions'}</span>
        </div>
        <div className="wb-chart-overlays" role="group" aria-label="Chart overlays">
          {OVERLAYS.map(({ key, label }) => (
            <button
              type="button" key={key} className={`wb-overlay wb-overlay--${key}`}
              aria-pressed={Boolean(overlays[key] && available[key] !== false)}
              disabled={available[key] === false}
              title={available[key] === false ? `${label} unavailable for this stock` : `Toggle ${label.toLowerCase()}`}
              onClick={() => setOverlays((current) => ({ ...current, [key]: !current[key] }))}
            >
              <i aria-hidden="true" />{key === 'cost' && buyerCost?.code ? `${buyerCost.code} cost` : label}
            </button>
          ))}
          <OutlookHorizon outlooks={outlooks} sessions={outlook?.sessions} onChange={onHorizonChange} label="Chart outlook horizon" />
        </div>
      </div>
      <div className="wb-chart-readout" aria-label="Selected candle values">
        <div className="wb-chart-readout__date">
          <button type="button" aria-label="Previous session" disabled={inspectedIndex === 0} onClick={() => inspect(-1)}>‹</button>
          <time dateTime={candle.date}>{new Date(candle.date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</time>
          <button type="button" aria-label="Next session" disabled={inspectedIndex == null || inspectedIndex >= rows.length - 1} onClick={() => inspect(1)}>›</button>
        </div>
        <dl className="wb-chart-readout__values">
          {[['Open', candle.open], ['High', candle.high], ['Low', candle.low], ['Close', candle.close]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={label === 'Close' ? candle.close >= candle.open ? 'text-positive' : 'text-negative' : ''}>{formatPrice(value)}</dd></div>)}
          <div><dt>Volume</dt><dd>{formatVolume(candle.volume)}</dd></div>
        </dl>
      </div>
      {fullscreenError && <p className="wb-chart-notice" role="status">{fullscreenError}</p>}
      <div className="wb-market-chart__canvas" ref={containerRef} tabIndex={0} aria-label="Interactive price chart. Use left and right arrow keys to inspect sessions." onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        inspect(event.key === 'ArrowLeft' ? -1 : 1);
      }} />
      <footer>
        <div className="wb-chart-help"><span>Drag to pan · Scroll to zoom · ← → to inspect</span><span>Daily candles · Delayed data</span></div>
      </footer>
    </section>
  );
}
