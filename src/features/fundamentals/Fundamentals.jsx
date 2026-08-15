import { useEffect, useRef, useState } from 'react';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';
import {
  getFundamentalsDerived,
  getFundamentalsFacts,
  getFundamentalsSnapshot,
  getFundamentalsSources,
  getFundamentalStatements,
} from '../../lib/api/client.js';
import {
  guardFundamentalsDerived,
  guardFundamentalsFacts,
  guardFundamentalsSnapshot,
  guardFundamentalsSources,
  guardFundamentalStatements,
} from '../../lib/api/contracts.js';
import { officialSourceHref } from '../../lib/disclosures/links.js';

function formatNumber(value, unit) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (unit === '%') return `${Number(value).toFixed(2)}%`;
  if (unit === 'x') return `${Number(value).toFixed(2)}x`;
  if (unit === 'IDR') {
    if (abs >= 1e12) return `Rp ${(value / 1e12).toFixed(2)} T`;
    if (abs >= 1e9) return `Rp ${(value / 1e9).toFixed(2)} M`;
    if (abs >= 1e6) return `Rp ${(value / 1e6).toFixed(2)} jt`;
    return `Rp ${Math.round(Number(value)).toLocaleString('id-ID')}`;
  }
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} M`;
  return String(value);
}

function formatRaw(value, unit) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (unit === '%') return `${Number(value).toFixed(2)}%`;
  if (unit === 'x') return `${Number(value).toFixed(2)}x`;
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} M`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)} jt`;
  return Number.isInteger(value) ? value.toLocaleString('id-ID') : Number(value).toFixed(2);
}

function CompanyTypeBadge({ type }) {
  if (!type) return null;
  return (
    <span className="fm-badge" data-testid="company-type-badge">
      {type.toUpperCase()}
    </span>
  );
}

function OfficialLink({ href, label = 'Official IDX source' }) {
  const safe = officialSourceHref(href);
  if (!safe) return <span className="ki-link-missing">Official source unavailable</span>;
  return (
    <a className="ki-official-link" href={safe} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function FilingSelector({ filings, selectedId, onSelect }) {
  if (!filings || filings.length === 0) return null;
  return (
    <div className="fm-filing-selector">
      <label className="fm-filing-selector__label" htmlFor="fm-filing-select">Filing</label>
      <select
        id="fm-filing-select"
        className="fm-filing-selector__select"
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        {filings.map((f) => (
          <option key={f.filingId} value={f.filingId}>
            {f.periodLabel || f.filingId}
            {f.extractionStatus === 'partial' ? ' (partial)' : ''}
            {f.extractionStatus === 'pending' ? ' (pending)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function SnapshotSection({ snapshot, loading, error }) {
  if (loading) return <Skeleton label="Loading snapshot…" />;
  if (error) return <ErrorState title="Snapshot unavailable" error={error} />;
  if (!snapshot) return null;
  if (snapshot.available === false) {
    return (
      <div className="fm-unavailable" data-testid="fundamentals-unavailable">
        <p className="text-secondary">
          v18 Fundamentals data not yet loaded for this ticker.
        </p>
        <p className="text-tertiary">{snapshot.reason}</p>
      </div>
    );
  }
  if (snapshot.filingCount === 0) {
    return (
      <EmptyState
        title="No filings"
        message="No v18 fundamental filings are available for this ticker."
      />
    );
  }
  return (
    <div className="fm-snapshot" data-testid="fundamentals-snapshot">
      <div className="fm-snapshot__meta">
        <CompanyTypeBadge type={snapshot.companyType} />
        <span className="text-tertiary">{snapshot.filingCount} filing{snapshot.filingCount !== 1 ? 's' : ''}</span>
        <span className="text-tertiary">Latest: {snapshot.latestPeriod || '—'}</span>
        {snapshot.latestExtractionStatus && snapshot.latestExtractionStatus !== 'success' ? (
          <span className="fm-badge fm-badge--warn" data-testid="extraction-status">
            {snapshot.latestExtractionStatus}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function KeyNumbersSection({ facts, derived, loading }) {
  if (loading) return <Skeleton label="Loading key numbers…" />;
  const KEY_FIELDS = ['net_income', 'revenue', 'total_assets', 'total_equity', 'operating_cash_flow', 'net_interest_income'];
  const seen = new Set();
  const entries = [];
  const pushFact = (fieldKey, valueNumeric, unit) => {
    if (!fieldKey || seen.has(fieldKey) || valueNumeric == null) return;
    const norm = fieldKey.toLowerCase().replace(/[-\s]/g, '_');
    if (!KEY_FIELDS.some((key) => norm.includes(key) || key.includes(norm))) return;
    seen.add(fieldKey);
    entries.push({ label: fieldKey, value: valueNumeric, unit: unit || 'IDR' });
  };
  for (const fact of facts || []) {
    pushFact(fact.fieldKey, fact.valueNumeric, fact.unit);
  }
  if (entries.length === 0 && derived?.available) {
    for (const metric of derived.metrics || []) {
      for (const inputKey of ['numerator', 'denominator']) {
        const fact = metric.inputs?.[inputKey];
        if (fact) pushFact(fact.fieldKey, fact.valueNumeric, fact.unit);
      }
    }
  }
  if (entries.length === 0) return null;

  return (
    <div className="fm-key-numbers" data-testid="key-numbers-section">
      {entries.slice(0, 5).map((entry) => (
        <div key={entry.label} className="fm-key-number">
          <span className="fm-key-number__label text-tertiary">{entry.label}</span>
          <strong className="fm-key-number__value">{formatRaw(entry.value, entry.unit)}</strong>
          {entry.unit && entry.unit !== 'IDR' ? (
            <span className="fm-key-number__unit text-tertiary">{entry.unit}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DerivedMetricCard({ metric }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={`fm-metric ${metric.available ? 'fm-metric--available' : 'fm-metric--unavailable'}`}
      data-testid="derived-metric"
    >
      <div className="fm-metric__header">
        <span className="fm-metric__label">{metric.label}</span>
        <strong className="fm-metric__value">
          {metric.available ? formatNumber(metric.value, metric.unit) : '—'}
        </strong>
      </div>
      <p className="fm-metric__formula text-tertiary">{metric.formula}</p>
      {!metric.available && metric.rejectionReason ? (
        <p className="fm-metric__rejection text-tertiary" data-testid="rejection-reason">
          {metric.rejectionReason}
        </p>
      ) : null}
      {metric.available && (metric.inputs.numerator || metric.inputs.denominator) ? (
        <button
          type="button"
          className="fm-metric__expand"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide inputs' : 'Show inputs'}
        </button>
      ) : null}
      {expanded ? (
        <div className="fm-metric__inputs" data-testid="metric-inputs">
          {metric.inputs.numerator ? (
            <div className="fm-metric__input">
              <span className="text-tertiary">Numerator:</span>
              <span>{metric.inputs.numerator.fieldKey}</span>
              <span className="text-secondary">{formatRaw(metric.inputs.numerator.valueNumeric, metric.inputs.numerator.unit)}</span>
              {metric.inputs.numerator.evidence?.officialUrl ? (
                <OfficialLink href={metric.inputs.numerator.evidence.officialUrl} label="Source" />
              ) : null}
              {metric.inputs.numerator.evidence?.page != null ? (
                <span className="text-tertiary">p.{metric.inputs.numerator.evidence.page}</span>
              ) : null}
            </div>
          ) : null}
          {metric.inputs.denominator ? (
            <div className="fm-metric__input">
              <span className="text-tertiary">Denominator:</span>
              <span>{metric.inputs.denominator.fieldKey}</span>
              <span className="text-secondary">{formatRaw(metric.inputs.denominator.valueNumeric, metric.inputs.denominator.unit)}</span>
              {metric.inputs.denominator.evidence?.officialUrl ? (
                <OfficialLink href={metric.inputs.denominator.evidence.officialUrl} label="Source" />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DerivedSection({ derived, section, title, loading, error }) {
  if (loading) return <Skeleton label={`Loading ${title}…`} />;
  if (error) return <ErrorState title={`${title} unavailable`} error={error} />;
  if (!derived) return null;
  if (derived.available === false) {
    return (
      <p className="text-tertiary" data-testid={`${section}-unavailable`}>
        {derived.reason || 'v18 data not available.'}
      </p>
    );
  }
  const metrics = (derived.metrics || []).filter((m) => m.section === section);
  if (metrics.length === 0) {
    return (
      <p className="text-tertiary">No {title.toLowerCase()} metrics available for this filing.</p>
    );
  }
  return (
    <div className="fm-metric-grid" data-testid={`${section}-section`}>
      {metrics.map((m) => (
        <DerivedMetricCard key={m.key} metric={m} />
      ))}
    </div>
  );
}

function TrendsSection({ snapshot, loading }) {
  if (loading) return <Skeleton label="Loading trends…" />;
  if (!snapshot?.available || !snapshot.filings || snapshot.filings.length < 2) {
    return (
      <p className="text-tertiary">Trends require at least two extracted filings.</p>
    );
  }
  return (
    <div className="fm-trends" data-testid="trends-section">
      <table className="ui-table fm-trends__table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Filing type</th>
            <th>Facts</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.filings.map((f) => (
            <tr key={f.filingId}>
              <td>{f.periodLabel || f.filingId}</td>
              <td className="text-secondary">{f.filingType || '—'}</td>
              <td className="text-secondary">{f.factCount ?? '—'}</td>
              <td>
                <span className={`fm-badge ${f.extractionStatus === 'success' ? 'fm-badge--ok' : 'fm-badge--warn'}`}>
                  {f.extractionStatus || '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FullStatementsSection({ ticker, filing, loading: parentLoading }) {
  const [status, setStatus] = useState('idle');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const filingId = filing?.filingId;

  useEffect(() => {
    if (!open || !ticker) return undefined;
    let cancelled = false;
    setStatus('loading');
    setError('');
    const fetch = filingId
      ? getFundamentalsFacts({ ticker, filingId, limit: 50 })
        .then((raw) => {
          const result = guardFundamentalsFacts(raw);
          if (!result.ok) throw new Error(result.error || 'Unavailable');
          if (result.data.available === false) {
            return { items: null, unavailable: result.data.reason };
          }
          return { items: result.data.items, unavailable: null };
        })
      : getFundamentalStatements({ ticker, limit: 50 })
        .then((raw) => {
          const result = guardFundamentalStatements(raw);
          if (!result.ok) throw new Error(result.error || 'Unavailable');
          if (result.data.available === false) {
            return { items: null, unavailable: result.data.reason };
          }
          const facts = [];
          for (const period of result.data.items) {
            for (const fact of period.facts) {
              facts.push({ ...fact, periodLabel: period.periodLabel, sourceUrl: period.sourceUrl });
            }
          }
          return { items: facts, unavailable: null };
        });
    fetch
      .then(({ items: fetched, unavailable }) => {
        if (cancelled) return;
        if (unavailable) { setStatus('unavailable'); setError(unavailable); return; }
        setItems(fetched || []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err?.message || 'Statements unavailable.');
      });
    return () => { cancelled = true; };
  }, [ticker, filingId, open, retryToken]);

  if (parentLoading) return <Skeleton label="Loading statements…" />;

  return (
    <div className="fm-statements" data-testid="statements-section">
      <button
        type="button"
        className="fm-toggle-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide full statements' : 'Show full statements'}
      </button>
      {open ? (
        <>
          {status === 'loading' && <Skeleton label="Loading facts…" />}
          {(status === 'error' || status === 'unavailable') && (
            <ErrorState
              title="Statements unavailable"
              error={error}
              onRetry={status === 'error' ? () => setRetryToken((n) => n + 1) : null}
            />
          )}
          {status === 'ready' && items.length === 0 && (
            <EmptyState title="No facts" message="No extracted facts are available for this filing." />
          )}
          {status === 'ready' && items.length > 0 && (
            <ul className="ki-fact-list fm-fact-list" data-testid="facts-list">
              {items.map((fact, i) => (
                <li key={`${fact.fieldKey || fact.factId || i}`} className="ki-signal" data-testid="fact-row">
                  <div className="ki-card-top">
                    <strong>{fact.fieldKey || fact.label}</strong>
                    <span className="text-tertiary">{fact.statementType}</span>
                  </div>
                  <span>
                    {fact.valueNumeric != null ? formatRaw(fact.valueNumeric, fact.unit) : fact.valueText || '—'}
                    {fact.unit && fact.unit !== 'IDR' ? ` ${fact.unit}` : ''}
                  </span>
                  {fact.periodLabel ? (
                    <span className="text-tertiary"> · {fact.periodLabel}</span>
                  ) : null}
                  {fact.confidence != null ? (
                    <span className="text-tertiary"> · conf {fact.confidence}</span>
                  ) : null}
                  {fact.evidence?.officialUrl ? (
                    <OfficialLink href={fact.evidence.officialUrl} label="Source" />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

const LEARNING_GLOSSARY = [
  { key: 'gross_margin', term: 'Gross Margin', definition: 'Percentage of revenue remaining after subtracting cost of goods sold. Measures pricing power and production efficiency.' },
  { key: 'operating_margin', term: 'Operating Margin', definition: 'Percentage of revenue remaining after operating expenses. Shows how efficiently the business converts sales to profit before interest and taxes.' },
  { key: 'net_margin', term: 'Net Profit Margin', definition: 'Bottom-line profit as a percentage of revenue. Includes all costs, taxes, and interest.' },
  { key: 'roe', term: 'Return on Equity (ROE)', definition: 'Net income relative to shareholders\' equity. Measures how effectively management generates profit from equity capital.' },
  { key: 'roa', term: 'Return on Assets (ROA)', definition: 'Net income relative to total assets. Shows how efficiently assets are deployed to generate earnings.' },
  { key: 'nim', term: 'Net Interest Margin (NIM)', definition: 'Bank-specific. Net interest income as a percentage of interest-earning assets. Higher is generally better for banks.' },
  { key: 'current_ratio', term: 'Current Ratio', definition: 'Current assets divided by current liabilities. A ratio above 1 means short-term assets cover short-term obligations.' },
  { key: 'debt_to_equity', term: 'Debt to Equity', definition: 'Total liabilities relative to equity. Higher values indicate more financial leverage and potential risk.' },
  { key: 'debt_to_assets', term: 'Debt to Assets', definition: 'Total liabilities as a fraction of total assets. Shows what proportion of assets is financed by debt.' },
  { key: 'bopo', term: 'BOPO Ratio', definition: 'Bank-specific efficiency ratio. Operating expenses divided by operating income. Lower BOPO means higher efficiency.' },
  { key: 'operating_cf_margin', term: 'Operating CF Margin', definition: 'Operating cash flow as a percentage of revenue. Higher than net margin suggests strong cash conversion.' },
  { key: 'cf_to_net_income', term: 'CF / Net Income', definition: 'Operating cash flow divided by net income. Ratios above 1 suggest accounting earnings are backed by real cash.' },
  { key: 'eps', term: 'Earnings Per Share (EPS)', definition: 'Net income divided by weighted average shares outstanding. A fundamental driver of share price.' },
  { key: 'bvps', term: 'Book Value Per Share (BVPS)', definition: 'Shareholders\' equity divided by shares outstanding. Compares to market price to compute Price-to-Book.' },
];

function LearningSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fm-learning" data-testid="learning-section">
      <button
        type="button"
        className="fm-toggle-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide explanations' : 'Show metric explanations'}
      </button>
      {open ? (
        <dl className="fm-glossary">
          {LEARNING_GLOSSARY.map((entry) => (
            <div key={entry.key} className="fm-glossary__entry">
              <dt className="fm-glossary__term">{entry.term}</dt>
              <dd className="fm-glossary__def text-secondary">{entry.definition}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function SourcesSection({ sources, loading, error }) {
  if (loading) return <Skeleton label="Loading sources…" />;
  if (error) return <ErrorState title="Sources unavailable" error={error} />;
  if (!sources) return null;
  if (sources.available === false) {
    return <p className="text-tertiary">{sources.reason || 'Sources not available.'}</p>;
  }
  const list = sources.sources || [];
  if (list.length === 0) {
    return <p className="text-tertiary">No official source links on record for this ticker.</p>;
  }
  return (
    <ul className="fm-sources-list" data-testid="sources-list">
      {list.map((src) => (
        <li key={src.filingId || src.eventId} className="fm-source-item">
          <div className="fm-source-item__meta">
            <strong>{src.periodLabel || src.filingId}</strong>
            {src.publishedAt ? (
              <span className="text-tertiary"> · {src.publishedAt.slice(0, 10)}</span>
            ) : null}
          </div>
          {src.title ? <p className="text-secondary">{src.title}</p> : null}
          <OfficialLink href={src.sourceUrl} />
        </li>
      ))}
    </ul>
  );
}

export default function Fundamentals() {
  const { ticker } = useAnalysisContext();
  const [snapshotStatus, setSnapshotStatus] = useState(ticker ? 'loading' : 'idle');
  const [snapshotData, setSnapshotData] = useState(null);
  const [snapshotError, setSnapshotError] = useState('');
  const [selectedFilingId, setSelectedFilingId] = useState(null);
  const [derivedStatus, setDerivedStatus] = useState('idle');
  const [derivedData, setDerivedData] = useState(null);
  const [derivedError, setDerivedError] = useState('');
  const [factsStatus, setFactsStatus] = useState('idle');
  const [factsData, setFactsData] = useState([]);
  const [sourcesStatus, setSourcesStatus] = useState('idle');
  const [sourcesData, setSourcesData] = useState(null);
  const [sourcesError, setSourcesError] = useState('');
  const snapshotRetryRef = useRef(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!ticker) {
      setSnapshotStatus('idle');
      setSnapshotData(null);
      setDerivedData(null);
      setSourcesData(null);
      setFactsData([]);
      setSelectedFilingId(null);
      return undefined;
    }
    let cancelled = false;
    setSnapshotStatus('loading');
    setSnapshotError('');
    setDerivedData(null);
    setSourcesData(null);
    setFactsData([]);
    setSelectedFilingId(null);

    Promise.all([
      getFundamentalsSnapshot(ticker),
      getFundamentalsSources({ ticker }),
    ]).then(([rawSnap, rawSrc]) => {
      if (cancelled) return;
      const snapResult = guardFundamentalsSnapshot(rawSnap);
      if (!snapResult.ok) {
        setSnapshotStatus('error');
        setSnapshotError(snapResult.error);
        return;
      }
      setSnapshotData(snapResult.data);
      setSnapshotStatus('ready');

      const srcResult = guardFundamentalsSources(rawSrc);
      if (srcResult.ok) {
        setSourcesData(srcResult.data);
      } else {
        setSourcesError(srcResult.error);
      }
      setSourcesStatus('ready');

      const latestFilingId = snapResult.data.latestFilingId;
      if (latestFilingId) {
        setSelectedFilingId(latestFilingId);
      }
    }).catch((err) => {
      if (cancelled) return;
      setSnapshotStatus('error');
      setSnapshotError(err?.message || 'Fundamentals data unavailable.');
    });

    return () => { cancelled = true; };
  }, [ticker, retryToken]);

  useEffect(() => {
    if (!ticker || !selectedFilingId) {
      setDerivedData(null);
      setFactsData([]);
      return undefined;
    }
    let cancelled = false;
    setDerivedStatus('loading');
    setFactsStatus('loading');
    setDerivedError('');
    Promise.all([
      getFundamentalsDerived({ ticker, filingId: selectedFilingId }),
      getFundamentalsFacts({ ticker, filingId: selectedFilingId, limit: 50 }),
    ]).then(([rawDerived, rawFacts]) => {
      if (cancelled) return;
      const derivedResult = guardFundamentalsDerived(rawDerived);
      if (!derivedResult.ok) {
        setDerivedStatus('error');
        setDerivedError(derivedResult.error);
      } else {
        setDerivedData(derivedResult.data);
        setDerivedStatus('ready');
      }
      const factsResult = guardFundamentalsFacts(rawFacts);
      if (factsResult.ok && factsResult.data.available !== false) {
        setFactsData(factsResult.data.items || []);
      } else {
        setFactsData([]);
      }
      setFactsStatus('ready');
    }).catch((err) => {
      if (cancelled) return;
      setDerivedStatus('error');
      setDerivedError(err?.message || 'Derived metrics unavailable.');
      setFactsStatus('ready');
    });
    return () => { cancelled = true; };
  }, [ticker, selectedFilingId]);

  const loading = snapshotStatus === 'loading';
  const derivedLoading = derivedStatus === 'loading';
  const selectedFiling = snapshotData?.filings?.find((f) => f.filingId === selectedFilingId) || null;

  if (!ticker) {
    return (
      <div className="fm-page ki-page">
        <EmptyState title="Select a ticker" message="Enter a ticker in the command bar to view fundamentals." />
      </div>
    );
  }

  if (snapshotStatus === 'error') {
    return (
      <div className="fm-page ki-page">
        <ErrorState
          title="Fundamentals unavailable"
          error={snapshotError}
          onRetry={() => setRetryToken((n) => n + 1)}
        />
      </div>
    );
  }

  return (
    <div className="fm-page ki-page" data-testid="fundamentals-page">
      <div className="fm-header">
        <h2 className="fm-header__title">
          Fundamentals
          <span className="fm-header__ticker text-tertiary"> · {ticker}</span>
        </h2>
        <p className="fm-header__note text-tertiary">
          All values from official filings only. No ratios mix periods or company types.
        </p>
      </div>

      <section className="fm-section" aria-labelledby="fm-snapshot-heading">
        <h3 id="fm-snapshot-heading" className="fm-section__title">Snapshot</h3>
        <SnapshotSection
          snapshot={snapshotData}
          loading={loading}
          error={snapshotStatus === 'error' ? snapshotError : ''}
        />
      </section>

      {snapshotData?.available && snapshotData.filings?.length > 0 ? (
        <FilingSelector
          filings={snapshotData.filings}
          selectedId={selectedFilingId}
          onSelect={setSelectedFilingId}
        />
      ) : null}

      <section className="fm-section" aria-labelledby="fm-keynumbers-heading">
        <h3 id="fm-keynumbers-heading" className="fm-section__title">Key Numbers</h3>
        <KeyNumbersSection
          facts={factsData}
          derived={derivedData}
          loading={derivedLoading || factsStatus === 'loading'}
        />
        {!derivedLoading && !derivedData && snapshotData?.available ? (
          <p className="text-tertiary">Select a filing to view key numbers.</p>
        ) : null}
      </section>

      <section className="fm-section" aria-labelledby="fm-trends-heading">
        <h3 id="fm-trends-heading" className="fm-section__title">Trends</h3>
        <TrendsSection snapshot={snapshotData} loading={loading} />
      </section>

      <section className="fm-section" aria-labelledby="fm-profitability-heading">
        <h3 id="fm-profitability-heading" className="fm-section__title">Profitability</h3>
        <DerivedSection
          derived={derivedData}
          section="profitability"
          title="Profitability"
          loading={derivedLoading}
          error={derivedStatus === 'error' ? derivedError : ''}
        />
      </section>

      <section className="fm-section" aria-labelledby="fm-health-heading">
        <h3 id="fm-health-heading" className="fm-section__title">Financial Health</h3>
        <DerivedSection
          derived={derivedData}
          section="health"
          title="Financial Health"
          loading={derivedLoading}
          error={derivedStatus === 'error' ? derivedError : ''}
        />
      </section>

      <section className="fm-section" aria-labelledby="fm-cashquality-heading">
        <h3 id="fm-cashquality-heading" className="fm-section__title">Cash Quality</h3>
        <DerivedSection
          derived={derivedData}
          section="cash_quality"
          title="Cash Quality"
          loading={derivedLoading}
          error={derivedStatus === 'error' ? derivedError : ''}
        />
      </section>

      <section className="fm-section" aria-labelledby="fm-pershare-heading">
        <h3 id="fm-pershare-heading" className="fm-section__title">Per Share</h3>
        <DerivedSection
          derived={derivedData}
          section="per_share"
          title="Per Share"
          loading={derivedLoading}
          error={derivedStatus === 'error' ? derivedError : ''}
        />
      </section>

      <section className="fm-section" aria-labelledby="fm-statements-heading">
        <h3 id="fm-statements-heading" className="fm-section__title">Full Statements</h3>
        <FullStatementsSection
          ticker={ticker}
          filing={selectedFiling}
          loading={loading && !snapshotData}
        />
      </section>

      <section className="fm-section" aria-labelledby="fm-learning-heading">
        <h3 id="fm-learning-heading" className="fm-section__title">Learning</h3>
        <LearningSection />
      </section>

      <section className="fm-section" aria-labelledby="fm-sources-heading">
        <h3 id="fm-sources-heading" className="fm-section__title">Sources</h3>
        <SourcesSection
          sources={sourcesData}
          loading={sourcesStatus === 'loading'}
          error={sourcesStatus === 'error' ? sourcesError : ''}
        />
      </section>
    </div>
  );
}
