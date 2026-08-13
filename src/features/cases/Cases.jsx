import { useCallback, useEffect, useState } from 'react';
import { getCases } from '../../lib/api/client.js';
import { guardCases } from '../../lib/api/contracts.js';
import { formatPrice, formatRelativeDays } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import InfoTip from '../../components/InfoTip.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

const MONITORING_LABEL = {
  meaningful_change: 'Changed since freeze',
  no_material_change: 'No material change',
  unavailable: 'Not in latest scan',
};

const MONITORING_CLASS = {
  meaningful_change: 'text-warning',
  no_material_change: 'text-positive',
  unavailable: 'text-tertiary',
};

function SnapshotAge({ monitoring }) {
  const { snapshotStale, snapshotAgeDays } = monitoring;
  if (snapshotStale === null) {
    return <span className="case-card__age text-warning">Analysis date unavailable</span>;
  }
  const age = snapshotAgeDays === null ? 'unknown age' : `${snapshotAgeDays}d old`;
  return (
    <span className={`case-card__age ${snapshotStale ? 'text-warning' : 'text-tertiary'}`}>
      {snapshotStale ? `Analysis is stale · ${age}` : `Analyzed ${age}`}
    </span>
  );
}

function CaseCard({ item, onReopen, onActors }) {
  const { monitoring, snapshot } = item;
  const delta = monitoring.current?.scoreDelta;
  const lifecycleEvent = monitoring.latestLifecycleEvent;
  return (
    <article className="case-card" role="listitem">
      <div className="case-card__top">
        <span className="case-card__status">{item.status}</span>
        <span className={`case-card__monitoring ${MONITORING_CLASS[monitoring.state]}`}>
          {MONITORING_LABEL[monitoring.state]}
        </span>
      </div>
      <h3>{item.ticker}</h3>
      <p className="case-card__thesis">
        {item.thesis || snapshot.reasons[0] || 'Thesis not recorded yet.'}
      </p>

      <dl className="case-card__levels">
        <div>
          <dt>{item.snapshot.levels?.framing === 'defensive' || item.snapshot.scenarioGeometry?.framing === 'defensive' ? 'Not a long entry' : 'Breakout above'}</dt>
          <dd>{formatPrice(item.triggerPrice ?? item.snapshot.levels.trigger)}</dd>
        </div>
        <div>
          <dt>{item.snapshot.levels?.framing === 'defensive' || item.snapshot.scenarioGeometry?.framing === 'defensive' ? 'Damage if lost' : 'Setup fails below'}</dt>
          <dd>{formatPrice(item.invalidationPrice ?? item.snapshot.levels.invalidation)}</dd>
        </div>
        <div>
          <dt>Saved score</dt>
          <dd>
            {Number.isFinite(snapshot.score) ? snapshot.score.toFixed(1) : '—'}
            {Number.isFinite(delta) && delta !== 0 && (
              <span className={delta > 0 ? 'text-positive' : 'text-negative'}>
                {' '}{delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Data quality</dt>
          <dd className={snapshot.dataQuality === 'high' ? '' : 'text-warning'}>
            {snapshot.dataQuality}
          </dd>
        </div>
      </dl>

      {snapshot.risks[0] && (
        <p className="case-card__risk text-warning">Against: {snapshot.risks[0]}</p>
      )}

      {lifecycleEvent && (
        <div className={`case-card__event case-card__event--${lifecycleEvent.severity}`}>
          <span>{lifecycleEvent.eventType.replaceAll('_', ' ')}</span>
          <p>{lifecycleEvent.message}</p>
          <small>{lifecycleEvent.eventDate}</small>
          {lifecycleEvent.evidence?.sourceUrl && (
            <a href={lifecycleEvent.evidence.sourceUrl} target="_blank" rel="noreferrer">Official source</a>
          )}
          {lifecycleEvent.eventType === 'profile_drift' && (
            <small> · {lifecycleEvent.evidence?.kind || 'scenario'} · scan #{lifecycleEvent.evidence?.sourceRunId || '—'} · {lifecycleEvent.evidence?.currentFitScore ?? '—'}% current fit</small>
          )}
        </div>
      )}

      {item.outcome && (
        <dl className="case-card__outcome">
          <div><dt>Best excursion</dt><dd>{Number.isFinite(item.outcome.mfePct) ? `${item.outcome.mfePct.toFixed(1)}%` : 'Not triggered'}</dd></div>
          <div><dt>Worst excursion</dt><dd>{Number.isFinite(item.outcome.maePct) ? `${item.outcome.maePct.toFixed(1)}%` : '—'}</dd></div>
          <div><dt>vs IHSG</dt><dd>{item.outcome.horizonElapsed && Number.isFinite(item.outcome.excessReturnPct) ? `${item.outcome.excessReturnPct > 0 ? '+' : ''}${item.outcome.excessReturnPct.toFixed(1)}%` : 'Horizon open'}</dd></div>
        </dl>
      )}

      <div className="case-card__provenance">
        <SnapshotAge monitoring={monitoring} />
        {item.addedAt && <span className="text-tertiary">Opened {formatRelativeDays(item.addedAt)}</span>}
      </div>

      <div className="case-card__actions">
        <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Re-open ${item.ticker} evidence`} onClick={onReopen}>
          Open Analysis
        </button>
        <button type="button" className="ui-btn ui-btn--ghost" aria-label={`Open ${item.ticker} actor map`} onClick={onActors}>
          Broker Flow
        </button>
      </div>
    </article>
  );
}

export default function Cases() {
  const { openInvestigation, openBrokerMap } = useAnalysisContext();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ loading: true, error: null, data: null });
    getCases()
      .then((raw) => {
        if (cancelled) return;
        const result = guardCases(raw);
        setState({ loading: false, error: result.ok ? null : result.error, data: result.data });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, error: error.message || 'Case request failed', data: null });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(load, [load]);

  const items = state.data?.items || [];

  return (
    <section className="cases-page" aria-labelledby="cases-title">
      <header className="module-heading">
        <div><h2 id="cases-title">Watchlist</h2></div>
        <p>Saved setups and what has changed since you added them.</p>
      </header>

      {state.loading && <Skeleton label="Loading watchlist…" />}

      {state.error && !state.loading && (
        <ErrorState title="Watchlist unavailable" error={state.error} onRetry={load} />
      )}

      {!state.loading && !state.error && items.length > 0 && (
        <div className="cases-summary">
          <span>{items.length} open</span>
          <span className={state.data.changedCount > 0 ? 'text-warning' : ''}>
            {state.data.changedCount} changed since freeze
            <InfoTip title="Material change">
              The backend flags a material change when score moves 10 or more, the
              lane changes, data quality changes, or the case drops out of the
              eligible set. It is not a signal to act.
            </InfoTip>
          </span>
          <span className={state.data.staleCount > 0 ? 'text-warning' : ''}>
            {state.data.staleCount} on stale evidence
          </span>
        </div>
      )}

      {!state.loading && !state.error && items.length === 0 && (
        <EmptyState
          title="Your watchlist is empty"
          message="No saved setups yet. Save a qualified setup from Screener or Stock Analysis on the private workstation."
          action={<a className="ui-btn ui-btn--ghost" href="/radar">Browse setups in Screener</a>}
        />
      )}

      {items.length > 0 && (
        <div className="cases-grid" role="list" aria-label="Open cases">
          {items.map((item) => (
            <CaseCard
              key={item.id}
              item={item}
              onReopen={() => openInvestigation(item.ticker)}
              onActors={() => openBrokerMap(item.ticker, 7)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
