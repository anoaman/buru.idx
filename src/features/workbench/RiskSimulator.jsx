import { useEffect, useRef, useState } from 'react';
import { simulateRisk } from '../../lib/api/client.js';
import { guardRiskSimulation } from '../../lib/api/contracts.js';
import { formatIDR, formatNumber, formatPct, formatPrice } from '../../lib/format/market.js';

/**
 * Sizing starts from the page's one trade plan, so the calculator can never
 * argue with it. With no long entry it starts from the breakout to watch, and
 * otherwise from the close with blank levels for a manual setup.
 */
export function planLevels(plan, close) {
  if (plan?.available) return { entry: plan.entryHigh, stop: plan.stop, target: plan.target, source: 'plan' };
  if (plan?.alt) return { entry: plan.alt.trigger, stop: plan.alt.stop, target: plan.alt.target, source: 'alt' };
  return { entry: close, stop: null, target: null, source: 'none' };
}

export default function RiskSimulator({ ticker, plan }) {
  const levels = planLevels(plan, ticker?.close);
  const [form, setForm] = useState({
    entry: levels.entry || '',
    stop: levels.stop || '',
    target: levels.target || '',
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
      entry: levels.entry || '',
      stop: levels.stop || '',
      target: levels.target || '',
    }));
    setState({ loading: false, data: null, error: null });
    return () => { requestRef.current += 1; };
  }, [ticker?.symbol, ticker?.close, levels.entry, levels.stop, levels.target]);

  if (!ticker) return null;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const requestId = ++requestRef.current;
    setState({ loading: true, data: null, error: null });
    try {
      const result = guardRiskSimulation(await simulateRisk(form));
      if (requestId !== requestRef.current) return;
      setState(result.ok
        ? { loading: false, data: result.data, error: null }
        : { loading: false, data: null, error: result.error });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState({ loading: false, data: null, error: error?.message || 'Risk simulation failed' });
    }
  };

  return (
    <section className="inv-simulator" aria-labelledby="simulator-title">
      <div className="inv-section-head">
        <span>03</span>
        <div>
          <h3 id="simulator-title">Risk Simulator</h3>
          <p>Server-calculated position size using IDX ticks, fees, capital, and maximum risk.</p>
        </div>
      </div>
      {levels.source === 'plan' && (
        <div className="inv-simulator__levels" aria-label="Trade plan levels">
          <div><span>Buy</span><strong>{formatPrice(plan.entryLow)}{plan.entryHigh !== plan.entryLow ? `–${formatPrice(plan.entryHigh)}` : ''}</strong></div>
          <div><span>Stop</span><strong>{formatPrice(plan.stop)}</strong></div>
          <div><span>Target</span><strong>{formatPrice(plan.target)}</strong></div>
          <div><span>Plan net R:R</span><strong>{Number.isFinite(plan.netRR) ? plan.netRR.toFixed(2) : '—'}</strong></div>
        </div>
      )}
      {levels.source === 'alt' && <p className="inv-simulator__note">{plan.reason} Levels below are the breakout to watch.</p>}
      {levels.source === 'none' && <p className="inv-simulator__note">{plan?.reason || 'No trade plan.'} Enter your own stop and target.</p>}
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
