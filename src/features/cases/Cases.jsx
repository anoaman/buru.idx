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
          <dt>Breakout above</dt>
          <dd>{formatPrice(item.triggerPrice ?? snapshot.levels.trigger)}</dd>
        </div>
        <div>
          <dt>Setup fails below</dt>
          <dd>{formatPrice(item.invalidationPrice ?? snapshot.levels.invalidation)}</dd>
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

      <div className="case-card__provenance">
        <SnapshotAge monitoring={monitoring} />
        {item.addedAt && <span className="text-tertiary">Opened {formatRelativeDays(item.addedAt)}</span>}
      </div>

      <div className="case-card__actions">
        <button type="button" aria-label={`Re-open ${item.ticker} evidence`} onClick={onReopen}>
          Open Analysis
        </button>
        <button type="button" aria-label={`Open ${item.ticker} actor map`} onClick={onActors}>
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
          message="No saved setups yet. Watchlist management will appear here when the workflow is enabled."
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
