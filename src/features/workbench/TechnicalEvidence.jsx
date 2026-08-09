import {
  formatPrice, formatPct, formatNumber, formatVolume,
} from '../../lib/format/market.js';

/**
 * TechnicalEvidence — returns, RSI, ATR, MA posture, and volume evidence.
 *
 * Reads from the existing analysis contract (priceHistory, ticker, supportResistance).
 * No analysis logic is duplicated — this is a read-only presentation of
 * server-computed values.
 *
 * @param {object} props
 * @param {object} props.priceHistory - The priceHistory block from analyze.
 * @param {object} props.ticker - The ticker block (for volume vs baseline).
 */
export default function TechnicalEvidence({ priceHistory, ticker }) {
  if (!priceHistory || priceHistory.note) {
    return (
      <div className="wb-tech-evidence">
        <h3 className="wb-section__title text-tertiary">Technical Evidence</h3>
        <div className="text-tertiary">{priceHistory?.note || 'Daily history unavailable'}</div>
      </div>
    );
  }

  const ma = priceHistory.movingAverages || {};
  const maPosture = ma.stack || 'unavailable';
  const volBaseline = ticker?.volumeVsBaseline;

  const returns = [
    { label: '5-day', value: priceHistory.ret5d },
    { label: '20-day', value: priceHistory.ret20d },
    { label: '60-day', value: priceHistory.ret60d },
  ];

  const maRows = [
    { key: 'ma5', label: 'MA5' },
    { key: 'ma10', label: 'MA10' },
    { key: 'ma20', label: 'MA20' },
    { key: 'ma50', label: 'MA50' },
    { key: 'ma200', label: 'MA200' },
  ].filter((row) => ma[row.key]);

  return (
    <div className="wb-tech-evidence">
      <h3 className="wb-section__title text-tertiary">Technical Evidence</h3>
      <div className="wb-tech-evidence__grid">
        <div className="wb-tech-evidence__section">
          <span className="wb-tech-evidence__label text-tertiary">Returns</span>
          <div className="wb-tech-evidence__rows">
            {returns.map((r) => (
              <div key={r.label} className="wb-tech-evidence__row">
                <span className="text-secondary">{r.label}</span>
                <span className={`tabular ${r.value > 0 ? 'text-positive' : r.value < 0 ? 'text-negative' : 'text-secondary'}`}>
                  {formatPct(r.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="wb-tech-evidence__section">
          <span className="wb-tech-evidence__label text-tertiary">Indicators</span>
          <div className="wb-tech-evidence__rows">
            <div className="wb-tech-evidence__row">
              <span className="text-secondary">RSI14</span>
              <span className="tabular text-secondary">
                {priceHistory.rsi14 != null ? priceHistory.rsi14.toFixed(1) : '—'}
              </span>
            </div>
            <div className="wb-tech-evidence__row">
              <span className="text-secondary">ATR14</span>
              <span className="tabular text-secondary">
                {priceHistory.atr14Pct != null ? formatPct(priceHistory.atr14Pct) : '—'}
              </span>
            </div>
            <div className="wb-tech-evidence__row">
              <span className="text-secondary">Streak</span>
              <span className="tabular text-secondary">
                {priceHistory.streak > 0 ? '+' : ''}{priceHistory.streak ?? '—'}d
              </span>
            </div>
          </div>
        </div>

        <div className="wb-tech-evidence__section">
          <span className="wb-tech-evidence__label text-tertiary">MA Posture</span>
          <div className="wb-tech-evidence__rows">
            {maRows.map((row) => {
              const data = ma[row.key];
              return (
                <div key={row.key} className="wb-tech-evidence__row">
                  <span className="text-secondary">{row.label}</span>
                  <span className="tabular text-secondary">{formatPrice(data.value)}</span>
                  <span className={`tabular ${data.vsPricePct > 0 ? 'text-positive' : 'text-negative'}`}>
                    {formatPct(data.vsPricePct)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="wb-tech-evidence__stack text-secondary">{maPosture}</div>
        </div>

        <div className="wb-tech-evidence__section">
          <span className="wb-tech-evidence__label text-tertiary">Volume</span>
          <div className="wb-tech-evidence__rows">
            <div className="wb-tech-evidence__row">
              <span className="text-secondary">vs {volBaseline?.days || 0}d avg</span>
              <span className="tabular text-secondary">
                {volBaseline?.ratio != null ? `${volBaseline.ratio.toFixed(2)}x` : '—'}
              </span>
            </div>
            <div className="wb-tech-evidence__row">
              <span className="text-secondary">Avg Volume</span>
              <span className="tabular text-secondary">
                {volBaseline?.avgVolume != null ? formatVolume(volBaseline.avgVolume) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
