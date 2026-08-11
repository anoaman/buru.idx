import { formatPct, formatPrice, formatRatio } from '../../lib/format/market.js';
import DynamicLevels from './DynamicLevels.jsx';

export default function LevelsPanel({ data }) {
  const geometry = data?.riskGeometry;
  const best = geometry?.bestSetup;
  const levels = data?.supportResistance || data?.chart?.levels || {};
  const supports = levels.supports || [];
  const resistances = levels.resistances || [];

  return (
    <div className="wb-levels-panel">
      <div className="wb-overview-grid" aria-label="Setup levels">
        <div>
          <span>Confirmation entry</span>
          <strong className="tabular">{formatPrice(data?.ticker?.close)}</strong>
          <small className="text-tertiary">Breakout above last close</small>
        </div>
        <div>
          <span>Setup fails below</span>
          <strong className="tabular">{formatPrice(best?.stop ?? geometry?.nearestSupport)}</strong>
          {geometry?.downsidePct != null && (
            <small className="text-warning">{formatPct(geometry.downsidePct)} under last close</small>
          )}
        </div>
        <div>
          <span>Target</span>
          <strong className="tabular text-positive">{formatPrice(best?.target ?? geometry?.nearestResistance)}</strong>
          {geometry?.upsidePct != null && (
            <small className="text-positive">{formatPct(geometry.upsidePct)} upside</small>
          )}
        </div>
        <div>
          <span>Support</span>
          <strong className="tabular">{formatPrice(geometry?.nearestSupport)}</strong>
          <small className="text-tertiary">
            {supports.slice(0, 3).map((level) => formatPrice(level.price ?? level)).filter(Boolean).join(' · ') || '—'}
          </small>
        </div>
        <div>
          <span>Resistance</span>
          <strong className="tabular">{formatPrice(geometry?.nearestResistance)}</strong>
          <small className="text-tertiary">
            {resistances.slice(0, 3).map((level) => formatPrice(level.price ?? level)).filter(Boolean).join(' · ') || '—'}
          </small>
        </div>
        <div>
          <span>Reward / risk</span>
          <strong className="tabular">{formatRatio(best?.netRR ?? best?.rr ?? geometry?.netRewardRisk)}</strong>
          {Number.isFinite(best?.costPct) && (
            <small className="text-tertiary">Cost drag {formatPct(best.costPct)}</small>
          )}
        </div>
      </div>
      <DynamicLevels dynamicLevels={data?.dynamicLevels} />
    </div>
  );
}
