import { useEffect, useRef, useState } from 'react';
import { simulateRisk } from '../../lib/api/client.js';
import { guardRiskSimulation } from '../../lib/api/contracts.js';
import { formatIDR, formatNumber, formatPct, formatPrice } from '../../lib/format/market.js';

export default function RiskSimulator({ ticker, geometry, scenarioGeometry, atr14Pct }) {
  const best = geometry?.bestSetup;
  const longSetup = scenarioGeometry?.framing === 'long_setup';
  const defaultEntry = longSetup
    ? scenarioGeometry?.trigger?.price ?? scenarioGeometry?.confirmation?.price ?? ''
    : scenarioGeometry
      ? ''
      : (ticker?.close || '');
  const defaultStop = scenarioGeometry?.invalidation?.price
    ?? scenarioGeometry?.defensiveExit?.price
    ?? best?.stop
    ?? '';
  const defaultTarget = longSetup
    ? (scenarioGeometry?.target?.price ?? best?.target ?? '')
    : scenarioGeometry
      ? ''
      : (best?.target || '');
  const [form, setForm] = useState({
    entry: defaultEntry,
    stop: defaultStop,
    target: defaultTarget,
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
      entry: defaultEntry,
      stop: defaultStop,
      target: defaultTarget,
    }));
    setState({ loading: false, data: null, error: null });
    return () => { requestRef.current += 1; };
  }, [ticker?.symbol, defaultEntry, defaultStop, defaultTarget]);

  if (!ticker || (!best && !scenarioGeometry)) return null;

  const entryNumber = Number(form.entry);
  const stopNumber = Number(form.stop);
  const stopDistancePct = entryNumber > 0 && stopNumber > 0
    ? ((entryNumber - stopNumber) / entryNumber) * 100
    : null;
  const stopAtrMultiple = Number.isFinite(stopDistancePct) && Number.isFinite(atr14Pct) && atr14Pct > 0
    ? stopDistancePct / atr14Pct
    : null;

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
          <p>
            {scenarioGeometry?.labels?.summary
              || 'Server-calculated position size using IDX ticks, fees, capital, and maximum risk.'}
          </p>
        </div>
      </div>
      <div className="inv-simulator__levels" aria-label="Current risk geometry">
        <div><span>Support</span><strong>{formatPrice(geometry?.nearestSupport)}</strong></div>
        <div><span>Resistance</span><strong>{formatPrice(geometry?.nearestResistance)}</strong></div>
        <div><span>Downside</span><strong>{formatPct(geometry?.downsidePct)}</strong></div>
        <div><span>Upside</span><strong>{formatPct(geometry?.upsidePct)}</strong></div>
        <div><span>Current net R:R</span><strong>{(longSetup ? (scenarioGeometry?.risk?.netRR ?? best?.netRR ?? best?.rr) : (best?.netRR ?? best?.rr))?.toFixed?.(2) || '—'}</strong></div>
      </div>
      <form onSubmit={submit}>
        {[
          ['entry', 'Entry'], ['stop', 'Fails below'], ['target', 'Upside to'],
          ['capital', 'Capital'], ['maxRiskPct', 'Max risk %'],
        ].map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input type="number" min="0" step="any" value={form[key]} onChange={(event) => update(key, event.target.value)} />
          </label>
        ))}
        <button type="submit" disabled={state.loading}>{state.loading ? 'Calculating' : 'Calculate size'}</button>
      </form>
      {Number.isFinite(stopAtrMultiple) && stopAtrMultiple < 1 && (
        <p className="inv-simulator__error">Fails below is {stopAtrMultiple.toFixed(1)} ATR from entry—inside the recent daily noise range.</p>
      )}
      {Number.isFinite(stopAtrMultiple) && stopAtrMultiple > 3 && (
        <p className="text-warning">Fails below is {stopAtrMultiple.toFixed(1)} ATR from entry; position sizing may become unusually thin.</p>
      )}
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
