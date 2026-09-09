import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { analyzeTicker, freezeMonitored } from '../../lib/api/client.js';
import { guardAnalyze } from '../../lib/api/contracts.js';
import {
  formatIDR, formatNumber, formatPrice, formatPct, formatVolume,
} from '../../lib/format/market.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import InfoTip from '../../components/InfoTip.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import MarketChart from './MarketChart.jsx';
import TechnicalEvidence from './TechnicalEvidence.jsx';
import BrokerEvidence from './BrokerEvidence.jsx';
import InvestigationBrief from './InvestigationBrief.jsx';
import EvidenceDebate from './EvidenceDebate.jsx';
import RiskSimulator from './RiskSimulator.jsx';
import DetailDrawer from './DetailDrawer.jsx';
import LevelsPanel from './LevelsPanel.jsx';

function TickerHeader({ ticker, priceHistory, onFreeze, freezeState }) {
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
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onFreeze} disabled={freezeState === 'saving' || freezeState === 'saved'}>
          {freezeState === 'saving' ? 'Freezing…' : freezeState === 'saved' ? 'Frozen to Monitored' : 'Freeze to Monitored'}
        </button>
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

/**
 * The verdict and its counter-evidence, side by side, above the fold.
 *
 * This all used to live inside a collapsed <details> labelled "Methodology &
 * data quality", two clicks from the surface, so the screen opened on a price
 * header and a chart and said nothing about what it thought. The grade is the
 * reason this page exists; it belongs where it can be read.
 *
 * Contradictions sit in the same block deliberately. The product's claim is
 * evidence over verdict, and a grade shown alone, with its disagreements folded
 * away somewhere else, quietly makes the opposite claim.
 */
function VerdictPanel({ grade, stance, scorecard, investigation, dataQuality }) {
  const warnings = dataQuality?.warnings || [];
  const factors = scorecard?.factors || [];
  const contradictions = investigation?.contradictions || [];
  const tally = factors.reduce((acc, factor) => {
    if (factor.signal > 0) acc.positive += 1;
    else if (factor.signal < 0) acc.negative += 1;
    else acc.neutral += 1;
    return acc;
  }, { positive: 0, negative: 0, neutral: 0 });

  return (
    <section className="wb-verdict" aria-label="Verdict and counter-evidence">
      <div className="wb-verdict__head">
        <div className="wb-verdict__grade" data-grade={grade?.grade || 'none'}>
          <span>
            Grade
            <InfoTip title="Grade">Weighted broker-flow, momentum, structure and risk score. A ≥82%, B ≥68%, C ≥54%, D ≥40%.</InfoTip>
          </span>
          <strong>{grade?.grade || '—'}</strong>
          <small>not a win probability</small>
        </div>
        <dl className="wb-verdict__reads">
          <div>
            <dt>Regime <InfoTip title="Regime">Trending when MA separation, returns and distance from MA20 produce strength ≥7; otherwise rangebound.</InfoTip></dt>
            <dd>{grade?.regime || 'Unknown'}</dd>
          </div>
          <div>
            <dt>Pattern <InfoTip title="Pattern">Uses the 60-day range, returns, volume trend, and moving-average alignment.</InfoTip></dt>
            <dd>{grade?.structurePhase || 'Unknown'}</dd>
          </div>
          <div>
            <dt>Bias <InfoTip title="Bias">Summarizes whether the current setup leans constructive, defensive, or neutral.</InfoTip></dt>
            <dd>{stance?.stance ? stance.stance.replace('_', ' ').toLowerCase() : 'neutral'}</dd>
          </div>
          <div>
            <dt>Scorecard <InfoTip title="Scorecard">Eight deterministic factors counted as positive, negative or neutral. It is not a win probability.</InfoTip></dt>
            <dd className="wb-verdict__tally">
              <span className="text-positive">{tally.positive} for</span>
              <span className="text-negative">{tally.negative} against</span>
              <span className="text-secondary">{tally.neutral} neutral</span>
            </dd>
          </div>
        </dl>
      </div>

      {factors.length > 0 && (
        <ul className="wb-verdict__factors">
          {factors.map((factor) => (
            <li
              key={factor.factor}
              className={factor.signal > 0 ? 'is-positive' : factor.signal < 0 ? 'is-negative' : 'is-neutral'}
              title={factor.reason}
            >
              <strong>{factor.factor}</strong>
              <span>{factor.signal > 0 ? 'For' : factor.signal < 0 ? 'Against' : 'Neutral'}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="wb-verdict__counter">
        <h3>Contradictions</h3>
        {contradictions.length === 0 ? (
          <p className="text-secondary">No factor disagreed with another on this reading.</p>
        ) : (
          <ul>
            {contradictions.map((item) => (
              <li key={item.code || item.title}>
                <strong>{item.title || item.code}</strong>
                <span className="text-secondary">{(item.evidence || []).join(' · ') || item.detail || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="wb-verdict__warnings">
          {warnings.map((warning) => <p key={warning} className="text-warning">⚠ {warning}</p>)}
        </div>
      )}
    </section>
  );
}

function MethodologyDetail({ grade, scorecard }) {
  const factors = scorecard?.factors || [];
  return (
    <section className="wb-method">
      <div className="wb-method__lenses">
        {Object.values(grade?.lenses || {}).map((lens) => (
          <div key={lens.name}>
            <strong>{lens.name}</strong>
            <span>{Math.round((lens.score || 0) * 100)} score · {Math.round((lens.weight || 0) * 100)}% weight</span>
            <small>{(lens.topReasons || []).join(' · ')}</small>
          </div>
        ))}
      </div>
      <h4>Factor reasoning</h4>
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
    </section>
  );
}

// Contradictions moved up into VerdictPanel, where they sit against the grade
// they argue with. Repeating them here would only make the same disagreement
// look like two separate ones.
function WhatChangedPanel({ data }) {
  return (
    <div className="wb-changed-panel">
      <InvestigationBrief investigation={data?.investigation} />
      <EvidenceDebate debate={data?.debate} stance={data?.stance} />
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
  const [freezeState, setFreezeState] = useState('idle');

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
      setFreezeState('idle');
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

  const freeze = async () => {
    const data = displayed.data;
    if (!data || freezeState === 'saving') return;
    const geometry = data.setupGeometry || data.riskGeometry || {};
    const factors = data.scorecard?.factors || [];
    setFreezeState('saving');
    const result = await freezeMonitored({
      ticker: displayed.ticker,
      thesis: data.stance?.reason || null,
      triggerPrice: geometry.trigger?.price ?? geometry.confirmation?.price ?? geometry.bestSetup?.entry ?? geometry.confirmation ?? null,
      invalidationPrice: geometry.invalidation?.price ?? geometry.bestSetup?.stop ?? null,
      setupType: geometry.scenario || data.grade?.structurePhase || null,
      snapshot: {
        lane: data.ticker?.tier || null,
        score: null,
        dataQuality: data.dataQuality?.status || 'unknown',
        reasons: factors.filter((factor) => factor.signal > 0).map((factor) => factor.reason),
        risks: factors.filter((factor) => factor.signal < 0).map((factor) => factor.reason),
        levels: geometry,
        freshness: { priceDate: data.chart?.source?.lastDate || null },
        verdict: data.grade || null,
        stance: data.stance || null,
        contradictions: data.investigation?.contradictions || [],
      },
    });
    setFreezeState(result?.success === false ? 'error' : 'saved');
  };

  const renderDrawer = (active) => {
    const data = displayed.data;
    if (!data) return null;
    switch (active) {
      case 'setup':
        return <><LevelsPanel data={data} /><WhatChangedPanel data={data} /></>;
      case 'indicators':
        return <TechnicalEvidence priceHistory={data.priceHistory} ticker={data.ticker} />;
      case 'broker':
        return <BrokerEvidence broker={data.broker} />;
      case 'risk':
        return <RiskSimulator ticker={data.ticker} geometry={data.setupGeometry || data.riskGeometry} />;
      default:
        return null;
    }
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
          <div className="wb-result" data-displayed-ticker={displayed.ticker}>
            <TickerHeader ticker={displayed.data.ticker} priceHistory={displayed.data.priceHistory} onFreeze={freeze} freezeState={freezeState} />
            {freezeState === 'error' && <p className="text-warning" role="alert">Could not freeze this setup. It may already be monitored.</p>}
            <VerdictPanel
              grade={displayed.data.grade}
              stance={displayed.data.stance}
              scorecard={displayed.data.scorecard}
              investigation={displayed.data.investigation}
              dataQuality={displayed.data.dataQuality}
            />
            <div className="wb-chart-panel">
              <MarketChart
                chart={displayed.data.chart}
                geometry={displayed.data.setupGeometry || displayed.data.riskGeometry}
                ticker={displayed.data.ticker}
              />
            </div>
            <DetailDrawer
              key={displayed.ticker || 'empty'}
              storageKey={displayed.ticker ? `nalar-drawer:${displayed.ticker}` : null}
            >
              {renderDrawer}
            </DetailDrawer>
            <details className="wb-methodology">
              <summary>How this score was calculated</summary>
              <MethodologyDetail grade={displayed.data.grade} scorecard={displayed.data.scorecard} />
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
