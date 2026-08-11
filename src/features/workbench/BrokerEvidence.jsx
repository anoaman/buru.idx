import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getStockBrokerIntelligence } from '../../lib/api/client.js';
import { guardStockBrokerIntelligence } from '../../lib/api/contracts.js';
import { formatIDR, formatNumber } from '../../lib/format/market.js';

const PRESETS = [
  ['latest', 'Latest'], ['previous', 'Previous'], ['7d', '7D'], ['14d', '14D'],
  ['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['ytd', 'YTD'], ['custom', 'Custom'],
];

function FlowBars({ buyers, sellers }) {
  const rows = [...buyers.slice(0, 5).map((row) => ({ ...row, side: 'buy' })), ...sellers.slice(0, 5).map((row) => ({ ...row, side: 'sell' }))];
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.netValue || 0)));
  return <div className="wb-broker-flow" aria-label="Observed broker net-value distribution">
    <div className="wb-broker-flow__axis"><span>Distribution</span><span>Accumulation</span></div>
    {rows.map((row) => <div className={`wb-broker-flow__row wb-broker-flow__row--${row.side}`} key={`${row.side}-${row.code}`}>
      <span className="wb-broker-flow__code">{row.code}</span><div className="wb-broker-flow__track"><i style={{ width: `${Math.max(3, Math.abs(row.netValue || 0) / max * 50)}%` }} /></div>
      <span className="wb-broker-flow__value">{formatIDR(row.netValue)}</span>
    </div>)}
  </div>;
}

function BrokerRows({ title, rows }) {
  if (!rows.length) return null;
  return <div className="wb-broker__top"><div className="text-tertiary">{title}</div><div className="wb-broker__rows">
    {rows.slice(0, 5).map((row) => <div key={row.code} className="wb-broker__row"><span className="wb-broker__code">{row.code}</span><span className="text-secondary">{row.sourceType || '—'}</span><span className={`tabular wb-broker__value ${row.netValue > 0 ? 'text-positive' : 'text-negative'}`}>{formatIDR(row.netValue)}</span></div>)}
  </div></div>;
}

export default function BrokerEvidence({ broker }) {
  const symbol = broker?.symbol ? String(broker.symbol).toUpperCase() : null;
  const [preset, setPreset] = useState('latest');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [state, setState] = useState({ loading: false, data: null, error: null });
  useEffect(() => {
    if (!symbol || (preset === 'custom' && (!custom.from || !custom.to))) return undefined;
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    const range = preset === 'custom' ? { from: custom.from, to: custom.to } : { preset };
    getStockBrokerIntelligence({ ticker: symbol, days: 1, ...range })
      .then(guardStockBrokerIntelligence).then((result) => { if (!cancelled) setState(result.ok ? { loading: false, data: result.data, error: null } : { loading: false, data: null, error: result.error }); })
      .catch((error) => { if (!cancelled) setState({ loading: false, data: null, error: error.message }); });
    return () => { cancelled = true; };
  }, [symbol, preset, custom.from, custom.to]);

  const buyers = state.data?.accumulation || broker?.buyers || [];
  const sellers = state.data?.distribution || broker?.sellers || [];
  const window = state.data?.window;
  const rangeLabel = window ? (window.from === window.to ? window.to : `${window.from} → ${window.to}`) : 'latest trading day';
  // The guarded contract exposes the observed session count as `tradingSessions`;
  // there has never been a `tradingSessionCount` field on the view model.
  const sessions = window ? window.tradingSessions : null;
  const customIncomplete = preset === 'custom' && (!custom.from || !custom.to);
  const methodNote = useMemo(() => window?.complete === false ? 'Selected range has incomplete archive coverage.' : null, [window]);
  if (!symbol && (!broker || !broker.available)) return <div className="wb-broker"><h3 className="wb-section__title text-tertiary">Broker flow</h3><div className="text-tertiary">{broker?.note || 'No broker data available.'}</div></div>;

  return <div className="wb-broker">
    <div className="wb-broker__head"><div><h3 className="wb-section__title text-tertiary">Broker Flow</h3></div></div>
    <div className="wb-broker__presets" aria-label="Broker evidence range">{PRESETS.map(([value, label]) => <button className={preset === value ? 'is-active' : ''} key={value} onClick={() => setPreset(value)} type="button">{label}</button>)}</div>
    {preset === 'custom' && <div className="wb-broker__custom"><label>From<input type="date" value={custom.from} onChange={(event) => setCustom((current) => ({ ...current, from: event.target.value }))} /></label><label>To<input type="date" value={custom.to} onChange={(event) => setCustom((current) => ({ ...current, to: event.target.value }))} /></label></div>}
    <div className="wb-broker__meta text-secondary"><span>Range: {rangeLabel}</span>{window && <span> · {formatNumber(sessions)} trading day{sessions === 1 ? '' : 's'}</span>}{customIncomplete && <span className="text-warning"> · Select both custom dates to load a range</span>}{state.loading && <span> · Loading…</span>}{state.error && <span className="text-warning"> · Range unavailable; showing analysis snapshot</span>}{methodNote && <span className="text-warning"> · {methodNote}</span>}</div>
    {(buyers.length > 0 || sellers.length > 0) && <div className="wb-broker__workspace"><div className="wb-broker__rankings"><BrokerRows title="Top buyers" rows={buyers} /><BrokerRows title="Top sellers" rows={sellers} /></div><FlowBars buyers={buyers} sellers={sellers} /></div>}
    {symbol && <Link className="wb-broker__intel-link" to={`/broker-intelligence?lens=stock&ticker=${encodeURIComponent(symbol)}&days=1${window?.to ? `&date=${encodeURIComponent(window.to)}` : ''}`}>Open Broker Flow →</Link>}
  </div>;
}
