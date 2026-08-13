import { useCallback, useEffect, useState } from 'react';
import { getFundamentals } from '../../lib/api/client.js';
import { guardFundamentals } from '../../lib/api/contracts.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

const SECTION_ORDER = [
  ['performance', 'Performance trend'],
  ['valuation', 'Valuation context'],
  ['balanceSheet', 'Balance sheet & cash flow'],
  ['dilution', 'Dilution & share count'],
  ['sources', 'Source attribution'],
];

export default function Fundamentals() {
  const { ticker } = useAnalysisContext();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ loading: true, error: null, data: null });
    getFundamentals(ticker)
      .then((raw) => {
        if (cancelled) return;
        const result = guardFundamentals(raw);
        setState({
          loading: false,
          error: result.ok ? null : result.error,
          data: result.data,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, error: error.message || 'Fundamentals request failed', data: null });
      });
    return () => { cancelled = true; };
  }, [ticker]);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  const sections = state.data?.sections || {};

  return (
    <section className="fd-page" aria-labelledby="fd-title">
      <header className="module-heading">
        <div><h2 id="fd-title">Fundamentals</h2></div>
        <p>
          Official-statement research for {ticker}. Sections stay empty until
          first-party IDX filings are loaded. This is not a price target and
          not a failed analysis.
        </p>
      </header>

      {state.loading && <Skeleton label={`Loading fundamentals for ${ticker}…`} />}

      {state.error && !state.loading && (
        <ErrorState title="Fundamentals unavailable" error={state.error} onRetry={load} />
      )}

      {!state.loading && !state.error && state.data && (
        <>
          <EmptyState
            title={`${ticker} statements are not loaded`}
            message={state.data.reason}
          />
          <div className="fd-grid">
            {SECTION_ORDER.map(([key, label]) => (
              <article key={key} className="fd-section">
                <h3>{label}</h3>
                <p>{sections[key]?.reason || 'This section stays empty rather than inventing figures.'}</p>
              </article>
            ))}
          </div>
          {state.data.sourcesConsidered.length > 0 && (
            <aside className="fd-sources" aria-label="Sources considered">
              <h3>Sources considered</h3>
              <ul>
                {state.data.sourcesConsidered.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </aside>
          )}
        </>
      )}
    </section>
  );
}
