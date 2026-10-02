import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getRadarScout, getRadarScoutConditions } from '../../lib/api/client.js';
import ScreenerFilters, { DEFAULT_SLOTS, blockingReason, requestFromSlots } from './ScreenerFilters.jsx';
import { guardRadarScout, guardRadarScoutConditions } from '../../lib/api/contracts.js';
import { formatDate } from '../../lib/format/market.js';
import { ResultsTable, StockPanel, sortRows } from './ScreenerResults.jsx';
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

const RANKING_LABEL = { broker: 'broker strength', structure: 'setup quality', blended: 'broker + setup' };

function ScoutProvenance({ data }) {
  return (
    <p className="radar-run">
      <span>{data.coverage.matched} matched</span>
      {data.coverage.returned < data.coverage.matched && <span>Showing {data.coverage.returned}</span>}
      <span>{data.coverage.evaluated} scanned</span>
      <span>Ranked by {RANKING_LABEL[data.ranking]}</span>
      <span>Prices to {formatDate(data.asOf.priceDate)}</span>
      {data.asOf.brokerFrom && (
        <span>Broker {formatDate(data.asOf.brokerFrom)}–{formatDate(data.asOf.brokerTo)} · {data.asOf.brokerSessions} trading days</span>
      )}
    </p>
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
  const [sort, setSort] = useState({ key: 'score', dir: -1 });
  const [showNear, setShowNear] = useState(false);
  const [selected, setSelected] = useState(null);
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
  const onSort = (key) => setSort((current) => ({
    key,
    dir: current.key === key ? -current.dir : key === 'ticker' || key === 'broker' ? 1 : -1,
  }));
  const qualified = useMemo(() => sortRows(state.data?.candidates || [], sort), [state.data, sort]);
  const nearMisses = useMemo(
    () => (showNear ? sortRows((state.data?.nearMisses || []).map((row) => ({ ...row, miss: true })), sort) : []),
    [state.data, sort, showNear],
  );
  const listed = useMemo(() => [...qualified, ...nearMisses], [qualified, nearMisses]);
  const selectedRow = listed.find((row) => row.ticker === selected) || null;
  // A new result set may not contain the open stock; close the panel rather
  // than show evidence from a screen that no longer applies.
  useEffect(() => { if (selected && !selectedRow) setSelected(null); }, [selected, selectedRow]);
  // One listener for the page's lifetime; it reads the current rows and
  // selection through a ref so no keypress lands between re-subscriptions.
  const keyState = useRef({});
  keyState.current = { listed, selected, selectedRow, onInvestigate, handoffActors };
  useEffect(() => {
    const onKey = (event) => {
      const { listed, selected, selectedRow, onInvestigate, handoffActors } = keyState.current;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target.closest?.('input, select, textarea, [role="dialog"]')) return;
      const index = listed.findIndex((row) => row.ticker === selected);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!listed.length) return;
        event.preventDefault();
        const next = event.key === 'ArrowDown' ? Math.min(listed.length - 1, index + 1) : Math.max(0, index - 1);
        setSelected(listed[next].ticker);
      } else if (event.key === 'Escape' && selected) {
        setSelected(null);
      } else if (selectedRow && event.key === 'Enter' && (event.target === document.body || event.target.closest?.('.sr-row'))) {
        event.preventDefault();
        onInvestigate(selectedRow.ticker);
      } else if (selectedRow && (event.key === 'f' || event.key === 'F')) {
        handoffActors(selectedRow.ticker);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (selected) document.querySelector('.sr-row.is-selected')?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  return (
    <div className="scout-view">
      <ScreenerFilters slots={slots} onChange={setSlots} templates={templates.byId} templatesReady={templates.ready} />
      <div className={`sr-layout${selectedRow ? ' has-panel' : ''}`}>
        <section className="scout-results" aria-label="Screening results" aria-busy={state.loading}>
          {blocked && <p className="scout-result-status" role="status">{blocked}</p>}
          {!blocked && state.error && <ErrorState title="Screener unavailable" error={state.error} onRetry={run} />}
          {!blocked && !state.data && state.loading && <Skeleton label="Screening the market…" />}
          {!blocked && state.data && state.loading && (
            <div className="sr-loading" role="status" aria-live="polite">
              <span className="sr-loading__bar" aria-hidden="true" />
              <span className="sr-loading__label"><span className="sr-spinner" aria-hidden="true" />Updating results…</span>
            </div>
          )}
          {!blocked && state.data && <>
            <div className="scout-results-tools">
              <ScoutProvenance data={state.data} />
              {state.data.nearMisses.length > 0 && (
                <label className="sr-toggle">
                  <input type="checkbox" checked={showNear} onChange={(event) => setShowNear(event.target.checked)} />
                  Show near misses ({state.data.nearMisses.length})
                </label>
              )}
            </div>
            {listed.length === 0
              ? <EmptyState title="No stocks pass these filters" message={state.data.nearMisses.length ? 'Loosen a filter, or show the near misses to see which one kept each stock out.' : 'Loosen a filter to widen the screen.'} />
              : <ResultsTable rows={qualified} nearMisses={nearMisses} sort={sort} onSort={onSort} selected={selected} onSelect={setSelected} />}
            <div className="scout-disclosures">{state.data.disclosures.map((item) => <p key={item}>{item}</p>)}</div>
          </>}
        </section>
        {selectedRow && state.data && (
          <StockPanel
            key={selectedRow.ticker}
            row={selectedRow}
            brokerSessions={state.data.asOf.brokerSessions}
            onInvestigate={() => onInvestigate(selectedRow.ticker)}
            onActors={() => handoffActors(selectedRow.ticker)}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
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
