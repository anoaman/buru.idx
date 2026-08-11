import { formatNumber, formatPrice } from '../../lib/format/market.js';

function signed(value, suffix = '') {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}${suffix}`;
}

export default function ActorMap({ data }) {
  if (!data) return null;
  const replay = Array.isArray(data.replay) ? data.replay : [];
  const maxInventory = Math.max(1, ...replay.map((point) => Math.abs(point.estimatedInventoryLots || 0)));

  return (
    <section className="actor-map" aria-label="Broker actor map">
      <header className="actor-map__header">
        <div>
          <h3>{data.leadActor} broker activity</h3>
          <p className="text-secondary">Estimated buying and selling across the selected dates.</p>
        </div>
        <div className={`actor-map__quadrant actor-map__quadrant--${data.quadrant}`}>
          <span>Selected period</span>
          <strong>{replay.length} trading days</strong>
        </div>
      </header>

      <div className="actor-map__metrics">
        <div><span>Price change</span><strong>{signed(data.priceChangePct, '%')}</strong></div>
        <div><span>Estimated inventory</span><strong>{signed(data.inventoryChangeLots, ' lots')}</strong></div>
        <div><span>Directional consistency</span><strong>{Number.isFinite(data.consistencyRatio) ? `${Math.round(data.consistencyRatio * 100)}%` : '—'}</strong></div>
      </div>

      <div className="actor-map__replay" aria-label="Daily broker flow">
        <div className="actor-map__replay-head">
          <strong>Daily broker flow</strong>
        </div>
        <div className="actor-map__sessions">
          {replay.map((point) => {
            const inventory = point.estimatedInventoryLots || 0;
            const height = 18 + (Math.abs(inventory) / maxInventory) * 46;
            return (
              <div className="actor-map__session" key={point.date} title={`${point.date} · ${signed(point.netLots, ' lots')}`}>
                <div className="actor-map__bar-zone">
                  <span
                    className={`actor-map__bar ${inventory >= 0 ? 'is-positive' : 'is-negative'}`}
                    style={{ height: `${height}px` }}
                  />
                </div>
                <strong>{point.close == null ? '—' : formatPrice(point.close)}</strong>
                <span>{point.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
