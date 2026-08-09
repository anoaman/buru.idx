import { formatPrice, formatPct } from '../../lib/format/market.js';

/**
 * TradeGeometry — entry zone, invalidation, target, and net R:R.
 *
 * Presentation of the existing riskGeometry contract from the analyze API.
 * No cost or geometry logic is recomputed — the server already applied
 * trading costs and selected the best setup.
 *
 * @param {object} props
 * @param {object} props.geometry - The riskGeometry block from analyze.
 */
export default function TradeGeometry({ geometry }) {
  if (!geometry) return null;

  const best = geometry.bestSetup;
  const hasSetup = best && best.rr != null;

  return (
    <div className="wb-geometry">
      <h3 className="wb-section__title text-tertiary">Risk and level map</h3>
      <div className="wb-geometry__grid">
        <div className="wb-geometry__item">
          <span className="wb-geometry__label text-tertiary">Nearest Support</span>
          <span className="wb-geometry__value tabular text-positive">
            {formatPrice(geometry.nearestSupport)}
          </span>
        </div>
        <div className="wb-geometry__item">
          <span className="wb-geometry__label text-tertiary">Nearest Resistance</span>
          <span className="wb-geometry__value tabular text-negative">
            {formatPrice(geometry.nearestResistance)}
          </span>
        </div>
        <div className="wb-geometry__item">
          <span className="wb-geometry__label text-tertiary">Downside</span>
          <span className="wb-geometry__value tabular text-secondary">
            {formatPct(geometry.downsidePct)}
          </span>
        </div>
        <div className="wb-geometry__item">
          <span className="wb-geometry__label text-tertiary">Upside</span>
          <span className="wb-geometry__value tabular text-secondary">
            {formatPct(geometry.upsidePct)}
          </span>
        </div>
      </div>

      {hasSetup && (
        <div className="wb-geometry__setup">
          <div className="wb-geometry__item">
            <span className="wb-geometry__label text-tertiary">Invalidation</span>
            <span className="wb-geometry__value tabular text-negative">
              {formatPrice(best.stop)}
            </span>
          </div>
          <div className="wb-geometry__item">
            <span className="wb-geometry__label text-tertiary">Target</span>
            <span className="wb-geometry__value tabular text-positive">
              {formatPrice(best.target)}
            </span>
          </div>
          <div className="wb-geometry__item">
            <span className="wb-geometry__label text-tertiary">Net R:R after costs</span>
            <span className={`wb-geometry__value tabular ${(best.netRR ?? best.rr) >= 2 ? 'text-positive' : (best.netRR ?? best.rr) >= 1 ? 'text-warning' : 'text-negative'}`}>
              {(best.netRR ?? best.rr)?.toFixed(2)}
            </span>
          </div>
          {best.costPct != null && (
            <div className="wb-geometry__item">
              <span className="wb-geometry__label text-tertiary">Cost Drag</span>
              <span className="wb-geometry__value tabular text-tertiary">
                {formatPct(best.costPct)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="wb-geometry__note text-tertiary">
        {geometry.note}
      </div>
    </div>
  );
}
