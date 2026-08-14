import { useCallback, useEffect, useMemo, useState } from 'react';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import {
  getCollectorHealth,
  getDisclosureAnomalies,
  getDisclosureDetail,
  getDisclosureTimeline,
  getDisclosures,
} from '../../lib/api/client.js';
import {
  guardCollectorHealth,
  guardDisclosureAnomalies,
  guardDisclosureDetail,
  guardDisclosureTimeline,
  guardDisclosures,
} from '../../lib/api/contracts.js';
import { evidencePage, evidenceSnippet, officialSourceHref } from './links.js';

const PAGE_LIMIT = 25;
const CATEGORY_OPTIONS = [
  '', 'rights_issue', 'private_placement', 'dividend', 'stock_split', 'reverse_split',
  'warrant', 'acquisition', 'divestment', 'debt_funding', 'management_change',
  'control_change', 'suspension', 'uma', 'notation', 'operational_update', 'other_material',
];
const SIGNAL_OPTIONS = [
  { value: '', label: 'All signals' },
  { value: 'correction', label: 'Correction' },
  { value: 'repeat_filing', label: 'Repeated filing' },
  { value: 'contradictory_state', label: 'Contradictory state' },
  { value: 'unusual_frequency', label: 'Unusual frequency' },
  { value: 'rights_issue', label: 'Rights issue' },
  { value: 'private_placement', label: 'Private placement' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'uma', label: 'UMA' },
];
const SEVERITY_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function severityClass(severity) {
  const s = String(severity || '').toLowerCase();
  if (s === 'critical' || s === 'high') return 'badge badge-negative';
  if (s === 'medium') return 'badge badge-warning';
  return 'badge badge-info';
}

function latestCollectorSuccess(health) {
  const times = (health?.feeds || []).map((feed) => feed.lastSuccessAt).filter(Boolean);
  if (!times.length) return null;
  return [...times].sort().at(-1);
}

function CollectorFreshness({ health, status }) {
  if (status === 'loading') {
    return <Skeleton label="Checking collector…" />;
  }
  if (status === 'error' || !health || health.available === false) {
    return (
      <p className="ki-health" data-testid="collector-unavailable">
        Collector freshness unavailable.
      </p>
    );
  }
  const last = latestCollectorSuccess(health);
  return (
    <p className="ki-health" data-testid="collector-health">
      Collector {health.status || 'unknown'}
      {last ? ` · last success ${formatWhen(last)}` : ''}
      {health.feeds?.length ? ` · ${health.feeds.length} feeds` : ''}
    </p>
  );
}

function OfficialLink({ href, children }) {
  const safe = officialSourceHref(href);
  if (!safe) {
    return (
      <span className="ki-link-missing" data-testid="official-link-missing">
        Official source unavailable
      </span>
    );
  }
  return (
    <a className="ki-official-link" href={safe} target="_blank" rel="noreferrer" data-testid="official-link">
      {children || 'Open official IDX source'}
    </a>
  );
}

function EvidenceBlock({ evidence, testId = 'evidence' }) {
  const snippet = evidenceSnippet(evidence);
  const page = evidencePage(evidence);
  const url = officialSourceHref(evidence?.officialUrl || evidence?.sourceUrl);
  if (!snippet && page == null && !url) {
    return <p className="text-secondary">No evidence attached.</p>;
  }
  return (
    <div className="ki-evidence" data-testid={testId}>
      {page != null ? <p className="text-tertiary">Page {page}</p> : null}
      {snippet ? <blockquote>{snippet}</blockquote> : null}
      {url ? <OfficialLink href={url} /> : null}
    </div>
  );
}

function EventCard({ event, anomalies, selected, onSelect }) {
  const top = anomalies[0];
  return (
    <button
      type="button"
      className={`ki-card${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(event)}
      data-testid="disclosure-card"
    >
      <div className="ki-card-top">
        <span className="ki-ticker">{event.ticker || '—'}</span>
        {top ? <span className={severityClass(top.severity)}>{top.type || top.severity}</span> : null}
        {event.hasCorrection || event.correctionOf ? (
          <span className="badge badge-warning">Correction</span>
        ) : null}
      </div>
      <strong>{event.title || 'Untitled disclosure'}</strong>
      <p className="text-secondary">
        {event.eventFamily || event.category || 'Disclosure'} · {formatWhen(event.publishedAt || event.effectiveDate)}
      </p>
    </button>
  );
}

function Timeline({ members }) {
  if (!members.length) {
    return <p className="text-secondary">No related events in this group.</p>;
  }
  return (
    <ol className="ki-timeline" data-testid="correction-timeline">
      {members.map((item) => (
        <li key={item.eventId || `${item.role}-${item.publishedAt}`}>
          <span className="ki-timeline-when">{formatWhen(item.publishedAt)}</span>
          <span>
            {item.role ? `${item.role} · ` : ''}
            {item.title || item.eventId}
          </span>
          <OfficialLink href={item.sourceUrl} />
        </li>
      ))}
    </ol>
  );
}

function queryFilters(applied) {
  const ticker = /^[A-Z]{4}$/.test(applied.ticker) ? applied.ticker : undefined;
  return {
    ticker,
    from: applied.from || undefined,
    to: applied.to || undefined,
    category: applied.category || undefined,
    severity: applied.severity || undefined,
    signal: applied.signal || undefined,
    limit: PAGE_LIMIT,
  };
}

export default function Keterbukaan() {
  const [filters, setFilters] = useState({
    ticker: '',
    from: '',
    to: '',
    category: '',
    severity: '',
    signal: '',
  });
  const [applied, setApplied] = useState(filters);
  const [items, setItems] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [partial, setPartial] = useState(false);
  const [feedStatus, setFeedStatus] = useState('loading');
  const [feedError, setFeedError] = useState('');
  const [health, setHealth] = useState(null);
  const [healthStatus, setHealthStatus] = useState('loading');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [timelineGroup, setTimelineGroup] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);

  const loadHealth = useCallback(async () => {
    setHealthStatus('loading');
    try {
      const result = guardCollectorHealth(await getCollectorHealth());
      if (!result.ok) {
        setHealth(null);
        setHealthStatus('error');
        return;
      }
      setHealth(result.data);
      setHealthStatus('ready');
    } catch {
      setHealth(null);
      setHealthStatus('error');
    }
  }, []);

  const loadFeed = useCallback(async (cursor = null, append = false) => {
    setFeedStatus(append ? 'loading-more' : 'loading');
    setFeedError('');
    const params = { ...queryFilters(applied), cursor: cursor ?? undefined };
    try {
      const [feedRaw, anomalyRaw] = await Promise.all([
        getDisclosures(params),
        append ? Promise.resolve(null) : getDisclosureAnomalies(queryFilters(applied)),
      ]);
      const feed = guardDisclosures(feedRaw);
      if (!feed.ok) {
        if (!append) setItems([]);
        setFeedStatus('error');
        setFeedError(feed.error || 'Disclosure feed is unavailable.');
        return;
      }
      if (feed.data.available === false) {
        if (!append) setItems([]);
        setFeedStatus('unavailable');
        setFeedError(feed.data.reason || 'Disclosure tables are not present.');
        return;
      }
      const page = feed.data.items;
      setItems((prev) => (append ? [...prev, ...page] : page));
      setNextCursor(feed.data.nextCursor || null);
      let nextPartial = feed.data.partial === true;
      if (!append) {
        if (anomalyRaw) {
          const anomaly = guardDisclosureAnomalies(anomalyRaw);
          if (!anomaly.ok || anomaly.data.available === false) {
            setAnomalies([]);
            nextPartial = true;
          } else {
            setAnomalies(anomaly.data.items);
          }
        }
        setPartial(nextPartial);
      } else {
        setPartial((prev) => prev || nextPartial);
      }
      setFeedStatus('ready');
    } catch {
      if (!append) setItems([]);
      setFeedStatus('error');
      setFeedError('Disclosure feed is unavailable.');
    }
  }, [applied]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    loadFeed(null, false);
  }, [loadFeed]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setTimelineGroup(null);
      setDetailStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setDetailStatus('loading');
    setDetailError('');
    getDisclosureDetail(selectedId).then(async (raw) => {
      if (cancelled) return;
      const result = guardDisclosureDetail(raw);
      if (!result.ok) {
        setDetail(null);
        setTimelineGroup(null);
        setDetailStatus('error');
        setDetailError(result.error || 'Disclosure detail is unavailable.');
        return;
      }
      setDetail(result.data);
      if (result.data.ticker) {
        try {
          const timeline = guardDisclosureTimeline(await getDisclosureTimeline({
            ticker: result.data.ticker,
            limit: PAGE_LIMIT,
          }));
          if (!cancelled && timeline.ok && timeline.data.available !== false) {
            setTimelineGroup(
              timeline.data.items.find((group) => group.groupId === result.data.groupId) || timeline.data.items[0] || null,
            );
          }
        } catch {
          if (!cancelled) setTimelineGroup(null);
        }
      }
      setDetailStatus('ready');
    }).catch(() => {
      if (cancelled) return;
      setDetail(null);
      setTimelineGroup(null);
      setDetailStatus('error');
      setDetailError('Disclosure detail is unavailable.');
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, detailRetry]);

  const selected = useMemo(
    () => items.find((item) => item.eventId === selectedId) || null,
    [items, selectedId],
  );

  const anomaliesByGroup = useMemo(() => {
    const map = new Map();
    for (const row of anomalies) {
      if (!row.groupId) continue;
      if (!map.has(row.groupId)) map.set(row.groupId, []);
      map.get(row.groupId).push(row);
    }
    return map;
  }, [anomalies]);

  function applyFilters(event) {
    event.preventDefault();
    setSelectedId(null);
    setApplied({ ...filters });
  }

  const showEmpty = feedStatus === 'ready' && items.length === 0;
  const showError = feedStatus === 'error' || feedStatus === 'unavailable';
  const timelineMembers = timelineGroup?.members
    || (detail?.correctionChain || []).map((item) => ({
      eventId: item.eventId,
      role: item.role,
      title: item.eventId,
      publishedAt: null,
      sourceUrl: null,
    }));

  return (
    <section className="ki-page" data-testid="keterbukaan-page">
      <header className="module-heading">
        <div>
          <h2>Keterbukaan Informasi</h2>
        </div>
        <p>Official IDX disclosures, grouped events, and rule-based signals.</p>
      </header>
      <CollectorFreshness health={health} status={healthStatus} />

      <form className="ki-filters" onSubmit={applyFilters} data-testid="keterbukaan-filters">
        <label>
          Ticker
          <input
            value={filters.ticker}
            onChange={(e) => setFilters((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
            maxLength={4}
            placeholder="BBCA"
            aria-label="Ticker"
          />
        </label>
        <label>
          From
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        </label>
        <label>
          To
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        </label>
        <label>
          Category
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.filter(Boolean).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select
            value={filters.severity}
            onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
            aria-label="Severity"
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Signal
          <select
            value={filters.signal}
            onChange={(e) => setFilters((f) => ({ ...f, signal: e.target.value }))}
            aria-label="Signal"
          >
            {SIGNAL_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button className="ki-apply" type="submit">Apply filters</button>
      </form>

      {partial ? (
        <p className="ki-partial" data-testid="partial-data">
          Showing partial disclosure data. Some records may be missing.
        </p>
      ) : null}

      <div className="ki-layout">
        <div className="ki-feed">
          {feedStatus === 'loading' ? (
            <div data-testid="keterbukaan-loading">
              <Skeleton label="Loading disclosures…" chart />
            </div>
          ) : null}
          {showError ? (
            <ErrorState
              title={feedStatus === 'unavailable' ? 'Disclosures unavailable' : 'Could not load disclosures'}
              error={feedError}
              onRetry={() => loadFeed(null, false)}
            />
          ) : null}
          {showEmpty ? (
            <EmptyState
              title="No disclosures"
              message="No official IDX disclosures match the current filters."
            />
          ) : null}
          {feedStatus === 'ready' || feedStatus === 'loading-more'
            ? items.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  anomalies={anomaliesByGroup.get(event.groupId) || []}
                  selected={event.eventId === selectedId}
                  onSelect={(item) => setSelectedId(item.eventId)}
                />
              ))
            : null}
          {nextCursor && (feedStatus === 'ready' || feedStatus === 'loading-more') ? (
            <button className="ki-apply" type="button" onClick={() => loadFeed(nextCursor, true)}>
              Load more
            </button>
          ) : null}
        </div>

        <aside className="ki-detail" data-testid="keterbukaan-detail">
          {!selectedId ? (
            <EmptyState title="Select a disclosure" message="Open an event to see signals, timeline, and evidence." />
          ) : null}
          {detailStatus === 'loading' ? <Skeleton label="Loading disclosure…" /> : null}
          {detailStatus === 'error' ? (
            <ErrorState
              title="Detail unavailable"
              error={detailError}
              onRetry={() => setDetailRetry((n) => n + 1)}
            />
          ) : null}
          {detailStatus === 'ready' && detail ? (
            <div>
              <p className="text-tertiary">{detail.ticker || selected?.ticker}</p>
              <h3>{detail.title || selected?.title}</h3>
              <p className="text-secondary">
                {detail.eventFamily || detail.category} · {formatWhen(detail.publishedAt || detail.effectiveDate)}
              </p>
              <OfficialLink href={detail.sourceUrl} />

              <h4>Signals</h4>
              {(detail.signals || []).length === 0 && !(timelineGroup?.anomalies || []).length ? (
                <p className="text-secondary">No anomaly signals on this event.</p>
              ) : (
                <ul className="ki-signal-list" data-testid="signal-cards">
                  {[...(detail.signals || []), ...(timelineGroup?.anomalies || [])].map((row, index) => (
                    <li key={row.anomalyId || `${row.type}-${index}`} className="ki-signal">
                      <div className="ki-card-top">
                        <span className={severityClass(row.severity)}>{row.severity}</span>
                        <strong>{row.type}</strong>
                      </div>
                      <p>{row.reason}</p>
                      <p className="text-tertiary">
                        {row.confidence != null ? `Confidence ${row.confidence}` : 'Confidence not stated'}
                        {row.ruleVersion ? ` · ${row.ruleVersion}` : ''}
                      </p>
                      <EvidenceBlock evidence={row.evidence} testId="signal-evidence" />
                    </li>
                  ))}
                </ul>
              )}

              {(detail.facts || []).length > 0 ? (
                <>
                  <h4>Facts</h4>
                  <ul className="ki-fact-list" data-testid="fact-cards">
                    {detail.facts.map((fact) => (
                      <li key={fact.key}>
                        <strong>{fact.key}</strong>
                        <span>{fact.valueText || fact.valueDate || fact.valueNumeric}</span>
                        {fact.unit ? <span className="text-tertiary">{fact.unit}</span> : null}
                        <EvidenceBlock evidence={fact.evidence} testId="fact-evidence" />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h4>Correction timeline</h4>
              <Timeline members={timelineMembers} />

              <h4>Document</h4>
              {detail.documents?.[0] ? (
                <div data-testid="document-meta">
                  <p>{detail.documents[0].mimeType || 'Official document'}</p>
                  <p className="text-tertiary">
                    {detail.documents[0].downloadStatus || ''}
                    {detail.documents[0].observedAt ? ` · ${formatWhen(detail.documents[0].observedAt)}` : ''}
                  </p>
                  <OfficialLink href={detail.documents[0].sourceUrl} />
                </div>
              ) : (
                <p className="text-secondary">No document metadata.</p>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
