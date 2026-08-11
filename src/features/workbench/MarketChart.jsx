import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { formatDate, formatPrice } from '../../lib/format/market.js';

const COLORS = {
  text: '#9aa0b4', up: '#34d399', down: '#f87171', grid: 'rgba(255,255,255,.04)',
  border: 'rgba(255,255,255,.08)', support: '#34d399', resistance: '#f87171',
  target: '#22c55e', stop: '#ef4444',
};
const MA_COLORS = { ma5: '#60a5fa', ma10: '#a78bfa', ma20: '#fbbf24', ma50: '#f97316', ma200: '#ef4444' };
const DEFAULT_CHART_HEIGHT = 480;

export default function MarketChart({ chart, geometry, ticker }) {
  const containerRef = useRef(null);
  const sectionRef = useRef(null);
  const chartRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showMovingAverages, setShowMovingAverages] = useState(true);

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
    if (!containerRef.current || !chart?.candles?.length) return undefined;
    const instance = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || DEFAULT_CHART_HEIGHT,
      layout: { background: { color: 'transparent' }, textColor: COLORS.text, fontSize: 11 },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      rightPriceScale: { borderColor: COLORS.border },
      timeScale: { borderColor: COLORS.border, timeVisible: false },
      crosshair: { mode: 1 },
    });
    chartRef.current = instance;
    const candles = instance.addSeries(CandlestickSeries, {
      upColor: COLORS.up, downColor: COLORS.down, borderUpColor: COLORS.up,
      borderDownColor: COLORS.down, wickUpColor: COLORS.up, wickDownColor: COLORS.down,
    });
    candles.setData(chart.candles.map((row) => ({ time: row.date, open: row.open, high: row.high, low: row.low, close: row.close })));

    const volume = instance.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    instance.priceScale('volume').applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
    volume.setData(chart.candles.map((row) => ({ time: row.date, value: row.volume, color: row.close >= row.open ? 'rgba(52,211,153,.3)' : 'rgba(248,113,113,.3)' })));

    Object.entries(showMovingAverages ? chart.movingAverages || {} : {}).forEach(([key, points]) => {
      const data = (points || []).filter((point) => Number.isFinite(point.value)).map((point) => ({ time: point.date, value: point.value }));
      if (!data.length) return;
      const line = instance.addSeries(LineSeries, { color: MA_COLORS[key] || COLORS.text, lineWidth: key === 'ma20' ? 2 : 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
      line.setData(data);
    });

    (chart.levels?.supports || []).slice(0, 3).forEach((level) => candles.createPriceLine({ price: level.price, color: COLORS.support, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `S ${formatPrice(level.price)}` }));
    (chart.levels?.resistances || []).slice(0, 3).forEach((level) => candles.createPriceLine({ price: level.price, color: COLORS.resistance, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `R ${formatPrice(level.price)}` }));
    if (!(chart.levels?.resistances || []).length && ticker?.high > ticker?.close) {
      candles.createPriceLine({ price: ticker.high, color: '#fbbf24', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `SESSION HIGH · UNCONFIRMED ${formatPrice(ticker.high)}` });
    }
    const best = geometry?.bestSetup;
    const tradeLines = [
      [best?.stop, COLORS.stop, 'SETUP FAILS BELOW'], [best?.target, COLORS.target, `TARGET · R:R ${(best?.netRR ?? best?.rr)?.toFixed(2) || '—'}`],
    ];
    tradeLines.filter(([price]) => Number.isFinite(price)).forEach(([price, color, title]) => candles.createPriceLine({ price, color, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title }));

    const visibleCount = Math.min(60, chart.candles.length);
    instance.timeScale().setVisibleLogicalRange?.({ from: chart.candles.length - visibleCount - 1, to: chart.candles.length + 2 });
    const visibleCandles = chart.candles.slice(-visibleCount);
    const visibleLow = Math.min(...visibleCandles.map((row) => row.low));
    const visibleHigh = Math.max(...visibleCandles.map((row) => row.high));
    const padding = Math.max((visibleHigh - visibleLow) * 0.08, visibleHigh * 0.01);
    instance.priceScale('right').setVisibleRange?.({ from: visibleLow - padding, to: visibleHigh + padding });
    instance.priceScale('right').setAutoScale?.(false);
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) instance.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height || DEFAULT_CHART_HEIGHT });
    });
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); chartRef.current = null; instance.remove(); };
  }, [chart, geometry, ticker, showMovingAverages]);

  if (!chart?.candles?.length) return <div className="wb-market-chart wb-market-chart--empty">Chart history unavailable.</div>;
  return (
    <section className="wb-market-chart" ref={sectionRef}>
      <header>
        <div><strong>NALAR Market Chart</strong><span>TradingView Lightweight Charts · data through {formatDate(chart.source?.lastDate)}</span></div>
        <div className="wb-market-chart__actions">
          <button type="button" aria-pressed={showMovingAverages} onClick={() => setShowMovingAverages((visible) => !visible)}>{showMovingAverages ? 'Hide MA lines' : 'Show MA lines'}</button>
          <button type="button" onClick={() => (fullscreen ? document.exitFullscreen() : sectionRef.current?.requestFullscreen())}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <a href={`https://www.tradingview.com/chart/?symbol=IDX%3A${encodeURIComponent(ticker?.symbol || '')}`} target="_blank" rel="noopener noreferrer">Open full TradingView ↗</a>
        </div>
      </header>
      <div className="wb-market-chart__canvas" ref={containerRef} />
      <footer>
        <div className="wb-market-chart__legend">
          {showMovingAverages && Object.entries(MA_COLORS).map(([key, color]) => <span key={key}><i style={{ background: color }} />{key.toUpperCase()}</span>)}
          <span><i style={{ background: COLORS.support }} />Support</span><span><i style={{ background: COLORS.resistance }} />Resistance</span>
        </div>
        <div className="wb-market-chart__setup">
          <span>Confirmation entry <strong>{formatPrice(geometry?.bestSetup?.entry ?? ticker?.close)}</strong></span>
          <span>Setup fails below <strong>{formatPrice(geometry?.bestSetup?.stop)}</strong></span>
          <span>Target <strong>{formatPrice(geometry?.bestSetup?.target)}</strong></span>
          <span>Reward / risk <strong>{(geometry?.bestSetup?.netRR ?? geometry?.bestSetup?.rr)?.toFixed(2) || '—'}</strong></span>
        </div>
      </footer>
    </section>
  );
}
