import { useEffect, useState } from 'react';
import { getCases } from '../../lib/api/client.js';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

export default function Cases() {
  const { openInvestigation, openBrokerMap } = useAnalysisContext();
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  useEffect(() => {
    let cancelled = false;
    getCases().then((response) => {
      if (cancelled) return;
      if (response?.success === false) setState({ loading: false, error: response.error, items: [] });
      else setState({ loading: false, error: null, items: response?.data?.items || [] });
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="cases-page" aria-labelledby="cases-title">
      <header className="module-heading">
        <div><span>MODULE 04 · MEMORY</span><h2 id="cases-title">Cases</h2></div>
        <p>Saved investigations retain the evidence and invalidation that existed when the case was opened.</p>
      </header>
      {state.loading && <p className="text-tertiary">Loading cases…</p>}
      {state.error && <p className="text-negative">{state.error}</p>}
      {!state.loading && !state.error && state.items.length === 0 && (
        <div className="cases-empty"><strong>No open cases.</strong><span>Radar finds candidates; Workbench turns one into a decision case.</span></div>
      )}
      <div className="cases-grid">
        {state.items.map((item) => (
          <article className="case-card" key={item.id}>
            <span className="case-card__status">{item.status || 'watching'}</span>
            <h3>{item.ticker}</h3>
            <p>{item.thesis || item.snapshot_reasons?.[0] || 'Thesis not recorded yet.'}</p>
            <div className="case-card__actions">
              <button type="button" onClick={() => openInvestigation(item.ticker)}>Re-open evidence</button>
              <button type="button" onClick={() => openBrokerMap(item.ticker, 7)}>Actor map</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
