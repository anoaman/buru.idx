import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getRadarScout, getRadarScoutConditions } from '../../lib/api/client.js';
import ScreenerFilters, { DEFAULT_SLOTS, blockingReason, requestFromSlots, rupiah } from './ScreenerFilters.jsx';
import { guardRadarScout, guardRadarScoutConditions } from '../../lib/api/contracts.js';
import { formatDate, formatIDR, formatPct, formatPrice, formatRatio } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';
import './Screener.css';

function scoutBrokerHandoffRange(slots) {
  if (slots.brokerPreset === 'custom' && slots.brokerFrom) {
    return { preset: 'custom', from: slots.brokerFrom, to: slots.asOf || slots.brokerFrom };
  }
  return slots.brokerPreset ? { preset: slots.brokerPreset } : null;
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

// Shared by qualified and near-miss Scout rows: reasons, risks, broker context and
// scoreBreakdown are always preserved here (behind a disclosure), even when a row's
// primary columns differ between the two tables.
function ScoutDetail({ row }) {
  const breakdown = Object.entries(row.scoreBreakdown || {});
  const brokerFocus = row.broker?.focus || row.broker?.lead || null;
  const brokerSharePct = row.broker?.focusSharePct ?? row.broker?.leadSharePct;
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
          <h4>{brokerFocus?.code ? `${brokerFocus.code} broker activity` : 'Broker activity'}</h4>
          <p>
            {formatPct(brokerSharePct, 0, false)} of buying value
            {brokerFocus ? ` · ${brokerFocus.buySessions}/${row.broker.expectedSessions} buying days` : ''}
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
    </div>
  );
}

const QUALIFIED_COLUMNS = 4;

function QualifiedRow({ row, ranking, onInvestigate, onActors }) {
  const [expanded, setExpanded] = useState(false);
  const brokerFocus = row.broker?.focus || row.broker?.lead || null;
  const focusIsLead = brokerFocus?.code === row.broker?.lead?.code;
  const persistence = row.broker?.expectedSessions
    ? (brokerFocus?.buySessions || 0) / row.broker.expectedSessions * 100
    : null;
  return (
    <>
      <tr className="ui-row">
        <td>
          <div className="radar-cell-ticker">
            <strong>{row.ticker}</strong>
            <span>{row.name}{row.board ? ` · ${row.board}` : ''}{row.isFca ? ' · FCA' : ''}</span>
            <EvidenceBandBadge band={row.evidenceBand} />
          </div>
        </td>
        <td className="tabular"><div className="radar-cell-metric"><strong>{formatPrice(row.price.lastPrice)}</strong><span>{formatIDR(row.price.averageValue, true)} / day</span></div></td>
        <td className="tabular">
          {ranking === 'structure' ? <div className="radar-cell-metric">
            <strong>{formatPrice(row.price.support)}</strong>
            <span>{formatPct(row.price.distanceFromSupportPct)} · {row.price.supportTouches} touches</span>
            <span>{formatPct(row.price.consolidationRangePct, 1, false)} range{row.price.volatilityContracting ? ' · contracting' : ''}</span>
          </div> : <div className="radar-cell-metric">
            <strong>{brokerFocus?.code || '—'} · {formatIDR(brokerFocus?.netValue, true)}</strong>
            <span>{formatPct(row.broker?.focusSharePct ?? row.broker?.leadSharePct, 0, false)} share{focusIsLead ? ` · ${formatRatio(row.broker?.leadToSecondRatio)} vs second` : ''}</span>
            <span>{formatPct(persistence, 0, false)} persistence</span>
            {ranking === 'blended' && <span>{formatPct(row.price.distanceFromSupportPct)} from support · {formatPct(row.price.consolidationRangePct, 1, false)} range</span>}
          </div>}
        </td>
        <td>
          <div className="radar-row__actions">
            <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} analysis`} onClick={onInvestigate}>Analyze ↗</button>
            <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} broker flow`} onClick={onActors}>Flow ↗</button>
            <button
              type="button"
              className="ui-btn ui-btn--ghost radar-row__toggle"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} ${row.ticker} evidence`}
              onClick={() => setExpanded((value) => !value)}
            >
              <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
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

function ScoutQualifiedTable({ rows, ranking, onInvestigate, onActors }) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table ui-table--scout" aria-label="Scout candidates">
        <thead>
          <tr>
            <th>Ticker</th>
            <th className="tabular">Price / liquidity</th>
            <th className="tabular">{ranking === 'structure' ? 'Support / range' : 'Broker evidence'}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <QualifiedRow
              key={row.ticker}
              row={row}
              ranking={ranking}
              onInvestigate={() => onInvestigate(row.ticker)}
              onActors={() => onActors(row.ticker)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RANKING_LABEL = { broker: 'broker strength', structure: 'setup quality', blended: 'broker + setup' };

function ScoutProvenance({ data }) {
  return (
    <p className="radar-run">
      <span>{data.coverage.matched} matched</span>
      <span>Showing {data.coverage.returned}</span>
      <span>{data.coverage.evaluated} scanned</span>
      <span>Ranked by {RANKING_LABEL[data.ranking]}</span>
      <span>Prices to {formatDate(data.asOf.priceDate)}</span>
      {data.asOf.brokerFrom && (
        <span>Broker {formatDate(data.asOf.brokerFrom)}–{formatDate(data.asOf.brokerTo)} · {data.asOf.brokerSessions} trading days</span>
      )}
    </p>
  );
}

const NEAR_MISS_COLUMNS = 6;

// Condition thresholds are read in the same units the filter was typed in, so a
// gap has to be rendered the same way the input was. Rupiah compacts, everything
// else keeps its suffix.
function formatConditionValue(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'IDR') return `Rp${rupiah(value)}`;
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
            <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} analysis`} onClick={onInvestigate}>Analyze ↗</button>
            <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${row.ticker} broker flow`} onClick={onActors}>Flow ↗</button>
            <button
              type="button"
              className="ui-btn ui-btn--ghost radar-row__toggle"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} ${row.ticker} evidence`}
              onClick={() => setExpanded((value) => !value)}
            >
              <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
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
      <p className="scout-near-miss__intro">Missed exactly one condition. A small gap is worth a look; a big one is a real no.</p>
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

const SLOT_KEYS = Object.keys(DEFAULT_SLOTS);

function slotsFromParams(params) {
  const slots = { ...DEFAULT_SLOTS };
  for (const key of SLOT_KEYS) {
    const raw = params.get(key);
    if (raw == null) continue;
    const fallback = DEFAULT_SLOTS[key];
    if (typeof fallback === 'boolean') slots[key] = raw === 'true';
    else if (typeof fallback === 'number') slots[key] = Number(raw) || 0;
    else if (key === 'minPrice' || key === 'maxPrice') slots[key] = raw === '' ? '' : Number(raw) || '';
    else slots[key] = raw;
  }
  return slots;
}

function Scout({ onInvestigate, onActors }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [slots, setSlots] = useState(() => slotsFromParams(searchParams));
  const [templates, setTemplates] = useState({ ready: false, byId: {} });
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const [sort, setSort] = useState('score');
  const requestRef = useRef(0);
  useEffect(() => () => { requestRef.current += 1; }, []);
  useEffect(() => {
    let active = true;
    getRadarScoutConditions().then((raw) => {
      if (!active) return;
      const result = guardRadarScoutConditions(raw);
      if (result.ok) setTemplates({ ready: true, byId: result.data.templates || {} });
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const blocked = blockingReason(slots);
  const requestKey = JSON.stringify(requestFromSlots(slots));
  const run = () => {
    if (blocked) return;
    const requestId = ++requestRef.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    getRadarScout(JSON.parse(requestKey)).then((raw) => {
      if (requestId !== requestRef.current) return;
      const result = guardRadarScout(raw);
      setState({ loading: false, error: result.ok ? null : result.error, data: result.data });
    }).catch((error) => {
      if (requestId !== requestRef.current) return;
      setState({ loading: false, error: error.message || 'Screener request failed', data: null });
    });
  };
  // Results follow the filters. Each committed edit re-runs after a short pause
  // and a newer request always supersedes an older one still in flight.
  useEffect(() => {
    const params = new URLSearchParams();
    for (const key of SLOT_KEYS) if (slots[key] !== DEFAULT_SLOTS[key]) params.set(key, String(slots[key]));
    setSearchParams(params, { replace: true });
    if (blocked) {
      requestRef.current += 1;
      setState((current) => ({ ...current, loading: false }));
      return undefined;
    }
    const timer = setTimeout(run, 350);
    return () => clearTimeout(timer);
  }, [requestKey, blocked]);
  const handoffActors = (ticker) => onActors(ticker, scoutBrokerHandoffRange(slots));
  const visibleRows = useMemo(() => {
    const rows = state.data?.candidates || [];
    return [...rows].sort((a, b) => sort === 'ticker' ? a.ticker.localeCompare(b.ticker)
      : sort === 'liquidity' ? (b.price.averageValue ?? -Infinity) - (a.price.averageValue ?? -Infinity)
        : (b.score ?? -Infinity) - (a.score ?? -Infinity));
  }, [state.data, sort]);
  return (
    <div className="scout-view">
      <ScreenerFilters slots={slots} onChange={setSlots} templates={templates.byId} templatesReady={templates.ready} />
      <section className="scout-results" aria-label="Screening results" aria-busy={state.loading}>
        {blocked && <p className="scout-result-status" role="status">{blocked}</p>}
        {!blocked && state.error && <ErrorState title="Screener unavailable" error={state.error} onRetry={run} />}
        {!blocked && !state.data && state.loading && <Skeleton label="Screening the market…" />}
        {!blocked && state.data && <>
          <div className="scout-results-tools">
            <ScoutProvenance data={state.data} />
            {state.loading && <span className="scout-updating" role="status">Updating…</span>}
            <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="score">Highest score</option><option value="liquidity">Most liquid</option><option value="ticker">Ticker A–Z</option></select></label>
          </div>
          {state.data.candidates.length === 0
            ? <EmptyState title="No stocks pass these filters" message="Loosen a filter, or check the near misses below to see which one kept a stock out." />
            : <ScoutQualifiedTable rows={visibleRows} ranking={state.data.ranking} onInvestigate={onInvestigate} onActors={handoffActors} />}
          <ScoutNearMissSection rows={state.data.nearMisses} onInvestigate={onInvestigate} onActors={handoffActors} />
          <div className="scout-disclosures">{state.data.disclosures.map((item) => <p key={item}>{item}</p>)}</div>
        </>}
      </section>
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
        <h2 id="radar-title">Screener</h2>
      </header>
      <Scout onInvestigate={openInvestigationTab} onActors={openBrokerFlowTab} />
    </section>
  );
}
