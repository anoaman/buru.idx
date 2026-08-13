import { useId, useRef, useState } from 'react';
import { saveCase } from '../../lib/api/client.js';
import { formatPrice } from '../../lib/format/market.js';

function finiteOrEmpty(value) {
  return Number.isFinite(value) ? String(value) : '';
}

export default function CaseCapturePanel({ ticker, source, snapshot, defaults = {}, onCancel, onSaved }) {
  const titleId = useId();
  const firstField = useRef(null);
  const [form, setForm] = useState({
    setupType: defaults.setupType || snapshot?.scenario || 'setup under review',
    horizonSessions: defaults.horizonSessions || 20,
    confirmation: defaults.confirmation || '',
    invalidationPrice: finiteOrEmpty(defaults.invalidationPrice),
    targetPrice: finiteOrEmpty(defaults.targetPrice),
    thesis: defaults.thesis || '',
  });
  const [state, setState] = useState({ saving: false, error: null, saved: null });

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setState({ saving: true, error: null, saved: null });
    const result = await saveCase({
      ticker,
      thesis: form.thesis.trim() || null,
      triggerPrice: defaults.triggerPrice ?? null,
      invalidationPrice: Number(form.invalidationPrice),
      snapshot,
      sourceRunId: snapshot?.sourceRunId ?? null,
      setupType: form.setupType.trim(),
      horizonSessions: Number(form.horizonSessions),
      entryCondition: {
        text: form.confirmation.trim(),
        basis: snapshot?.scenarioGeometry?.confirmation?.basis || snapshot?.scenarioGeometry?.invalidation?.basis || 'close',
        direction: 'long',
      },
      expectedConfirmation: snapshot?.scenarioGeometry?.confirmation
        ? {
            ...snapshot.scenarioGeometry.confirmation,
            level: snapshot.scenarioGeometry.confirmation.level ?? snapshot.scenarioGeometry.confirmation.price,
            text: form.confirmation.trim(),
          }
        : { text: form.confirmation.trim() },
      targets: form.targetPrice ? [Number(form.targetPrice)] : [],
    });
    if (result?.success === false) {
      setState({ saving: false, error: result.error || 'Case could not be saved.', saved: null });
      return;
    }
    setState({ saving: false, error: null, saved: result?.data || true });
    onSaved?.(result?.data || null);
  };

  return (
    <section className="case-capture" aria-labelledby={titleId}>
      <header className="case-capture__header">
        <div><h3 id={titleId}>Save {ticker} setup</h3><p>{source} · frozen as of {snapshot?.dataAsOf || 'latest EOD'}</p></div>
        <dl className="case-capture__summary">
          <div><dt>Tier</dt><dd>{snapshot?.capitalTier || '—'}</dd></div>
          <div><dt>Profile</dt><dd>{snapshot?.tradingProfile || '—'}</dd></div>
          <div><dt>Score</dt><dd>{Number.isFinite(snapshot?.score) ? snapshot.score.toFixed(1) : '—'}</dd></div>
          <div><dt>Fails below</dt><dd>{formatPrice(defaults.invalidationPrice)}</dd></div>
        </dl>
      </header>
      {state.saved ? (
        <div className="case-capture__success" role="status">
          <strong>Case saved with its current evidence frozen.</strong>
          <a className="ui-btn ui-btn--ghost" href="/cases">View Watchlist</a>
        </div>
      ) : (
        <form className="case-capture__form" onSubmit={submit}>
          {state.error && <p className="case-capture__error" role="alert">{state.error}</p>}
          <label>Setup label<input ref={firstField} required value={form.setupType} onChange={update('setupType')} /></label>
          <label>Horizon (sessions)<input required min="1" max="120" type="number" value={form.horizonSessions} onChange={update('horizonSessions')} /></label>
          <label className="case-capture__wide">Confirmation / entry condition<input required value={form.confirmation} onChange={update('confirmation')} placeholder="Daily close above the confirmation level" /></label>
          <label>Invalidation price<input required min="1" inputMode="decimal" value={form.invalidationPrice} onChange={update('invalidationPrice')} /></label>
          <label>Target price (optional)<input min="1" inputMode="decimal" value={form.targetPrice} onChange={update('targetPrice')} /></label>
          <label className="case-capture__wide">Your thesis (optional)<textarea rows="2" value={form.thesis} onChange={update('thesis')} /></label>
          <div className="case-capture__actions">
            <button className="ui-btn ui-btn--primary" type="submit" disabled={state.saving}>{state.saving ? 'Saving…' : 'Save case'}</button>
            <button className="ui-btn ui-btn--ghost" type="button" onClick={onCancel} disabled={state.saving}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
