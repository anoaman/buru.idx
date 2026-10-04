import { useState } from 'react';
import { formatIDR, formatPrice } from '../../lib/format/market.js';

const shortDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');

/** Setup label, the plain read, what changed today, and the one trade plan. */
export function ReadCard({ read }) {
  const { setup, summary, changes, plan } = read;
  return (
    <section className="sa-read" aria-label="Read and trade plan">
      <div className="sa-read__text">
        <span className={`sa-setup sa-setup--${setup.id}`}>{setup.label}</span>
        <p>{summary || setup.why}</p>
        {changes.length > 0 && (
          <ul className="sa-changes" aria-label="New today">
            {changes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </div>
      <PlanBlock plan={plan} />
    </section>
  );
}

function PlanBlock({ plan }) {
  if (!plan.available) {
    return (
      <div className="sa-plan sa-plan--none" aria-label="Trade plan">
        <span className="sa-plan__label">Plan</span>
        <strong>{plan.reason || 'No plan yet.'}</strong>
        {plan.alt && (
          <small>Watch: close above <b>{formatPrice(plan.alt.trigger)}</b> → target {formatPrice(plan.alt.target)}, stop {formatPrice(plan.alt.stop)}</small>
        )}
      </div>
    );
  }
  return (
    <div className="sa-plan" aria-label="Trade plan">
      <dl>
        <div><dt>Buy</dt><dd>{formatPrice(plan.entryLow)}{plan.entryHigh !== plan.entryLow ? `–${formatPrice(plan.entryHigh)}` : ''}</dd></div>
        <div><dt>Stop</dt><dd className="is-negative">{formatPrice(plan.stop)}</dd></div>
        <div><dt>{plan.targetSource === 'measured' ? 'Target (range projection)' : 'Target'}</dt><dd className="is-positive">{formatPrice(plan.target)}</dd></div>
        <div><dt>R:R</dt><dd>{Number.isFinite(plan.netRR) ? plan.netRR.toFixed(1) : '—'}</dd></div>
      </dl>
      <small>
        Buy next session{Number.isFinite(plan.skipAbove) ? <>, skip if it opens above <b>{formatPrice(plan.skipAbove)}</b></> : ''}.
        {plan.invalidIf ? ` ${plan.invalidIf}` : ''}
      </small>
      {plan.warning && <small className="is-warning">{plan.warning}</small>}
      {plan.alt && <small>Or: close above <b>{formatPrice(plan.alt.trigger)}</b> → {formatPrice(plan.alt.target)}</small>}
    </div>
  );
}

const WINDOWS = [['today', 'Today'], ['d5', '5D'], ['m1', '1M']];

function BrokerRow({ row, side, showDays }) {
  return (
    <li>
      <b>{row.code}<small>{row.type}</small></b>
      <span className={side === 'buy' ? 'is-positive' : 'is-negative'}>
        {formatIDR(row.net, true)}{row.avg ? <small> @ {formatPrice(row.avg)}</small> : null}
      </span>
      <em>{showDays ? `${row.days}/${row.of}d` : ''}</em>
    </li>
  );
}

/** Top buyers and sellers for today, 5 sessions and about a month. */
export function BrokerWindows({ brokers, symbol }) {
  const firstAvailable = WINDOWS.find(([key]) => brokers[key])?.[0] || 'd5';
  const [active, setActive] = useState(brokers.d5 ? 'd5' : firstAvailable);
  const window = brokers[active];
  return (
    <section className="sa-box" aria-label="Brokers">
      <header>
        <h3>Brokers{symbol && <a className="sa-link" href={`/broker-intelligence?lens=stock&ticker=${encodeURIComponent(symbol)}&days=${active === 'm1' ? 30 : active === 'today' ? 1 : 7}`} target="_blank" rel="noopener noreferrer">Full broker flow ↗</a>}</h3>
        <div className="sa-seg" role="group" aria-label="Broker window">
          {WINDOWS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={active === key} disabled={!brokers[key]} onClick={() => setActive(key)}>{label}</button>
          ))}
        </div>
      </header>
      {!window ? <p className="sa-muted">Broker data is unavailable for this window.</p> : (
        <>
          <div className="sa-brokers">
            <div>
              <h4>Buying</h4>
              <ul>{window.buyers.slice(0, 4).map((row) => <BrokerRow key={row.code} row={row} side="buy" showDays={active !== 'today'} />)}</ul>
            </div>
            <div>
              <h4>Selling</h4>
              <ul>{window.sellers.slice(0, 4).map((row) => <BrokerRow key={row.code} row={row} side="sell" showDays={active !== 'today'} />)}</ul>
            </div>
          </div>
          <p className="sa-muted">{window.from === window.to ? shortDate(window.to) : `${shortDate(window.from)} – ${shortDate(window.to)} · ${window.sessions} sessions`}</p>
        </>
      )}
    </section>
  );
}

/** Pass / watch / fail facts, each with its number. */
export function Checks({ checks }) {
  return (
    <section className="sa-box" aria-label="Checks">
      <header><h3>Checks</h3></header>
      <ul className="sa-checks">
        {checks.map((item) => (
          <li key={item.label} className={`is-${item.status}`}>
            <i aria-hidden="true" />
            <span><b>{item.label}</b> · {item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
