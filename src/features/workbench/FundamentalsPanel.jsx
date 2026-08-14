import { useEffect, useMemo, useState } from 'react';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { getFundamentalStatements } from '../../lib/api/client.js';
import { guardFundamentalStatements } from '../../lib/api/contracts.js';
import { evidencePage, evidenceSnippet, officialSourceHref } from '../keterbukaan/links.js';

function isInferredValue(row) {
  const kind = String(row.valueKind || row.factKind || '').toLowerCase();
  if (kind === 'inferred' || kind === 'derived' || kind === 'ratio' || kind === 'valuation') return true;
  return row.inferred === true || row.isInferred === true;
}

export function groupStatementsByPeriod(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (items[0] && Array.isArray(items[0].facts)) {
    return items
      .map((period) => ({
        period: period.periodLabel || period.period || 'Unspecified period',
        parserStatus: period.parserStatus || null,
        parserMethod: period.parserMethod || null,
        parserVersion: period.parserVersion || null,
        sourceUrl: period.sourceUrl || period.officialUrl || null,
        publishedAt: period.publishedAt || null,
        title: period.title || null,
        facts: (period.facts || []).filter((row) => !isInferredValue(row)),
      }))
      .filter((group) => group.facts.length > 0);
  }
  const groups = new Map();
  for (const row of items) {
    if (isInferredValue(row)) continue;
    const key = [row.periodEnd, row.periodType, row.periodLabel, row.fiscalYear]
      .filter(Boolean)
      .join(' · ') || 'Unspecified period';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([period, facts]) => ({ period, facts }));
}

function OfficialLink({ href }) {
  const safe = officialSourceHref(href);
  if (!safe) return <span className="ki-link-missing">Official source unavailable</span>;
  return (
    <a className="ki-official-link" href={safe} target="_blank" rel="noreferrer" data-testid="fundamentals-official-link">
      Official IDX source
    </a>
  );
}

export function FundamentalsPanel({ ticker }) {
  const [status, setStatus] = useState(ticker ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [partial, setPartial] = useState(false);

  useEffect(() => {
    if (!ticker) {
      setStatus('idle');
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    setError('');
    getFundamentalStatements({ ticker, limit: 50 }).then((raw) => {
      if (cancelled) return;
      const result = guardFundamentalStatements(raw);
      if (!result.ok) {
        setItems([]);
        setStatus('error');
        setError(result.error || 'Fundamental statements are unavailable.');
        return;
      }
      if (result.data.available === false) {
        setItems([]);
        setStatus('unavailable');
        setError(result.data.reason || 'Fundamental statement tables are not present.');
        return;
      }
      setItems(result.data.items);
      setPartial(Boolean(result.data.partial));
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const periods = useMemo(() => groupStatementsByPeriod(items), [items]);

  if (!ticker) {
    return <EmptyState title="Select a ticker" message="Open a name from the workbench to load statement periods." />;
  }
  if (status === 'loading') {
    return (
      <div data-testid="fundamentals-loading">
        <Skeleton label="Loading statements…" />
      </div>
    );
  }
  if (status === 'error' || status === 'unavailable') {
    return <ErrorState title="Fundamentals unavailable" error={error} />;
  }
  if (periods.length === 0) {
    return (
      <EmptyState
        title="No statement periods"
        message="No extracted financial-statement facts are available for this ticker."
      />
    );
  }

  return (
    <div className="fundamentals-panel" data-testid="fundamentals-panel">
      <p className="text-secondary">Parsed statement facts only. No ratios, valuation, or inferred values.</p>
      {partial ? (
        <p className="ki-partial" data-testid="fundamentals-partial">
          Showing partial statement data.
        </p>
      ) : null}
      {periods.map((group) => (
        <section key={group.period} className="fundamentals-period" data-testid="statement-period">
          <h4>{group.period}</h4>
          {group.parserStatus ? (
            <p className="text-tertiary">
              Parser {group.parserStatus}
              {group.parserMethod ? ` · ${group.parserMethod}` : ''}
              {group.parserVersion ? ` · ${group.parserVersion}` : ''}
            </p>
          ) : null}
          <OfficialLink href={group.sourceUrl} />
          <ul>
            {group.facts.map((row, index) => (
              <li key={`${row.fieldKey || row.label}-${index}`} data-testid="statement-fact">
                <div className="ki-card-top">
                  <strong>{row.label || row.fieldKey}</strong>
                  <span className="text-tertiary">{row.statementType}</span>
                </div>
                <p>
                  {row.valueText || (row.valueNumeric != null ? row.valueNumeric : '—')}
                  {row.unit ? ` ${row.unit}` : ''}
                </p>
                <p className="text-tertiary">
                  {row.confidence != null ? `Confidence ${row.confidence}` : 'Confidence not stated'}
                </p>
                {evidenceSnippet(row.evidence) || evidencePage(row.evidence) != null ? (
                  <div className="ki-evidence" data-testid="fundamentals-evidence">
                    {evidencePage(row.evidence) != null ? <p className="text-tertiary">Page {evidencePage(row.evidence)}</p> : null}
                    {evidenceSnippet(row.evidence) ? <blockquote>{evidenceSnippet(row.evidence)}</blockquote> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
