import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getOpportunities, getRadarScout } from '../../lib/api/client.js';
import { guardOpportunities, guardRadarScout } from '../../lib/api/contracts.js';
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
  { id: 'range_resolution', label: 'Range resolution + participation', description: 'Requires a backend-confirmed base breakout with value, transaction-frequency, broker-breadth and close-location participation.' },
  { id: 'foreign_flow_divergence', label: 'Foreign flow divergence', description: 'Finds persistent foreign accumulation while price has not yet travelled materially.' },
  { id: 'capitulation_reversal', label: 'Capitulation reversal', description: 'A strict V-reversal recipe requiring capitulation, retracement, improving trend and seller-behaviour confirmation.' },
];
const DEFAULT_SCOUT_FILTERS = Object.freeze({
  recipe: '', asOf: '', brokerSessions: 7, brokerPreset: '7d', brokerFrom: '', brokerTo: '', consolidationSessions: 10,
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
const RECIPE_CONDITIONS = Object.freeze({
  quiet_accumulation: { useBroker: true, useSupport: true, useSideways: true },
  dominant_broker: { useBroker: true, useSupport: false, useSideways: false },
  support_compression: { useBroker: false, useSupport: true, useSideways: true },
  range_resolution: { useBroker: true, useSupport: false, useSideways: true, useLiquidity: true },
  foreign_flow_divergence: { useBroker: false, useSupport: false, useSideways: false, useLiquidity: true },
  capitulation_reversal: { useBroker: true, useSupport: false, useSideways: false, useLiquidity: true },
});
const EVIDENCE_BAND_LABEL = { high: 'High signal', medium: 'Medium signal', low: 'Low signal' };
const EVIDENCE_BAND_TONE = { high: 'badge-positive', medium: 'badge-info', low: 'badge-neutral' };

function numericText(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '';
}

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

function Scout({ onInvestigate, onActors }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => {
    const next = { ...DEFAULT_SCOUT_FILTERS };
    for (const key of Object.keys(next)) {
      const raw = searchParams.get(key);
      if (raw == null) continue;
      if (typeof next[key] === 'boolean') next[key] = raw === 'true';
      else if (typeof next[key] === 'number') next[key] = Number(raw);
      else next[key] = raw;
    }
    return next;
  });
  const [savedScreens, setSavedScreens] = useState(readSavedScreens);
  const [saveName, setSaveName] = useState('');
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const requestRef = useRef(0);
  useEffect(() => () => { requestRef.current += 1; }, []);
  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox'
      ? event.target.checked
      : event.target.type === 'text'
        ? Number(event.target.value.replace(/[^0-9]/g, ''))
        : Number(event.target.value);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const recipe = RECIPES.find((item) => item.id === filters.recipe);
  const persistPermalink = (nextFilters) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) if (value !== '' && value !== false) params.set(key, String(value));
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
  const selectRecipe = (event) => {
    const recipeId = event.target.value;
    setFilters((current) => ({ ...current, recipe: recipeId, ...RECIPE_CONDITIONS[recipeId] }));
  };
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
          <div className="scout-controls__intro">
            <label className="scout-controls__recipe">Screening recipe<select value={filters.recipe} onChange={selectRecipe}><option value="" disabled>Select a recipe</option>{RECIPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            {recipe && <div className="scout-recipe-explanation"><strong>{recipe.label}</strong><p>{recipe.description}</p><span>Every enabled condition must pass.</span></div>}
            <div className="scout-saved">
              <label>Saved screens<select defaultValue="" onChange={(event) => { const saved = savedScreens.find((item) => item.id === event.target.value); if (saved) setFilters({ ...DEFAULT_SCOUT_FILTERS, ...saved.filters }); }}><option value="">Load a screen</option>{savedScreens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Save current<input value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="Morning breakout" /></label>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={saveScreen} disabled={!saveName.trim()}>Save</button>
            </div>
          </div>
          <fieldset className="scout-conditions">
            <legend>Conditions</legend>
            <div className={!filters.useBroker ? 'scout-condition is-disabled' : 'scout-condition'}>
              <label className="scout-toggle"><input type="checkbox" checked={filters.useBroker} onChange={update('useBroker')} /><span><strong>Broker concentration</strong><small>One buyer leads the positive flow.</small></span></label>
              <label className="scout-condition__value">Date range<select disabled={!filters.useBroker} value={filters.brokerPreset} onChange={(event) => setFilters((current) => ({ ...current, brokerPreset: event.target.value }))}>{BROKER_RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {filters.brokerPreset === 'custom' && <div className="scout-condition__dates"><label>From<input type="date" disabled={!filters.useBroker} value={filters.brokerFrom} onChange={(event) => setFilters((current) => ({ ...current, brokerFrom: event.target.value }))} /></label><label>To<input type="date" disabled={!filters.useBroker} value={filters.brokerTo} onChange={(event) => setFilters((current) => ({ ...current, brokerTo: event.target.value }))} /></label></div>}
            </div>
            <div className={!filters.useSupport ? 'scout-condition is-disabled' : 'scout-condition'}>
              <label className="scout-toggle"><input type="checkbox" checked={filters.useSupport} onChange={update('useSupport')} /><span><strong>Repeated support</strong><small>Price remains near a tested support zone.</small></span></label>
              <label className="scout-condition__value">Trading days<input type="number" min="5" max="120" disabled={!filters.useSupport} value={filters.supportSessions} onChange={update('supportSessions')} /></label>
            </div>
            <div className={!filters.useSideways ? 'scout-condition is-disabled' : 'scout-condition'}>
              <label className="scout-toggle"><input type="checkbox" checked={filters.useSideways} onChange={update('useSideways')} /><span><strong>Sideways compression</strong><small>Recent candles stay inside a narrow range.</small></span></label>
              <label className="scout-condition__value">Trading days<input type="number" min="5" max="60" disabled={!filters.useSideways} value={filters.consolidationSessions} onChange={update('consolidationSessions')} /></label>
            </div>
            <div className={!filters.useMaxPrice ? 'scout-condition is-disabled' : 'scout-condition'}>
              <label className="scout-toggle"><input type="checkbox" checked={filters.useMaxPrice} onChange={update('useMaxPrice')} /><span><strong>Maximum price</strong><small>Keep the universe inside your price band.</small></span></label>
              <label className="scout-condition__value">Rp<input type="text" inputMode="numeric" disabled={!filters.useMaxPrice} value={numericText(filters.maxPrice)} onChange={update('maxPrice')} /></label>
            </div>
            <div className={!filters.useLiquidity ? 'scout-condition is-disabled' : 'scout-condition'}>
              <label className="scout-toggle"><input type="checkbox" checked={filters.useLiquidity} onChange={update('useLiquidity')} /><span><strong>Liquidity floor</strong><small>Minimum average traded value per trading day.</small></span></label>
              <label className="scout-condition__value">Rp average<input type="text" inputMode="numeric" disabled={!filters.useLiquidity} value={numericText(filters.minAverageValue)} onChange={update('minAverageValue')} /></label>
            </div>
            <div className={!filters.useLeadBrokerValue ? 'scout-condition is-disabled' : 'scout-condition'}>
              <label className="scout-toggle"><input type="checkbox" checked={filters.useLeadBrokerValue} onChange={update('useLeadBrokerValue')} /><span><strong>Lead broker minimum</strong><small>Minimum net accumulation by the top buyer.</small></span></label>
              <label className="scout-condition__value">Rp net buy<input type="text" inputMode="numeric" disabled={!filters.useLeadBrokerValue} value={numericText(filters.minLeadBrokerValue)} onChange={update('minLeadBrokerValue')} /></label>
            </div>
            <div className={!filters.useRsVsIhsg ? 'scout-condition is-disabled' : 'scout-condition'}>
              <label className="scout-toggle"><input type="checkbox" checked={filters.useRsVsIhsg} onChange={update('useRsVsIhsg')} /><span><strong>RS vs IHSG</strong><small>Minimum backend-calculated relative performance.</small></span></label>
              <label className="scout-condition__value">Minimum %<input type="number" step="0.1" disabled={!filters.useRsVsIhsg} value={filters.minRsVsIhsgPct} onChange={update('minRsVsIhsgPct')} /></label>
            </div>
            <div className="scout-condition">
              <label className="scout-toggle"><input type="checkbox" checked={filters.excludeFca} onChange={update('excludeFca')} /><span><strong>Exclude FCA</strong><small>Hide tickers identified by the backend as FCA.</small></span></label>
            </div>
            <div className="scout-condition">
              <label className="scout-condition__value">As-of date<input type="date" value={filters.asOf} onChange={(event) => setFilters((current) => ({ ...current, asOf: event.target.value }))} /></label>
              <small className="text-tertiary">Leave blank for the latest completed session. Permalinks preserve this date.</small>
            </div>
          </fieldset>
          <div className="scout-controls__footer">
            <span>No AI · end-of-day data · deterministic ranking</span>
            <div className="scout-controls__actions">
              <label>Return<select value={filters.limit} onChange={update('limit')}><option value="10">10 stocks</option><option value="25">25 stocks</option><option value="50">50 stocks</option><option value="100">100 stocks</option></select></label>
              <button type="submit" className="ui-btn ui-btn--primary" disabled={state.loading}>{state.loading ? 'Screening…' : 'Run Screener'}</button>
            </div>
          </div>
        </form>

        <div className="scout-results">
          {state.error && <ErrorState title="Custom Screener unavailable" error={state.error} onRetry={run} />}
          {!state.data && state.loading && <Skeleton label="Screening…" />}
          {!state.data && !state.loading && !state.error && <EmptyState title={recipe ? `${recipe.label} is ready` : 'Custom Screener is ready'} message="Choose a recipe or enable conditions, then press Run Screener to find matching stocks." />}
          {state.data && <>
            <div className="radar-run"><strong>{state.data.recipe.label}</strong><span>Prices through {formatDate(state.data.asOf.priceDate)}</span><span>Broker flow {formatDate(state.data.asOf.brokerFrom)}–{formatDate(state.data.asOf.brokerTo)} · requested {state.data.asOf.requestedBrokerSessions ?? filters.brokerSessions}, observed {state.data.asOf.brokerSessions} trading days</span><span>{state.data.coverage.matched} matched</span><span>Showing {state.data.coverage.returned}</span></div>
            {(state.data.dailyDiff.new.length > 0 || state.data.dailyDiff.still.length > 0 || state.data.dailyDiff.dropped.length > 0) && <section className="scout-diff" aria-label="Daily qualification changes"><h3>Since previous session</h3><div><strong>New</strong> {state.data.dailyDiff.new.map((row) => row.ticker).join(', ') || 'None'}</div><div><strong>Still</strong> {state.data.dailyDiff.still.map((row) => `${row.ticker}${row.qualificationStreak ? ` (${row.qualificationStreak})` : ''}`).join(', ') || 'None'}</div><div><strong>Dropped</strong> {state.data.dailyDiff.dropped.map((row) => `${row.ticker}${row.failedCondition ? ` — ${row.failedCondition}` : ''}`).join(', ') || 'None'}</div></section>}
            {state.data.candidates.length === 0
              ? <EmptyState title="No stocks passed this recipe" message="That is a valid screen result. Widen the price or liquidity boundary only if it matches your intended trade universe." />
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
