import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { analyzeTicker } from '../../lib/api/client.js';
import { guardAnalyze } from '../../lib/api/contracts.js';
import {
  formatIDR, formatNumber, formatPrice, formatPct, formatVolume,
} from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import InfoTip from '../../components/InfoTip.jsx';
import MarketChart from './MarketChart.jsx';
import TechnicalEvidence from './TechnicalEvidence.jsx';
import DynamicLevels from './DynamicLevels.jsx';
import BrokerEvidence from './BrokerEvidence.jsx';
import InvestigationBrief from './InvestigationBrief.jsx';
import RiskSimulator from './RiskSimulator.jsx';

function TickerHeader({ ticker, priceHistory }) {
  if (!ticker) return null;
  const changeColor = ticker.changePct > 0 ? 'text-positive' : ticker.changePct < 0 ? 'text-negative' : 'text-secondary';
  return (
    <div className="wb-header">
      <div className="wb-header__main">
        <h2 className="wb-header__symbol">{ticker.symbol}</h2>
        <span className="wb-header__name text-secondary">{ticker.name}</span>
      </div>
      <div className="wb-header__price">
        <span className="wb-header__close tabular">{formatPrice(ticker.close)}</span>
        <span className={`wb-header__change tabular ${changeColor}`}>
          {formatPct(ticker.changePct)} · {formatPrice(ticker.change)}
        </span>
      </div>
      <div className="wb-header__meta">
        {ticker.tier && (
          <span className={`badge ${ticker.tier === 'liquid' ? 'badge-positive' : ticker.tier === 'mid' ? 'badge-warning' : 'badge-neutral'}`}>
            {ticker.tier}
          </span>
        )}
      </div>
      <div className="wb-overview-grid">
        <div><span>Open / High / Low</span><strong>{formatPrice(ticker.open)} / {formatPrice(ticker.high)} / {formatPrice(ticker.low)}</strong></div>
        <div><span>VWAP</span><strong>{formatPrice(ticker.vwap)}</strong></div>
        <div><span>Traded value</span><strong>{formatIDR(ticker.value)}</strong></div>
        <div><span>Volume</span><strong>{formatVolume(ticker.volume)} · {ticker.volumeVsBaseline?.ratio?.toFixed(2) || '—'}x base</strong></div>
        <div><span>Frequency</span><strong>{formatNumber(ticker.frequency)}</strong></div>
        <div><span>Foreign net</span><strong className={ticker.fnet > 0 ? 'text-positive' : ticker.fnet < 0 ? 'text-negative' : ''}>{formatIDR(ticker.fnet)}</strong></div>
        <div><span>RSI14 / ATR14</span><strong>{priceHistory?.rsi14?.toFixed(1) || '—'} / {formatPct(priceHistory?.atr14Pct)}</strong></div>
        <div><span>Returns 5 / 20 / 60</span><strong>{formatPct(priceHistory?.ret5d)} / {formatPct(priceHistory?.ret20d)} / {formatPct(priceHistory?.ret60d)}</strong></div>
      </div>
      {(ticker.notations?.length > 0 || ticker.uma) && <div className="wb-overview-flags text-warning">{[...(ticker.notations || []), ...(ticker.uma ? ['UMA'] : [])].join(' · ')}</div>}
    </div>
  );
}

function EvidenceSummary({ grade, stance, scorecard, dataQuality }) {
  const warnings = dataQuality?.warnings || [];
  const factors = scorecard?.factors || [];
  return (
    <section className="wb-method">
      <div className="wb-evidence-summary">
        <div><span>Grade <InfoTip title="Grade">Weighted broker-flow, momentum, structure and risk score. A ≥82%, B ≥68%, C ≥54%, D ≥40%.</InfoTip></span><strong>{grade?.grade || '—'}</strong></div>
        <div><span>Regime <InfoTip title="Regime">Trending when MA separation, returns and distance from MA20 produce strength ≥7; otherwise rangebound.</InfoTip></span><strong>{grade?.regime || 'Unknown'}</strong></div>
        <div><span>Phase <InfoTip title="Phase">Uses 60-session range position, return, volume trend and MA alignment.</InfoTip></span><strong>{grade?.structurePhase || 'Unknown'}</strong></div>
        <div><span>Lean <InfoTip title="Lean">Constructive needs bullish edge ≥2, grade A/B and net R:R ≥1.2. Defensive needs bearish edge ≥2 or bearish evidence with grade D/F.</InfoTip></span><strong>{stance?.stance ? stance.stance.replace('_', ' ').toLowerCase() : 'neutral'}</strong></div>
        <div><span>Data <InfoTip title="Data quality">Complete means daily history passed availability and range-dislocation checks.</InfoTip></span><strong className={warnings.length ? 'text-warning' : 'text-positive'}>{warnings.length ? 'Degraded' : 'Complete'}</strong></div>
        {warnings.map((warning) => <p key={warning} className="text-warning">⚠ {warning}</p>)}
      </div>
      <details className="wb-method__details">
        <summary>Full methodology</summary>
        <div className="wb-method__lenses">
          {Object.values(grade?.lenses || {}).map((lens) => (
            <div key={lens.name}>
              <strong>{lens.name}</strong>
              <span>{Math.round((lens.score || 0) * 100)} score · {Math.round((lens.weight || 0) * 100)}% weight</span>
              <small>{(lens.topReasons || []).join(' · ')}</small>
            </div>
          ))}
        </div>
        <h4>Scorecard <InfoTip title="Scorecard">Eight deterministic factors counted as positive, negative or neutral. It is not a win probability.</InfoTip></h4>
        <div className="wb-method__factors">
          {factors.map((factor) => (
            <div key={factor.factor}>
              <span>{factor.factor}</span>
              <strong className={factor.signal > 0 ? 'text-positive' : factor.signal < 0 ? 'text-negative' : 'text-secondary'}>
                {factor.signal > 0 ? 'Positive' : factor.signal < 0 ? 'Negative' : 'Neutral'}
              </strong>
              <small>{factor.reason}</small>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

export default function Workbench() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tickerParam = searchParams.get('ticker') || '';
  const [query, setQuery] = useState(tickerParam);
  // `analyzing` is the ticker this state actually describes. The search box is
  // free text and can move on while a request is still open, so nothing on
  // screen may be labelled from `query`.
  const [state, setState] = useState({ loading: false, analyzing: '', data: null, error: null });
  // Monotonic request id. A response is only allowed to write state while it is
  // still the newest request, so a slow analysis cannot replace a newer ticker.
  const requestRef = useRef(0);

  const fetchAnalysis = useCallback((raw) => {
    const ticker = String(raw || '').trim().toUpperCase();
    const requestId = ++requestRef.current;
    if (!/^[A-Z]{4}$/.test(ticker)) {
      setState({ loading: false, analyzing: ticker, data: null, error: 'Enter a four-letter ticker (e.g. BBRI)' });
      return;
    }
    setState({ loading: true, analyzing: ticker, data: null, error: null });
    analyzeTicker(ticker).then((response) => {
      if (requestId !== requestRef.current) return;
      const result = guardAnalyze(response);
      if (!result.ok) {
        setState({ loading: false, analyzing: ticker, data: null, error: result.error });
        return;
      }
      setState({ loading: false, analyzing: ticker, data: result.data, error: null });
    }).catch((err) => {
      if (requestId !== requestRef.current) return;
      setState({ loading: false, analyzing: ticker, data: null, error: err.message });
    });
  }, []);

  useEffect(() => {
    if (!tickerParam) {
      // Leaving the ticker behind must also drop its result; otherwise the
      // previous analysis keeps rendering under an empty investigation.
      requestRef.current += 1;
      setQuery('');
      setState((current) => (current.loading || current.data || current.error
        ? { loading: false, analyzing: '', data: null, error: null }
        : current));
      return undefined;
    }
    setQuery(tickerParam);
    fetchAnalysis(tickerParam);
    return () => { requestRef.current += 1; };
  }, [tickerParam, fetchAnalysis]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = query.trim().toUpperCase();
    if (clean) {
      setSearchParams({ ticker: clean });
    }
  };

  return (
    <div className="workbench">
      <form className="wb-search" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="wb-ticker-input">IDX ticker</label>
        <input
          id="wb-ticker-input"
          className="wb-search__input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter ticker (e.g. BBRI)"
          maxLength={4}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="wb-search__btn" type="submit">Analyze</button>
      </form>

      {state.loading && (
        <div className="wb-loading text-tertiary" aria-live="polite">Analyzing {state.analyzing}…</div>
      )}

      {state.error && !state.loading && (
        <ErrorState
          title={state.analyzing ? `Analysis failed for ${state.analyzing}` : 'Analysis failed'}
          error={state.error}
          onRetry={() => fetchAnalysis(state.analyzing || tickerParam)}
        />
      )}

      {state.data && !state.loading && (
        <div className="wb-result">
          <TickerHeader ticker={state.data.ticker} priceHistory={state.data.priceHistory} />
          <div className="wb-chart-panel">
            <MarketChart chart={state.data.chart} geometry={state.data.riskGeometry} ticker={state.data.ticker} />
          </div>

          <RiskSimulator ticker={state.data.ticker} geometry={state.data.riskGeometry} />

          <details className="inv-ledger">
            <summary>
              <span>04</span>
              <strong>Evidence ledger</strong>
              <small>Full deterministic inputs, geometry, scorecard, and provenance</small>
            </summary>
            <div className="inv-ledger__body">
              <EvidenceSummary grade={state.data.grade} stance={state.data.stance} scorecard={state.data.scorecard} dataQuality={state.data.dataQuality} />

              <DynamicLevels dynamicLevels={state.data.dynamicLevels} />

              <TechnicalEvidence
                priceHistory={state.data.priceHistory}
                ticker={state.data.ticker}
                supportResistance={state.data.supportResistance}
                riskGeometry={state.data.riskGeometry}
              />

              <BrokerEvidence broker={state.data.broker} />
            </div>
          </details>

          <InvestigationBrief investigation={state.data.investigation} />
        </div>
      )}

      {!state.data && !state.loading && !state.error && !tickerParam && (
        <EmptyState
          title="Enter a ticker to analyze"
          message="Type a four-letter IDX symbol above to load the full evidence, grade, and trade geometry."
        />
      )}
    </div>
  );
}
