import { useState } from 'react';
import { formatIDR, formatPrice } from '../../lib/format/market.js';

const shortDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');

// Spelled out because en-GB writes September as "Sept".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (value) => (value ? `${MONTHS[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` : '');
const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`;
const away = (level, price) => (price > 0 ? ` (${signed(((level - price) / price) * 100)})` : '');

/** Setup label, the plain read, what changed today, and the outlook. */
export function ReadCard({ read, price }) {
  const { setup, summary, changes, outlook, track } = read;
  return (
    <section className="sa-read" aria-label="Read and outlook">
      <div className="sa-read__text">
        <span className={`sa-setup sa-setup--${setup.id}`}>{setup.label}</span>
        <p>{summary || setup.why}</p>
        {changes.length > 0 && (
          <ul className="sa-changes" aria-label="New today">
            {changes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </div>
      <Outlook outlook={outlook} track={track} setupLabel={setup.label} price={price} />
    </section>
  );
}

/**
 * What the next sessions could look like, as odds: a read, never an entry.
 * The odds come from the stock's own recent sessions; the track record is how
 * the same label played out across the market.
 */
export function Outlook({ outlook, track, setupLabel, price }) {
  if (!outlook && !track) return null;
  const sessions = outlook?.sessions ?? track?.sessions ?? 10;
  return (
    <div className="sa-outlook" aria-label={`Next ${sessions} sessions`}>
      <span className="sa-outlook__label">Next {sessions} sessions · odds, not a call</span>
      {outlook && (
        <dl>
          <div><dt>Likely range</dt><dd>{formatPrice(outlook.range.low)}–{formatPrice(outlook.range.high)}</dd></div>
          {outlook.resistanceFirstPct != null && (
            <div><dt>Reaches {formatPrice(outlook.resistance)} first</dt><dd className="is-positive">{outlook.resistanceFirstPct}%</dd></div>
          )}
          {outlook.supportFirstPct != null && (
            <div><dt>Drops to {formatPrice(outlook.support)} first</dt><dd className="is-negative">{outlook.supportFirstPct}%</dd></div>
          )}
        </dl>
      )}
      {outlook && (
        <small>
          8 in 10 simulated paths close between those prices, middle {formatPrice(outlook.range.mid)}.
          {outlook.resistance != null ? ` Resistance${away(outlook.resistance, price)}` : ''}
          {outlook.support != null ? `${outlook.resistance != null ? ',' : ''} support${away(outlook.support, price)}` : ''}
          {outlook.resistance != null || outlook.support != null ? '.' : ''}
          {outlook.closeBelowSupportPct != null ? ` Ends below support in ${outlook.closeBelowSupportPct}%.` : ''}
        </small>
      )}
      {track && (
        <small className="sa-outlook__track">
          Past “{setupLabel}” reads: up after {track.sessions} sessions in {track.upPct}% of {track.cases.toLocaleString('en-US')} cases,
          median {signed(track.medianPct)}, {signed(track.vsIhsgPct)} vs IHSG ({monthYear(track.from)} – {monthYear(track.to)}).
        </small>
      )}
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
