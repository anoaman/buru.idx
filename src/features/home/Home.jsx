import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getMarketOverview, getRadarScout } from '../../lib/api/client.js';
import { formatDate } from '../../lib/format/number.js';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import IndexChart from './IndexChart.jsx';
import Panel from './Panel.jsx';
import { composeMarketRead, idr, pct } from './marketRead.js';
import './Home.css';

// Today's accumulation: liquid names where a single broker bought at least Rp1B
// in the latest session, no price cap, ranked by how much the lead broker bought.
const BANDAR_REQUEST = {
  conditions: [{ id: 'min_average_value', value: 500_000_000 }, { id: 'broker_accumulation', value: true }],
  useBroker: true, useSupport: false, useSideways: false,
  brokerPreset: 'latest', minBrokerAccumulation: 1_000_000_000, limit: 60,
};
// Paired panels show the same number of equal-height rows so they line up.
const LIST_ROWS = 8;
const MOVER_ROWS = 12;
const OVERVIEW_RETRY_MS = [1_500, 3_000];
const MOVER_TABS = [['mostActive', 'Most active'], ['gainers', 'Gainers'], ['losers', 'Losers']];

const tone = (value) => (value > 0 ? 'is-up' : value < 0 ? 'is-down' : '');
const stockLink = (code) => `/workbench?ticker=${encodeURIComponent(code)}`;
const flowLink = (code) => `/broker-intelligence?preset=latest&lens=stock&ticker=${encodeURIComponent(code)}`;

function Change({ value, digits = 2 }) {
  return <span className={`home-num ${tone(value)}`}>{Number.isFinite(value) ? pct(value, digits) : '—'}</span>;
}

function Tape({ ihsg, indices }) {
  return (
    <div className="home-tape" aria-label="Indices">
      {ihsg && (
        <div className="home-tape__lead">
          <span>IHSG</span>
          <strong>{ihsg.close.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
          <span className="home-tape__meta"><Change value={ihsg.changePct} /> · {idr(ihsg.value)} · {(ihsg.frequency / 1e6).toFixed(2)}M trades</span>
        </div>
      )}
      {indices.map((item) => (
        <div key={item.symbol} className="home-tape__item">
          <span>{item.name}</span>
          <b>{item.close?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</b>
          <Change value={item.changePct} />
        </div>
      ))}
    </div>
  );
}

function SplitBar({ label, up, down, flat, format = (value) => value, flatLabel = 'flat' }) {
  const total = up + down + flat || 1;
  return (
    <div className="home-split">
      <div className="home-split__label"><span>{label}</span><span>{format(up)} up · {format(down)} down · {format(flat)} {flatLabel}</span></div>
      <div className="home-split__bar" role="img" aria-label={`${label}: ${Math.round(up / total * 100)}% up, ${Math.round(down / total * 100)}% down`}>
        <i className="is-up" style={{ width: `${up / total * 100}%` }} />
        <i className="is-flat" style={{ width: `${flat / total * 100}%` }} />
        <i className="is-down" style={{ width: `${down / total * 100}%` }} />
      </div>
    </div>
  );
}

function LimitList({ title, items, count, sign }) {
  return (
    <div className="home-limit">
      <div className="home-limit__head"><span>{title}</span><strong className={sign}>{count}</strong></div>
      <ol>
        {items.slice(0, 3).map((item) => (
          <li key={item.code}><Link to={stockLink(item.code)}>{item.code}</Link><Change value={item.changePct} /></li>
        ))}
        {!items.length && <li className="home-empty">None</li>}
        {count > 3 && <li className="home-empty">+{count - 3} more</li>}
      </ol>
    </div>
  );
}

// How concentrated the session was, from numbers already on the page.
export function sessionShape({ home, ihsg, foreignFlow, movers }) {
  const total = home?.valueBreadth?.total;
  const top10 = (movers?.mostActive || []).slice(0, 10).reduce((sum, row) => sum + (row.value || 0), 0);
  return {
    top10SharePct: total > 0 && top10 > 0 ? top10 / total * 100 : null,
    foreignParticipationPct: ihsg?.value > 0 && foreignFlow?.buy >= 0 && foreignFlow?.sell >= 0
      ? (foreignFlow.buy + foreignFlow.sell) / (2 * ihsg.value) * 100 : null,
  };
}

function Breadth({ breadth, home, shape }) {
  const value = home?.valueBreadth;
  const limits = home?.limits;
  // Untraded stocks (suspended, or no matched orders) are not "unchanged".
  const untraded = value?.untradedCount;
  const unchanged = Number.isFinite(value?.unchangedTradedCount) ? value.unchangedTradedCount : breadth?.unchanged;
  return (
    <Panel title="Breadth" note="all listed stocks">
      {breadth?.available
        ? <SplitBar label="By count" up={breadth.advanced} down={breadth.declined} flat={unchanged} flatLabel="unchanged" />
        : <p className="home-empty">Breadth is unavailable for this session.</p>}
      {value?.total > 0 && (
        <SplitBar label="By value" up={value.advancingValue} down={value.decliningValue} flat={value.unchangedValue} format={idr} flatLabel="unch." />
      )}
      {shape && (
        <dl className="home-shape">
          <div><dt>Top 10 names</dt><dd>{Number.isFinite(shape.top10SharePct) ? `${Math.round(shape.top10SharePct)}%` : '—'}</dd><small>of value traded</small></div>
          <div><dt>Foreign</dt><dd>{Number.isFinite(shape.foreignParticipationPct) ? `${Math.round(shape.foreignParticipationPct)}%` : '—'}</dd><small>of turnover</small></div>
        </dl>
      )}
      {limits && (
        <div className="home-limits">
          <LimitList title="Closed at ARA" items={limits.ara} count={limits.araCount} sign="is-up" />
          <LimitList title="Closed at ARB" items={limits.arb} count={limits.arbCount} sign="is-down" />
        </div>
      )}
      <p className="home-foot">
        {Number.isFinite(untraded) && untraded > 0 && <>{untraded} stocks did not trade and are left out of the counts. </>}
        {limits?.excludedFca > 0 && <>ARA/ARB uses each stock&apos;s limit from its previous close and excludes {limits.excludedFca} FCA counter{limits.excludedFca === 1 ? '' : 's'}.</>}
      </p>
    </Panel>
  );
}

function FlowList({ title, rows, sign }) {
  return (
    <div className="home-flow__side">
      <h4>{title}</h4>
      <ol>
        {rows.map((row) => (
          <li key={row.code}>
            <Link to={stockLink(row.code)}>{row.code}</Link>
            <span className={`home-num ${sign}`}>{idr(row.net)}</span>
            <Change value={row.changePct} />
          </li>
        ))}
        {!rows.length && <li className="home-empty">None</li>}
      </ol>
    </div>
  );
}

function ForeignFlow({ flow, marketFlow }) {
  if (!flow) return <Panel title="Foreign flow"><p className="home-empty">Foreign flow is unavailable for this session.</p></Panel>;
  const net = Number.isFinite(marketFlow?.net) ? marketFlow.net : flow.net;
  return (
    <Panel title="Foreign flow" note={`net ${net >= 0 ? 'buy' : 'sell'} ${idr(net)}`}>
      <div className="home-flow">
        <FlowList title={`Inflow · ${flow.inflowNames} names`} rows={flow.inflow} sign="is-up" />
        <FlowList title={`Outflow · ${flow.outflowNames} names`} rows={flow.outflow} sign="is-down" />
      </div>
      {Number.isFinite(flow.topInflowSharePct) && (
        <p className="home-foot">Top five inflow names were {Math.round(flow.topInflowSharePct)}% of all foreign net buying; top five outflow names {Math.round(flow.topOutflowSharePct ?? 0)}% of net selling.</p>
      )}
    </Panel>
  );
}

function TodaysAccumulation({ state }) {
  return (
    <Panel title="Today's accumulation" note="lead broker net buy ≥ Rp1B · latest session">
      {state.status === 'loading' && <Skeleton label="Reading broker flow" />}
      {state.status === 'error' && <p className="home-empty">Broker flow is unavailable right now.</p>}
      {state.status === 'ready' && (
        state.rows.length ? (
          <table className="home-table">
            <thead><tr><th>Stock</th><th>Lead</th><th className="num">Net buy</th><th className="num">Share</th><th className="num">1D</th></tr></thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.ticker}>
                  <td><Link to={flowLink(row.ticker)}>{row.ticker}</Link>{row.isFca && <em className="home-tag">FCA</em>}</td>
                  <td className="home-broker">{row.broker.lead.code}</td>
                  <td className="num is-up">{idr(row.broker.lead.netValue)}</td>
                  <td className="num">{Number.isFinite(row.broker.leadSharePct) ? `${Math.round(row.broker.leadSharePct)}%` : '—'}</td>
                  <td className="num"><Change value={row.price?.changePct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="home-empty">No broker bought Rp1B or more of a liquid name in the latest session.</p>
      )}
      <p className="home-foot">Share is the lead broker&apos;s part of all net buying in that stock. <Link to="/radar">Open in Screener</Link></p>
    </Panel>
  );
}

function heat(value) {
  if (!Number.isFinite(value)) return undefined;
  const strength = Math.min(1, Math.abs(value) / 6);
  return { '--heat': `${Math.round(strength * 38)}%` };
}

function SectorRotation({ trends }) {
  const rows = useMemo(() => [...(trends?.sectors || [])]
    .sort((a, b) => (b.vsIhsg?.d5 ?? -Infinity) - (a.vsIhsg?.d5 ?? -Infinity)), [trends]);
  if (!rows.length) return <Panel title="Sector rotation"><p className="home-empty">Sector history is unavailable.</p></Panel>;
  const cell = (value) => (
    <td className={`num home-heat ${tone(value)}`} style={heat(value)}>{Number.isFinite(value) ? pct(value, 1) : '—'}</td>
  );
  return (
    <Panel title="Sector rotation" note="IDX sector indices · ranked by 5-session lead over IHSG">
      <table className="home-table home-table--sectors">
        <thead><tr><th>Sector</th><th className="num">1D</th><th className="num">5D</th><th className="num">20D</th><th className="num">5D vs IHSG</th><th className="num">20D vs IHSG</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol}>
              <td>{row.name}</td>
              {cell(row.returns.d1)}{cell(row.returns.d5)}{cell(row.returns.d20)}{cell(row.vsIhsg.d5)}{cell(row.vsIhsg.d20)}
            </tr>
          ))}
          <tr className="home-table__benchmark">
            <td>IHSG</td>{cell(trends.ihsg.d1)}{cell(trends.ihsg.d5)}{cell(trends.ihsg.d20)}<td /><td />
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

function Movers({ movers }) {
  const [tab, setTab] = useState('mostActive');
  const rows = (movers?.[tab] || []).slice(0, MOVER_ROWS);
  const tabs = (
    <div className="home-tabs" role="tablist" aria-label="Movers">
      {MOVER_TABS.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
      ))}
    </div>
  );
  return (
    <Panel title="Movers" actions={tabs} className="home-movers">
      <table className="home-table" role="tabpanel">
        <thead><tr><th>Stock</th><th className="num">Price</th><th className="num">1D</th><th className="num">Value</th><th className="num">Foreign net</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <td title={row.name}><Link to={stockLink(row.code)}>{row.code}</Link></td>
              <td className="num">{row.price?.toLocaleString('en-US')}</td>
              <td className="num"><Change value={row.changePct} /></td>
              <td className="num">{idr(row.value)}</td>
              <td className={`num ${tone(row.fnet)}`}>{Number.isFinite(row.fnet) && row.fnet !== 0 ? `${row.fnet < 0 ? '−' : '+'}${idr(row.fnet)}` : '—'}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="home-empty">Nothing here this session.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}

export default function Home() {
  const [overview, setOverview] = useState({ status: 'loading' });
  const [bandar, setBandar] = useState({ status: 'loading', rows: [] });

  // Right after an API restart the overview is not cached yet and the health
  // lane can briefly answer 503. Retry quietly before showing an error.
  const load = useCallback((isCancelled = () => false) => {
    setOverview({ status: 'loading' });
    const attempt = (n) => getMarketOverview()
      .then((response) => {
        if (!response?.data) throw new Error('Market overview is unavailable right now.');
        if (!isCancelled()) setOverview({ status: 'ready', data: response.data, meta: response.meta || {} });
      })
      .catch((error) => {
        if (isCancelled()) return;
        if (n < OVERVIEW_RETRY_MS.length) setTimeout(() => { if (!isCancelled()) attempt(n + 1); }, OVERVIEW_RETRY_MS[n]);
        else setOverview({ status: 'error', error: error.message });
      });
    attempt(0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    getRadarScout(BANDAR_REQUEST)
      .then((response) => {
        if (cancelled) return;
        const rows = (response?.data?.candidates || [])
          .filter((row) => row.broker?.lead?.netValue > 0)
          .sort((a, b) => b.broker.lead.netValue - a.broker.lead.netValue)
          .slice(0, LIST_ROWS);
        setBandar({ status: 'ready', rows });
      })
      .catch(() => { if (!cancelled) setBandar({ status: 'error', rows: [] }); });
    return () => { cancelled = true; };
  }, []);

  const data = overview.data;
  const read = useMemo(() => composeMarketRead(data), [data]);
  const sessionDate = data?.home?.snapshotDate || data?.session?.date;

  return (
    <section className="home-page" aria-labelledby="home-title">
      <header className="module-heading home-heading">
        <h2 id="home-title">Market</h2>
        {sessionDate && <span>Session {formatDate(sessionDate)} · delayed end-of-day</span>}
      </header>

      {overview.status === 'loading' && <Skeleton label="Reading the market" chart />}
      {overview.status === 'error' && <ErrorState title="Market overview is unavailable" error={overview.error} onRetry={() => load()} />}

      {overview.status === 'ready' && (
        <>
          {overview.meta?.freshness === 'stale' && (
            <p className="home-stale">This market data is more than one session old. Numbers below may not reflect the latest close.</p>
          )}
          <div className="home-read" data-testid="market-read">
            {read.length ? read.map((line) => <p key={line}>{line}</p>) : <p>The market read is unavailable for this session.</p>}
          </div>
          <Tape ihsg={data.ihsg} indices={data.indices || []} />
          <div className="home-grid home-grid--top">
            <IndexChart bars={data.home?.ihsgChart} />
            <Breadth breadth={data.breadth} home={data.home} shape={sessionShape({ ...data })} />
          </div>
          <div className="home-grid">
            <ForeignFlow flow={data.home?.foreign} marketFlow={data.foreignFlow} />
            <TodaysAccumulation state={bandar} />
          </div>
          <div className="home-grid">
            <SectorRotation trends={data.home?.trends} />
            <Movers movers={data.movers} />
          </div>
        </>
      )}
    </section>
  );
}
