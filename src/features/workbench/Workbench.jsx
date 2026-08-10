import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { analyzeTicker } from '../../lib/api/client.js';
import { guardAnalyze } from '../../lib/api/contracts.js';
import {
  formatPrice, formatPct, formatVolume,
} from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import PriceChart from './PriceChart.jsx';
import TradingViewChart from './TradingViewChart.jsx';
import TechnicalEvidence from './TechnicalEvidence.jsx';
import DynamicLevels from './DynamicLevels.jsx';
import BrokerEvidence from './BrokerEvidence.jsx';
import InvestigationBrief from './InvestigationBrief.jsx';
import RiskSimulator from './RiskSimulator.jsx';

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
        <span className="text-tertiary">Vol {formatVolume(ticker.volume)}</span>
        {ticker.tier && (
          <span className={`badge ${ticker.tier === 'liquid' ? 'badge-positive' : ticker.tier === 'mid' ? 'badge-warning' : 'badge-neutral'}`}>
            {ticker.tier}
          </span>
        )}
      </div>
    </div>
  );
}

function EvidenceSummary({ grade, stance, dataQuality }) {
  const warnings = dataQuality?.warnings || [];
  return (
    <div className="wb-evidence-summary">
      <div><span>Grade</span><strong>{grade?.grade || '—'}</strong></div>
      <div><span>Regime</span><strong>{grade?.regime || 'Unknown'}</strong></div>
      <div><span>Phase</span><strong>{grade?.structurePhase || 'Unknown'}</strong></div>
      <div><span>Lean</span><strong>{stance?.stance ? stance.stance.replace('_', ' ').toLowerCase() : 'neutral'}</strong></div>
      <div><span>Data</span><strong className={warnings.length ? 'text-warning' : 'text-positive'}>{warnings.length ? 'Degraded' : 'Complete'}</strong></div>
      {warnings.map((warning) => <p key={warning} className="text-warning">⚠ {warning}</p>)}
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
          <InvestigationBrief investigation={state.data.investigation} />

          <div className="wb-chart-panel">
            <ChartViewToggle view={chartView} onChange={setChartView} />
            {chartView === 'nalar' ? (
              <PriceChart chart={state.data.chart} />
            ) : (
              <TradingViewChart ticker={activeTicker} />
            )}
          </div>

          <RiskSimulator ticker={state.data.ticker} geometry={state.data.riskGeometry} />

          <details className="inv-ledger">
            <summary>
              <span>04</span>
              <strong>Evidence ledger</strong>
              <small>Full deterministic inputs, geometry, scorecard, and provenance</small>
            </summary>
            <div className="inv-ledger__body">
              <EvidenceSummary grade={state.data.grade} stance={state.data.stance} dataQuality={state.data.dataQuality} />

              <DynamicLevels dynamicLevels={state.data.dynamicLevels} />

              <TechnicalEvidence
                priceHistory={state.data.priceHistory}
                ticker={state.data.ticker}
              />

              <BrokerEvidence broker={state.data.broker} />
            </div>
          </details>
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
