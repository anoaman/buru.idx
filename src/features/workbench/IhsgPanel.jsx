import { LABELS } from '../../lib/copy/terms.js';

function excessLabel(value, sessions) {
  if (!Number.isFinite(value)) return 'Unavailable';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}% · ${sessions} sessions`;
}

export default function IhsgPanel({ macro }) {
  const regime = macro?.regime;
  const strength = macro?.relativeStrength;
  const excess20 = strength?.periods?.[20]?.excessReturnPct;
  const excess60 = strength?.periods?.[60]?.excessReturnPct;
  return (
    <div className="wb-overview-grid" aria-label="Market versus IHSG">
      <div>
        <span>{LABELS.ihsg}</span>
        <strong>{String(regime?.state || 'unknown').replace('_', ' ')}</strong>
        <small className="text-tertiary">as of {regime?.asOf || '—'}</small>
      </div>
      <div>
        <span>{LABELS.vsIhsg}</span>
        <strong>{excessLabel(excess20, 20)}</strong>
        <small className="text-tertiary">
          {Number.isFinite(excess60) ? excessLabel(excess60, 60) : '60-session history unavailable'}
        </small>
      </div>
      <div>
        <span>Relative line</span>
        <strong>{strength?.lineState || 'unavailable'}</strong>
        <small className="text-tertiary">{strength?.matchedSessions || 0} matched sessions</small>
      </div>
      <div>
        <span>Sector</span>
        <strong>{strength?.sector?.available ? 'Available' : 'Not claimed'}</strong>
        <small className="text-tertiary">
          {strength?.sector?.available ? strength.sector.symbol : 'Awaiting verified issuer mapping'}
        </small>
      </div>
    </div>
  );
}
