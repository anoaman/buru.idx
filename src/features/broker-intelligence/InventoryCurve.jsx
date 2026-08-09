import { formatNumber } from '../../lib/format/market.js';

/**
 * InventoryCurve — pure presentation of estimated inventory lots over a window.
 * Receives already-calculated curve points; performs no broker math beyond
 * plotting supplied values and choosing axis coordinates.
 *
 * @param {object} props
 * @param {Array} props.points - Curve points from the broker-intelligence contract
 * @param {string} props.identityLabel - Selected row identity (broker code or ticker)
 */
export default function InventoryCurve({ points = [], identityLabel = '' }) {
  const series = Array.isArray(points) ? points : [];

  if (!series.length) {
    return (
      <div className="bi-curve bi-curve--empty">
        <div className="bi-curve__identity text-secondary">{identityLabel || 'Selected row'}</div>
        <div className="bi-curve__empty text-tertiary">
          No estimated inventory curve for this selection.
        </div>
      </div>
    );
  }

  const values = series.map((p) => p.estimatedInventoryLots);
  const start = values[0];
  const end = values[values.length - 1];
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;

  const width = 560;
  const height = 260;
  const padL = 64;
  const padR = 20;
  const padT = 28;
  const padB = 48;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xAt = (i) => padL + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const yAt = (v) => padT + ((max - v) / span) * plotH;
  const zeroY = yAt(0);

  const path = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.estimatedInventoryLots).toFixed(1)}`)
    .join(' ');

  const labelIndexes = (() => {
    if (series.length <= 4) return series.map((_, i) => i);
    const mid = Math.floor((series.length - 1) / 2);
    return [0, mid, series.length - 1];
  })();

  const signedLots = (n) => {
    if (!Number.isFinite(n)) return '—';
    const sign = n > 0 ? '+' : '';
    return `${sign}${formatNumber(n)}`;
  };

  const endClass = end > 0 ? 'text-positive' : end < 0 ? 'text-negative' : 'text-secondary';
  const summary = `Estimated inventory changed from ${signedLots(start)} to ${signedLots(end)} lots across ${series.length} trading sessions.`;

  return (
    <div className="bi-curve">
      <div className="bi-curve__header">
        <div className="bi-curve__identity">{identityLabel}</div>
        <div className="bi-curve__range text-secondary">
          <span>Start {signedLots(start)}</span>
          <span aria-hidden="true"> · </span>
          <span className={endClass}>End {signedLots(end)}</span>
        </div>
      </div>

      <svg
        className="bi-curve__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summary}
      >
        <line
          x1={padL}
          y1={zeroY}
          x2={width - padR}
          y2={zeroY}
          className="bi-curve__baseline"
        />
        <path d={path} className="bi-curve__line" fill="none" />
        {series.map((p, i) => (
          <circle
            key={p.date}
            cx={xAt(i)}
            cy={yAt(p.estimatedInventoryLots)}
            r={series.length <= 12 ? 3 : 2}
            className={
              p.estimatedInventoryLots > 0
                ? 'bi-curve__dot bi-curve__dot--pos'
                : p.estimatedInventoryLots < 0
                  ? 'bi-curve__dot bi-curve__dot--neg'
                  : 'bi-curve__dot'
            }
          />
        ))}
        {labelIndexes.map((i) => {
          const isFirst = i === 0;
          const isLast = i === series.length - 1;
          return (
            <text
              key={`label-${series[i].date}`}
              x={xAt(i)}
              y={height - 12}
              textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
              className="bi-curve__date"
              fontSize="22"
            >
              {series[i].date.slice(5)}
            </text>
          );
        })}
        <text x={4} y={padT + 8} className="bi-curve__axis" fontSize="22">{formatNumber(max)}</text>
        <text x={4} y={zeroY + 6} className="bi-curve__axis" fontSize="22">0</text>
        {min !== 0 && (
          <text x={4} y={height - padB + 8} className="bi-curve__axis" fontSize="22">{formatNumber(min)}</text>
        )}
      </svg>

      <p className="bi-curve__summary text-secondary" aria-live="polite">
        {summary}
      </p>
    </div>
  );
}
