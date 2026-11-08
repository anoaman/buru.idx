import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { readChartTheme } from '../workbench/MarketChart.jsx';
import Panel from './Panel.jsx';

const RANGES = [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 250], ['All', Infinity]];

/** Daily IHSG candles with volume. Bars come oldest first as { date, open, high, low, close, volume }. */
export default function IndexChart({ bars }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [range, setRange] = useState('6M');

  useEffect(() => {
    if (!containerRef.current || !bars?.length) return undefined;
    const colors = readChartTheme(containerRef.current);
    const instance = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: colors.background }, textColor: colors.text, fontSize: 12, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: false },
      crosshair: { vertLine: { color: colors.crosshair }, horzLine: { color: colors.crosshair } },
    });
    const candles = instance.addSeries(CandlestickSeries, {
      upColor: colors.up, downColor: colors.down, borderUpColor: colors.up, borderDownColor: colors.down,
      wickUpColor: colors.up, wickDownColor: colors.down, priceLineVisible: false,
    });
    const volume = instance.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false });
    instance.priceScale('volume').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    candles.setData(bars.map(({ date, open, high, low, close }) => ({ time: date, open, high, low, close })));
    volume.setData(bars.map(({ date, open, close, volume: value }) => ({
      time: date, value: value || 0, color: close >= open ? colors.volumeUp : colors.volumeDown,
    })));
    chartRef.current = instance;
    return () => { chartRef.current = null; instance.remove(); };
  }, [bars]);

  useEffect(() => {
    const instance = chartRef.current;
    if (!instance || !bars?.length) return;
    const sessions = RANGES.find(([key]) => key === range)?.[1] ?? Infinity;
    if (!Number.isFinite(sessions) || sessions >= bars.length) instance.timeScale().fitContent();
    else instance.timeScale().setVisibleLogicalRange({ from: bars.length - sessions, to: bars.length - 1 });
  }, [range, bars]);

  const ranges = (
    <div className="home-tabs" role="group" aria-label="Chart range">
      {RANGES.map(([key]) => (
        <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}>{key}</button>
      ))}
    </div>
  );
  return (
    <Panel title="IHSG" note="daily" actions={bars?.length ? ranges : null} className="home-panel--chart">
      {bars?.length
        ? <div ref={containerRef} className="home-chart__canvas" data-testid="ihsg-chart" />
        : <p className="home-empty">IHSG history is unavailable right now.</p>}
    </Panel>
  );
}
