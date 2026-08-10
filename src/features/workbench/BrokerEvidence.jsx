import { Link } from 'react-router';
import { formatIDR } from '../../lib/format/market.js';

/**
 * BrokerEvidence — bandar, buyers/sellers, 5/20/60 coverage.
 *
 * Presentation of the existing broker contract from the analyze API.
 * Source classification (Local / Foreign) is owned by the backend
 * normalizer — this component only displays the canonical sourceType.
 *
 * @param {object} props
 * @param {object} props.broker - The broker block from analyze.
 */
export default function BrokerEvidence({ broker }) {
  if (!broker || !broker.available) {
    return (
      <div className="wb-broker">
        <h3 className="wb-section__title text-tertiary">Broker Evidence</h3>
        <div className="text-tertiary">
          {broker?.note || 'No broker data available — bandarmology blind, conviction capped at moderate'}
        </div>
      </div>
    );
  }

  const multiDay = broker.multiDay || {};
  const bandar = broker.bandar || {};
  const top5 = bandar.top5 || bandar.all || {};
  const symbol = broker.symbol ? String(broker.symbol).toUpperCase() : null;

  return (
    <div className="wb-broker">
      <h3 className="wb-section__title text-tertiary">Broker Evidence</h3>
      <p className="wb-broker__disclaimer text-tertiary">
        Supporting evidence only. A stronger composite broker reading is not a calibrated predictor of returns.
      </p>
      {symbol && (
        <Link
          className="wb-broker__intel-link"
          to={`/broker-intelligence?lens=stock&ticker=${encodeURIComponent(symbol)}&days=1`}
        >
          Open Broker Intelligence →
        </Link>
      )}
      <div className="wb-broker__meta text-secondary">
        {broker.from && <span>Session: {broker.from}</span>}
        {bandar.signal && <span> · Bandar: {bandar.signal}</span>}
        {top5.percent != null && <span> · Top-5: {(top5.percent).toFixed(1)}%</span>}
      </div>

      <div className="wb-broker__coverage">
        {multiDay.d5 && (
          <div className="wb-broker__coverage-item">
            <span className="text-tertiary">5-session</span>
            <span className="tabular text-secondary">{multiDay.d5.sessions || 0} sessions</span>
          </div>
        )}
        {multiDay.d20 && (
          <div className="wb-broker__coverage-item">
            <span className="text-tertiary">20-session</span>
            <span className="tabular text-secondary">{multiDay.d20.sessions || 0} sessions</span>
          </div>
        )}
        {multiDay.d60 && (
          <div className="wb-broker__coverage-item">
            <span className="text-tertiary">60-session</span>
            <span className="tabular text-secondary">{multiDay.d60.sessions || 0} sessions</span>
          </div>
        )}
      </div>

      {broker.buyers?.length > 0 && (
        <div className="wb-broker__top">
          <div className="text-tertiary">Top buyers</div>
          <div className="wb-broker__rows">
            {broker.buyers.slice(0, 5).map((b, i) => (
              <div key={i} className="wb-broker__row">
                <span className="wb-broker__code">{b.code}</span>
                <span className="text-secondary">{b.sourceType}</span>
                <span className={`tabular wb-broker__value ${b.netValue > 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatIDR(b.netValue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {broker.sellers?.length > 0 && (
        <div className="wb-broker__top">
          <div className="text-tertiary">Top sellers</div>
          <div className="wb-broker__rows">
            {broker.sellers.slice(0, 5).map((b, i) => (
              <div key={i} className="wb-broker__row">
                <span className="wb-broker__code">{b.code}</span>
                <span className="text-secondary">{b.sourceType}</span>
                <span className={`tabular wb-broker__value ${b.netValue > 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatIDR(b.netValue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {multiDay.consistency?.length > 0 && (
        <div className="wb-broker__consistency">
          <div className="text-tertiary">Consistency</div>
          <div className="wb-broker__rows">
            {multiDay.consistency.slice(0, 3).map((c, i) => (
              <div key={i} className="wb-broker__row">
                <span className="wb-broker__code">{c.code}</span>
                <span className="text-secondary">{c.signal}</span>
                <span className="tabular text-tertiary">{c.sessions} sessions</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
