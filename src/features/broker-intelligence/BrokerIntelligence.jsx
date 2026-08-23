import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  getStockBrokerIntelligence,
  getBrokerStockIntelligence,
  prefetchStockBrokerIntelligence,
  prefetchBrokerStockIntelligence,
} from '../../lib/api/client.js';
import {
  guardStockBrokerIntelligence,
  guardBrokerStockIntelligence,
} from '../../lib/api/contracts.js';
import { formatDate, formatIDR, formatNumber, formatPrice } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import InventoryCurve from './InventoryCurve.jsx';

const ALLOWED_DAYS = [1, 7, 14, 30, 60];
const RANGE_PRESETS = [['latest', 'Latest'], ['previous', 'Previous'], ['7d', '7D'], ['14d', '14D'], ['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['ytd', 'YTD'], ['custom', 'Custom']];
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


function avgCostLabel(value) {
  return Number.isFinite(value) ? formatPrice(value) : null;
}

// Phase 6: the two default accumulation/distribution panel lists are merged, on the
// frontend only, into one signed net ranking table (no backend/calculation changes).
function SideBadge({ side }) {
  return (
    <span className={side === 'buy' ? 'ui-side-buy' : 'ui-side-sell'}>
      {side === 'buy' ? 'Buy' : 'Sell'}
    </span>
  );
}

function MergedRankRow({ side, row, lens, selected, onSelect }) {
  const primary = lens === 'stock' ? row.code : row.ticker;
  const secondary = lens === 'stock' ? (row.sourceType || '—') : row.name;
  const avgCost = avgCostLabel(row.estimatedAverageCost);
  const netValue = row.netValue;
  const netLots = row.netLots;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <tr
      className={`ui-row bi-merged__row ${selected ? 'is-selected' : ''}`}
      tabIndex={0}
      aria-label={`${primary} ${side === 'buy' ? 'buy' : 'sell'}`}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <td>
        <div className="bi-merged__identity">
          <span className="bi-rank__primary">{primary}</span>
          <span className="bi-rank__secondary text-secondary">{secondary}</span>
        </div>
      </td>
      <td>
        <SideBadge side={side} />
      </td>
      <td className={`tabular ${netValue > 0 ? 'text-positive' : netValue < 0 ? 'text-negative' : 'text-secondary'}`}>
        {signedValue(netValue)}
      </td>
      <td className={`tabular ${netLots > 0 ? 'text-positive' : netLots < 0 ? 'text-negative' : 'text-secondary'}`}>
        {signedLots(netLots)}
      </td>
      <td className="tabular bi-merged__avg text-tertiary">{avgCost || '—'}</td>
    </tr>
  );
}

// Default order: positive net buyers descending, then a quiet group-label row,
// then negative net sellers by absolute net value descending. An empty side
// renders a quiet fallback row instead of breaking the table.
function MergedRankGroup({ side, rows, lens, selectedKey, onSelect, emptyLabel }) {
  const [expanded, setExpanded] = useState(false);
  if (!rows.length) {
    return (
      <tr className="ui-group-row">
        <td colSpan={5} className="text-tertiary">{emptyLabel}</td>
      </tr>
    );
  }
  const label = side === 'buy' ? 'Buyers' : 'Sellers';
  const LIMIT = 10;
  const visible = expanded ? rows : rows.slice(0, LIMIT);
  const hiddenCount = rows.length - visible.length;
  return (
    <>
      <tr className="ui-group-row">
        <td colSpan={5}>{label} · {rows.length}</td>
      </tr>
      {visible.map((row) => {
        const key = lens === 'stock' ? row.code : row.ticker;
        const selectionKey = `${side}:${key}`;
        const isSelected = selectedKey === selectionKey;
        return (
          <MergedRankRow
            key={selectionKey}
            side={side}
            row={row}
            lens={lens}
            selected={isSelected}
            onSelect={() => onSelect(selectionKey)}
          />
        );
      })}
      {hiddenCount > 0 && (
        <tr className="ui-group-row">
          <td colSpan={5}>
            <button type="button" className="bi-show-more" onClick={() => setExpanded(true)}>
              Show {hiddenCount} more
            </button>
          </td>
        </tr>
      )}
      {expanded && rows.length > LIMIT && (
        <tr className="ui-group-row">
          <td colSpan={5}>
            <button type="button" className="bi-show-more" onClick={() => setExpanded(false)}>
              Show less
            </button>
          </td>
        </tr>
      )}
    </>
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
          Open broker view
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
          <span className="text-tertiary">Observed trading days</span>
          <span className="tabular">{formatNumber(row.observedSessions)}</span>
        </div>
        <div>
          <span className="text-tertiary">Accumulation persistence</span>
          <span className="tabular">{row.accumulationSessions == null ? 'Unavailable' : `${formatNumber(row.accumulationSessions)}/${formatNumber(row.requestedSessions ?? row.observedSessions)} sessions`}</span>
        </div>
        <div>
          <span className="text-tertiary">Current streak</span>
          <span className="tabular">{row.accumulationStreak == null ? 'Unavailable' : `${formatNumber(row.accumulationStreak)} sessions`}</span>
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
        Open in Stock Analysis
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
  const presetParam = RANGE_PRESETS.some(([value]) => value === searchParams.get('preset')) ? searchParams.get('preset') : '';
  function formatWindow(from, to) {
  if (!from || !to) return '';
  if (from === to) return formatDate(from);
  return `${formatDate(from)}–${formatDate(to)}`;
}

const preset = presetParam || (date ? '' : days === 1 ? 'latest' : `${days}d`);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') || '') ? searchParams.get('from') : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') || '') ? searchParams.get('to') : '';
  const ticker = (searchParams.get('ticker') || DEFAULT_TICKER).toUpperCase();
  const code = (searchParams.get('code') || '').toUpperCase();

  const [searchInput, setSearchInput] = useState(lens === 'broker' ? code : ticker);
  const [validationError, setValidationError] = useState(null);

  const [lensState, setLensState] = useState({
    loading: true,
    refreshing: false,
    result: null,
    error: null,
  });
  const [selectedKey, setSelectedKey] = useState(null);
  const [lensRetry, setLensRetry] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    setSearchInput(lens === 'broker' ? code : ticker);
    setValidationError(null);
  }, [lens, ticker, code]);

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

    const range = date ? { date } : presetParam === 'custom' ? { from, to } : presetParam ? { preset: presetParam } : {};
    if (preset === 'custom' && (!from || !to)) {
      setLensState({ loading: false, refreshing: false, result: null, error: null });
      return undefined;
    }
    const request = lens === 'stock'
      ? getStockBrokerIntelligence({ ticker, days, ...range })
      : getBrokerStockIntelligence({ code, days, ...range, limit: 25 });

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
  }, [lens, ticker, code, days, date, preset, presetParam, from, to, lensRetry]);

  // Prefetch other windows after first successful identity load
  useEffect(() => {
    if (lensState.loading || lensState.error || !lensState.result || preset !== 'latest') return;
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
  }, [lensState.loading, lensState.error, lensState.result, lens, ticker, code, days, preset]);

  const updateParams = useCallback((next) => {
    const params = new URLSearchParams();
    const nextLens = normalizeLens(next.lens ?? lens);
    const nextDays = normalizeDays(next.days ?? days);
    params.set('lens', nextLens);
    params.set('days', String(nextDays));
    const nextDate = next.date === undefined ? date : next.date;
    if (nextDate) params.set('date', nextDate);
    const nextPreset = next.preset === undefined ? presetParam : next.preset;
    if (nextPreset) params.set('preset', nextPreset);
    const nextFrom = next.from === undefined ? from : next.from;
    const nextTo = next.to === undefined ? to : next.to;
    if (nextPreset === 'custom' && nextFrom) params.set('from', nextFrom);
    if (nextPreset === 'custom' && nextTo) params.set('to', nextTo);
    if (nextLens === 'stock') {
      params.set('ticker', String(next.ticker ?? ticker).toUpperCase());
    } else {
      params.set('code', String(next.code ?? code).toUpperCase());
    }
    setSearchParams(params);
  }, [lens, days, date, presetParam, from, to, ticker, code, setSearchParams]);

  const handleLensChange = (nextLens) => {
    if (nextLens === lens) return;
    if (nextLens === 'broker') {
      updateParams({ lens: 'broker', code: code || 'YP', days });
    } else {
      updateParams({ lens: 'stock', ticker: ticker || DEFAULT_TICKER, days });
    }
  };

  const handlePresetChange = (nextPreset) => updateParams({ preset: nextPreset, date: '', from: '', to: '' });

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

  // Display-only merge: sort buyers by net value descending and sellers by
  // absolute net value descending. No backend/calculation changes.
  const buyers = useMemo(() => (
    [...accumulation].sort((a, b) => {
      const av = Number.isFinite(a?.netValue) ? a.netValue : -Infinity;
      const bv = Number.isFinite(b?.netValue) ? b.netValue : -Infinity;
      return bv - av;
    })
  ), [accumulation]);
  const sellers = useMemo(() => (
    [...distribution].sort((a, b) => {
      const av = Number.isFinite(a?.netValue) ? Math.abs(a.netValue) : -Infinity;
      const bv = Number.isFinite(b?.netValue) ? Math.abs(b.netValue) : -Infinity;
      return bv - av;
    })
  ), [distribution]);

  const mismatched = Boolean(data) && !viewData;
  const showLensLoading = lensState.loading;
  const showRefreshing = lensState.refreshing && !lensState.loading;

  const resolvedSelectedKey = useMemo(() => {
    if (selectedKey) return selectedKey;
    if (buyers[0]) {
      return `buy:${lens === 'stock' ? buyers[0].code : buyers[0].ticker}`;
    }
    if (sellers[0]) {
      return `sell:${lens === 'stock' ? sellers[0].code : sellers[0].ticker}`;
    }
    return null;
  }, [selectedKey, buyers, sellers, lens]);

  const selectedRow = useMemo(() => {
    if (!resolvedSelectedKey) return null;
    const [side, identity] = String(resolvedSelectedKey).split(':');
    const pool = side === 'sell' ? sellers : buyers;
    return pool.find((row) => (
      lens === 'stock' ? row.code === identity : row.ticker === identity
    )) || null;
  }, [buyers, sellers, resolvedSelectedKey, lens]);

  const identityLabel = selectedRow
    ? (lens === 'stock' ? selectedRow.code : selectedRow.ticker)
    : '';

  const searchValid = lens === 'stock'
    ? /^[A-Z]{4}$/i.test(searchInput.trim())
    : /^[A-Z]{2}$/i.test(searchInput.trim());

  const retryLens = () => setLensRetry((n) => n + 1);
  return (
    <div className="bi-page">
      <header className="bi-intro">
        <div>
          <h2 className="bi-intro__title">Broker Flow</h2>
        </div>
      </header>

      <div className="bi-controls">
        <div className="bi-lens" role="group" aria-label="Lens">
          <button
            type="button"
            className={`bi-lens__btn ${lens === 'stock' ? 'is-active' : ''}`}
            aria-pressed={lens === 'stock'}
            onClick={() => handleLensChange('stock')}
          >
            By stock
          </button>
          <button
            type="button"
            className={`bi-lens__btn ${lens === 'broker' ? 'is-active' : ''}`}
            aria-pressed={lens === 'broker'}
            onClick={() => handleLensChange('broker')}
          >
            By broker · Across market
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
          <div className="bi-window__buttons" role="group" aria-label="Broker date range">
            {RANGE_PRESETS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`bi-window__btn ${preset === value ? 'is-active' : ''}`}
                aria-pressed={preset === value}
                onClick={() => handlePresetChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === 'custom' && <div className="wb-broker__custom"><label>From<input type="date" value={from} onChange={(event) => updateParams({ preset: 'custom', from: event.target.value })} /></label><label>To<input type="date" value={to} onChange={(event) => updateParams({ preset: 'custom', to: event.target.value })} /></label></div>}
          {preset === 'custom' && (!from || !to) && <p className="bi-window__note text-warning">Select both dates.</p>}
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
                  {formatWindow(stockData.window.from, stockData.window.to)}
                </span>
                {!stockData.window.complete && <span className="badge badge-warning">Broker data incomplete</span>}
                {(stockData.window.gapSessions > 0 || stockData.window.missingSessions > 0) && (
                  <span className="text-warning">
                    Missing {formatNumber((stockData.window.gapSessions || 0) + (stockData.window.missingSessions || 0))} trading days
                  </span>
                )}
                {meta?.archive?.calendarCoverage?.status === 'degraded' && (
                  <span className="badge badge-warning">Calendar degraded</span>
                )}
              </div>
              <div className="bi-summary__metrics">
                {(stockData.preferredBroker.observedCodes || []).length > 0 && stockData.preferredBroker.share > 0 && (
                  <div className="bi-summary__primary">
                    <span className="text-tertiary">Preferred-broker share</span>
                    <strong className="tabular">{`${(stockData.preferredBroker.share * 100).toFixed(1)}%`}</strong>
                    <small className="text-tertiary">{stockData.preferredBroker.observedCodes.join(', ')}</small>
                  </div>
                )}

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
            </section>
          ) : (
            <section className="bi-summary" aria-label="Broker window summary">
              <div className="bi-summary__line">
                <strong>{brokerData.broker.code}</strong>
                <span className="text-secondary">
                  {(brokerData.broker.sourceTypes || []).join(' / ') || '—'}
                </span>
                <span className="text-tertiary">
                  {formatWindow(brokerData.window.from, brokerData.window.to)}
                </span>
                <span className="text-tertiary">Requested {formatNumber(brokerData.window.days ?? days)} · observed {formatNumber(brokerData.window.tradingSessions)} sessions</span>
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
              <section
                className="bi-rank bi-merged"
                aria-label={lens === 'stock' ? 'Broker net ranking' : 'Stock net ranking'}
              >
                <h3 className="bi-rank__title">
                  {lens === 'stock' ? 'Broker net ranking' : 'Stock net ranking'}
                </h3>
                <div className="bi-merged__scroll">
                  <table className="ui-table ui-table--broker-ranking bi-merged__table">
                    <thead>
                      <tr>
                        <th scope="col">{lens === 'stock' ? 'Broker' : 'Stock'}</th>
                        <th scope="col">Side</th>
                        <th scope="col" className="tabular">Net value</th>
                        <th scope="col" className="tabular">Net lots</th>
                        <th scope="col" className="tabular">Avg price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <MergedRankGroup
                        side="buy"
                        rows={buyers}
                        lens={lens}
                        selectedKey={resolvedSelectedKey}
                        onSelect={setSelectedKey}
                        emptyLabel="No buyers observed"
                      />
                      <MergedRankGroup
                        side="sell"
                        rows={sellers}
                        lens={lens}
                        selectedKey={resolvedSelectedKey}
                        onSelect={setSelectedKey}
                        emptyLabel="No sellers observed"
                      />
                    </tbody>
                  </table>
                </div>
              </section>

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
          {brokerData && <p className="bi-merged__note" role="note">Broker codes aggregate activity from unrelated clients. Persistence is observed flow, not proof of a single bandar, owner, or coordinated position.</p>}
        </>
      )}
    </div>
  );
}
