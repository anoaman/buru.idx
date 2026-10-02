import { useEffect, useState } from 'react';
import { analyzeTicker } from '../../lib/api/client.js';
import { formatIDR, formatPct, formatPrice, formatRatio } from '../../lib/format/market.js';
import { rupiah } from './ScreenerFilters.jsx';

const focusOf = (row) => row.broker?.focus || row.broker?.lead || null;
const shareOf = (row) => row.broker?.focusSharePct ?? row.broker?.leadSharePct ?? null;
const buyDaysOf = (row) => {
  const focus = focusOf(row);
  return focus && row.broker.expectedSessions ? focus.buySessions / row.broker.expectedSessions : null;
};

// Sort keys read straight off the row so a header click never needs a lookup table.
export const COLUMNS = [
  { key: 'trend', label: '30D', align: 'left', sortable: false, narrow: true },
  { key: 'ticker', label: 'Ticker', align: 'left', value: (row) => row.ticker },
  { key: 'price', label: 'Price', value: (row) => row.price.lastPrice },
  { key: 'change', label: '1D', value: (row) => row.price.changePct },
  { key: 'liquidity', label: 'Value/day', value: (row) => row.price.averageValue, wide: true },
  { key: 'broker', label: 'Broker', value: (row) => focusOf(row)?.code ?? null, wide: true },
  { key: 'netBuy', label: 'Net buy', value: (row) => focusOf(row)?.netValue ?? null },
  { key: 'share', label: 'Share', value: shareOf, wide: true },
  { key: 'buyDays', label: 'Buy days', value: buyDaysOf, wide: true },
  { key: 'support', label: 'From support', value: (row) => row.price.distanceFromSupportPct, wide: true },
  { key: 'range', label: 'Range', value: (row) => row.price.consolidationRangePct, wide: true },
  { key: 'score', label: 'Score', value: (row) => row.score },
];

export function sortRows(rows, { key, dir }) {
  const column = COLUMNS.find((item) => item.key === key && item.value) || COLUMNS.at(-1);
  return [...rows].sort((a, b) => {
    const left = column.value(a);
    const right = column.value(b);
    if (left == null && right == null) return a.ticker.localeCompare(b.ticker);
    if (left == null) return 1;
    if (right == null) return -1;
    const order = typeof left === 'string' ? left.localeCompare(right) : left - right;
    return order * dir || a.ticker.localeCompare(b.ticker);
  });
}

// Condition thresholds are read in the same units the filter was typed in, so a
// gap has to be rendered the same way the input was.
function formatConditionValue(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'IDR') return `Rp${rupiah(value)}`;
  if (unit === '%') return `${Number(value.toFixed(2))}%`;
  if (unit === 'x') return `${Number(value.toFixed(2))}×`;
  return String(Number(value.toFixed(2)));
}

/**
 * Missing the liquidity floor by 3% and by 92% are different stocks, and only
 * one of them is worth opening, so a near miss always carries its margin.
 */
export function MissedCondition({ detail, fallback }) {
  if (!detail) return <span className="scout-near-miss__missed">Missed: {fallback || 'unspecified condition'}</span>;
  if (!detail.available) {
    return <span className="scout-near-miss__missed">Missed <strong>{detail.label}</strong> · no evidence available</span>;
  }
  if (!Number.isFinite(detail.gap)) {
    return <span className="scout-near-miss__missed">Missed <strong>{detail.label}</strong></span>;
  }
  const gapText = Number.isFinite(detail.gapPct)
    ? `off by ${formatConditionValue(detail.gap, detail.unit)} (${detail.gapPct}%)`
    : `off by ${formatConditionValue(detail.gap, detail.unit)}`;
  // Within 15% of the threshold the stock is a tuning decision, not a rejection.
  const near = Number.isFinite(detail.gapPct) && detail.gapPct <= 15;
  return (
    <span className={`scout-near-miss__missed${near ? ' scout-near-miss__missed--close' : ''}`}>
      Missed <strong>{detail.label}</strong> · {formatConditionValue(detail.observed, detail.unit)} vs {formatConditionValue(detail.expected, detail.unit)} · {gapText}
    </span>
  );
}

function ScoreCell({ score }) {
  if (!Number.isFinite(score)) return '—';
  return (
    <span className="sr-score">
      <i aria-hidden="true"><s style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></i>
      {score.toFixed(0)}
    </span>
  );
}

function Sparkline({ closes }) {
  if (closes.length < 2) return <span className="sr-spark is-empty" aria-hidden="true" />;
  const low = Math.min(...closes);
  const span = Math.max(...closes) - low || 1;
  const points = closes.map((value, index) => `${((index / (closes.length - 1)) * 72).toFixed(1)},${(20 - ((value - low) / span) * 18).toFixed(1)}`).join(' ');
  return (
    <svg className={`sr-spark ${closes.at(-1) >= closes[0] ? 'is-up' : 'is-down'}`} viewBox="0 0 72 22" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

const changeTone = (value) => (value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : '');

function ResultRow({ row, selected, onSelect }) {
  const focus = focusOf(row);
  const buyDays = focus && row.broker.expectedSessions ? `${focus.buySessions}/${row.broker.expectedSessions}` : '—';
  return (
    <tr
      className={`sr-row${row.miss ? ' is-miss' : ''}${selected ? ' is-selected' : ''}`}
      aria-selected={selected}
      onClick={() => onSelect(selected ? null : row.ticker)}
    >
      <td className="sr-trend"><Sparkline closes={row.price.recentCloses || []} /></td>
      <td className="sr-ticker">
        <button type="button" aria-label={`Show ${row.ticker} details`} onClick={(event) => { event.stopPropagation(); onSelect(selected ? null : row.ticker); }}>
          {row.ticker}
        </button>
        {row.isFca && <small className="sr-tag">FCA</small>}
        {row.miss
          ? <MissedCondition detail={row.failedDetail} fallback={row.failedCondition} />
          : <span>{row.name}</span>}
      </td>
      <td><strong>{formatPrice(row.price.lastPrice)}</strong></td>
      <td className={changeTone(row.price.changePct)}>{formatPct(row.price.changePct)}</td>
      <td className="sr-wide">{formatIDR(row.price.averageValue, true)}</td>
      <td className="sr-wide"><strong>{focus?.code || '—'}</strong></td>
      <td className={focus?.netValue > 0 ? 'is-positive' : ''}>{focus ? formatIDR(focus.netValue, true) : '—'}</td>
      <td className="sr-wide">{formatPct(shareOf(row), 0, false)}</td>
      <td className="sr-wide">{buyDays}</td>
      <td className="sr-wide">{formatPct(row.price.distanceFromSupportPct)}</td>
      <td className="sr-wide">{formatPct(row.price.consolidationRangePct, 1, false)}</td>
      <td><ScoreCell score={row.score} /></td>
    </tr>
  );
}

export function ResultsTable({ rows, nearMisses, sort, onSort, selected, onSelect }) {
  const header = (column) => {
    if (column.sortable === false) return <th key={column.key} className="sr-left sr-trend"><span>{column.label}</span></th>;
    const active = sort.key === column.key;
    return (
      <th
        key={column.key}
        className={`${column.align === 'left' ? 'sr-left' : ''}${column.wide ? ' sr-wide' : ''}`}
        aria-sort={active ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" onClick={() => onSort(column.key)}>
          {column.label}{active ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    );
  };
  return (
    <div className="ui-table-wrap sr-wrap">
      <table className="sr-table" aria-label="Scout candidates">
        <thead><tr>{COLUMNS.map(header)}</tr></thead>
        <tbody>
          {rows.map((row) => <ResultRow key={row.ticker} row={row} selected={selected === row.ticker} onSelect={onSelect} />)}
          {nearMisses.length > 0 && (
            <tr className="sr-divider"><td colSpan={COLUMNS.length}>Near misses · failed exactly one filter</td></tr>
          )}
          {nearMisses.map((row) => <ResultRow key={`miss-${row.ticker}`} row={row} selected={selected === row.ticker} onSelect={onSelect} />)}
        </tbody>
      </table>
    </div>
  );
}

const closeCache = new Map();

/** Last 30 closes: shipped with the screen, or fetched once per ticker from older APIs. */
function useRecentCloses(ticker, shipped) {
  const [state, setState] = useState({ ticker: null, closes: null });
  const hasShipped = shipped?.length > 1;
  useEffect(() => {
    if (!ticker || hasShipped) return undefined;
    if (closeCache.has(ticker)) {
      setState({ ticker, closes: closeCache.get(ticker) });
      return undefined;
    }
    let active = true;
    setState({ ticker, closes: null });
    analyzeTicker(ticker).then((raw) => {
      const candles = raw?.data?.chart?.candles;
      const closes = Array.isArray(candles) ? candles.slice(-30).map((item) => Number(item.close)).filter(Number.isFinite) : [];
      closeCache.set(ticker, closes);
      if (active) setState({ ticker, closes });
    }).catch(() => { if (active) setState({ ticker, closes: [] }); });
    return () => { active = false; };
  }, [ticker, hasShipped]);
  if (hasShipped) return shipped;
  return state.ticker === ticker ? state.closes : null;
}

function PriceLine({ closes, support }) {
  if (closes == null) return <div className="sr-chart is-loading" aria-label="Loading price history" />;
  if (closes.length < 2) return <div className="sr-chart"><p>Price history unavailable.</p></div>;
  const width = 360;
  const height = 110;
  const low = Math.min(...closes, Number.isFinite(support) ? support : Infinity);
  const high = Math.max(...closes);
  const span = high - low || 1;
  const y = (value) => (height - 4 - ((value - low) / span) * (height - 8)).toFixed(1);
  const points = closes.map((value, index) => `${((index / (closes.length - 1)) * width).toFixed(1)},${y(value)}`).join(' ');
  const rising = closes.at(-1) >= closes[0];
  return (
    <svg className="sr-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Last ${closes.length} closes`}>
      {Number.isFinite(support) && <line className="sr-chart__support" x1="0" x2={width} y1={y(support)} y2={y(support)} />}
      <polyline className={rising ? 'is-up' : 'is-down'} points={points} />
    </svg>
  );
}

function breakdownLabel(key) {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function StockPanel({ row, brokerSessions, onInvestigate, onActors, onClose }) {
  const closes = useRecentCloses(row.ticker, row.price.recentCloses);
  const brokers = row.broker?.brokers || [];
  const largest = Math.max(1, ...brokers.map((item) => Math.abs(item.netValue || 0)));
  const breakdown = Object.entries(row.scoreBreakdown || {});
  const focus = focusOf(row);
  return (
    <aside className="sr-panel" aria-label={`${row.ticker} details`}>
      <header>
        <div>
          <h3>{row.ticker}</h3>
          <span>{row.name}{row.board ? ` · ${row.board}` : ''}{row.isFca ? ' · FCA' : ''}</span>
        </div>
        <button type="button" className="sr-close" aria-label="Close details" onClick={onClose}>×</button>
      </header>
      <p className="sr-price">
        {formatPrice(row.price.lastPrice)}
        {Number.isFinite(row.price.changePct) && <small className={changeTone(row.price.changePct)}>{formatPct(row.price.changePct)}</small>}
      </p>
      <PriceLine closes={closes} support={row.price.support} />
      <p className="sr-caption">
        {closes?.length ? `${closes.length} sessions` : '30 sessions'}
        {Number.isFinite(row.price.support) ? ` · dashed line = support Rp${formatPrice(row.price.support)} (${row.price.supportTouches} touches)` : ''}
      </p>
      {row.miss && <p className="sr-miss-note"><MissedCondition detail={row.failedDetail} fallback={row.failedCondition} /></p>}

      {brokers.length > 0 && <>
        <h4>Broker net · {brokerSessions} days</h4>
        <div className="sr-brokers">
          {brokers.slice(0, 6).map((item) => (
            <div key={item.code} className={item.code === focus?.code ? 'is-focus' : ''}>
              <strong>{item.code}</strong>
              <span><i className={item.netValue < 0 ? 'is-negative' : ''} style={{ width: `${(Math.abs(item.netValue || 0) / largest) * 100}%` }} /></span>
              <em className={item.netValue < 0 ? 'is-negative' : 'is-positive'}>{formatIDR(item.netValue, true)}</em>
              <small>{item.buySessions}/{row.broker.expectedSessions}d</small>
            </div>
          ))}
        </div>
        {focus && row.broker.lead?.code === focus.code && Number.isFinite(row.broker.leadToSecondRatio) && (
          <p className="sr-caption">{focus.code} bought {formatRatio(row.broker.leadToSecondRatio)} the next broker.</p>
        )}
      </>}

      <h4>Why it’s here</h4>
      {row.reasons.length ? row.reasons.map((reason) => <p key={reason}>{reason}</p>) : <p>No reasons recorded.</p>}
      {row.risks.length > 0 && <>
        <h4>Check manually</h4>
        {row.risks.map((risk) => <p key={risk} className="is-risk">{risk}</p>)}
      </>}
      {breakdown.length > 0 && <>
        <h4>Score breakdown</h4>
        <div className="radar-detail__chips" aria-label="Score breakdown">
          {breakdown.map(([key, value]) => (
            <span key={key}>{breakdownLabel(key)} <strong>{Number.isFinite(value) ? value.toFixed(0) : '—'}</strong></span>
          ))}
        </div>
      </>}

      <div className="sr-actions">
        <button type="button" className="ui-btn ui-btn--primary" aria-label={`Open ${row.ticker} analysis`} onClick={onInvestigate}>Open analysis ↗</button>
        <button type="button" className="ui-btn" aria-label={`Open ${row.ticker} broker flow`} onClick={onActors}>Broker flow ↗</button>
      </div>
      <p className="sr-keys"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> analysis · <kbd>F</kbd> flow · <kbd>Esc</kbd> close</p>
    </aside>
  );
}
