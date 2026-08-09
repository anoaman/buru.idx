import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { analyzeTicker } from '../../lib/api/client.js';
import { guardAnalyze } from '../../lib/api/contracts.js';
import {
  formatPrice, formatPct, formatVolume, formatNumber,
  gradeColor,
} from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import InfoTip from '../../components/InfoTip.jsx';
import PriceChart from './PriceChart.jsx';
import TradingViewChart from './TradingViewChart.jsx';
import TechnicalEvidence from './TechnicalEvidence.jsx';
import TradeGeometry from './TradeGeometry.jsx';
import BrokerEvidence from './BrokerEvidence.jsx';
import EvidenceDebate from './EvidenceDebate.jsx';

function TickerHeader({ ticker }) {
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
        <span className="text-tertiary">O {formatPrice(ticker.open)}</span>
        <span className="text-tertiary">H {formatPrice(ticker.high)}</span>
        <span className="text-tertiary">L {formatPrice(ticker.low)}</span>
        <span className="text-tertiary">Vol {formatVolume(ticker.volume)}</span>
        <span className="text-tertiary">Freq {formatNumber(ticker.frequency)}</span>
        <span className="text-tertiary">VWAP {formatPrice(ticker.vwap)}</span>
      </div>
      <div className="wb-header__badges">
        {ticker.tier && (
          <span className={`badge ${ticker.tier === 'liquid' ? 'badge-positive' : ticker.tier === 'mid' ? 'badge-warning' : 'badge-neutral'}`}>
            {ticker.tier}
          </span>
        )}
      </div>
    </div>
  );
}

function stanceLabel(stance) {
  if (stance === 'LONG_LEAN') return 'Constructive lean';
  if (stance === 'SHORT_LEAN') return 'Defensive lean';
  return 'Neutral / mixed';
}

function GradeBlock({ grade, stance, dataQuality }) {
  if (!grade) return null;
  const warnings = dataQuality?.warnings || [];
  return (
    <section className="wb-grade" aria-labelledby="decision-summary-title">
      <div className="wb-grade__eyebrow" id="decision-summary-title">Decision summary</div>
      <div className="wb-grade__main">
        <div className="wb-grade__grade">
          <span className="wb-grade__label">Evidence grade <InfoTip title="Evidence grade">Four lenses each score 0–1: Bandar Flow (top-5 concentration + preferred-broker share + foreign flow), Momentum (MA stack, volume vs baseline, RSI14, 20-day return), Structure (range position, volume trend, 60-day return) and Risk (net R:R, stop distance in ATR, cost drag, notations). They are weighted by regime — trending 0.34 momentum / 0.28 bandar / 0.20 structure / 0.18 risk, rangebound 0.36 bandar / 0.24 structure / 0.22 momentum / 0.18 risk — then cut into letters at 0.82 A, 0.68 B, 0.54 C, 0.40 D, below that F. Not a recommendation or a calibrated success probability.</InfoTip></span>
          <span className="wb-grade__letter" style={{ color: gradeColor(grade.grade) }}>{grade.grade}</span>
        </div>
        <div className="wb-grade__metric">
          <span className="wb-grade__label">Evidence alignment <InfoTip title="Evidence alignment">0.38 + min(regime strength, 12) / 28 + (1 − lens spread) × 0.28, capped at 0.95. Lens spread is the gap between the highest and lowest of the four lens scores, so a high reading means the lenses agree and the regime is decisive. It measures agreement among inputs, not win probability.</InfoTip></span>
          <span className="wb-grade__metric-value">
            {Number.isFinite(grade.confidence) ? `${Math.round(grade.confidence * 100)}%` : '—'}
          </span>
          <span className="wb-grade__metric-note">Agreement between model inputs, not win probability</span>
        </div>
        <div className="wb-grade__metric">
          <span className="wb-grade__label">Market structure <InfoTip title="Market structure">Regime = trending when MA20/MA50 spread as % of price × 1.8, plus |20-day return| + |60-day return| / 2, plus |distance from MA20| × 0.5 reaches 7; otherwise rangebound. Phase reads the 60-session range, where position is (last − low) / (high − low) and volume trend is the last 10 sessions over the 60-session average: markup at ≥12% return, position ≥0.72 and an aligned up stack; markdown at ≤−12%, position ≤0.28 and an aligned down stack; accumulation below 0.40 with volume ≥1.05x and return above −8%; distribution above 0.60 with volume ≥1.02x and return under 8%; otherwise rangebound.</InfoTip></span>
          <span className="wb-grade__metric-value wb-grade__metric-value--text">{grade.regime || 'Unknown'}</span>
          <span className="wb-grade__metric-note">{grade.structurePhase || 'Phase unavailable'}</span>
        </div>
        <div className="wb-grade__metric">
          <span className="wb-grade__label">Data quality <InfoTip title="Data quality">Two checks on the price history the levels are built from. It reads Degraded when daily history is unavailable, or when the 60-session high / low ratio reaches 3, which means the range is dislocated enough that distant support and resistance were dropped rather than trusted. Complete means neither fired. This is about input integrity only, not about the setup.</InfoTip></span>
          <span className={`wb-grade__metric-value wb-grade__metric-value--text ${warnings.length ? 'text-warning' : 'text-positive'}`}>
            {warnings.length ? 'Degraded' : 'Complete'}
          </span>
          <span className="wb-grade__metric-note">Delayed / end-of-day inputs</span>
        </div>
      </div>
      {stance && (
        <div className="wb-grade__stance">
          <span className={`badge ${stance.stance === 'LONG_LEAN' ? 'badge-positive' : stance.stance === 'SHORT_LEAN' ? 'badge-negative' : 'badge-neutral'}`}>
            {stanceLabel(stance.stance)}
          </span>
          <span className="wb-grade__reason text-secondary">{stance.reason}</span>
        </div>
      )}
      <p className="wb-grade__disclaimer">Decision support only. A grade summarizes current evidence; it is not a recommendation or calibrated success probability.</p>
    </section>
  );
}

function ScorecardTable({ scorecard }) {
  if (!scorecard) return null;
  const factors = scorecard.factors || [];
  const summary = scorecard.summary || {};
  return (
    <div className="wb-scorecard">
      <h3 className="wb-section__title text-tertiary">Scorecard <InfoTip title="Scorecard">Eight components, each reduced to the sign of one measurement rather than a weight: broker concentration (sign of top-5 net value), preferred-broker share (above or below the 25% even-split baseline), foreign flow (sign of 20-session net), trend / MA stack (aligned up or down), volume vs baseline (≥1x paired with the direction of the price move), risk geometry (Bull at net R:R ≥1.5), book pressure (Bull ≥60% bid frequency, Bear ≤40%, and only counted for third-liners), and notations / UMA (Bear if any flag is present). The leaning is a raw count of Bull against Bear, so it says how many things point which way, not outcome probabilities.</InfoTip></h3>
      <div className="wb-scorecard__factors">
        {factors.map((f, i) => (
          <div key={i} className="wb-scorecard__factor">
            <span className="wb-scorecard__factor-name text-secondary">{f.factor}</span>
            <span className={`wb-scorecard__factor-signal ${f.signal > 0 ? 'text-positive' : f.signal < 0 ? 'text-negative' : 'text-secondary'}`}>
              {f.signal > 0 ? 'Bull' : f.signal < 0 ? 'Bear' : 'Neutral'}
            </span>
            <span className="wb-scorecard__factor-reason text-tertiary">{f.reason}</span>
          </div>
        ))}
      </div>
      {summary.leaning && (
        <div className="wb-scorecard__summary">
          <span className="text-tertiary">Lean:</span>
          <span className={`tabular ${summary.leaning === 'bullish' ? 'text-positive' : summary.leaning === 'bearish' ? 'text-negative' : 'text-secondary'}`}>
            {summary.leaning}
          </span>
          <span className="text-tertiary">
            {summary.bullish ?? 0}B · {summary.bearish ?? 0}S · {summary.neutral ?? 0}N
          </span>
        </div>
      )}
    </div>
  );
}

function ChartViewToggle({ view, onChange }) {
  return (
    <div className="wb-chart-toggle" role="group" aria-label="Chart view">
      <button
        type="button"
        className={`wb-chart-toggle__btn${view === 'nalar' ? ' is-active' : ''}`}
        aria-pressed={view === 'nalar'}
        onClick={() => onChange('nalar')}
      >
        NALAR Analysis
      </button>
      <button
        type="button"
        className={`wb-chart-toggle__btn${view === 'tradingview' ? ' is-active' : ''}`}
        aria-pressed={view === 'tradingview'}
        onClick={() => onChange('tradingview')}
      >
        TradingView
      </button>
    </div>
  );
}

export default function Workbench() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tickerParam = searchParams.get('ticker') || '';
  const [query, setQuery] = useState(tickerParam);
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const [chartView, setChartView] = useState('nalar');

  const fetchAnalysis = (ticker) => {
    if (!ticker || !/^[A-Z]{4}$/i.test(ticker)) {
      setState({ loading: false, data: null, error: 'Enter a four-letter ticker (e.g. BBRI)' });
      return;
    }
    setState({ loading: true, data: null, error: null });
    analyzeTicker(ticker.toUpperCase()).then((raw) => {
      const result = guardAnalyze(raw);
      if (!result.ok) {
        setState({ loading: false, data: null, error: result.error });
        return;
      }
      setState({ loading: false, data: result.data, error: null });
    }).catch((err) => {
      setState({ loading: false, data: null, error: err.message });
    });
  };

  useEffect(() => {
    if (tickerParam) {
      setQuery(tickerParam);
      fetchAnalysis(tickerParam);
    }
  }, [tickerParam]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = query.trim().toUpperCase();
    if (clean) {
      setSearchParams({ ticker: clean });
    }
  };

  const activeTicker = state.data?.ticker?.symbol || query.toUpperCase();

  return (
    <div className="workbench">
      <form className="wb-search" onSubmit={handleSubmit}>
        <input
          className="wb-search__input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter ticker (e.g. BBRI)"
          maxLength={4}
        />
        <button className="wb-search__btn" type="submit">Analyze</button>
      </form>

      {state.loading && (
        <div className="wb-loading text-tertiary">Analyzing {query.toUpperCase()}…</div>
      )}

      {state.error && !state.loading && (
        <ErrorState title="Analysis failed" error={state.error} onRetry={() => fetchAnalysis(query)} />
      )}

      {state.data && !state.loading && (
        <div className="wb-result">
          <TickerHeader ticker={state.data.ticker} />
          <div className="wb-actions">
            <span className="wb-actions__disclosure">
              Delayed decision-support view. No watchlist, order entry, or trade-plan actions are available here.
            </span>
          </div>
          <GradeBlock grade={state.data.grade} stance={state.data.stance} dataQuality={state.data.dataQuality} />

          <TradeGeometry geometry={state.data.riskGeometry} />

          <EvidenceDebate debate={state.data.debate} stance={state.data.stance} />

          <div className="wb-chart-panel">
            <ChartViewToggle view={chartView} onChange={setChartView} />
            {chartView === 'nalar' ? (
              <PriceChart chart={state.data.chart} />
            ) : (
              <TradingViewChart ticker={activeTicker} />
            )}
          </div>

          <TechnicalEvidence
            priceHistory={state.data.priceHistory}
            ticker={state.data.ticker}
          />

          <ScorecardTable scorecard={state.data.scorecard} />

          <BrokerEvidence broker={state.data.broker} />

          {state.data.dataQuality && (
            <div className="wb-quality">
              <h3 className="wb-section__title text-tertiary">Data Quality</h3>
              <div className="wb-quality__items">
                {state.data.dataQuality.sources && (
                  <span className="text-secondary">Sources: {state.data.dataQuality.sources.join(', ')}</span>
                )}
                {state.data.dataQuality.warnings?.map((w, i) => (
                  <span key={i} className="text-warning">⚠ {w}</span>
                ))}
              </div>
            </div>
          )}
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
