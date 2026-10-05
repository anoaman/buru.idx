import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { analyzeTicker } from '../../lib/api/client.js';
import { guardAnalyze } from '../../lib/api/contracts.js';
import { formatIDR, formatPrice, formatPct, formatVolume } from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import MarketChart from './MarketChart.jsx';
import TechnicalEvidence from './TechnicalEvidence.jsx';
import RiskSimulator from './RiskSimulator.jsx';
import DetailDrawer from './DetailDrawer.jsx';
import { BrokerWindows, Checks, ReadCard } from './StockRead.jsx';
import './StockAnalysis.css';

const MORE_TABS = [
  { id: 'indicators', label: 'Indicators' },
  { id: 'risk', label: 'Risk calculator' },
];

function TickerHeader({ ticker, read, asOf }) {
  if (!ticker) return null;
  const tone = (value) => (value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : '');
  const flags = [...(ticker.notations || []), ...(ticker.uma ? ['UMA'] : [])];
  return (
    <header className="sa-header">
      <h2>{ticker.symbol}</h2>
      <span className="sa-header__name">{ticker.name}</span>
      <span className="sa-header__price">{formatPrice(ticker.close)}<small className={tone(ticker.changePct)}>{formatPct(ticker.changePct)}</small></span>
      <span className="sa-stat">Value <b>{formatIDR(ticker.value, true)}</b></span>
      <span className="sa-stat">Volume <b>{Number.isFinite(ticker.volumeVsBaseline?.ratio) ? `${ticker.volumeVsBaseline.ratio.toFixed(1)}× avg` : formatVolume(ticker.volume)}</b></span>
      <span className="sa-stat">Foreign <b className={tone(ticker.fnet)}>{formatIDR(ticker.fnet, true)}</b></span>
      <span className="sa-tags">
        {flags.map((flag) => <span key={flag} className="sa-tag is-warning">{flag}</span>)}
        {read?.limits && <span className="sa-tag" title="Next session auto-reject prices">ARA {formatPrice(read.limits.ara)} · ARB {formatPrice(read.limits.arb)}</span>}
        {asOf && <span className="sa-tag">{new Date(`${asOf}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
      </span>
    </header>
  );
}

export default function Workbench() {
  const [searchParams] = useSearchParams();
  const tickerParam = (searchParams.get('ticker') || '').trim().toUpperCase();
  // displayed.data always belongs to displayed.ticker — never relabel mid-flight.
  const [displayed, setDisplayed] = useState({ ticker: '', data: null });
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState('');
  const [error, setError] = useState(null);
  const [failedTicker, setFailedTicker] = useState('');
  const requestRef = useRef(0);

  const fetchAnalysis = useCallback((raw) => {
    const ticker = String(raw || '').trim().toUpperCase();
    const requestId = ++requestRef.current;
    if (!/^[A-Z]{4}$/.test(ticker)) {
      setLoading(false);
      setAnalyzing(ticker);
      setFailedTicker(ticker);
      setError('Enter a four-letter ticker (e.g. BBRI)');
      return;
    }
    setLoading(true);
    setAnalyzing(ticker);
    setError(null);
    setFailedTicker('');
    analyzeTicker(ticker).then((response) => {
      if (requestId !== requestRef.current) return;
      const result = guardAnalyze(response);
      if (!result.ok) {
        setLoading(false);
        setAnalyzing('');
        setFailedTicker(ticker);
        setError(result.error);
        return;
      }
      setDisplayed({ ticker, data: result.data });
      setLoading(false);
      setAnalyzing('');
      setError(null);
      setFailedTicker('');
    }).catch((err) => {
      if (requestId !== requestRef.current) return;
      setLoading(false);
      setAnalyzing('');
      setFailedTicker(ticker);
      setError(err.message);
    });
  }, []);

  useEffect(() => {
    if (!tickerParam) {
      requestRef.current += 1;
      setDisplayed({ ticker: '', data: null });
      setLoading(false);
      setAnalyzing('');
      setError(null);
      setFailedTicker('');
      return undefined;
    }
    fetchAnalysis(tickerParam);
    return () => { requestRef.current += 1; };
  }, [tickerParam, fetchAnalysis]);

  const hasDisplayed = Boolean(displayed.data && displayed.ticker);
  const warmLoading = loading && hasDisplayed && analyzing && analyzing !== displayed.ticker;
  const coldLoading = loading && !hasDisplayed;

  const renderMore = (active) => {
    const data = displayed.data;
    if (!data) return null;
    if (active === 'indicators') return <TechnicalEvidence priceHistory={data.priceHistory} ticker={data.ticker} />;
    if (active === 'risk') return <RiskSimulator ticker={data.ticker} />;
    return null;
  };

  return (
    <div className="workbench">
      {coldLoading && <Skeleton label={`Loading ${analyzing}…`} chart />}

      {error && !loading && (
        <ErrorState
          title={failedTicker ? `Analysis failed for ${failedTicker}` : 'Analysis failed'}
          error={error}
          onRetry={() => fetchAnalysis(failedTicker || tickerParam)}
        />
      )}

      {hasDisplayed && (
        <div className={`wb-analysis-frame ${warmLoading ? 'is-stale' : ''}`}>
          {warmLoading && (
            <div className="wb-analysis-frame__overlay" aria-live="polite">
              <div className="ui-progress" aria-hidden="true"><div className="ui-progress__bar" /></div>
              <span className="wb-analysis-frame__chip">Loading {analyzing}…</span>
            </div>
          )}
          <div className="wb-result sa-page" data-displayed-ticker={displayed.ticker}>
            <TickerHeader ticker={displayed.data.ticker} read={displayed.data.read} asOf={displayed.data.chart?.source?.lastDate} />
            {displayed.data.read
              ? <ReadCard read={displayed.data.read} price={displayed.data.ticker?.close} />
              : <p className="sa-muted">The read for this stock is unavailable right now; the chart and indicators below still apply.</p>}
            <div className="wb-chart-panel">
              <MarketChart
                chart={displayed.data.chart}
                outlook={displayed.data.read?.outlook}
                buyerCost={displayed.data.read?.leadBuyer}
                ticker={displayed.data.ticker}
              />
            </div>
            {displayed.data.read && (
              <div className="sa-row">
                <BrokerWindows key={displayed.ticker} brokers={displayed.data.read.brokers} symbol={displayed.data.ticker?.symbol} />
                <Checks checks={displayed.data.read.checks} />
              </div>
            )}
            <details className="sa-more">
              <summary>More: indicators and risk calculator</summary>
              <DetailDrawer
                key={displayed.ticker || 'empty'}
                tabs={MORE_TABS}
                storageKey={displayed.ticker ? `nalar-more:${displayed.ticker}` : null}
              >
                {renderMore}
              </DetailDrawer>
            </details>
          </div>
        </div>
      )}

      {!hasDisplayed && !loading && !error && !tickerParam && (
        <EmptyState
          title="Enter a ticker to analyze"
          message="Use the command bar ticker field (OPEN) to load an IDX symbol’s chart, levels, and broker flow."
        />
      )}
    </div>
  );
}
