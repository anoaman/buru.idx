import { useEffect, useMemo, useState } from 'react';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { getNewsDetector, runNewsDetector } from '../../lib/api/client.js';
import { guardNewsDetector } from '../../lib/api/contracts.js';
import { officialSourceHref } from '../../lib/disclosures/links.js';

function todayWib() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function labelize(value) {
  return String(value || '').replaceAll('_', ' ');
}

function OfficialLink({ href }) {
  const safe = officialSourceHref(href);
  if (!safe) return <span className="ki-link-missing">Official source unavailable</span>;
  return (
    <a className="ki-official-link" href={safe} target="_blank" rel="noreferrer">
      Official IDX source
    </a>
  );
}

function EvidenceDrawer({ item }) {
  const [open, setOpen] = useState(false);
  const evidence = item.evidence || [];
  const breakdown = item.scoreBreakdown || {};
  return (
    <div className="nd-evidence">
      <button type="button" className="fm-toggle-btn" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? 'Hide evidence' : 'Show evidence'}
      </button>
      {open ? (
        <div className="nd-evidence__body" data-testid="news-evidence">
          {evidence.length === 0 ? <p className="text-tertiary">No keyword evidence stored for this item.</p> : null}
          {evidence.map((entry, index) => (
            <p className="text-secondary" key={`${entry.kind}-${index}`}>
              {entry.quote || `Matched ${entry.keyword}`}
            </p>
          ))}
          <dl className="nd-score">
            <div><dt>Title boost</dt><dd>{Number(breakdown.title || 0).toFixed(2)}</dd></div>
            <div><dt>Body boost</dt><dd>{Number(breakdown.body || 0).toFixed(2)}</dd></div>
            <div><dt>Category weight</dt><dd>{Number(breakdown.categoryWeight || 0).toFixed(2)}</dd></div>
            <div><dt>Deep-parsed</dt><dd>{breakdown.deepParsed ? 'yes' : 'no'}</dd></div>
          </dl>
          {item.suppressionReason ? <p className="text-tertiary">{item.suppressionReason}</p> : null}
          <OfficialLink href={item.officialSourceUrl} />
        </div>
      ) : null}
    </div>
  );
}

function SignalCard({ item }) {
  return (
    <article className="nd-card" data-testid="news-signal-card">
      <div className="nd-card__head">
        <span className="fm-badge">{labelize(item.category)}</span>
        <strong>{item.ticker || 'IDX'}</strong>
        <span className="text-tertiary">score {Number(item.signalScore || 0).toFixed(2)}</span>
      </div>
      <p>{item.title || item.eventId}</p>
      <EvidenceDrawer item={item} />
    </article>
  );
}

function AllDisclosures({ items }) {
  const [disposition, setDisposition] = useState('all');
  const [category, setCategory] = useState('all');
  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(),
    [items],
  );
  const filtered = items.filter((item) => {
    if (disposition !== 'all' && item.disposition !== disposition) return false;
    if (category !== 'all' && item.category !== category) return false;
    return true;
  });
  return (
    <div className="nd-all" data-testid="news-all-disclosures">
      <div className="nd-filters">
        <label>
          Disposition
          <select value={disposition} onChange={(event) => setDisposition(event.target.value)}>
            <option value="all">All</option>
            <option value="material">Material</option>
            <option value="suppressed">Suppressed</option>
            <option value="inconclusive">Inconclusive</option>
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All</option>
            {categories.map((value) => (
              <option key={value} value={value}>{labelize(value)}</option>
            ))}
          </select>
        </label>
      </div>
      <table className="ui-table nd-all__table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Title</th>
            <th>Disposition</th>
            <th>Category</th>
            <th>Score</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.eventId} data-testid="news-all-row">
              <td>{item.ticker || 'IDX'}</td>
              <td>{item.title || item.eventId}</td>
              <td>{item.disposition}</td>
              <td>{labelize(item.category)}</td>
              <td>{Number(item.signalScore || 0).toFixed(2)}</td>
              <td className="text-tertiary">{item.suppressionReason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 ? <p className="nd-empty">No disclosures match these filters.</p> : null}
    </div>
  );
}

export default function NewsDetector() {
  const [date, setDate] = useState(todayWib);
  const [view, setView] = useState('signals');
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = async (selectedDate = date) => {
    setState({ loading: true, data: null, error: null });
    const result = guardNewsDetector(await getNewsDetector(selectedDate));
    setState({
      loading: false,
      data: result.ok ? result.data : null,
      error: result.ok ? null : result.error,
    });
  };
  useEffect(() => { load(date); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const scan = async () => {
    setState({ loading: true, data: null, error: null });
    const result = guardNewsDetector(await runNewsDetector(date));
    setState({
      loading: false,
      data: result.ok ? result.data : null,
      error: result.ok ? null : result.error,
    });
  };
  const run = state.data?.run;
  const items = state.data?.items || [];
  const material = items.filter((item) => item.disposition === 'material');
  const suppressed = items.filter((item) => item.disposition === 'suppressed');

  return (
    <div className="nd-page ki-page" data-testid="news-detector-page">
      <header className="nd-header">
        <div>
          <h2>News Detector</h2>
          <p className="text-tertiary">Selected-date EOD scan of official IDX disclosures.</p>
        </div>
        <div className="nd-controls">
          <label htmlFor="nd-date">Disclosure date</label>
          <input id="nd-date" type="date" value={date} max={todayWib()} onChange={(event) => setDate(event.target.value)} />
          <button type="button" onClick={scan} disabled={state.loading}>Scan date</button>
        </div>
      </header>
      <div className="nd-tabs" role="tablist" aria-label="News Detector views">
        <button type="button" role="tab" aria-selected={view === 'signals'} onClick={() => setView('signals')}>Ranked signals</button>
        <button type="button" role="tab" aria-selected={view === 'all'} onClick={() => setView('all')}>All disclosures</button>
      </div>
      {state.loading ? <Skeleton label="Scanning disclosures…" /> : null}
      {state.error ? <ErrorState title="News Detector unavailable" error={state.error} /> : null}
      {!state.loading && !state.error && !run ? <p className="nd-empty">No scan exists for this date. Run it when the EOD disclosures are ready.</p> : null}
      {run ? (
        <section className="nd-summary" aria-label="Scan summary">
          <strong>{material.length} material signal{material.length === 1 ? '' : 's'}</strong>
          <span>{run.totalDisclosures} disclosures checked</span>
          <span>{suppressed.length} routine item{suppressed.length === 1 ? '' : 's'} suppressed</span>
          <span className="text-tertiary">rules {run.taxonomyVersion}</span>
        </section>
      ) : null}
      {view === 'all' && run ? <AllDisclosures items={items} /> : null}
      {view === 'signals' ? (
        <>
          <div className="nd-results">{material.map((item) => <SignalCard key={item.eventId} item={item} />)}</div>
          {run && material.length === 0 ? <p className="nd-empty">No material signals detected for this date.</p> : null}
          {suppressed.length ? (
            <details className="nd-suppressed">
              <summary>{suppressed.length} suppressed routine disclosures</summary>
              <ul>
                {suppressed.map((item) => (
                  <li key={item.eventId}>{item.ticker || 'IDX'} · {labelize(item.category)} · {item.suppressionReason}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
