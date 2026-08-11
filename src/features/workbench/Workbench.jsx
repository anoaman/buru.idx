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
import BrokerEvidence from './BrokerEvidence.jsx';
import InvestigationBrief from './InvestigationBrief.jsx';
import EvidenceDebate from './EvidenceDebate.jsx';
import RiskSimulator from './RiskSimulator.jsx';
import DetailDrawer from './DetailDrawer.jsx';
import LevelsPanel from './LevelsPanel.jsx';

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
        <div><span>Pattern <InfoTip title="Pattern">Uses the 60-day range, returns, volume trend, and moving-average alignment.</InfoTip></span><strong>{grade?.structurePhase || 'Unknown'}</strong></div>
        <div><span>Bias <InfoTip title="Bias">Summarizes whether the current setup leans constructive, defensive, or neutral.</InfoTip></span><strong>{stance?.stance ? stance.stance.replace('_', ' ').toLowerCase() : 'neutral'}</strong></div>
        {warnings.length > 0 && <div><span>Data warning</span><strong className="text-warning">Check data</strong></div>}
        {warnings.map((warning) => <p key={warning} className="text-warning">⚠ {warning}</p>)}
      </div>
      <details className="wb-method__details">
        <summary>How this score was calculated</summary>
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

function AnalysisSkeleton({ label }) {
  return (
    <div className="ui-skeleton" role="status" aria-live="polite">
      <p className="ui-skeleton__status">{label}</p>
      <div className="ui-skeleton__block ui-skeleton__block--lg" />
      <div className="ui-skeleton__block ui-skeleton__block--chart" />
      <div className="ui-skeleton__block" />
      <div className="ui-skeleton__block" />
    </div>
  );
}

function CompactGrade({ grade, stance }) {
  return (
    <div className="wb-evidence-summary" aria-label="Score summary">
      <div><span>Grade</span><strong>{grade?.grade || '—'}</strong></div>
      <div><span>Regime</span><strong>{grade?.regime || 'Unknown'}</strong></div>
      <div><span>Pattern</span><strong>{grade?.structurePhase || 'Unknown'}</strong></div>
      <div><span>Bias</span><strong>{stance?.stance ? stance.stance.replace('_', ' ').toLowerCase() : 'neutral'}</strong></div>
    </div>
  );
}

function WhatChangedPanel({ data }) {
  const contradictions = data?.investigation?.contradictions || [];
  return (
    <div className="wb-changed-panel">
      <InvestigationBrief investigation={data?.investigation} />
      <EvidenceDebate debate={data?.debate} stance={data?.stance} />
      {contradictions.length > 0 && (
        <section className="wb-contradictions" aria-label="Investigation contradictions">
          <h3 className="wb-section__title text-tertiary">Contradictions</h3>
          <ul>
            {contradictions.map((item) => (
              <li key={item.code || item.title}>
                <strong>{item.title || item.code}</strong>
                <p className="text-secondary">{(item.evidence || []).join(' · ') || item.detail || ''}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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

  const renderDrawer = (active) => {
    const data = displayed.data;
    if (!data) return null;
    switch (active) {
      case 'levels':
        return <LevelsPanel data={data} />;
      case 'indicators':
        return (
          <>
            <CompactGrade grade={data.grade} stance={data.stance} />
            <TechnicalEvidence
              priceHistory={data.priceHistory}
              ticker={data.ticker}
              supportResistance={data.supportResistance}
              riskGeometry={data.riskGeometry}
            />
          </>
        );
      case 'broker':
        return <BrokerEvidence broker={data.broker} />;
      case 'changed':
        return <WhatChangedPanel data={data} />;
      case 'risk':
        return <RiskSimulator ticker={data.ticker} geometry={data.riskGeometry} />;
      case 'methodology':
        return (
          <EvidenceSummary
            grade={data.grade}
            stance={data.stance}
            scorecard={data.scorecard}
            dataQuality={data.dataQuality}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="workbench">
      {coldLoading && <AnalysisSkeleton label={`Loading ${analyzing}…`} />}

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
          <div className="wb-result" data-displayed-ticker={displayed.ticker}>
            <TickerHeader ticker={displayed.data.ticker} priceHistory={displayed.data.priceHistory} />
            <div className="wb-chart-panel">
              <MarketChart
                chart={displayed.data.chart}
                geometry={displayed.data.riskGeometry}
                ticker={displayed.data.ticker}
              />
            </div>
            <DetailDrawer storageKey={displayed.ticker ? `nalar-drawer:${displayed.ticker}` : null}>
              {renderDrawer}
            </DetailDrawer>
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
