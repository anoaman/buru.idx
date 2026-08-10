import { useEffect, useRef, useState } from 'react';
import { simulateRisk } from '../../lib/api/client.js';
import { guardRiskSimulation } from '../../lib/api/contracts.js';
import { formatIDR, formatNumber, formatPct, formatPrice } from '../../lib/format/market.js';

export default function RiskSimulator({ ticker, geometry }) {
  const best = geometry?.bestSetup;
  const [form, setForm] = useState({
    entry: ticker?.close || '',
    stop: best?.stop || '',
    target: best?.target || '',
    capital: 100_000_000,
    maxRiskPct: 1,
  });
  const [state, setState] = useState({ loading: false, data: null, error: null });
  // A sizing result belongs to the setup it was requested for. Bumping this on
  // every setup change and on unmount keeps an in-flight simulation from
  // landing under a ticker or geometry it was never calculated against.
  const requestRef = useRef(0);

  useEffect(() => {
    requestRef.current += 1;
    setForm((current) => ({
      ...current,
      entry: ticker?.close || '',
      stop: best?.stop || '',
      target: best?.target || '',
    }));
    setState({ loading: false, data: null, error: null });
    return () => { requestRef.current += 1; };
  }, [ticker?.symbol, ticker?.close, best?.stop, best?.target]);

  if (!ticker || !best) return null;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const requestId = ++requestRef.current;
    setState({ loading: true, data: null, error: null });
    const result = guardRiskSimulation(await simulateRisk(form));
    if (requestId !== requestRef.current) return;
    setState(result.ok
      ? { loading: false, data: result.data, error: null }
      : { loading: false, data: null, error: result.error });
  };

  return (
    <section className="inv-simulator" aria-labelledby="simulator-title">
      <div className="inv-section-head">
        <span>03</span>
        <div>
          <h3 id="simulator-title">Invalidation simulator</h3>
          <p>Server-calculated position size using IDX ticks, fees, capital, and maximum risk.</p>
        </div>
      </div>
      <div className="inv-simulator__levels" aria-label="Current risk geometry">
        <div><span>Support</span><strong>{formatPrice(geometry.nearestSupport)}</strong></div>
        <div><span>Resistance</span><strong>{formatPrice(geometry.nearestResistance)}</strong></div>
        <div><span>Downside</span><strong>{formatPct(geometry.downsidePct)}</strong></div>
        <div><span>Upside</span><strong>{formatPct(geometry.upsidePct)}</strong></div>
        <div><span>Current net R:R</span><strong>{(best.netRR ?? best.rr)?.toFixed(2) || '—'}</strong></div>
      </div>
      <form onSubmit={submit}>
        {[
          ['entry', 'Entry'], ['stop', 'Invalidation'], ['target', 'Target'],
          ['capital', 'Capital'], ['maxRiskPct', 'Max risk %'],
        ].map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input type="number" min="0" step="any" value={form[key]} onChange={(event) => update(key, event.target.value)} />
          </label>
        ))}
        <button type="submit" disabled={state.loading}>{state.loading ? 'CALCULATING' : 'CALCULATE SIZE'}</button>
      </form>
      {state.error && <p className="inv-simulator__error">{state.error}</p>}
      {state.data && (
        <div className="inv-simulator__result">
          <div><span>Position</span><strong>{formatNumber(state.data.lots)} lots</strong></div>
          <div><span>Capital deployed</span><strong>{formatIDR(state.data.deployedCapital)}</strong></div>
          <div><span>Estimated risk</span><strong>{formatIDR(state.data.estimatedRisk)} · {formatPct(state.data.estimatedRiskPct)}</strong></div>
          <div><span>Net R:R</span><strong>{state.data.netRR?.toFixed(2) || '—'}</strong></div>
          <div><span>Tick-aligned levels</span><strong>{formatPrice(state.data.entry)} / {formatPrice(state.data.stop)} / {formatPrice(state.data.target)}</strong></div>
          <div><span>Constraint</span><strong>{state.data.bindingConstraint}</strong></div>
        </div>
      )}
    </section>
  );
}
