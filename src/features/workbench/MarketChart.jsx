import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { formatDate, formatPrice } from '../../lib/format/market.js';

const COLORS = {
  text: '#9aa0b4', up: '#34d399', down: '#f87171', grid: 'rgba(255,255,255,.04)',
  border: 'rgba(255,255,255,.08)', support: '#34d399', resistance: '#f87171',
  entry: '#60a5fa', target: '#22c55e', stop: '#ef4444',
};
const MA_COLORS = { ma5: '#60a5fa', ma10: '#a78bfa', ma20: '#fbbf24', ma50: '#f97316', ma200: '#ef4444' };

export default function MarketChart({ chart, geometry, ticker }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !chart?.candles?.length) return undefined;
    const instance = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 480,
      layout: { background: { color: 'transparent' }, textColor: COLORS.text, fontSize: 11 },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      rightPriceScale: { borderColor: COLORS.border },
      timeScale: { borderColor: COLORS.border, timeVisible: false },
      crosshair: { mode: 1 },
    });
    const candles = instance.addSeries(CandlestickSeries, {
      upColor: COLORS.up, downColor: COLORS.down, borderUpColor: COLORS.up,
      borderDownColor: COLORS.down, wickUpColor: COLORS.up, wickDownColor: COLORS.down,
    });
    candles.setData(chart.candles.map((row) => ({ time: row.date, open: row.open, high: row.high, low: row.low, close: row.close })));

    const volume = instance.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    instance.priceScale('volume').applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
    volume.setData(chart.candles.map((row) => ({ time: row.date, value: row.volume, color: row.close >= row.open ? 'rgba(52,211,153,.3)' : 'rgba(248,113,113,.3)' })));

    Object.entries(chart.movingAverages || {}).forEach(([key, points]) => {
      const data = (points || []).filter((point) => Number.isFinite(point.value)).map((point) => ({ time: point.date, value: point.value }));
      if (!data.length) return;
      const line = instance.addSeries(LineSeries, { color: MA_COLORS[key] || COLORS.text, lineWidth: key === 'ma20' ? 2 : 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
      line.setData(data);
    });

    (chart.levels?.supports || []).slice(0, 3).forEach((level) => candles.createPriceLine({ price: level.price, color: COLORS.support, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `S ${formatPrice(level.price)}` }));
    (chart.levels?.resistances || []).slice(0, 3).forEach((level) => candles.createPriceLine({ price: level.price, color: COLORS.resistance, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `R ${formatPrice(level.price)}` }));
    const best = geometry?.bestSetup;
    const tradeLines = [
      [ticker?.close, COLORS.entry, 'ENTRY'], [best?.stop, COLORS.stop, 'INVALIDATION'], [best?.target, COLORS.target, `TARGET · R:R ${(best?.netRR ?? best?.rr)?.toFixed(2) || '—'}`],
    ];
    tradeLines.filter(([price]) => Number.isFinite(price)).forEach(([price, color, title]) => candles.createPriceLine({ price, color, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title }));

    instance.timeScale().fitContent();
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) instance.applyOptions({ width: entry.contentRect.width });
    });
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); instance.remove(); };
  }, [chart, geometry, ticker]);

  if (!chart?.candles?.length) return <div className="wb-market-chart wb-market-chart--empty">Chart history unavailable.</div>;
  return (
    <section className="wb-market-chart">
      <header>
        <div><strong>NALAR Market Chart</strong><span>TradingView Lightweight Charts · data through {formatDate(chart.source?.lastDate)}</span></div>
        <a href={`https://www.tradingview.com/chart/?symbol=IDX%3A${encodeURIComponent(ticker?.symbol || '')}`} target="_blank" rel="noopener noreferrer">Open full TradingView ↗</a>
      </header>
      <div className="wb-market-chart__canvas" ref={containerRef} />
      <footer>
        {Object.entries(MA_COLORS).map(([key, color]) => <span key={key}><i style={{ background: color }} />{key.toUpperCase()}</span>)}
        <span><i style={{ background: COLORS.support }} />Support</span><span><i style={{ background: COLORS.resistance }} />Resistance</span>
      </footer>
    </section>
  );
}
