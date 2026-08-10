import { useEffect, useState } from 'react';
import { getOpportunities } from '../../lib/api/client.js';
import { formatPrice } from '../../lib/format/market.js';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

export default function Radar() {
  const { openInvestigation, openBrokerMap } = useAnalysisContext();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    getOpportunities().then((response) => {
      if (cancelled) return;
      if (response?.success === false) setState({ loading: false, error: response.error, data: null });
      else setState({ loading: false, error: null, data: response.data });
    });
    return () => { cancelled = true; };
  }, []);

  const rows = state.data?.opportunities || [];
  return (
    <section className="radar-page" aria-labelledby="radar-title">
      <header className="module-heading">
        <div><span>MODULE 01 · DISCOVERY</span><h2 id="radar-title">Radar</h2></div>
        <p>Only structures worth questioning. No feed, no hype ticker carousel.</p>
      </header>
      {state.loading && <p className="text-tertiary">Loading the latest qualified scan…</p>}
      {state.error && <p className="text-negative">{state.error}</p>}
      {state.data?.run && (
        <div className="radar-run">
          <span>Scan #{state.data.run.id}</span><strong>{state.data.run.data_as_of}</strong>
          <span>{state.data.run.total_shortlisted} shortlisted / {state.data.run.total_eligible} eligible</span>
        </div>
      )}
      <div className="radar-list">
        {rows.map((row) => (
          <article className="radar-row" key={row.ticker}>
            <div className="radar-row__rank">{String(row.rank).padStart(2, '0')}</div>
            <div className="radar-row__identity">
              <strong>{row.ticker}</strong><span>{row.lane}</span>
            </div>
            <div className="radar-row__score"><strong>{row.score.toFixed(1)}</strong><span>{row.confidence} confidence</span></div>
            <div className="radar-row__why">
              <strong>{row.reasons?.[0] || 'Qualified structure'}</strong>
              <span>{row.reasons?.[1] || 'Evidence available in Workbench'}</span>
            </div>
            <div className="radar-row__levels">
              <span>Trigger <strong>{formatPrice(row.levels?.trigger)}</strong></span>
              <span>Invalid <strong>{formatPrice(row.levels?.invalidation)}</strong></span>
            </div>
            <div className="radar-row__actions">
              <button type="button" onClick={() => openInvestigation(row.ticker)}>Investigate</button>
              <button type="button" onClick={() => openBrokerMap(row.ticker, 7)}>Actors</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
