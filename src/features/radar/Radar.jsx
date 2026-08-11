import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOpportunities, getRadarScout } from '../../lib/api/client.js';
import { guardOpportunities, guardRadarScout } from '../../lib/api/contracts.js';
import { formatIDR, formatPct, formatPrice, formatRatio, formatRelativeDays } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import InfoTip from '../../components/InfoTip.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

const ALL_LANES = 'all';
const RECIPES = [
  { id: 'quiet_accumulation', label: 'Quiet accumulation', description: 'Combines persistent broker concentration with repeated support and a narrow recent trading range.' },
  { id: 'dominant_broker', label: 'Dominant broker', description: 'Prioritizes stocks where one broker accumulated materially more than the second-largest positive buyer.' },
  { id: 'support_compression', label: 'Support compression', description: 'Looks for repeated one-month support while recent candles remain inside a controlled sideways range.' },
];
const DEFAULT_SCOUT_FILTERS = Object.freeze({
  recipe: 'quiet_accumulation', brokerSessions: 7, consolidationSessions: 10,
  supportSessions: 20, maxPrice: 1000, minAverageValue: 500_000_000, limit: 10,
  useBroker: true, useSupport: true, useSideways: true, useMaxPrice: true, useLiquidity: true,
});
const RECIPE_CONDITIONS = Object.freeze({
  quiet_accumulation: { useBroker: true, useSupport: true, useSideways: true },
  dominant_broker: { useBroker: true, useSupport: false, useSideways: false },
  support_compression: { useBroker: false, useSupport: true, useSideways: true },
});

function numericText(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '';
}

function ScanProvenance({ run, tally, candidateCount }) {
  if (!run) return null;
  const thinSources = tally.low + tally.unknown;
  return (
    <div className="radar-run">
      <span>Scan #{run.id ?? '—'}</span>
      <strong>{run.dataAsOf || 'undated'}</strong>
      <span className={`radar-run__age${run.dataAsOf ? '' : ' radar-run__age--missing'}`}>
        data {formatRelativeDays(run.dataAsOf)}
      </span>
      <span>
        {run.totalShortlisted ?? '—'} shortlisted / {run.totalEligible ?? '—'} eligible
        {Number.isFinite(run.totalSeen) ? ` / ${run.totalSeen} seen` : ''}
      </span>
      <span>showing {candidateCount}</span>
      <span className={thinSources > 0 ? 'text-warning' : ''}>
        sources {tally.high}H / {tally.medium}M / {thinSources}L
        <InfoTip title="Data quality">
          Backend grade for source freshness and coverage on each candidate. It is
          not a confidence or probability that the setup works.
        </InfoTip>
      </span>
      {run.scannedAt && <span className="text-tertiary">run {formatRelativeDays(run.scannedAt)}</span>}
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
        <span className={row.dataQuality === 'high' ? '' : 'is-degraded'}>
          {row.dataQuality} data quality
        </span>
      </div>
      <div className="radar-row__why">
        <strong>{primaryReason || 'Qualified structure'}</strong>
        <span className={primaryRisk ? 'radar-row__risk' : ''}>
          {primaryRisk ? `Against: ${primaryRisk}` : 'No recorded counter-evidence'}
        </span>
      </div>
      <div className="radar-row__levels">
        <span>Trigger <strong>{formatPrice(row.levels.trigger)}</strong></span>
        <span>Invalid <strong>{formatPrice(row.levels.invalidation)}</strong></span>
        <span>Net R:R <strong>{formatRatio(row.levels.netRewardRisk)}</strong></span>
      </div>
      <div className="radar-row__actions">
        <button type="button" aria-label={`Investigate ${row.ticker}`} onClick={onInvestigate}>
          Investigate
        </button>
        <button type="button" aria-label={`Open ${row.ticker} actor map`} onClick={onActors}>
          Actors
        </button>
      </div>
    </article>
  );
}

function ScoutCandidate({ row, onInvestigate, onActors }) {
  return (
    <article className="scout-card" role="listitem">
      <div className="scout-card__identity">
        <span className="scout-card__rank">{String(row.rank ?? '—').padStart(2, '0')}</span>
        <div><strong>{row.ticker}</strong><span>{row.name} · {row.board || 'board unavailable'}</span></div>
        <b>{Number.isFinite(row.score) ? row.score.toFixed(1) : '—'}</b>
      </div>
      <div className="scout-card__metrics">
        <div><span>Lead broker</span><strong>{row.broker?.lead?.code || '—'}</strong><small>{formatIDR(row.broker?.lead?.netValue, true)}</small></div>
        <div><span>Lead gap</span><strong>{formatRatio(row.broker?.leadToSecondRatio)}</strong><small>{row.broker?.second?.code ? `vs ${row.broker.second.code}` : 'no second buyer'}</small></div>
        <div><span>Positive share</span><strong>{formatPct(row.broker?.leadSharePct, 0, false)}</strong><small>{row.broker?.lead ? `${row.broker.lead.buySessions}/${row.broker.expectedSessions} buy sessions` : 'unavailable'}</small></div>
        <div><span>Support</span><strong>{formatPrice(row.price.support)}</strong><small>{formatPct(row.price.distanceFromSupportPct)} away · {row.price.supportTouches} touches</small></div>
        <div><span>Compression</span><strong>{formatPct(row.price.consolidationRangePct, 1, false)}</strong><small>{row.price.volatilityContracting ? 'volatility contracting' : 'not contracting'}</small></div>
        <div><span>Avg value</span><strong>{formatIDR(row.price.averageValue, true)}</strong><small>per session</small></div>
      </div>
      <div className="scout-card__evidence">
        <div><span>Why it passed</span>{row.reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
        <div className={row.risks.length ? 'has-risk' : ''}><span>Check manually</span>{row.risks.length ? row.risks.map((risk) => <p key={risk}>{risk}</p>) : <p>No additional warning triggered.</p>}</div>
      </div>
      <div className="radar-row__actions">
        <button type="button" onClick={onInvestigate}>Investigate</button>
        <button type="button" onClick={onActors}>Actors</button>
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
    }).catch((error) => setState({ loading: false, error: error.message || 'Scout request failed', data: null }));
  };
  return (
    <div className="scout-view">
      <form className="scout-controls" onSubmit={run}>
        <div className="scout-controls__intro">
          <label className="scout-controls__recipe">Screening recipe<select value={filters.recipe} onChange={selectRecipe}>{RECIPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <div className="scout-recipe-explanation"><strong>{recipe.label}</strong><p>{recipe.description}</p><span>Recipe defaults are editable below. Scout requires every enabled condition.</span></div>
        </div>
        <fieldset className="scout-conditions">
          <legend>Conditions</legend>
          <div className={!filters.useBroker ? 'scout-condition is-disabled' : 'scout-condition'}>
            <label className="scout-toggle"><input type="checkbox" checked={filters.useBroker} onChange={update('useBroker')} /><span><strong>Broker concentration</strong><small>One buyer leads the positive flow.</small></span></label>
            <label className="scout-condition__value">Sessions<input type="number" min="3" max="20" disabled={!filters.useBroker} value={filters.brokerSessions} onChange={update('brokerSessions')} /></label>
          </div>
          <div className={!filters.useSupport ? 'scout-condition is-disabled' : 'scout-condition'}>
            <label className="scout-toggle"><input type="checkbox" checked={filters.useSupport} onChange={update('useSupport')} /><span><strong>Repeated support</strong><small>Price remains near a tested support zone.</small></span></label>
            <label className="scout-condition__value">Sessions<input type="number" min="5" max="60" disabled={!filters.useSupport} value={filters.supportSessions} onChange={update('supportSessions')} /></label>
          </div>
          <div className={!filters.useSideways ? 'scout-condition is-disabled' : 'scout-condition'}>
            <label className="scout-toggle"><input type="checkbox" checked={filters.useSideways} onChange={update('useSideways')} /><span><strong>Sideways compression</strong><small>Recent candles stay inside a narrow range.</small></span></label>
            <label className="scout-condition__value">Candles<input type="number" min="5" max="20" disabled={!filters.useSideways} value={filters.consolidationSessions} onChange={update('consolidationSessions')} /></label>
          </div>
          <div className={!filters.useMaxPrice ? 'scout-condition is-disabled' : 'scout-condition'}>
            <label className="scout-toggle"><input type="checkbox" checked={filters.useMaxPrice} onChange={update('useMaxPrice')} /><span><strong>Maximum price</strong><small>Keep the universe inside your price band.</small></span></label>
            <label className="scout-condition__value">Rp<input type="text" inputMode="numeric" disabled={!filters.useMaxPrice} value={numericText(filters.maxPrice)} onChange={update('maxPrice')} /></label>
          </div>
          <div className={!filters.useLiquidity ? 'scout-condition is-disabled' : 'scout-condition'}>
            <label className="scout-toggle"><input type="checkbox" checked={filters.useLiquidity} onChange={update('useLiquidity')} /><span><strong>Liquidity floor</strong><small>Minimum average traded value per session.</small></span></label>
            <label className="scout-condition__value">Rp average<input type="text" inputMode="numeric" disabled={!filters.useLiquidity} value={numericText(filters.minAverageValue)} onChange={update('minAverageValue')} /></label>
          </div>
        </fieldset>
        <div className="scout-controls__footer"><span>No AI · cached EOD data · deterministic ranking</span><button type="submit" disabled={state.loading}>{state.loading ? 'Screening…' : 'Run Scout'}</button></div>
      </form>
      {state.error && <ErrorState title="Scout unavailable" error={state.error} onRetry={run} />}
      {!state.data && !state.loading && !state.error && <EmptyState title="Choose a recipe" message="Run Scout to screen the cached IDX universe. Nothing is ranked in the browser." />}
      {state.data && <>
        <div className="radar-run"><strong>{state.data.recipe.label}</strong><span>prices {state.data.asOf.priceDate || 'unavailable'}</span><span>brokers {state.data.asOf.brokerFrom || '—'} → {state.data.asOf.brokerTo || '—'} · {state.data.asOf.brokerSessions} sessions</span><span>{state.data.coverage.matched} matched / {state.data.coverage.evaluated} evaluated</span><span>showing {state.data.coverage.returned}</span></div>
        {state.data.candidates.length === 0 ? <EmptyState title="No stocks passed this recipe" message="That is a valid screen result. Widen the price or liquidity boundary only if it matches your intended trade universe." /> : <div className="scout-list" role="list" aria-label="Scout candidates">{state.data.candidates.map((row) => <ScoutCandidate key={row.ticker} row={row} onInvestigate={() => onInvestigate(row.ticker)} onActors={() => onActors(row.ticker, filters.brokerSessions)} />)}</div>}
        <div className="scout-disclosures">{state.data.disclosures.map((item) => <p key={item}>{item}</p>)}</div>
      </>}
    </div>
  );
}

export default function Radar() {
  const { openInvestigation, openBrokerMap } = useAnalysisContext();
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
        <div><span>MODULE 01 · DISCOVERY</span><h2 id="radar-title">Radar</h2></div>
        <p>Only structures worth questioning. No feed, no hype ticker carousel.</p>
      </header>

      <div className="radar-view-tabs" role="tablist" aria-label="Radar views">
        <button type="button" role="tab" aria-selected={view === 'scan'} className={view === 'scan' ? 'is-active' : ''} onClick={() => setView('scan')}>Qualified Scan</button>
        <button type="button" role="tab" aria-selected={view === 'scout'} className={view === 'scout' ? 'is-active' : ''} onClick={() => setView('scout')}>Scout</button>
      </div>

      {view === 'scout' && <Scout onInvestigate={openInvestigation} onActors={openBrokerMap} />}

      {view === 'scan' && <>

      {state.loading && <p className="text-tertiary">Loading the latest qualified scan…</p>}

      {state.error && !state.loading && (
        <ErrorState title="Scan unavailable" error={state.error} onRetry={load} />
      )}

      {!state.loading && !state.error && state.data && (
        <>
          <ScanProvenance
            run={state.data.run}
            tally={state.data.dataQualityTally}
            candidateCount={visible.length}
          />

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
              message="Radar reads the most recent stored scan run. Nothing has been persisted yet."
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
                  onInvestigate={() => openInvestigation(row.ticker)}
                  onActors={() => openBrokerMap(row.ticker, 7)}
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
