import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOpportunities, getRadarScout } from '../../lib/api/client.js';
import { guardOpportunities, guardRadarScout } from '../../lib/api/contracts.js';
import { formatDate, formatIDR, formatPct, formatPrice, formatRatio, formatRelativeDays } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

const ALL_LANES = 'all';
const RECIPES = [
  { id: 'quiet_accumulation', label: 'Quiet accumulation', description: 'Looks for moderate, persistent buying—not extreme broker dominance—near independently confirmed support.' },
  { id: 'dominant_broker', label: 'Dominant broker', description: 'Prioritizes stocks where one broker accumulated materially more than the second-largest positive buyer.' },
  { id: 'support_compression', label: 'Support compression', description: 'Looks for repeated one-month support while recent candles remain inside a controlled sideways range.' },
];
const DEFAULT_SCOUT_FILTERS = Object.freeze({
  recipe: 'quiet_accumulation', brokerSessions: 7, brokerPreset: '7d', brokerFrom: '', brokerTo: '', consolidationSessions: 10,
  supportSessions: 20, maxPrice: 1000, minAverageValue: 500_000_000, limit: 10,
  minLeadBrokerValue: 1_000_000_000, useLeadBrokerValue: false,
  useBroker: true, useSupport: true, useSideways: true, useMaxPrice: true, useLiquidity: true,
});
const BROKER_RANGES = [['latest', 'Latest'], ['previous', 'Previous'], ['7d', '7D'], ['14d', '14D'], ['1m', '1M'], ['custom', 'Custom (up to 60 days)']];
const RECIPE_CONDITIONS = Object.freeze({
  quiet_accumulation: { useBroker: true, useSupport: true, useSideways: true },
  dominant_broker: { useBroker: true, useSupport: false, useSideways: false },
  support_compression: { useBroker: false, useSupport: true, useSideways: true },
});

function numericText(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '';
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

function CandidateRow({ row, onInvestigate, onActors }) {
  const primaryReason = row.reasons[0];
  const primaryRisk = row.risks[0];
  return (
    <article className="radar-row" role="listitem">
      <div className="radar-row__rank">
        {Number.isFinite(row.rank) ? String(row.rank).padStart(2, '0') : '—'}
      </div>
      <div className="radar-row__identity">
        <strong>{row.ticker}</strong>
        <span>
          {row.lane || 'lane unknown'}
          {row.isFca ? ' · FCA' : ''}
          {row.ineligible ? ' · gated' : ''}
        </span>
      </div>
      <div className="radar-row__score">
        <strong>{Number.isFinite(row.score) ? row.score.toFixed(1) : '—'}</strong>
        {row.dataQuality !== 'high' && <span className="is-degraded">{row.dataQuality} data quality</span>}
      </div>
      <div className="radar-row__why">
        <strong>{primaryReason || 'Qualified structure'}</strong>
        <span className={primaryRisk ? 'radar-row__risk' : ''}>
          {primaryRisk ? `Against: ${primaryRisk}` : 'No recorded counter-evidence'}
        </span>
      </div>
      <div className="radar-row__levels">
        <span>Breakout above <strong>{formatPrice(row.levels.trigger)}</strong></span>
        <span>Setup fails below <strong>{formatPrice(row.levels.invalidation)}</strong></span>
        <span>Reward / risk <strong>{formatRatio(row.levels.netRewardRisk)}</strong></span>
      </div>
      <div className="radar-row__actions">
        <button type="button" aria-label={`Open ${row.ticker} analysis`} onClick={onInvestigate}>
          Open Analysis
        </button>
        <button type="button" aria-label={`Open ${row.ticker} broker flow`} onClick={onActors}>
          Broker Flow
        </button>
      </div>
    </article>
  );
}

function ScoutCandidate({ row, onInvestigate, onActors }) {
  const breakdown = Object.entries(row.scoreBreakdown || {});
  return (
    <article className="scout-card" role="listitem">
      <div className="scout-card__identity">
        <span className="scout-card__rank">{String(row.rank ?? '—').padStart(2, '0')}</span>
        <div><strong>{row.ticker}</strong><span>{row.name} · {row.board || 'board unavailable'}</span></div>
        <b>{Number.isFinite(row.score) ? row.score.toFixed(1) : '—'} <small>{row.evidenceBand} signal strength</small></b>
      </div>
      {breakdown.length > 0 && <div className="scout-card__breakdown" aria-label="Score breakdown">{breakdown.map(([key, value]) => <span key={key}>{key.replace(/([A-Z])/g, ' $1')} <strong>{Number.isFinite(value) ? value.toFixed(0) : '—'}</strong></span>)}</div>}
      <div className="scout-card__metrics">
        <div><span>Lead broker</span><strong>{row.broker?.lead?.code || '—'}</strong><small>{formatIDR(row.broker?.lead?.netValue, true)}</small></div>
        <div><span>Lead gap</span><strong>{formatRatio(row.broker?.leadToSecondRatio)}</strong><small>{row.broker?.second?.code ? `vs ${row.broker.second.code}` : 'no second buyer'}</small></div>
        <div><span>Positive share</span><strong>{formatPct(row.broker?.leadSharePct, 0, false)}</strong><small>{row.broker?.lead ? `${row.broker.lead.buySessions}/${row.broker.expectedSessions} buying days` : 'unavailable'}</small></div>
        <div><span>Support</span><strong>{formatPrice(row.price.support)}</strong><small>{formatPct(row.price.distanceFromSupportPct)} away · {row.price.supportTouches} touches</small></div>
        <div><span>Compression</span><strong>{formatPct(row.price.consolidationRangePct, 1, false)}</strong><small>{row.price.volatilityContracting ? 'volatility contracting' : 'not contracting'}</small></div>
        <div><span>Avg value</span><strong>{formatIDR(row.price.averageValue, true)}</strong><small>per trading day</small></div>
      </div>
      <div className="scout-card__evidence">
        <div><span>Why it passed</span>{row.reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
        <div className={row.risks.length ? 'has-risk' : ''}><span>Check manually</span>{row.risks.length ? row.risks.map((risk) => <p key={risk}>{risk}</p>) : <p>No additional warning triggered.</p>}</div>
      </div>
      <div className="radar-row__actions">
        <button type="button" onClick={onInvestigate}>Open Analysis</button>
        <button type="button" onClick={onActors}>Broker Flow</button>
      </div>
    </article>
  );
}

function Scout({ onInvestigate, onActors }) {
  const [filters, setFilters] = useState(DEFAULT_SCOUT_FILTERS);
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox'
      ? event.target.checked
      : event.target.type === 'text'
        ? Number(event.target.value.replace(/[^0-9]/g, ''))
        : Number(event.target.value);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const recipe = RECIPES.find((item) => item.id === filters.recipe) || RECIPES[0];
  const selectRecipe = (event) => {
    const recipeId = event.target.value;
    setFilters((current) => ({ ...current, recipe: recipeId, ...RECIPE_CONDITIONS[recipeId] }));
  };
  const run = (event) => {
    event?.preventDefault();
    setState((current) => ({ ...current, loading: true, error: null }));
    getRadarScout(filters).then((raw) => {
      const result = guardRadarScout(raw);
      setState({ loading: false, error: result.ok ? null : result.error, data: result.data });
    }).catch((error) => setState({ loading: false, error: error.message || 'Screener request failed', data: null }));
  };
  return (
    <div className="scout-view">
      <form className="scout-controls" onSubmit={run}>
        <div className="scout-controls__intro">
          <label className="scout-controls__recipe">Screening recipe<select value={filters.recipe} onChange={selectRecipe}>{RECIPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <div className="scout-recipe-explanation"><strong>{recipe.label}</strong><p>{recipe.description}</p><span>Every enabled condition must pass.</span></div>
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
        </fieldset>
        <div className="scout-controls__footer">
          <span>No AI · cached EOD data · deterministic ranking</span>
          <div className="scout-controls__actions">
            <label>Return<select value={filters.limit} onChange={update('limit')}><option value="10">10 stocks</option><option value="25">25 stocks</option><option value="50">50 stocks</option><option value="100">100 stocks</option></select></label>
            <button type="submit" disabled={state.loading}>{state.loading ? 'Screening…' : 'Run Screener'}</button>
          </div>
        </div>
      </form>
      {state.error && <ErrorState title="Custom Screener unavailable" error={state.error} onRetry={run} />}
      {!state.data && !state.loading && !state.error && <EmptyState title="Choose a recipe" message="Run the screener to find stocks matching your selected conditions." />}
      {state.data && <>
        <div className="radar-run"><strong>{state.data.recipe.label}</strong><span>Prices through {formatDate(state.data.asOf.priceDate)}</span><span>Broker flow {formatDate(state.data.asOf.brokerFrom)}–{formatDate(state.data.asOf.brokerTo)} · {state.data.asOf.brokerSessions} trading days</span><span>{state.data.coverage.matched} matched</span><span>Showing {state.data.coverage.returned}</span></div>
        {state.data.candidates.length === 0 ? <EmptyState title="No stocks passed this recipe" message="That is a valid screen result. Widen the price or liquidity boundary only if it matches your intended trade universe." /> : <div className="scout-list" role="list" aria-label="Scout candidates">{state.data.candidates.map((row) => <ScoutCandidate key={row.ticker} row={row} onInvestigate={() => onInvestigate(row.ticker)} onActors={() => onActors(row.ticker, filters.brokerSessions)} />)}</div>}
        {state.data.nearMisses.length > 0 && <section className="scout-near-misses"><h3>Almost Matched</h3><p>These stocks missed one enabled condition.</p><div className="scout-list" role="list" aria-label="Almost matched stocks">{state.data.nearMisses.map((row) => <div key={row.ticker} className="scout-near-miss"><span>Missed: {row.failedCondition}</span><ScoutCandidate row={row} onInvestigate={() => onInvestigate(row.ticker)} onActors={() => onActors(row.ticker, filters.brokerSessions)} /></div>)}</div></section>}
        <div className="scout-disclosures">{state.data.disclosures.map((item) => <p key={item}>{item}</p>)}</div>
      </>}
    </div>
  );
}

export default function Radar() {
  const { openInvestigationTab, openBrokerFlowTab } = useAnalysisContext();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [lane, setLane] = useState(ALL_LANES);
  const [view, setView] = useState('scan');

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
        <button type="button" role="tab" aria-selected={view === 'scan'} className={view === 'scan' ? 'is-active' : ''} onClick={() => setView('scan')}>Market Shortlist</button>
        <button type="button" role="tab" aria-selected={view === 'scout'} className={view === 'scout' ? 'is-active' : ''} onClick={() => setView('scout')}>Custom Screener</button>
      </div>

      {view === 'scout' && <Scout onInvestigate={openInvestigationTab} onActors={openBrokerFlowTab} />}

      {view === 'scan' && <>

      {state.loading && <p className="text-tertiary">Loading the latest qualified scan…</p>}

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
            <div className="radar-list" role="list" aria-label="Shortlisted candidates">
              {visible.map((row) => (
                <CandidateRow
                  key={row.ticker}
                  row={row}
                  onInvestigate={() => openInvestigationTab(row.ticker)}
                  onActors={() => openBrokerFlowTab(row.ticker)}
                />
              ))}
            </div>
          )}
        </>
      )}
      </>}
    </section>
  );
}
