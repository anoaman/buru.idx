import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getRadarScout, getRadarScoutConditions } from '../../lib/api/client.js';
import { guardRadarScout, guardRadarScoutConditions } from '../../lib/api/contracts.js';
import { formatDate, formatIDR, formatPct, formatPrice, formatRatio } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';
import './Screener.css';

const RECIPES = [
  { id: 'quiet_accumulation', label: 'Quiet accumulation', description: 'Persistent buying near confirmed support.', icon: '↗' },
  { id: 'dominant_broker', label: 'Dominant broker', description: 'Find a clear leader in broker buying.', icon: '◎' },
  { id: 'support_compression', label: 'Support compression', description: 'Tight price ranges near repeated support.', icon: '≋' },
];
const DEFAULT_SCOUT_FILTERS = Object.freeze({
  recipe: '', conditions: [], asOf: '', brokerSessions: 7, brokerPreset: '7d', brokerFrom: '', brokerTo: '', consolidationSessions: 10,
  supportSessions: 20, maxPrice: 1000, minAverageValue: 500_000_000, limit: 10,
  minLeadBrokerValue: 1_000_000_000, useLeadBrokerValue: false,
  minRsVsIhsgPct: 0, useRsVsIhsg: false, excludeFca: false,
  useBroker: false, useSupport: false, useSideways: false, useMaxPrice: false, useLiquidity: false,
});
const BROKER_RANGES = [['latest', 'Latest'], ['previous', 'Previous'], ['7d', '7D'], ['14d', '14D'], ['1m', '1M'], ['custom', 'Custom (up to 60 days)']];
const BROKER_PRESET_SESSIONS = Object.freeze({
  latest: 1,
  previous: 1,
  '7d': 7,
  '14d': 14,
  '1m': 22,
});
function scoutRequestPayload(filters) {
  const payload = { ...filters };
  if (filters.brokerPreset === 'custom') {
    delete payload.brokerSessions;
  } else if (BROKER_PRESET_SESSIONS[filters.brokerPreset] != null) {
    payload.brokerSessions = BROKER_PRESET_SESSIONS[filters.brokerPreset];
  }
  if (filters.brokerPreset !== 'custom') {
    delete payload.brokerFrom;
    delete payload.brokerTo;
  }
  return payload;
}

function scoutBrokerHandoffRange(filters) {
  if (filters.brokerPreset === 'custom' && filters.brokerFrom && filters.brokerTo) {
    return { preset: 'custom', from: filters.brokerFrom, to: filters.brokerTo };
  }
  if (filters.brokerPreset && filters.brokerPreset !== 'custom') {
    return { preset: filters.brokerPreset };
  }
  return null;
}

function formatRank(rank) {
  return Number.isFinite(rank) ? String(rank).padStart(2, '0') : '—';
}

const PRICE_CONDITIONS = new Set(['min_price', 'max_price']);

function compactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (Math.abs(number) >= 1e12) return `${Number((number / 1e12).toFixed(2))}T`;
  if (Math.abs(number) >= 1e9) return `${Number((number / 1e9).toFixed(2))}B`;
  if (Math.abs(number) >= 1e6) return `${Number((number / 1e6).toFixed(2))}M`;
  return number.toLocaleString('en-US');
}

function parseCompactNumber(value) {
  const clean = String(value || '').trim().toUpperCase().replaceAll(',', '');
  const match = clean.match(/^(-?\d+(?:\.\d+)?)\s*([KMBT])?$/);
  if (!match) return null;
  const scale = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[match[2]] || 1;
  const parsed = Number(match[1]) * scale;
  return Number.isFinite(parsed) ? parsed : null;
}

function ConditionInput({ definition, condition, onChange }) {
  const formatValue = (value) => definition.unit === 'IDR'
    ? (PRICE_CONDITIONS.has(definition.id) ? Number(value).toLocaleString('en-US') : compactNumber(value))
    : String(value);
  const [draft, setDraft] = useState(() => formatValue(condition.value));
  useEffect(() => setDraft(formatValue(condition.value)), [condition.value]);
  if (definition.type === 'select') {
    return <select id={`condition-${definition.id}`} aria-label={definition.label} value={condition.value} onChange={(event) => onChange(event.target.value)}>{definition.options.map((option) => <option key={option}>{option}</option>)}</select>;
  }
  const commit = () => {
    const parsed = parseCompactNumber(draft);
    if (parsed == null) {
      setDraft(formatValue(condition.value));
      return;
    }
    const bounded = Math.min(definition.max, Math.max(definition.min, parsed));
    onChange(bounded);
    setDraft(formatValue(bounded));
  };
  return (
    <span className="scout-filter__value">
      <input
        id={`condition-${definition.id}`} aria-label={`${definition.label} value`}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur(); } }}
      />
      {definition.unit && <small>{definition.unit === 'IDR' && !PRICE_CONDITIONS.has(definition.id) ? 'Rp · use M/B/T' : definition.unit}</small>}
    </span>
  );
}
const EVIDENCE_BAND_LABEL = { high: 'High signal', medium: 'Medium signal', low: 'Low signal' };
const EVIDENCE_BAND_TONE = { high: 'badge-positive', medium: 'badge-info', low: 'badge-neutral' };

function breakdownLabel(key) {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function EvidenceBandBadge({ band }) {
  const key = EVIDENCE_BAND_LABEL[band] ? band : 'low';
  return <span className={`badge ${EVIDENCE_BAND_TONE[key]}`}>{EVIDENCE_BAND_LABEL[key]}</span>;
}

// Shared by qualified and near-miss Scout rows: reasons, risks, broker context and
// scoreBreakdown are always preserved here (behind a disclosure), even when a row's
// primary columns differ between the two tables.
function ScoutDetail({ row }) {
  const breakdown = Object.entries(row.scoreBreakdown || {});
  const evidence = Object.entries(row.evidence || {});
  return (
    <div className="radar-detail">
      <div>
        <h4>Why it appeared</h4>
        {row.reasons.length > 0
          ? row.reasons.map((reason) => <p key={reason}>{reason}</p>)
          : <p>No reasons recorded.</p>}
      </div>
      <div>
        <h4>Check manually</h4>
        {row.risks.length > 0
          ? row.risks.map((risk) => <p key={risk} className="is-risk">{risk}</p>)
          : <p>No additional warning triggered.</p>}
      </div>
      {row.broker && (
        <div>
          <h4>Positive share</h4>
          <p>
            {formatPct(row.broker.leadSharePct, 0, false)} of buying value
            {row.broker.lead ? ` · ${row.broker.lead.buySessions}/${row.broker.expectedSessions} buying days` : ''}
          </p>
        </div>
      )}
      {breakdown.length > 0 && (
        <div>
          <h4>Score breakdown</h4>
          <div className="radar-detail__chips" aria-label="Score breakdown">
            {breakdown.map(([key, value]) => (
              <span key={key}>{breakdownLabel(key)} <strong>{Number.isFinite(value) ? value.toFixed(0) : '—'}</strong></span>
            ))}
          </div>
        </div>
      )}
      {evidence.length > 0 && (
        <div><h4>Recipe evidence</h4><div className="radar-detail__chips">{evidence.map(([key, value]) => <span key={key}>{breakdownLabel(key)} <strong>{value == null ? 'Unavailable' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</strong></span>)}</div></div>
      )}
    </div>
  );
}

const QUALIFIED_COLUMNS = 7;

function QualifiedRow({ row, displayRank, onInvestigate, onActors }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="ui-row">
        <td className="tabular text-tertiary">{formatRank(displayRank)}</td>
        <td>
          <div className="radar-cell-ticker">
            <strong>{row.ticker}</strong>
            <span>{row.name}{row.board ? ` · ${row.board}` : ''}{row.isFca ? ' · FCA' : ''}</span>
          </div>
        </td>
        <td className="tabular"><div className="scout-score"><strong>{Number.isFinite(row.score) ? row.score.toFixed(1) : '—'}</strong><EvidenceBandBadge band={row.evidenceBand} /></div></td>
        <td className="tabular"><div className="radar-cell-metric"><strong>{formatPrice(row.price.lastPrice)}</strong><span>{formatIDR(row.price.averageValue, true)} / day</span></div></td>
        <td className="tabular">
          <div className="radar-cell-metric">
            <strong>{row.broker?.lead?.code || '—'}</strong>
            <span>{formatIDR(row.broker?.lead?.netValue, true)}</span>
            <span>{formatRatio(row.broker?.leadToSecondRatio)}{row.broker?.second?.code ? ` vs ${row.broker.second.code}` : ' · no second buyer'}</span>
          </div>
        </td>
        <td className="tabular">
          <div className="radar-cell-metric">
            <strong>{formatPrice(row.price.support)}</strong>
            <span>{formatPct(row.price.distanceFromSupportPct)} · {row.price.supportTouches} touches</span>
            <span>{formatPct(row.price.consolidationRangePct, 1, false)} range{row.price.volatilityContracting ? ' · contracting' : ''}</span>
          </div>
        </td>
        <td>
          <div className="radar-row__actions">
            <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} analysis`} onClick={onInvestigate}>Analyze ↗</button>
            <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} broker flow`} onClick={onActors}>Flow ↗</button>
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} ${row.ticker} evidence`}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="ui-row-detail">
          <td colSpan={QUALIFIED_COLUMNS}><div className="scout-expanded-heading"><span>RS vs IHSG <strong>{row.relativeStrengthVsIhsgPct == null ? 'Unavailable' : formatPct(row.relativeStrengthVsIhsgPct)}</strong> · Volatility {row.price.volatilityContracting ? 'contracting' : 'not contracting'}</span></div><ScoutDetail row={row} /></td>
        </tr>
      )}
    </>
  );
}

function ScoutQualifiedTable({ rows, onInvestigate, onActors }) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table ui-table--scout" aria-label="Scout candidates">
        <thead>
          <tr>
            <th className="tabular">#</th>
            <th>Ticker</th>
            <th className="tabular">Score / signal</th>
            <th className="tabular">Price / liquidity</th>
            <th className="tabular">Lead broker</th>
            <th className="tabular">Support / range</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <QualifiedRow
              key={row.ticker}
              row={row}
              displayRank={index + 1}
              onInvestigate={() => onInvestigate(row.ticker)}
              onActors={() => onActors(row.ticker)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What the screen actually ran against, stated rather than implied.
 *
 * Two things here are easy to miss and change how a result should be read. The
 * broker window silently shrinks when the archive is short of the requested
 * span, so asking for 7 sessions and scoring on 5 looks identical to asking for
 * 5. And a recipe with no broker leg anchors to a later price date than one with
 * it, so two strategies on this page can legitimately disagree about "today".
 */
function ScoutProvenance({ data, requestedSessions }) {
  const requested = data.asOf.requestedBrokerSessions ?? requestedSessions;
  const observed = data.asOf.brokerSessions;
  const degraded = Number.isFinite(requested) && Number.isFinite(observed) && observed < requested;
  return (
    <div className="radar-run">
      <strong>{data.recipe.label}</strong>
      <span>Prices through {formatDate(data.asOf.priceDate)}</span>
      {data.asOf.brokerFrom ? (
        <span className={degraded ? 'radar-run__age--missing' : undefined}>
          Broker flow {formatDate(data.asOf.brokerFrom)}–{formatDate(data.asOf.brokerTo)}
          {degraded
            ? ` · ${observed} of ${requested} sessions available`
            : ` · ${observed} trading days`}
        </span>
      ) : (
        <span>No broker window in this screen</span>
      )}
      <span>{data.coverage.matched} matched</span>
      <span>Showing {data.coverage.returned}</span>
    </div>
  );
}

const NEAR_MISS_COLUMNS = 6;

// Condition thresholds are read in the same units the filter was typed in, so a
// gap has to be rendered the same way the input was. Rupiah compacts, everything
// else keeps its suffix.
function formatConditionValue(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'IDR') return `Rp${compactNumber(value)}`;
  if (unit === '%') return `${Number(value.toFixed(2))}%`;
  if (unit === 'x') return `${Number(value.toFixed(2))}×`;
  return String(Number(value.toFixed(2)));
}

/**
 * A near miss that only names the condition it failed is a label, not a finding.
 * Missing the liquidity floor by 3% and missing it by 92% are different stocks,
 * and only one of them is worth opening.
 */
function MissedCondition({ detail, fallback }) {
  if (!detail) {
    return <span className="scout-near-miss__missed">Missed: {fallback || 'unspecified condition'}</span>;
  }
  if (!detail.available) {
    return (
      <span className="scout-near-miss__missed">
        <strong>{detail.label}</strong>
        <small>no evidence available</small>
      </span>
    );
  }
  const gapText = Number.isFinite(detail.gapPct)
    ? `off by ${formatConditionValue(detail.gap, detail.unit)} (${detail.gapPct}%)`
    : `off by ${formatConditionValue(detail.gap, detail.unit)}`;
  // Under 15% of the threshold is close enough that the stock is arguably a
  // tuning decision rather than a rejection.
  const near = Number.isFinite(detail.gapPct) && detail.gapPct <= 15;
  return (
    <span className={`scout-near-miss__missed${near ? ' scout-near-miss__missed--close' : ''}`}>
      <strong>{detail.label}</strong>
      <small>
        {formatConditionValue(detail.observed, detail.unit)} vs {formatConditionValue(detail.expected, detail.unit)} · {gapText}
      </small>
    </span>
  );
}

function NearMissRow({ row, onInvestigate, onActors }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="ui-row">
        <td className="tabular text-tertiary">{formatRank(row.rank)}</td>
        <td>
          <div className="radar-cell-ticker">
            <strong>{row.ticker}</strong>
            <span>{row.name}{row.board ? ` · ${row.board}` : ''}</span>
          </div>
        </td>
        <td className="tabular"><strong>{Number.isFinite(row.score) ? row.score.toFixed(1) : '—'}</strong></td>
        <td><EvidenceBandBadge band={row.evidenceBand} /></td>
        <td><MissedCondition detail={row.failedDetail} fallback={row.failedCondition} /></td>
        <td>
          <div className="radar-row__actions">
            <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} analysis`} onClick={onInvestigate}>Open Analysis</button>
            <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} broker flow`} onClick={onActors}>Broker Flow</button>
            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} ${row.ticker} evidence`}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="ui-row-detail">
          <td colSpan={NEAR_MISS_COLUMNS}><ScoutDetail row={row} /></td>
        </tr>
      )}
    </>
  );
}

function ScoutNearMissSection({ rows, onInvestigate, onActors }) {
  if (rows.length === 0) return null;
  return (
    <section className="scout-near-miss" aria-label="Almost matched stocks">
      <h3 className="scout-near-miss__title">Almost Matched</h3>
      <p className="scout-near-miss__intro">
        These stocks missed exactly one enabled condition. The margin is shown against the
        threshold you set, so a narrow miss is a tuning decision and a wide one is a rejection.
      </p>
      <div className="ui-table-wrap">
        <table className="ui-table ui-table--near-miss" aria-label="Almost matched stocks">
          <thead>
            <tr>
              <th className="tabular">#</th>
              <th>Ticker</th>
              <th className="tabular">Score</th>
              <th>Signal</th>
              <th>Missed condition</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <NearMissRow
                key={row.ticker}
                row={row}
                onInvestigate={() => onInvestigate(row.ticker)}
                onActors={() => onActors(row.ticker)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DailyDiff({ diff }) {
  const groups = [
    { key: 'new', label: 'New', rows: diff.new, tone: 'positive' },
    { key: 'still', label: 'Still qualified', rows: diff.still, tone: 'neutral' },
    { key: 'dropped', label: 'Dropped', rows: diff.dropped, tone: 'warning' },
  ];
  return (
    <section className="scout-diff" aria-label="Daily qualification changes">
      <header><div><span>Session change</span><h3>Since previous session</h3></div></header>
      <div className="scout-diff__grid">
        {groups.map((group) => (
          <article className={`scout-diff__card scout-diff__card--${group.tone}`} key={group.key}>
            <div className="scout-diff__heading"><strong>{group.label}</strong><span>{group.rows.length}</span></div>
            <div className="scout-diff__tickers">
              {group.rows.length === 0 && <span className="scout-diff__empty">None</span>}
              {group.rows.map((row) => (
                <span className="scout-diff__ticker" key={row.ticker} title={row.failedCondition || undefined}>
                  {row.ticker}{group.key === 'still' && row.qualificationStreak ? <small>{row.qualificationStreak}d</small> : null}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Scout({ onInvestigate, onActors }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => {
    const next = { ...DEFAULT_SCOUT_FILTERS };
    for (const key of Object.keys(next)) {
      const raw = searchParams.get(key);
      if (raw == null) continue;
      if (Array.isArray(next[key])) {
        try { next[key] = JSON.parse(raw); } catch { next[key] = []; }
      } else if (typeof next[key] === 'boolean') next[key] = raw === 'true';
      else if (typeof next[key] === 'number') next[key] = Number(raw);
      else next[key] = raw;
    }
    return next;
  });
  const [catalog, setCatalog] = useState({ loading: true, error: null, conditions: [], templates: {} });
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const [showCatalog, setShowCatalog] = useState(filters.conditions.length === 0);
  const [filterQuery, setFilterQuery] = useState('');
  const [resultQuery, setResultQuery] = useState('');
  const [sort, setSort] = useState('score');
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const requestRef = useRef(0);
  useEffect(() => () => { requestRef.current += 1; }, []);
  useEffect(() => {
    let active = true;
    getRadarScoutConditions().then((raw) => {
      if (!active) return;
      const result = guardRadarScoutConditions(raw);
      setCatalog(result.ok ? { loading: false, error: null, ...result.data } : { loading: false, error: result.error, conditions: [], templates: {} });
    }).catch((error) => { if (active) setCatalog({ loading: false, error: error.message, conditions: [], templates: {} }); });
    return () => { active = false; };
  }, []);
  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox'
      ? event.target.checked
      : event.target.type === 'text'
        ? Number(event.target.value.replace(/[^0-9]/g, ''))
        : Number(event.target.value);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const conditionGroups = useMemo(() => ['Universe', 'Price setup', 'Confirmation'].map((category) => ({
    category,
    items: catalog.conditions.filter((item) => item.category === category),
  })), [catalog.conditions]);
  const persistPermalink = (nextFilters) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) if (value !== '' && value !== false) params.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
    setSearchParams(params, { replace: true });
  };
  const selectRecipe = (recipeId) => {
    setFilters((current) => ({ ...current, recipe: recipeId, conditions: (catalog.templates[recipeId] || []).map((item) => ({ ...item })) }));
    setShowCatalog(!recipeId);
    setFilterQuery('');
    setFiltersOpen(true);
  };
  const updateCondition = (id, value) => setFilters((current) => ({ ...current, conditions: current.conditions.map((item) => item.id === id ? { ...item, value } : item) }));
  const toggleCondition = (definition, enabled) => setFilters((current) => ({
    ...current,
    conditions: enabled
      ? [...current.conditions, { id: definition.id, value: definition.defaultValue ?? definition.options?.[0] ?? true }]
      : current.conditions.filter((item) => item.id !== definition.id),
  }));
  const run = (event) => {
    event?.preventDefault();
    const requestId = ++requestRef.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    persistPermalink(filters);
    getRadarScout(scoutRequestPayload(filters)).then((raw) => {
      if (requestId !== requestRef.current) return;
      const result = guardRadarScout(raw);
      setState({ loading: false, error: result.ok ? null : result.error, data: result.data });
      if (result.ok) { setAppliedFilters(filters); setResultQuery(''); setFiltersOpen(false); }
      if (result.ok && !filters.asOf && result.data.asOf.priceDate) {
        const pinned = { ...filters, asOf: result.data.asOf.priceDate };
        persistPermalink(pinned);
      }
    }).catch((error) => {
      if (requestId !== requestRef.current) return;
      setState({ loading: false, error: error.message || 'Screener request failed', data: null });
    });
  };
  const handoffActors = (ticker) => onActors(ticker, scoutBrokerHandoffRange(appliedFilters || filters));
  const dirty = appliedFilters && JSON.stringify(filters) !== JSON.stringify(appliedFilters);
  const visibleRows = useMemo(() => {
    const query = resultQuery.trim().toLowerCase();
    const rows = (state.data?.candidates || []).filter((row) => !query || `${row.ticker} ${row.name}`.toLowerCase().includes(query));
    return [...rows].sort((a, b) => sort === 'ticker' ? a.ticker.localeCompare(b.ticker)
      : sort === 'liquidity' ? (b.price.averageValue ?? -Infinity) - (a.price.averageValue ?? -Infinity)
        : (b.score ?? -Infinity) - (a.score ?? -Infinity));
  }, [state.data, resultQuery, sort]);
  return (
    <div className="scout-view">
      <fieldset className="scout-strategies">
        <legend>Start with a strategy</legend>
        <div role="radiogroup" aria-label="Screening strategy">
          {[...RECIPES, { id: '', label: 'Custom screen', description: 'Choose your own market conditions.', icon: '+' }].map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={filters.recipe === item.id} disabled={catalog.loading || Boolean(catalog.error)} className={filters.recipe === item.id ? 'is-selected' : ''} onClick={() => selectRecipe(item.id)}>
              <span className="scout-strategy-icon" aria-hidden="true">{item.icon}</span>
              <span className="scout-strategy-copy"><strong>{item.label}</strong><span>{item.description}</span></span>
              <span className="scout-strategy-check" aria-hidden="true">{filters.recipe === item.id ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="scout-layout">
        <form className="scout-controls scout-layout__conditions" data-collapsed={!filtersOpen} onSubmit={run}>
          <header className="scout-filter-heading"><div><span className="scout-eyebrow">Build your screen</span><h2>Conditions <span>{filters.conditions.length}</span></h2></div><div className="scout-filter-heading-actions"><button type="button" className="scout-text-button" disabled={!filters.conditions.length} onClick={() => { selectRecipe(''); }}>Clear all</button><button type="button" className="scout-mobile-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>{filtersOpen ? 'Hide filters' : 'Edit filters'}</button></div></header>
          <div className="scout-active-filters" aria-label="Active conditions">
            {!filters.conditions.length && <p className="scout-filter-hint">Add a condition below, or start with a strategy above.</p>}
            {filters.conditions.map((condition) => {
              const definition = catalog.conditions.find((item) => item.id === condition.id);
              if (!definition) return null;
              return <div className="scout-active-filter" key={condition.id}>
                <div>{definition.type === 'boolean' ? <span className="scout-active-filter__label">{definition.label}</span> : <label htmlFor={`condition-${definition.id}`}>{definition.label}</label>}<button type="button" className="scout-remove" aria-label={`Remove ${definition.label}`} onClick={() => toggleCondition(definition, false)}>×</button></div>
                {definition.type !== 'boolean' ? <ConditionInput definition={definition} condition={condition} onChange={(value) => updateCondition(definition.id, value)} /> : <span className="scout-condition-enabled">✓ Enabled</span>}
                {definition.description && <span className="scout-condition-description">{definition.description}</span>}
              </div>;
            })}
          </div>
          <section className="scout-catalog" aria-label="Screener filters">
            <button type="button" className="scout-add-button" aria-expanded={showCatalog} aria-controls="scout-catalog" onClick={() => setShowCatalog((value) => !value)}>{showCatalog ? '− Close filter library' : '+ Add conditions'}</button>
            {catalog.loading && <Skeleton label="Loading condition catalog…" />}
            {catalog.error && <p className="scout-catalog-error" role="alert">Filters are unavailable. {catalog.error}</p>}
            {showCatalog && !catalog.loading && !catalog.error && <div id="scout-catalog">
              <input type="search" aria-label="Find a condition" placeholder="Find a condition…" value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} />
              <div className="scout-filter-groups">{conditionGroups.map((group) => {
                const items = group.items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(filterQuery.toLowerCase()));
                if (!items.length) return null;
                return <section key={group.category} className="scout-filter-group"><h3>{group.category}</h3><div>{items.map((definition) => {
                  const enabled = filters.conditions.some((item) => item.id === definition.id);
                  return <label className={`scout-library-option ${enabled ? 'is-enabled' : ''}`} key={definition.id} title={definition.description}><input type="checkbox" checked={enabled} onChange={(event) => toggleCondition(definition, event.target.checked)} /><span>{definition.label}</span></label>;
                })}</div></section>;
              })}</div>
              {!catalog.conditions.some((item) => `${item.label} ${item.description}`.toLowerCase().includes(filterQuery.toLowerCase())) && <p className="scout-filter-hint">No conditions found. Try “price” or “broker”.</p>}
            </div>}
          </section>
          <details className="scout-screen-settings">
            <summary><span>Time windows</span><span>{BROKER_RANGES.find(([value]) => value === filters.brokerPreset)?.[1]} broker flow</span></summary>
            <div className="scout-execution-settings" aria-label="Screen settings">
              <label>Broker window<select value={filters.brokerPreset} onChange={(event) => setFilters((current) => ({ ...current, brokerPreset: event.target.value }))}>{BROKER_RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {filters.brokerPreset === 'custom' && <><label>From<input type="date" required value={filters.brokerFrom} onChange={(event) => setFilters((current) => ({ ...current, brokerFrom: event.target.value }))} /></label><label>To<input type="date" required min={filters.brokerFrom || undefined} value={filters.brokerTo} onChange={(event) => setFilters((current) => ({ ...current, brokerTo: event.target.value }))} /></label></>}
              <label>As-of date<input type="date" value={filters.asOf} onChange={(event) => setFilters((current) => ({ ...current, asOf: event.target.value }))} /><small>Leave blank for latest available</small></label>
              <label>Support window<input type="number" min="5" max="120" value={filters.supportSessions} onChange={update('supportSessions')} /><small>Trading sessions</small></label>
              <label>Range window<input type="number" min="5" max="60" value={filters.consolidationSessions} onChange={update('consolidationSessions')} /><small>Trading sessions</small></label>
            </div>
          </details>
          <div className="scout-controls__footer">
            <label>Result limit<select value={filters.limit} onChange={update('limit')}><option value="10">10 stocks</option><option value="25">25 stocks</option><option value="50">50 stocks</option><option value="100">100 stocks</option></select></label>
            <button type="submit" className="ui-btn ui-btn--primary" disabled={state.loading || catalog.loading || Boolean(catalog.error) || filters.conditions.length === 0}>{state.loading ? 'Screening…' : 'Run Screener'} <span aria-hidden="true">→</span></button>
            <p>{filters.conditions.length ? `All ${filters.conditions.length} active conditions must pass.` : 'Add a condition to start screening.'}</p>
          </div>
        </form>

        <section className="scout-results" aria-label="Screening results" aria-busy={state.loading}>
          <header className="scout-results-heading"><div><span className="scout-eyebrow">Your research queue</span><h2>Shortlist {state.data && <span>{state.data.coverage.matched}</span>}</h2></div><span className="scout-data-badge"><i /> End-of-day data</span></header>
          {state.error && <ErrorState title="Screener unavailable" error={state.error} onRetry={run} />}
          {!state.data && state.loading && <Skeleton label="Screening the market…" />}
          {!state.data && !state.loading && !state.error && <div className="scout-welcome">
            <div className="scout-empty-art" aria-hidden="true"><svg width="160" height="104" viewBox="0 0 160 104" fill="none"><rect x="18" y="8" width="124" height="88" rx="10" /><path d="M35 31h42M35 52h65M35 73h51" /><path className="scout-art-accent" d="m111 28 4 4 9-10m-13 27 4 4 9-10" /><circle cx="117" cy="74" r="5" /></svg></div>
            <span className="scout-eyebrow">From the market to your shortlist</span>
            <h3>Find stocks worth a closer look.</h3>
            <p>Start with a strategy, fine-tune your conditions, and compare the stocks that match.</p>
            <button type="button" className="ui-btn ui-btn--primary" disabled={catalog.loading || Boolean(catalog.error)} onClick={() => selectRecipe('quiet_accumulation')}>Try quiet accumulation <span aria-hidden="true">↗</span></button>
            <div className="scout-welcome-steps"><div><span>01</span><strong>Define your universe</strong><p>Price and liquidity boundaries.</p></div><div><span>02</span><strong>Look for a setup</strong><p>Support, range and confirmation.</p></div><div><span>03</span><strong>Investigate the evidence</strong><p>Open charts and broker activity.</p></div></div>
          </div>}
          {state.data && <>
            <div className="scout-result-status" role="status">{state.loading ? 'Updating results…' : dirty ? 'Conditions changed. Run the screener to update these results.' : `${state.data.coverage.returned} returned from ${state.data.coverage.evaluated} evaluated stocks.`}</div>
            <ScoutProvenance data={state.data} requestedSessions={scoutRequestPayload(appliedFilters || filters).brokerSessions} />
            <div className="scout-results-tools"><label><span className="sr-only">Search returned stocks</span><input type="search" placeholder="Search ticker or company…" value={resultQuery} onChange={(event) => setResultQuery(event.target.value)} /></label><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="score">Highest score</option><option value="liquidity">Most liquid</option><option value="ticker">Ticker A–Z</option></select></label></div>
            {state.data.candidates.length === 0
              ? <EmptyState title="No stocks passed this screen" message="Review your active conditions or explore the near misses below to see which threshold kept a stock out." />
              : visibleRows.length === 0 ? <EmptyState title="No matching tickers" message="Try another ticker or company name within the returned results." />
                : <ScoutQualifiedTable rows={visibleRows} onInvestigate={onInvestigate} onActors={handoffActors} />}
            <details className="scout-session-changes"><summary>Changes since the previous session <span>{state.data.dailyDiff.new.length} new · {state.data.dailyDiff.dropped.length} dropped</span></summary><DailyDiff diff={state.data.dailyDiff} /></details>
            <ScoutNearMissSection rows={state.data.nearMisses} onInvestigate={onInvestigate} onActors={handoffActors} />
            <div className="scout-disclosures">{state.data.disclosures.map((item) => <p key={item}>{item}</p>)}</div>
          </>}
        </section>
      </div>
    </div>
  );
}


/**
 * One screener, not two.
 *
 * This page used to carry a second tab, "Market Shortlist", reading the nightly
 * batch scan off /api/opportunities. It ran a different methodology against a
 * different as-of date than the screener beside it, so the same ticker could
 * qualify in one tab and not the other with nothing on screen explaining why.
 * Removed 2026-08-25; the batch scan still runs and is still readable from the
 * private cockpit, it just no longer competes with the live screener here.
 */
export default function Radar() {
  const { openInvestigationTab, openBrokerFlowTab } = useAnalysisContext();

  return (
    <section className="radar-page screener-v2" aria-labelledby="radar-title">
      <header className="module-heading">
        <div><span className="scout-eyebrow">Market discovery</span><h2 id="radar-title">A sharper view of the market.</h2><p>Turn price action and broker activity into a focused research list.</p></div><span className="scout-page-note">IDX equities <span> / </span> Screener</span>
      </header>
      <Scout onInvestigate={openInvestigationTab} onActors={openBrokerFlowTab} />
    </section>
  );
}
