import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  getBrokerArchiveHealth,
  getStockBrokerIntelligence,
  getBrokerStockIntelligence,
  invalidateBrokerCache,
  prefetchStockBrokerIntelligence,
  prefetchBrokerStockIntelligence,
} from '../../lib/api/client.js';
import {
  guardBrokerArchiveHealth,
  guardStockBrokerIntelligence,
  guardBrokerStockIntelligence,
} from '../../lib/api/contracts.js';
import { formatIDR, formatNumber, formatPrice } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import InventoryCurve from './InventoryCurve.jsx';
import ActorMap from './ActorMap.jsx';

const ALLOWED_DAYS = [1, 7, 14, 30, 60];
const DEFAULT_TICKER = 'BBCA';
const DEFAULT_DAYS = 1;

function normalizeLens(raw) {
  return raw === 'broker' ? 'broker' : 'stock';
}

function normalizeDays(raw) {
  const n = Number(raw);
  return ALLOWED_DAYS.includes(n) ? n : DEFAULT_DAYS;
}

function signedValue(value, formatter = formatIDR) {
  if (!Number.isFinite(value)) return '—';
  const formatted = formatter(value);
  if (value > 0 && !formatted.startsWith('+')) return `+${formatted}`;
  return formatted;
}

function signedLots(value) {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)} lots`;
}

function consistencyLabel(consistency) {
  if (!consistency) return '—';
  const side = consistency.dominantSide || 'mixed';
  const pct = Number.isFinite(consistency.consistencyRatio)
    ? `${Math.round(consistency.consistencyRatio * 100)}%`
    : '—';
  return `${side} · ${pct}`;
}

function avgCostLabel(value) {
  return Number.isFinite(value) ? formatPrice(value) : 'Unavailable';
}

function coveragePct(coverage) {
  if (!Number.isFinite(coverage)) return '—';
  return `${(coverage * 100).toFixed(1)}%`;
}

function ArchiveHealthStrip({ health, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="bi-health bi-health--loading" aria-live="polite">
        Loading archive health…
      </div>
    );
  }

  if (error || !health?.ok) {
    return (
      <div className="bi-health bi-health--error">
        <span className="text-negative">Archive health unavailable</span>
        <span className="text-secondary">{error || health?.error || 'Request failed'}</span>
        {onRetry && (
          <button type="button" className="bi-health__retry" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  const data = health.data;
  if (data?.available === false) {
    return (
      <div className="bi-health bi-health--unavailable">
        <span className="text-warning">Archive unavailable</span>
        <span className="text-secondary">{data.reason || 'Archive not available'}</span>
        {onRetry && (
          <button type="button" className="bi-health__retry" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  const calendar = health.meta?.calendarCoverage;
  const latest = data.latestDate;
  const latestStatus = !latest
    ? 'Unavailable'
    : latest.complete
      ? 'Complete'
      : 'Partial';

  return (
    <details
      className={`bi-health ${calendar?.status === 'degraded' ? 'bi-health--degraded' : ''} ${latest && !latest.complete ? 'bi-health--partial' : ''}`}
    >
      <summary>
        <span>Archive</span>
        <strong className={latest?.complete ? 'text-positive' : 'text-warning'}>{latest?.date || 'Unavailable'} · {latestStatus}</strong>
        <small>{coveragePct(data.coverage)} coverage</small>
      </summary>
      <div className="bi-health__details">
      <div className="bi-health__item">
        <span className="bi-health__label">Full-universe complete</span>
        <span
          className={`bi-health__value tabular ${data.completedCoverageStalled ? 'text-warning' : ''}`}
          title={data.completedCoverageStalled
            ? `${data.completedCoverageReason} Daily data continues past this date; see Latest available.`
            : 'Every canonical ticker is accounted for on this date.'}
        >
          {data.latestCompletedDate || '—'}
        </span>
        {data.completedCoverageStalled && data.completedLagSessions > 0 && (
          <span className="bi-health__note text-tertiary">
            stalled · {data.completedLagSessions} sessions of partial data since
          </span>
        )}
      </div>
      <div className="bi-health__item">
        <span className="bi-health__label">Earliest archive</span>
        <span className="bi-health__value tabular">{data.earliestAvailableDate || '—'}</span>
      </div>
      <div className="bi-health__item">
        <span className="bi-health__label">Coverage</span>
        <span className="bi-health__value tabular">
          {coveragePct(data.coverage)} · {formatNumber(data.accountedStockDays)}/{formatNumber(data.expectedStockDays)} stock-days
        </span>
      </div>
      <div className="bi-health__item">
        <span className="bi-health__label">Verified trading dates</span>
        <span className="bi-health__value tabular">{formatNumber(data.verifiedTradingDates)}</span>
      </div>
      <div className="bi-health__item">
        <span className="bi-health__label">Latest available</span>
        <span className={`bi-health__value tabular ${latest && !latest.complete ? 'text-warning' : ''}`}>
          {latest?.date || '—'} · {latestStatus}
          {latest && Number.isFinite(latest.accounted) && Number.isFinite(latest.expected)
            ? ` (${latest.accounted}/${latest.expected})`
            : ''}
        </span>
      </div>
      {calendar?.status === 'degraded' && (
        <div className="bi-health__banner text-warning">
          Calendar coverage degraded{calendar.reason ? `: ${calendar.reason}` : ''}
          {calendar.uncoveredWeekdays?.length
            ? ` · uncovered ${calendar.uncoveredWeekdays.join(', ')}`
            : ''}
        </div>
      )}
      {data.serving && (
        <div className={`bi-health__serving ${data.serving.servingAvailable ? 'bi-health__serving--ready' : 'bi-health__serving--unavailable'}`}>
          <span className="bi-health__label">Serving layer</span>
          <span className={`bi-health__value ${data.serving.servingAvailable ? (data.serving.servingStatus === 'stale' ? 'text-warning' : 'text-positive') : 'text-secondary'}`}>
            {data.serving.servingStatus}
            {data.serving.servingAvailable && data.serving.servingRows > 0
              ? ` · ${formatNumber(data.serving.servingRows)} rows`
              : ''}
            {data.serving.materializedAt
              ? ` · materialized ${data.serving.materializedAt.slice(0, 10)}`
              : ''}
          </span>
          {data.serving.servingReason && (
            <span className="bi-health__value text-warning">{data.serving.servingReason}</span>
          )}
          {data.serving.lastFailure && (
            <span className="bi-health__value text-negative">
              Last failure: {data.serving.lastFailure.finishedAt?.slice(0, 10) || 'unknown'}
              {data.serving.lastFailure.error ? ` · ${data.serving.lastFailure.error}` : ''}
            </span>
          )}
        </div>
      )}
      </div>
    </details>
  );
}

function RankingRow({
  selected,
  onSelect,
  primary,
  secondary,
  netValue,
  sideLabel,
  avgCost,
}) {
  return (
    <button
      type="button"
      className={`bi-rank__row ${selected ? 'bi-rank__row--selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="bi-rank__identity">
        <span className="bi-rank__primary">{primary}</span>
        <span className="bi-rank__secondary text-secondary">{secondary}</span>
      </div>
      <div className="bi-rank__metrics">
        <span className={`bi-rank__net tabular ${netValue > 0 ? 'text-positive' : netValue < 0 ? 'text-negative' : 'text-secondary'}`}>
          {signedValue(netValue)}
        </span>
        <span className="bi-rank__side text-secondary">{sideLabel}</span>
        <span className="bi-rank__cost text-tertiary">Avg {avgCost}</span>
      </div>
    </button>
  );
}

function SelectedDetail({ lens, row }) {
  if (!row) {
    return (
      <div className="bi-detail bi-detail--empty text-tertiary">
        Select a ranking row to inspect estimated inventory and detail.
      </div>
    );
  }

  if (lens === 'stock') {
    return (
      <div className="bi-detail">
        <div className="bi-detail__title">{row.code} · {row.sourceType || '—'}</div>
        <div className="bi-detail__grid">
          <div>
            <span className="text-tertiary">Net lots</span>
            <span className={`tabular ${row.netLots > 0 ? 'text-positive' : row.netLots < 0 ? 'text-negative' : ''}`}>
              {signedLots(row.netLots)}
            </span>
          </div>
          <div>
            <span className="text-tertiary">Est. inventory</span>
            <span className={`tabular ${row.estimatedInventoryLots > 0 ? 'text-positive' : row.estimatedInventoryLots < 0 ? 'text-negative' : ''}`}>
              {signedLots(row.estimatedInventoryLots)}
            </span>
          </div>
          <div>
            <span className="text-tertiary">Frequency</span>
            <span className="tabular">{formatNumber(row.frequency)}</span>
          </div>
        </div>
        <Link
          className="bi-detail__link"
          to={`/broker-intelligence?lens=broker&code=${encodeURIComponent(row.code)}&days=${encodeURIComponent(String(row._days || DEFAULT_DAYS))}`}
        >
          Open Broker Lens
        </Link>
      </div>
    );
  }

  return (
    <div className="bi-detail">
      <div className="bi-detail__title">{row.ticker} · {row.name}</div>
      <div className="bi-detail__grid">
        <div>
          <span className="text-tertiary">Net lots</span>
          <span className={`tabular ${row.netLots > 0 ? 'text-positive' : row.netLots < 0 ? 'text-negative' : ''}`}>
            {signedLots(row.netLots)}
          </span>
        </div>
        <div>
          <span className="text-tertiary">Observed sessions</span>
          <span className="tabular">{formatNumber(row.observedSessions)}</span>
        </div>
        <div>
          <span className="text-tertiary">Est. inventory</span>
          <span className={`tabular ${row.estimatedInventoryLots > 0 ? 'text-positive' : row.estimatedInventoryLots < 0 ? 'text-negative' : ''}`}>
            {signedLots(row.estimatedInventoryLots)}
          </span>
        </div>
      </div>
      <Link
        className="bi-detail__link"
        to={`/workbench?ticker=${encodeURIComponent(row.ticker)}`}
      >
        Open in Workbench
      </Link>
    </div>
  );
}

function Disclosures({ items }) {
  const list = Array.isArray(items) && items.length
    ? items
    : [
        { code: 'top25_observed', label: 'Observed flow contains up to the top 25 buyers and sellers per stock-day.' },
        { code: 'absence_not_proof', label: 'Absence does not prove no trading activity.' },
        { code: 'estimated_inventory_window_zero', label: 'Estimated inventory starts at zero at the selected window\'s beginning.' },
        { code: 'estimates_not_holdings', label: 'Estimated inventory and average cost are not actual holdings or confirmed cost basis.' },
        { code: 'regular_market_combined', label: 'Regular-market broker summary; all investor types combined.' },
      ];

  return (
    <details className="bi-disclosures" aria-label="Methodology and disclosures">
      <summary className="bi-disclosures__title">Methodology & limitations</summary>
      <ul className="bi-disclosures__list">
        {list.map((item) => (
          <li key={item.code}>{item.label}</li>
        ))}
      </ul>
    </details>
  );
}

export default function BrokerIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams();
  const lens = normalizeLens(searchParams.get('lens'));
  const days = normalizeDays(searchParams.get('days'));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') || '')
    ? searchParams.get('date')
    : '';
  const ticker = (searchParams.get('ticker') || DEFAULT_TICKER).toUpperCase();
  const code = (searchParams.get('code') || '').toUpperCase();

  const [searchInput, setSearchInput] = useState(lens === 'broker' ? code : ticker);
  const [validationError, setValidationError] = useState(null);

  const [healthState, setHealthState] = useState({
    loading: true,
    result: null,
    error: null,
  });
  const [lensState, setLensState] = useState({
    loading: true,
    refreshing: false,
    result: null,
    error: null,
  });
  const [selectedKey, setSelectedKey] = useState(null);
  const [healthRetry, setHealthRetry] = useState(0);
  const [lensRetry, setLensRetry] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    setSearchInput(lens === 'broker' ? code : ticker);
    setValidationError(null);
  }, [lens, ticker, code]);

  useEffect(() => {
    let cancelled = false;
    setHealthState((prev) => ({ ...prev, loading: true, error: null }));
    getBrokerArchiveHealth()
      .then((raw) => {
        if (cancelled) return;
        const result = guardBrokerArchiveHealth(raw);
        if (!result.ok) {
          setHealthState({ loading: false, result: null, error: result.error });
          return;
        }
        setHealthState({ loading: false, result, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setHealthState({ loading: false, result: null, error: err.message || 'Network error' });
      });
    return () => { cancelled = true; };
  }, [healthRetry]);

  useEffect(() => {
    const reqId = ++requestRef.current;
    let cancelled = false;
    const hasIdentity = lens === 'stock' ? /^[A-Z]{4}$/.test(ticker) : /^[A-Z]{2}$/.test(code);
    if (!hasIdentity) {
      setLensState({
        loading: false,
        refreshing: false,
        result: null,
        error: lens === 'stock'
          ? 'Enter a four-letter IDX ticker'
          : 'Enter a two-letter broker code',
      });
      return undefined;
    }

    setLensState((prev) => {
      const prevData = prev.result?.data;
      const compatible = Boolean(
        prevData
        && ((lens === 'stock' && prevData.ticker === ticker) || (lens === 'broker' && prevData.broker?.code === code)),
      );
      return {
        loading: !compatible,
        refreshing: compatible,
        result: compatible ? prev.result : null,
        error: null,
      };
    });

    const request = lens === 'stock'
      ? getStockBrokerIntelligence({ ticker, days, ...(date ? { date } : {}) })
      : getBrokerStockIntelligence({ code, days, ...(date ? { date } : {}), limit: 25 });

    request
      .then((raw) => {
        if (cancelled || reqId !== requestRef.current) return;
        const result = lens === 'stock'
          ? guardStockBrokerIntelligence(raw)
          : guardBrokerStockIntelligence(raw);
        if (!result.ok) {
          setLensState({ loading: false, refreshing: false, result: null, error: result.error });
          return;
        }
        if (date && result.data?.window?.asOf !== date) {
          setLensState({ loading: false, refreshing: false, result: null, error: `No broker data is available for ${date}.` });
          return;
        }
        setLensState({ loading: false, refreshing: false, result, error: null });
        setSelectedKey(null);
      })
      .catch((err) => {
        if (cancelled || reqId !== requestRef.current) return;
        setLensState({
          loading: false,
          refreshing: false,
          result: null,
          error: err.message || 'Network error',
        });
      });

    return () => { cancelled = true; };
  }, [lens, ticker, code, days, date, lensRetry]);

  // Prefetch other windows after first successful identity load
  useEffect(() => {
    if (lensState.loading || lensState.error || !lensState.result || date) return;
    const timer = setTimeout(() => {
      const others = ALLOWED_DAYS.filter((d) => d !== days);
      for (const d of others) {
        if (lens === 'stock') {
          prefetchStockBrokerIntelligence({ ticker, days: d });
        } else {
          prefetchBrokerStockIntelligence({ code, days: d, limit: 25 });
        }
      }
      // Warm the counterpart lens for the same window so Stock/Broker switches
      // resolve from the client cache instead of presenting a blank transition.
      if (lens === 'stock') {
        prefetchBrokerStockIntelligence({ code: code || 'YP', days, limit: 25 });
      } else {
        prefetchStockBrokerIntelligence({ ticker: ticker || DEFAULT_TICKER, days });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [lensState.loading, lensState.error, lensState.result, lens, ticker, code, days, date]);

  const updateParams = useCallback((next) => {
    const params = new URLSearchParams();
    const nextLens = normalizeLens(next.lens ?? lens);
    const nextDays = normalizeDays(next.days ?? days);
    params.set('lens', nextLens);
    params.set('days', String(nextDays));
    const nextDate = next.date === undefined ? date : next.date;
    if (nextDate) params.set('date', nextDate);
    if (nextLens === 'stock') {
      params.set('ticker', String(next.ticker ?? ticker).toUpperCase());
    } else {
      params.set('code', String(next.code ?? code).toUpperCase());
    }
    setSearchParams(params);
  }, [lens, days, date, ticker, code, setSearchParams]);

  const handleLensChange = (nextLens) => {
    if (nextLens === lens) return;
    if (nextLens === 'broker') {
      updateParams({ lens: 'broker', code: code || 'YP', days });
    } else {
      updateParams({ lens: 'stock', ticker: ticker || DEFAULT_TICKER, days });
    }
  };

  const handleDaysChange = (nextDays) => {
    updateParams({ days: nextDays });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (lens === 'stock') {
      if (!/^[A-Z]{4}$/.test(clean)) {
        setValidationError('IDX ticker must be exactly four letters.');
        return;
      }
      setValidationError(null);
      updateParams({ ticker: clean });
      return;
    }
    if (!/^[A-Z]{2}$/.test(clean)) {
      setValidationError('Broker code must be exactly two letters.');
      return;
    }
    setValidationError(null);
    updateParams({ code: clean });
  };

  const data = lensState.result?.data || null;
  const meta = lensState.result?.meta || null;
  const stockData = lens === 'stock' && data?.ticker ? data : null;
  const brokerData = lens === 'broker' && data?.broker?.code ? data : null;
  const viewData = stockData || brokerData;

  const accumulation = viewData?.accumulation || [];
  const distribution = viewData?.distribution || [];

  const mismatched = Boolean(data) && !viewData;
  const showLensLoading = lensState.loading;
  const showRefreshing = lensState.refreshing && !lensState.loading;

  const selectedRow = useMemo(() => {
    const all = [...accumulation, ...distribution];
    if (!all.length) return null;
    if (selectedKey) {
      const found = all.find((row) => (
        lens === 'stock' ? row.code === selectedKey : row.ticker === selectedKey
      ));
      if (found) return found;
    }
    return accumulation[0] || distribution[0] || null;
  }, [accumulation, distribution, selectedKey, lens]);

  const identityLabel = selectedRow
    ? (lens === 'stock' ? selectedRow.code : selectedRow.ticker)
    : '';

  const searchValid = lens === 'stock'
    ? /^[A-Z]{4}$/i.test(searchInput.trim())
    : /^[A-Z]{2}$/i.test(searchInput.trim());

  const retryLens = () => setLensRetry((n) => n + 1);
  const retryHealth = () => {
    invalidateBrokerCache();
    setHealthRetry((n) => n + 1);
  };

  return (
    <div className="bi-page">
      <header className="bi-intro">
        <div>
          <h2 className="bi-intro__title">Broker Intelligence</h2>
          <p className="bi-intro__subtitle text-secondary">
            Observed broker flow across NALAR&apos;s historical IDX archive.
          </p>
        </div>
        <span className="bi-intro__method">Top-25 observed flow · estimates start at window zero</span>
      </header>

      <ArchiveHealthStrip
        health={healthState.result}
        loading={healthState.loading}
        error={healthState.error}
        onRetry={retryHealth}
      />

      <div className="bi-controls">
        <div className="bi-lens" role="group" aria-label="Lens">
          <button
            type="button"
            className={`bi-lens__btn ${lens === 'stock' ? 'is-active' : ''}`}
            aria-pressed={lens === 'stock'}
            onClick={() => handleLensChange('stock')}
          >
            Stock Lens
          </button>
          <button
            type="button"
            className={`bi-lens__btn ${lens === 'broker' ? 'is-active' : ''}`}
            aria-pressed={lens === 'broker'}
            onClick={() => handleLensChange('broker')}
          >
            Broker Lens · Across Market
          </button>
        </div>

        <form className="bi-search" onSubmit={handleSearchSubmit}>
          <label className="bi-search__label" htmlFor="bi-search-input">
            {lens === 'stock' ? 'IDX ticker' : 'Broker code'}
          </label>
          <div className="bi-search__row">
            <input
              id="bi-search-input"
              className="bi-search__input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              placeholder={lens === 'stock' ? 'BBCA' : 'YP'}
              maxLength={lens === 'stock' ? 4 : 2}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="bi-search__submit"
              disabled={!searchValid}
            >
              Analyze
            </button>
          </div>
          {validationError && (
            <div className="bi-search__error text-negative" role="alert">{validationError}</div>
          )}
        </form>

        <div className="bi-window">
          <div className="bi-window__buttons" role="group" aria-label="Calendar-day window">
            {ALLOWED_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`bi-window__btn ${days === d ? 'is-active' : ''}`}
                aria-pressed={days === d}
                onClick={() => handleDaysChange(d)}
              >
                {d}D
              </button>
            ))}
          </div>
          <p className="bi-window__note text-tertiary">
            Calendar days; weekends and verified IDX holidays excluded.
          </p>
        </div>
      </div>

      {showLensLoading && (
        <div className="bi-loading text-tertiary" aria-live="polite">
          Loading broker intelligence…
        </div>
      )}

      {showRefreshing && (
        <div className="bi-refreshing text-tertiary" aria-live="polite">
          <span className="bi-refreshing__spinner" />
          Refreshing…
        </div>
      )}

      {lensState.error && !showLensLoading && (
        <ErrorState
          title="Broker intelligence unavailable"
          error={lensState.error}
          onRetry={retryLens}
        />
      )}

      {viewData && !lensState.loading && !mismatched && (
        <>
          {stockData ? (
            <section className="bi-summary" aria-label="Stock window summary">
              <div className="bi-summary__line">
                <strong>{stockData.ticker}</strong>
                <span className="text-secondary">{stockData.name}</span>
                <span className="text-tertiary">
                  {stockData.window.from} → {stockData.window.to}
                </span>
                <span className="text-tertiary">
                  {formatNumber(stockData.window.tradingSessions)} sessions
                </span>
                <span className="text-tertiary">
                  Populated {formatNumber(stockData.window.populatedSessions)}
                  {' · '}Gap {formatNumber(stockData.window.gapSessions)}
                  {' · '}Missing {formatNumber(stockData.window.missingSessions)}
                </span>
                <span className={`badge ${stockData.window.complete ? 'badge-positive' : 'badge-warning'}`}>
                  {stockData.window.complete ? 'Complete' : 'Degraded'}
                </span>
                {meta?.archive?.calendarCoverage?.status === 'degraded' && (
                  <span className="badge badge-warning">Calendar degraded</span>
                )}
              </div>
              <div className="bi-summary__metrics">
                <div className="bi-summary__primary">
                  <span className="text-tertiary">Preferred-broker share</span>
                  <strong className="tabular">
                    {stockData.preferredBroker.share == null ? '—' : `${(stockData.preferredBroker.share * 100).toFixed(1)}%`}
                  </strong>
                  <small className="text-tertiary">
                    {(stockData.preferredBroker.observedCodes || []).join(', ') || 'No preferred broker observed'}
                  </small>
                </div>
                <div>
                  <span className="text-tertiary">Observed net value</span>
                  <span className={`tabular ${stockData.observedFlow.netValue > 0 ? 'text-positive' : stockData.observedFlow.netValue < 0 ? 'text-negative' : ''}`}>
                    {signedValue(stockData.observedFlow.netValue)}
                  </span>
                </div>
              </div>
              {stockData.rotationHandoff && (
                <div className="bi-rotation" role="status">
                  <strong>Broker handoff detected</strong>
                  <span>{stockData.rotationHandoff.outgoingBroker} → {stockData.rotationHandoff.incomingBroker}</span>
                  <span className="text-tertiary">
                    {stockData.rotationHandoff.split.earlyFrom}–{stockData.rotationHandoff.split.lateTo}
                  </span>
                </div>
              )}
              <ActorMap data={stockData.actorMap} />
            </section>
          ) : (
            <section className="bi-summary" aria-label="Broker window summary">
              <div className="bi-summary__line">
                <strong>{brokerData.broker.code}</strong>
                <span className="text-secondary">
                  {(brokerData.broker.sourceTypes || []).join(' / ') || '—'}
                </span>
                <span className="text-tertiary">
                  {brokerData.window.from} → {brokerData.window.to}
                </span>
                <span className="text-tertiary">
                  {formatNumber(brokerData.window.tradingSessions)} sessions
                </span>
                <span className="text-tertiary">
                  Observed stocks {formatNumber(brokerData.summary.observedStocks)}
                  {' · '}Acc {formatNumber(brokerData.summary.accumulationStocks)}
                  {' · '}Dist {formatNumber(brokerData.summary.distributionStocks)}
                </span>
                {meta?.archive?.calendarCoverage?.status === 'degraded' && (
                  <span className="badge badge-warning">Calendar degraded</span>
                )}
              </div>
              <div className="bi-summary__metrics">
                <div>
                  <span className="text-tertiary">Observed net value</span>
                  <span className={`tabular ${brokerData.summary.netValue > 0 ? 'text-positive' : brokerData.summary.netValue < 0 ? 'text-negative' : ''}`}>
                    {signedValue(brokerData.summary.netValue)}
                  </span>
                </div>
                {brokerData.fingerprint && (
                  <div className="bi-summary__primary">
                    <span className="text-tertiary">Behavioral fingerprint</span>
                    <strong>{brokerData.fingerprint.style} · {String(brokerData.fingerprint.bias).replaceAll('_', ' ')}</strong>
                    <small className="text-tertiary">
                      Top-5 concentration {brokerData.fingerprint.concentration == null ? '—' : `${Math.round(brokerData.fingerprint.concentration * 100)}%`}
                      {' · '}repeatability {brokerData.fingerprint.repeatability == null ? '—' : `${Math.round(brokerData.fingerprint.repeatability * 100)}%`}
                    </small>
                  </div>
                )}
              </div>
            </section>
          )}

          {!accumulation.length && !distribution.length ? (
            <EmptyState
              title="No observed rankings"
              message="No accumulation or distribution rows were observed in this window. Absence does not prove no trading activity."
            />
          ) : (
            <div className="bi-workstation">
              <div className="bi-rankings">
                <section className="bi-rank" aria-label={lens === 'stock' ? 'Accumulation ranking' : 'Accumulated stocks'}>
                  <h3 className="bi-rank__title">
                    {lens === 'stock' ? 'Accumulation ranking' : 'Accumulated stocks'}
                  </h3>
                  <div className="bi-rank__list">
                    {accumulation.length === 0 && (
                      <div className="bi-rank__empty text-tertiary">No accumulation rows</div>
                    )}
                    {accumulation.map((row) => {
                      const key = lens === 'stock' ? row.code : row.ticker;
                      return (
                        <RankingRow
                          key={`acc-${key}`}
                          selected={selectedRow && (lens === 'stock' ? selectedRow.code === row.code : selectedRow.ticker === row.ticker)}
                          onSelect={() => setSelectedKey(key)}
                          primary={key}
                          secondary={lens === 'stock' ? (row.sourceType || '—') : row.name}
                          netValue={row.netValue}
                          sideLabel={consistencyLabel(row.consistency)}
                          avgCost={avgCostLabel(row.estimatedAverageCost)}
                        />
                      );
                    })}
                  </div>
                </section>

                <section className="bi-rank" aria-label={lens === 'stock' ? 'Distribution ranking' : 'Distributed stocks'}>
                  <h3 className="bi-rank__title">
                    {lens === 'stock' ? 'Distribution ranking' : 'Distributed stocks'}
                  </h3>
                  <div className="bi-rank__list">
                    {distribution.length === 0 && (
                      <div className="bi-rank__empty text-tertiary">No distribution rows</div>
                    )}
                    {distribution.map((row) => {
                      const key = lens === 'stock' ? row.code : row.ticker;
                      return (
                        <RankingRow
                          key={`dist-${key}`}
                          selected={selectedRow && (lens === 'stock' ? selectedRow.code === row.code : selectedRow.ticker === row.ticker)}
                          onSelect={() => setSelectedKey(key)}
                          primary={key}
                          secondary={lens === 'stock' ? (row.sourceType || '—') : row.name}
                          netValue={row.netValue}
                          sideLabel={consistencyLabel(row.consistency)}
                          avgCost={avgCostLabel(row.estimatedAverageCost)}
                        />
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="bi-inspect">
                <InventoryCurve
                  points={selectedRow?.curve || []}
                  identityLabel={identityLabel}
                />
                <SelectedDetail
                  lens={lens}
                  row={selectedRow ? { ...selectedRow, _days: days } : null}
                />
              </div>
            </div>
          )}

          <Disclosures items={meta?.disclosures} />
        </>
      )}
    </div>
  );
}
