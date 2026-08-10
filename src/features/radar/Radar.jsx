import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOpportunities } from '../../lib/api/client.js';
import { guardOpportunities } from '../../lib/api/contracts.js';
import { formatPrice, formatRatio, formatRelativeDays } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import InfoTip from '../../components/InfoTip.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

const ALL_LANES = 'all';

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

export default function Radar() {
  const { openInvestigation, openBrokerMap } = useAnalysisContext();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [lane, setLane] = useState(ALL_LANES);

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
    </section>
  );
}
