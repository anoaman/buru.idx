import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getStockBrokerIntelligence } from '../../lib/api/client.js';
import { guardStockBrokerIntelligence } from '../../lib/api/contracts.js';
import { formatIDR } from '../../lib/format/market.js';

function FlowBars({ buyers, sellers }) {
  const rows = [
    ...buyers.slice(0, 5).map((row) => ({ ...row, side: 'buy' })),
    ...sellers.slice(0, 5).map((row) => ({ ...row, side: 'sell' })),
  ];
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.netValue || 0)));
  return (
    <div className="wb-broker-flow" aria-label="Observed broker net-value distribution">
      <div className="wb-broker-flow__axis"><span>Distribution</span><span>Accumulation</span></div>
      {rows.map((row) => {
        const width = `${Math.max(3, Math.abs(row.netValue || 0) / max * 50)}%`;
        return (
          <div className={`wb-broker-flow__row wb-broker-flow__row--${row.side}`} key={`${row.side}-${row.code}`}>
            <span className="wb-broker-flow__code">{row.code}</span>
            <div className="wb-broker-flow__track"><i style={{ width }} /></div>
            <span className="wb-broker-flow__value">{formatIDR(row.netValue)}</span>
          </div>
        );
      })}
    </div>
  );
}

function BrokerRows({ title, rows }) {
  if (!rows.length) return null;
  return (
    <div className="wb-broker__top">
      <div className="text-tertiary">{title}</div>
      <div className="wb-broker__rows">
        {rows.slice(0, 5).map((row) => (
          <div key={row.code} className="wb-broker__row">
            <span className="wb-broker__code">{row.code}</span>
            <span className="text-secondary">{row.sourceType || '—'}</span>
            <span className={`tabular wb-broker__value ${row.netValue > 0 ? 'text-positive' : 'text-negative'}`}>{formatIDR(row.netValue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BrokerEvidence({ broker }) {
  const symbol = broker?.symbol ? String(broker.symbol).toUpperCase() : null;
  const [requestedDate, setRequestedDate] = useState('');
  const [state, setState] = useState({ loading: false, data: null, error: null });

  useEffect(() => {
    if (!symbol) return undefined;
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    getStockBrokerIntelligence({ ticker: symbol, days: 1, date: requestedDate || null })
      .then((raw) => guardStockBrokerIntelligence(raw))
      .then((result) => {
        if (cancelled) return;
        setState(result.ok
          ? { loading: false, data: result.data, error: null }
          : { loading: false, data: null, error: result.error });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, data: null, error: error.message });
      });
    return () => { cancelled = true; };
  }, [symbol, requestedDate]);

  const fallbackBuyers = broker?.buyers || [];
  const fallbackSellers = broker?.sellers || [];
  const buyers = state.data?.accumulation || fallbackBuyers;
  const sellers = state.data?.distribution || fallbackSellers;
  const resolvedDate = state.data?.window?.to || broker?.from || null;
  const rowsAvailable = buyers.length > 0 || sellers.length > 0;
  const methodNote = useMemo(() => state.data?.window?.complete === false
    ? 'Selected session has incomplete archive coverage.'
    : null, [state.data]);

  if (!symbol && (!broker || !broker.available)) {
    return (
      <div className="wb-broker">
        <h3 className="wb-section__title text-tertiary">Broker Evidence</h3>
        <div className="text-tertiary">{broker?.note || 'No broker data available.'}</div>
      </div>
    );
  }

  return (
    <div className="wb-broker">
      <div className="wb-broker__head">
        <div>
          <h3 className="wb-section__title text-tertiary">Broker Evidence</h3>
          <p className="wb-broker__disclaimer text-tertiary">Observed top-25 flow for one trading session. Estimates are evidence, not confirmed holdings.</p>
        </div>
        <label className="wb-broker__date">
          <span>Trading session</span>
          <input type="date" value={requestedDate || resolvedDate || ''} onChange={(event) => setRequestedDate(event.target.value)} />
        </label>
      </div>

      <div className="wb-broker__meta text-secondary">
        <span>Session: {resolvedDate || 'latest complete'}</span>
        {state.loading && <span> · Loading…</span>}
        {state.error && <span className="text-warning"> · Historical detail unavailable; showing analysis snapshot</span>}
        {methodNote && <span className="text-warning"> · {methodNote}</span>}
      </div>

      {rowsAvailable && (
        <div className="wb-broker__workspace">
          <div className="wb-broker__rankings">
            <BrokerRows title="Top buyers" rows={buyers} />
            <BrokerRows title="Top sellers" rows={sellers} />
          </div>
          <FlowBars buyers={buyers} sellers={sellers} />
        </div>
      )}

      {symbol && (
        <Link className="wb-broker__intel-link" to={`/broker-intelligence?lens=stock&ticker=${encodeURIComponent(symbol)}&days=1${resolvedDate ? `&date=${encodeURIComponent(resolvedDate)}` : ''}`}>
          Open full Broker Map →
        </Link>
      )}
    </div>
  );
}
