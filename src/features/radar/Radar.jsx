import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getOpportunities, getRadarScout, getRadarScoutConditions } from '../../lib/api/client.js';
import { guardOpportunities, guardRadarScout, guardRadarScoutConditions } from '../../lib/api/contracts.js';
import { formatDate, formatIDR, formatPct, formatPrice, formatRatio, formatRelativeDays } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

const ALL_LANES = 'all';
const RECIPES = [
  { id: 'quiet_accumulation', label: 'Quiet accumulation', description: 'Looks for moderate, persistent buying—not extreme broker dominance—near independently confirmed support.' },
  { id: 'dominant_broker', label: 'Dominant broker', description: 'Prioritizes stocks where one broker accumulated materially more than the second-largest positive buyer.' },
  { id: 'support_compression', label: 'Support compression', description: 'Looks for repeated one-month support while recent candles remain inside a controlled sideways range.' },
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
const SAVED_SCREENS_KEY = 'nalar-saved-screens-v1';

function readSavedScreens() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_SCREENS_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item?.id && item?.name && item?.filters) : [];
  } catch { return []; }
}

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

function ScanProvenance({ run, candidateCount }) {
  if (!run) return null;
  return (
    <div className="radar-run">
      <strong>{formatDate(run.dataAsOf)}</strong>
      <span className={`radar-run__age${run.dataAsOf ? '' : ' radar-run__age--missing'}`}>
        data {formatRelativeDays(run.dataAsOf)}
      </span>
      <span>{candidateCount} stocks</span>
    </div>
  );
}

// Dense table, not card-bands: rank, ticker+lane, score, why/against, levels, actions.
function ShortlistRow({ row, onInvestigate, onActors }) {
  const primaryReason = row.reasons[0];
  const primaryRisk = row.risks[0];
  return (
    <tr className="ui-row">
      <td className="tabular text-tertiary">{formatRank(row.rank)}</td>
      <td>
        <div className="radar-cell-ticker">
          <strong>{row.ticker}</strong>
          <span>
            {row.lane || 'lane unknown'}
            {row.isFca ? ' · FCA' : ''}
            {row.ineligible ? ' · gated' : ''}
          </span>
        </div>
      </td>
      <td className="tabular">
        <strong>{Number.isFinite(row.score) ? row.score.toFixed(1) : '—'}</strong>
        {row.dataQuality !== 'high' && <span className="is-degraded">{row.dataQuality} data quality</span>}
      </td>
      <td>
        <div className="radar-cell-why">
          <strong>{primaryReason || 'Qualified structure'}</strong>
          {primaryRisk ? <span className="radar-row__risk">Against: {primaryRisk}</span> : null}
        </div>
      </td>
      <td className="tabular">
        <div className="radar-cell-levels">
          <span>Breakout above <strong>{formatPrice(row.levels.trigger)}</strong></span>
          <span>Setup fails below <strong>{formatPrice(row.levels.invalidation)}</strong></span>
          <span>Reward / risk <strong>{formatRatio(row.levels.netRewardRisk)}</strong></span>
        </div>
      </td>
      <td>
        <div className="radar-row__actions">
          <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} analysis`} onClick={onInvestigate}>
            Open Analysis
          </button>
          <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} broker flow`} onClick={onActors}>
            Broker Flow
          </button>
        </div>
      </td>
    </tr>
  );
}

function ShortlistTable({ rows, onInvestigate, onActors }) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table ui-table--shortlist" aria-label="Shortlisted candidates">
        <thead>
          <tr>
            <th className="tabular">#</th>
            <th>Ticker</th>
            <th className="tabular">Score</th>
            <th>Why</th>
            <th className="tabular">Levels</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ShortlistRow
              key={row.ticker}
              row={row}
              onInvestigate={() => onInvestigate(row.ticker)}
              onActors={() => onActors(row.ticker)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
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

const QUALIFIED_COLUMNS = 10;

function QualifiedRow({ row, onInvestigate, onActors }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="ui-row">
        <td className="tabular text-tertiary">{formatRank(row.rank)}</td>
        <td>
          <div className="radar-cell-ticker">
            <strong>{row.ticker}</strong>
            <span>{row.name}{row.board ? ` · ${row.board}` : ''}{row.isFca ? ' · FCA' : ''}</span>
          </div>
        </td>
        <td className="tabular"><strong>{Number.isFinite(row.score) ? row.score.toFixed(1) : '—'}</strong></td>
        <td><EvidenceBandBadge band={row.evidenceBand} /></td>
        <td className="tabular">
          <div className="radar-cell-metric">
            <strong>{row.broker?.lead?.code || '—'}</strong>
            <span>{formatIDR(row.broker?.lead?.netValue, true)}</span>
          </div>
        </td>
        <td className="tabular">
          <div className="radar-cell-metric">
            <strong>{formatRatio(row.broker?.leadToSecondRatio)}</strong>
            <span>{row.broker?.second?.code ? `vs ${row.broker.second.code}` : 'no second buyer'}</span>
          </div>
        </td>
        <td className="tabular">
          <div className="radar-cell-metric">
            <strong>{formatPrice(row.price.support)}</strong>
            <span>{formatPct(row.price.distanceFromSupportPct)} · {row.price.supportTouches} touches</span>
          </div>
        </td>
        <td className="tabular">
          <div className="radar-cell-metric">
            <strong>{formatPct(row.price.consolidationRangePct, 1, false)}</strong>
            <span>{row.price.volatilityContracting ? 'contracting' : 'not contracting'}</span>
          </div>
        </td>
        <td className="tabular"><div className="radar-cell-metric"><strong>{row.relativeStrengthVsIhsgPct == null ? 'Unavailable' : formatPct(row.relativeStrengthVsIhsgPct)}</strong><span>vs IHSG</span></div></td>
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
          <td colSpan={QUALIFIED_COLUMNS}><ScoutDetail row={row} /></td>
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
            <th className="tabular">Score</th>
            <th>Signal</th>
            <th className="tabular">Lead broker</th>
            <th className="tabular">Lead gap</th>
            <th className="tabular">Support</th>
            <th className="tabular">Compression</th>
            <th className="tabular">RS vs IHSG</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <QualifiedRow
              key={row.ticker}
              row={row}
              onInvestigate={() => onInvestigate(row.ticker)}
              onActors={() => onActors(row.ticker)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NEAR_MISS_COLUMNS = 6;

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
        <td><span className="scout-near-miss__missed">Missed: {row.failedCondition || 'unspecified condition'}</span></td>
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
      <p className="scout-near-miss__intro">These stocks missed one enabled condition.</p>
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
  const [savedScreens, setSavedScreens] = useState(readSavedScreens);
  const [saveName, setSaveName] = useState('');
  const [catalog, setCatalog] = useState({ loading: true, error: null, conditions: [], templates: {} });
  const [conditionSearch, setConditionSearch] = useState('');
  const [state, setState] = useState({ loading: false, error: null, data: null });
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
  const recipe = RECIPES.find((item) => item.id === filters.recipe);
  const definitions = useMemo(() => new Map(catalog.conditions.map((item) => [item.id, item])), [catalog.conditions]);
  const availableConditions = catalog.conditions.filter((item) => !filters.conditions.some((active) => active.id === item.id)
    && (!conditionSearch.trim() || `${item.label} ${item.category}`.toLowerCase().includes(conditionSearch.trim().toLowerCase())));
  const persistPermalink = (nextFilters) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) if (value !== '' && value !== false) params.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
    setSearchParams(params, { replace: true });
  };
  const saveScreen = () => {
    const name = saveName.trim();
    if (!name) return;
    const next = [...savedScreens.filter((item) => item.name !== name), { id: `${Date.now()}`, name, filters }];
    localStorage.setItem(SAVED_SCREENS_KEY, JSON.stringify(next));
    setSavedScreens(next);
    setSaveName('');
  };
  const selectRecipe = (recipeId) => {
    setFilters((current) => ({ ...current, recipe: recipeId, conditions: (catalog.templates[recipeId] || []).map((item) => ({ ...item })) }));
  };
  const updateCondition = (id, value) => setFilters((current) => ({ ...current, conditions: current.conditions.map((item) => item.id === id ? { ...item, value } : item) }));
  const removeCondition = (id) => setFilters((current) => ({ ...current, conditions: current.conditions.filter((item) => item.id !== id) }));
  const addCondition = (definition) => setFilters((current) => ({ ...current, conditions: [...current.conditions, { id: definition.id, value: definition.defaultValue ?? definition.options[0] ?? true }] }));
  const run = (event) => {
    event?.preventDefault();
    const requestId = ++requestRef.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    persistPermalink(filters);
    getRadarScout(scoutRequestPayload(filters)).then((raw) => {
      if (requestId !== requestRef.current) return;
      const result = guardRadarScout(raw);
      setState({ loading: false, error: result.ok ? null : result.error, data: result.data });
      if (result.ok && !filters.asOf && result.data.asOf.priceDate) {
        const pinned = { ...filters, asOf: result.data.asOf.priceDate };
        persistPermalink(pinned);
      }
    }).catch((error) => {
      if (requestId !== requestRef.current) return;
      setState({ loading: false, error: error.message || 'Screener request failed', data: null });
    });
  };
  const handoffActors = (ticker) => onActors(ticker, scoutBrokerHandoffRange(filters));
  return (
    <div className="scout-view">
      <div className="scout-layout">
        <form className="scout-controls scout-layout__conditions" onSubmit={run}>
          <div className="scout-toolbar">
            <div><span className="scout-eyebrow">Deterministic screener</span><h2>Build a trade shortlist</h2></div>
            <label className="scout-template">Start from template<select aria-label="Start from template" value={filters.recipe} onChange={(event) => selectRecipe(event.target.value)}><option value="">Custom conditions</option>{RECIPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          <section className="scout-builder" aria-label="Active screening conditions">
            <header><div><h3>Active conditions</h3><span>{filters.conditions.length} enabled · all must pass</span></div></header>
            {catalog.loading && <Skeleton label="Loading condition catalog…" />}
            {catalog.error && <p className="is-degraded">{catalog.error}</p>}
            {!catalog.loading && filters.conditions.length === 0 && <p className="scout-builder__empty">Choose a template or add conditions to define the shortlist.</p>}
            <div className="scout-condition-list">
              {filters.conditions.map((condition) => {
                const definition = definitions.get(condition.id);
                if (!definition) return null;
                return <div className="scout-condition-row" key={condition.id}><div><span>{definition.category}</span><strong>{definition.label}</strong></div><label><span className="sr-only">{definition.label}</span>{definition.type === 'boolean' ? <select value={String(condition.value)} onChange={(event) => updateCondition(condition.id, event.target.value === 'true')}><option value="true">Required</option><option value="false">Must be false</option></select> : definition.type === 'select' ? <select value={condition.value} onChange={(event) => updateCondition(condition.id, event.target.value)}>{definition.options.map((option) => <option key={option}>{option}</option>)}</select> : <span className="scout-condition-row__value"><input aria-label={definition.label} type="number" min={definition.min} max={definition.max} step={definition.step || 1} value={condition.value} onChange={(event) => updateCondition(condition.id, Number(event.target.value))} />{definition.unit && <small>{definition.unit}</small>}</span>}</label><button type="button" className="ui-btn ui-btn--ghost" aria-label={`Remove ${definition.label}`} onClick={() => removeCondition(condition.id)}>Remove</button></div>;
              })}
            </div>
            <details className="scout-add-condition">
              <summary>+ Add condition</summary>
              <div className="scout-add-condition__panel"><input aria-label="Search conditions" value={conditionSearch} onChange={(event) => setConditionSearch(event.target.value)} placeholder="Search price, broker, foreign…" /><div>{availableConditions.map((definition) => <button type="button" key={definition.id} onClick={() => addCondition(definition)}><span>{definition.category}</span><strong>{definition.label}</strong></button>)}</div></div>
            </details>
          </section>
          <details className="scout-advanced">
            <summary><span><strong>Window, date and saved screens</strong><small>Change evidence periods only when the strategy requires it</small></span><span aria-hidden="true">+</span></summary>
            <div className="scout-execution-settings">
              <label>Broker window<select value={filters.brokerPreset} onChange={(event) => setFilters((current) => ({ ...current, brokerPreset: event.target.value }))}>{BROKER_RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {filters.brokerPreset === 'custom' && <><label>From<input type="date" value={filters.brokerFrom} onChange={(event) => setFilters((current) => ({ ...current, brokerFrom: event.target.value }))} /></label><label>To<input type="date" value={filters.brokerTo} onChange={(event) => setFilters((current) => ({ ...current, brokerTo: event.target.value }))} /></label></>}
              <label>Support window<input type="number" min="5" max="120" value={filters.supportSessions} onChange={update('supportSessions')} /></label>
              <label>Range window<input type="number" min="5" max="60" value={filters.consolidationSessions} onChange={update('consolidationSessions')} /></label>
              <label>As-of date<input type="date" value={filters.asOf} onChange={(event) => setFilters((current) => ({ ...current, asOf: event.target.value }))} /></label>
            </div>
            <div className="scout-saved"><label>Saved screen<select aria-label="Saved screens" defaultValue="" onChange={(event) => { const saved = savedScreens.find((item) => item.id === event.target.value); if (saved) setFilters({ ...DEFAULT_SCOUT_FILTERS, ...saved.filters }); }}><option value="">Load saved</option>{savedScreens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Save as<input aria-label="Save current screen as" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="Morning breakout" /></label><button type="button" className="ui-btn ui-btn--ghost" onClick={saveScreen} disabled={!saveName.trim()}>Save</button></div>
          </details>
          <div className="scout-controls__footer">
            <div className="scout-run-context"><div><strong>{recipe?.label || 'Custom screen'}</strong><small>No AI · end-of-day data · every active condition must pass</small></div></div>
            <div className="scout-controls__actions">
              <label>Return<select value={filters.limit} onChange={update('limit')}><option value="10">10 stocks</option><option value="25">25 stocks</option><option value="50">50 stocks</option><option value="100">100 stocks</option></select></label>
              <button type="submit" className="ui-btn ui-btn--primary" disabled={state.loading || catalog.loading || filters.conditions.length === 0}>{state.loading ? 'Screening…' : 'Run Screener'}</button>
            </div>
          </div>
        </form>

        <div className="scout-results">
          {state.error && <ErrorState title="Custom Screener unavailable" error={state.error} onRetry={run} />}
          {!state.data && state.loading && <Skeleton label="Screening…" />}
          {!state.data && !state.loading && !state.error && <EmptyState title={recipe ? `${recipe.label} is ready` : 'Custom Screener is ready'} message="Choose a template or add conditions, then press Run Screener to find matching stocks." />}
          {state.data && <>
            <div className="radar-run"><strong>{state.data.recipe.label}</strong><span>Prices through {formatDate(state.data.asOf.priceDate)}</span><span>Broker flow {formatDate(state.data.asOf.brokerFrom)}–{formatDate(state.data.asOf.brokerTo)} · requested {state.data.asOf.requestedBrokerSessions ?? filters.brokerSessions}, observed {state.data.asOf.brokerSessions} trading days</span><span>{state.data.coverage.matched} matched</span><span>Showing {state.data.coverage.returned}</span></div>
            <DailyDiff diff={state.data.dailyDiff} />
            {state.data.candidates.length === 0
              ? <EmptyState title="No stocks passed this screen" message="That is a valid screen result. Widen a boundary only if it still matches your intended trade universe." />
              : <ScoutQualifiedTable rows={state.data.candidates} onInvestigate={onInvestigate} onActors={handoffActors} />}
            <ScoutNearMissSection rows={state.data.nearMisses} onInvestigate={onInvestigate} onActors={handoffActors} />
            <div className="scout-disclosures">{state.data.disclosures.map((item) => <p key={item}>{item}</p>)}</div>
          </>}
        </div>
      </div>
    </div>
  );
}

export default function Radar() {
  const { openInvestigationTab, openBrokerFlowTab } = useAnalysisContext();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [lane, setLane] = useState(ALL_LANES);
  const [view, setView] = useState('scout');

  const load = useCallback(() => {
    let cancelled = false;
    setState({ loading: true, error: null, data: null });
    getOpportunities()
      .then((raw) => {
        if (cancelled) return;
        const result = guardOpportunities(raw);
        setState({ loading: false, error: result.ok ? null : result.error, data: result.data });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, error: error.message || 'Scan request failed', data: null });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(load, [load]);

  const candidates = state.data?.candidates || [];
  const lanes = state.data?.lanes || [];
  // Filtering only hides rows the backend already ranked. Nothing is re-scored,
  // re-ranked or re-ordered here.
  const visible = useMemo(
    () => (lane === ALL_LANES ? candidates : candidates.filter((row) => row.lane === lane)),
    [candidates, lane],
  );

  return (
    <section className="radar-page" aria-labelledby="radar-title">
      <header className="module-heading">
        <div><h2 id="radar-title">Screener</h2></div>
      </header>

      <div className="radar-view-tabs" role="tablist" aria-label="Screener views">
        <button type="button" role="tab" aria-selected={view === 'scout'} className={view === 'scout' ? 'is-active' : ''} onClick={() => setView('scout')}>Custom Screener</button>
        <button type="button" role="tab" aria-selected={view === 'scan'} className={view === 'scan' ? 'is-active' : ''} onClick={() => setView('scan')}>Market Shortlist</button>
      </div>

      {view === 'scout' && <Scout onInvestigate={openInvestigationTab} onActors={openBrokerFlowTab} />}

      {view === 'scan' && <>

      {state.loading && <Skeleton label="Loading the latest qualified scan…" />}

      {state.error && !state.loading && (
        <ErrorState title="Scan unavailable" error={state.error} onRetry={load} />
      )}

      {!state.loading && !state.error && state.data && (
        <>
          <ScanProvenance
            run={state.data.run}
            candidateCount={visible.length}
          />

          <details className="radar-criteria">
            <summary>How stocks qualify</summary>
            <p>Stocks need sufficient price history and liquidity, must hold near support inside a compressed range, and need either broker-flow or volume confirmation. The shortlist also requires acceptable reward / risk after costs. Results are ranked by support, compression, broker flow, risk, volume, and market context.</p>
          </details>

          {lanes.length > 1 && (
            <div className="radar-lanes" role="group" aria-label="Filter candidates by lane">
              {[ALL_LANES, ...lanes].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={lane === value ? 'is-active' : ''}
                  aria-pressed={lane === value}
                  onClick={() => setLane(value)}
                >
                  {value === ALL_LANES ? `all (${candidates.length})` : value}
                </button>
              ))}
            </div>
          )}

          {!state.data.run && candidates.length === 0 && (
            <EmptyState
              title="No scan has been recorded"
              message="The Market Shortlist has not been generated yet."
            />
          )}

          {state.data.run && candidates.length === 0 && (
            <EmptyState
              title="Scan completed with no candidates"
              message={`Scan #${state.data.run.id ?? '—'} evaluated ${state.data.run.totalSeen ?? 'the universe'} and shortlisted nothing. An empty shortlist is a result, not a failure.`}
            />
          )}

          {candidates.length > 0 && visible.length === 0 && (
            <EmptyState
              title="No candidates in this lane"
              message="The current scan shortlisted nothing in the selected lane."
              action={(
                <button type="button" onClick={() => setLane(ALL_LANES)}>
                  Show all lanes
                </button>
              )}
            />
          )}

          {visible.length > 0 && (
            <ShortlistTable
              rows={visible}
              onInvestigate={openInvestigationTab}
              onActors={openBrokerFlowTab}
            />
          )}
        </>
      )}
      </>}
    </section>
  );
}
