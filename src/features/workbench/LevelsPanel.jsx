import { formatPct, formatPrice, formatRatio } from '../../lib/format/market.js';
import DynamicLevels from './DynamicLevels.jsx';
import { LABELS, framingLabel, priceLevelCaption, setupTypeLabel } from '../../lib/copy/terms.js';

export default function LevelsPanel({ data }) {
  const setup = data?.scenarioGeometry;
  const scenario = data?.scenario;
  const geometry = data?.riskGeometry;
  const best = geometry?.bestSetup;
  const levels = data?.supportResistance || data?.chart?.levels || {};
  const supports = levels.supports || [];
  const resistances = levels.resistances || [];
  const longSetup = setup?.framing === 'long_setup';
  const confirmationPrice = longSetup
    ? setup.confirmation?.price ?? setup.trigger?.price
    : null;
  const failPrice = setup?.invalidation?.price ?? setup?.defensiveExit?.price ?? best?.stop ?? geometry?.nearestSupport;
  const targetPrice = longSetup ? setup?.target?.price : null;
  const reward = longSetup
    ? setup?.risk?.netRR ?? setup?.risk?.rr ?? best?.netRR ?? best?.rr ?? geometry?.netRewardRisk
    : null;

  return (
    <div className="wb-levels-panel">
      {(scenario || setup) && (
        <p className="wb-levels-panel__setup">
          <span>{LABELS.setupType}</span>
          {setupTypeLabel(scenario?.scenario)} · {framingLabel(setup?.framing)}
        </p>
      )}
      <div className="wb-overview-grid" aria-label="Setup levels">
        <div>
          <span>{priceLevelCaption(setup?.framing, { longLabel: LABELS.clearsAbove, defensiveLabel: LABELS.longEntry })}</span>
          <strong className="tabular">{formatPrice(confirmationPrice)}</strong>
          <small className="text-tertiary">{setup?.labels?.confirmation || setup?.unavailableReason || 'No fabricated last-close entry'}</small>
        </div>
        <div>
          <span>{priceLevelCaption(setup?.framing, { longLabel: LABELS.failsBelow, defensiveLabel: LABELS.damageIfLost })}</span>
          <strong className="tabular">{formatPrice(failPrice)}</strong>
          {longSetup && geometry?.downsidePct != null && (
            <small className="text-warning">{formatPct(geometry.downsidePct)} under last close</small>
          )}
          {!longSetup && (
            <small className="text-tertiary">{setup?.labels?.invalidation || 'Unavailable'}</small>
          )}
        </div>
        <div>
          <span>{LABELS.upsideTo}</span>
          <strong className={`tabular ${targetPrice != null ? 'text-positive' : ''}`}>{formatPrice(targetPrice)}</strong>
          <small className={targetPrice != null ? 'text-positive' : 'text-tertiary'}>
            {setup?.labels?.target || (targetPrice != null && geometry?.upsidePct != null ? `${formatPct(geometry.upsidePct)} upside` : 'No long target')}
          </small>
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
          <span>{LABELS.rewardRisk}</span>
          <strong className="tabular">{formatRatio(reward)}</strong>
          {longSetup && Number.isFinite(setup?.risk?.costPct ?? best?.costPct) && (
            <small className="text-tertiary">Cost drag {formatPct(setup?.risk?.costPct ?? best?.costPct)}</small>
          )}
          {!longSetup && <small className="text-tertiary">Not a long-entry R:R</small>}
        </div>
      </div>
      <DynamicLevels dynamicLevels={data?.dynamicLevels} />
    </div>
  );
}
