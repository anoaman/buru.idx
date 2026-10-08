import { formatPrice, formatPct, formatVolume } from '../../lib/format/market.js';

function tone(value) {
  return value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-secondary';
}

function Metric({ label, value, className = 'text-secondary', detail }) {
  return (
    <div className="sa-market-metric">
      <span className="text-tertiary">{label}</span>
      <strong className={`tabular ${className}`}>{value}</strong>
      {detail && <small className="text-tertiary">{detail}</small>}
    </div>
  );
}

/** Compact market-state summary using server-computed analysis fields only. */
export default function TechnicalEvidence({ priceHistory, ticker, macro }) {
  if (!priceHistory || priceHistory.note) {
    return (
      <section className="wb-tech-evidence sa-market-state">
        <h3>Market state</h3>
        <div className="text-tertiary">{priceHistory?.note || 'Daily history unavailable'}</div>
      </section>
    );
  }

  const ma = priceHistory.movingAverages || {};
  const volume = ticker?.volumeVsBaseline || {};
  const rs20 = macro?.relativeStrength?.periods?.['20'];
  const rs60 = macro?.relativeStrength?.periods?.['60'];
  const atrMove = Number.isFinite(ticker?.close) && Number.isFinite(priceHistory.atr14Pct)
    ? ticker.close * priceHistory.atr14Pct / 100
    : null;
  const posture = String(ma.stack || 'unavailable').replaceAll('_', ' ');

  return (
    <section className="wb-tech-evidence sa-market-state" aria-label="Market state">
      <header className="sa-market-state__header">
        <div>
          <span className="sa-market-state__eyebrow">Market state</span>
          <h3>{posture}</h3>
        </div>
        <p>
          MA posture {posture}; volume {Number.isFinite(volume.ratio) ? `${volume.ratio.toFixed(2)}× baseline` : 'baseline unavailable'}
          {Number.isFinite(rs20?.excessReturnPct) ? `; 20-day relative return ${formatPct(rs20.excessReturnPct)} vs IHSG.` : '.'}
        </p>
      </header>

      <div className="sa-market-state__grid">
        <div className="sa-market-state__group">
          <h4>Momentum</h4>
          <Metric label="RSI14" value={Number.isFinite(priceHistory.rsi14) ? priceHistory.rsi14.toFixed(1) : '—'} />
          <Metric label="5-day return" value={formatPct(priceHistory.ret5d)} className={tone(priceHistory.ret5d)} />
          <Metric label="20-day return" value={formatPct(priceHistory.ret20d)} className={tone(priceHistory.ret20d)} />
          <Metric label="60-day return" value={formatPct(priceHistory.ret60d)} className={tone(priceHistory.ret60d)} />
        </div>

        <div className="sa-market-state__group">
          <h4>Trend</h4>
          {['ma20', 'ma50', 'ma200'].map((key) => (
            <Metric key={key} label={key.toUpperCase()} value={ma[key] ? formatPrice(ma[key].value) : '—'} className={tone(ma[key]?.vsPricePct)} detail={ma[key] ? `${formatPct(ma[key].vsPricePct)} vs price` : null} />
          ))}
        </div>

        <div className="sa-market-state__group">
          <h4>Volatility & participation</h4>
          <Metric label="ATR14" value={formatPct(priceHistory.atr14Pct)} detail={Number.isFinite(atrMove) ? `≈ ${formatPrice(atrMove)} daily range` : null} />
          <Metric label="Volume ratio" value={Number.isFinite(volume.ratio) ? `${volume.ratio.toFixed(2)}×` : '—'} detail={volume.days ? `${volume.days}-day baseline` : null} />
          <Metric label="Average volume" value={Number.isFinite(volume.avgVolume) ? formatVolume(volume.avgVolume) : '—'} />
          <Metric label="Price streak" value={Number.isFinite(priceHistory.streak) ? `${priceHistory.streak > 0 ? '+' : ''}${priceHistory.streak} sessions` : '—'} className={tone(priceHistory.streak)} />
        </div>

        <div className="sa-market-state__group">
          <h4>Relative to IHSG</h4>
          <Metric label="20-day excess" value={Number.isFinite(rs20?.excessReturnPct) ? formatPct(rs20.excessReturnPct) : '—'} className={tone(rs20?.excessReturnPct)} detail={Number.isFinite(rs20?.benchmarkReturnPct) ? `IHSG ${formatPct(rs20.benchmarkReturnPct)}` : null} />
          <Metric label="60-day excess" value={Number.isFinite(rs60?.excessReturnPct) ? formatPct(rs60.excessReturnPct) : '—'} className={tone(rs60?.excessReturnPct)} detail={Number.isFinite(rs60?.benchmarkReturnPct) ? `IHSG ${formatPct(rs60.benchmarkReturnPct)}` : null} />
          <Metric label="Market regime" value={String(macro?.regime?.state || '—').replaceAll('_', ' ')} />
        </div>
      </div>
    </section>
  );
}
