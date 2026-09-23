import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { formatDate, formatPrice, formatVolume } from '../../lib/format/market.js';
import { applyCandleOnlyScale, computeCandleOnlyScale, isPriceInCandleWindow } from './chartScale.js';

export { computeCandleOnlyScale, isPriceInCandleWindow } from './chartScale.js';

const DEFAULT_CHART_HEIGHT = 480;
const MA_KEYS = ['ma5', 'ma10', 'ma20', 'ma50', 'ma200'];
const RANGES = [[20, '20D'], [60, '60D'], [120, '120D'], ['all', 'All']];

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
    support: token('--chart-support', '#77828a'),
    resistance: token('--chart-resistance', '#77828a'),
    target: token('--chart-target', '#3fae6f'),
    entry: token('--color-accent', '#a8c93a'),
    stop: token('--chart-stop', '#d99a34'),
    ma: Object.fromEntries(MA_KEYS.map((key) => [key, token('--chart-ma-' + key.slice(2), '#98a0a8')])),
  };
}

export default function MarketChart({ chart, geometry, ticker }) {
  const containerRef = useRef(null);
  const sectionRef = useRef(null);
  const controlsRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [showMovingAverages, setShowMovingAverages] = useState(false);
  const [enabledMAs, setEnabledMAs] = useState(MA_KEYS);
  const [showLevels, setShowLevels] = useState(true);
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
    let levelsVisible = true;
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
    instance.priceScale('volume').applyOptions({ scaleMargins: { top: .84, bottom: 0 } });
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
    const addLevel = (price, colorKey, title, lineWidth = 1) => {
      if (!Number.isFinite(price)) return;
      const visible = isPriceInCandleWindow(price, currentScale);
      const line = overlays.createPriceLine({
        price, color: colors[colorKey], title, lineWidth,
        lineStyle: lineWidth === 2 ? 0 : 2, lineVisible: visible, axisLabelVisible: visible,
      });
      priceLines.push({ price, colorKey, line });
    };
    (chart.levels?.supports || []).slice(0, 3).forEach((level) => addLevel(level.price, 'support', 'Support'));
    (chart.levels?.resistances || []).slice(0, 3).forEach((level) => addLevel(level.price, 'resistance', 'Resistance'));
    if (!(chart.levels?.resistances || []).length && ticker?.high > ticker?.close) {
      addLevel(ticker.high, 'stop', 'Day high · unconfirmed');
    }
    addLevel(geometry?.bestSetup?.entry, 'entry', 'Confirmation entry', 2);
    addLevel(geometry?.bestSetup?.stop ?? geometry?.invalidation, 'stop', 'Setup fails below', 2);
    addLevel(geometry?.bestSetup?.target ?? geometry?.target, 'target', 'Target', 2);
    const updateLevels = () => priceLines.forEach(({ price, colorKey, line }) => {
      const visible = levelsVisible && isPriceInCandleWindow(price, currentScale);
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
      averages.forEach((line, key) => line.applyOptions({ color: colors.ma[key] }));
      updateLevels();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    controlsRef.current = {
      chooseRange,
      setAverages: (show, enabled) => averages.forEach((line, key) => line.applyOptions({ visible: show && enabled.includes(key) })),
      setLevels: (show) => { levelsVisible = show; updateLevels(); },
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
  }, [chart, geometry, ticker]);

  useEffect(() => {
    controlsRef.current?.setAverages(showMovingAverages, enabledMAs);
    controlsRef.current?.setLevels(showLevels);
  }, [chart, geometry, ticker, showMovingAverages, enabledMAs, showLevels]);

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
  const best = geometry?.bestSetup;
  const target = best?.target ?? geometry?.target;
  const ratio = best?.netRR ?? best?.rr;

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
          <button type="button" aria-pressed={showLevels} onClick={() => setShowLevels((value) => !value)}>Levels</button>
          <button type="button" aria-pressed={showMovingAverages} onClick={() => setShowMovingAverages((value) => !value)}>{showMovingAverages ? 'Hide MA lines' : 'Show MA lines'}</button>
        </div>
      </div>
      {showMovingAverages && <div className="wb-chart-averages" role="group" aria-label="Moving averages">
        <span>Moving averages</span>
        {MA_KEYS.map((key) => {
          const available = chart.movingAverages?.[key]?.some((point) => Number.isFinite(point.value));
          return <button type="button" key={key} disabled={!available} aria-pressed={Boolean(available && enabledMAs.includes(key))} title={available ? 'Toggle ' + key.toUpperCase() : key.toUpperCase() + ' history unavailable'} onClick={() => setEnabledMAs((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key])}><i style={{ background: 'var(--chart-ma-' + key.slice(2) + ')' }} />{key.toUpperCase()}</button>;
        })}
      </div>}
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
        <dl className="wb-chart-setup" aria-label="Chart setup levels">
          <div><dt>Confirmation entry</dt><dd>{formatPrice(best?.entry)}</dd></div>
          <div><dt>Setup fails below</dt><dd className="text-negative">{formatPrice(best?.stop ?? geometry?.invalidation)}</dd></div>
          <div><dt>Target</dt><dd>{target != null ? formatPrice(target) : 'No confirmed target'}</dd></div>
          <div><dt>Reward / risk</dt><dd>{Number.isFinite(ratio) ? ratio.toFixed(2) : '—'}</dd></div>
        </dl>
      </footer>
    </section>
  );
}
