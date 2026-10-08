import { useState } from 'react';
import { formatIDR, formatPrice } from '../../lib/format/market.js';

const shortDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');

// Spelled out because en-GB writes September as "Sept".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (value) => (value ? `${MONTHS[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` : '');
const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`;
const away = (level, price) => (price > 0 ? ` (${signed(((level - price) / price) * 100)})` : '');

/** Setup label, the plain read, what changed today, and the outlook. */
export function ReadCard({ read, price, outlook = read.outlook, outlooks = {}, onHorizonChange }) {
  const { setup, summary, changes, track, watch = [] } = read;
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
        {watch.length > 0 && (
          <div className="sa-watch" aria-label="What would change this read">
            <h3>What would change this read?</h3>
            <ul>{watch.map((item) => <li key={item.label}><b>{item.label}</b><span>{item.detail}</span></li>)}</ul>
            <small>Based on current levels and broker evidence; reassessed after each close.</small>
          </div>
        )}
      </div>
      <Outlook outlook={outlook} outlooks={outlooks} onHorizonChange={onHorizonChange} track={track} setupLabel={setup.label} price={price} />
    </section>
  );
}

/** Both controls share Workbench state; no simulation or scoring lives in the UI. */
export function OutlookHorizon({ outlooks = {}, sessions, onChange, label = 'Outlook horizon' }) {
  const available = Object.values(outlooks).filter(Boolean).sort((a, b) => a.sessions - b.sessions);
  if (available.length < 2 || !onChange) return null;
  return (
    <select className="sa-horizon" aria-label={label} value={sessions} onChange={(event) => onChange(Number(event.target.value))}>
      {available.map((item) => <option key={item.sessions} value={item.sessions}>{item.sessions} sessions ahead</option>)}
    </select>
  );
}

/**
 * What the next sessions could look like, as odds: a read, never an entry.
 * The odds come from the stock's own recent sessions; the track record is how
 * the same label played out across the market.
 */
export function Outlook({ outlook, outlooks, onHorizonChange, track, setupLabel, price }) {
  if (!outlook && !track) return null;
  const sessions = outlook?.sessions ?? track?.sessions ?? 10;
  return (
    <div className="sa-outlook" aria-label={`Next ${sessions} sessions`}>
      <div className="sa-outlook__header">
        <span className="sa-outlook__label">Next {sessions} sessions · odds, not a call</span>
        <OutlookHorizon outlooks={outlooks} sessions={sessions} onChange={onHorizonChange} />
      </div>
      {outlook && (
        <dl>
          <div><dt>Closing range</dt><dd>{formatPrice(outlook.range.low)}–{formatPrice(outlook.range.high)}</dd></div>
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
          8 in 10 simulated paths close between those prices after {sessions} trading sessions (not calendar days), middle {formatPrice(outlook.range.mid)}.
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
      <em title={Number.isFinite(row.lot) ? 'Average trade size vs this stock\'s average: under 0.8× is retail-size, 2× and up is a big-lot desk' : undefined}>
        {showDays ? `${row.days}/${row.of}d` : ''}
        {Number.isFinite(row.lot) && <small className={row.lot < 0.8 ? 'is-warning' : undefined}>{row.lot.toFixed(1)}× lot</small>}
      </em>
    </li>
  );
}

/** Top buyers and sellers for today, 5 sessions and about a month. */
export function BrokerWindows({ brokers, summary, symbol }) {
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
          {active === 'd5' && summary && (
            <div className="sa-broker-balance">
              <div className="sa-broker-balance__headline">
                <b>{summary.control === 'buyer' ? 'Buyers control' : summary.control === 'seller' ? 'Sellers control' : summary.control === 'split' ? 'Flow is split' : 'Control unresolved'}</b>
                <span>{formatIDR(summary.buyNet, true)} buying vs {formatIDR(summary.sellNet, true)} selling</span>
              </div>
              <div className="sa-broker-balance__bar" aria-label={`${summary.buySharePct ?? 50}% buyer share`}>
                <i style={{ width: `${summary.buySharePct ?? 50}%` }} />
              </div>
              <div className="sa-broker-balance__facts">
                <span><small>Control</small><b>{summary.control}</b></span>
                <span><small>Persistence</small><b>{summary.leadBuyer ? `${summary.leadBuyer.code} ${summary.leadBuyer.days}/${summary.leadBuyer.of}d` : '—'}</b></span>
                <span><small>Price vs buyer cost</small><b className={summary.costGapPct < 0 ? 'is-warning' : 'is-positive'}>{summary.costGapPct == null ? '—' : signed(summary.costGapPct)}</b></span>
              </div>
            </div>
          )}
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
const CHECK_GROUPS = [['price', 'Price'], ['participation', 'Participation'], ['market', 'Market'], ['risk', 'Risk']];

export function Checks({ checks }) {
  const counts = checks.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
  return (
    <section className="sa-box" aria-label="Checks">
      <header><h3>Decision checklist</h3><span className="sa-checks__summary"><b>{counts.bad || 0}</b> risks · <b>{counts.warn || 0}</b> watch · <b>{counts.ok || 0}</b> supportive</span></header>
      <div className="sa-check-groups">
        {CHECK_GROUPS.map(([id, label]) => {
          const items = checks.filter((item) => item.category === id);
          if (!items.length) return null;
          return <section key={id}><h4>{label}</h4><ul className="sa-checks">{items.map((item) => (
            <li key={item.label} className={`is-${item.status}`}>
              <i aria-hidden="true" />
              <span><b>{item.label}</b><small>{item.explanation || item.detail}</small><em>{item.detail}</em>{item.changesWhen && <small className="sa-checks__change">Changes when: {item.changesWhen}</small>}{item.secondary && <small className="sa-checks__context">Secondary context · third-liner</small>}</span>
            </li>
          ))}</ul></section>;
        })}
      </div>
    </section>
  );
}
