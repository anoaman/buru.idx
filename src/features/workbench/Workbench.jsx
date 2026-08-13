import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { analyzeTicker, privateWritesEnabled } from '../../lib/api/client.js';
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
import CaseCapturePanel from '../cases/CaseCapturePanel.jsx';
import {
  LABELS,
  framingLabel,
  leanLabel,
  priceLevelCaption,
  setupTypeLabel,
} from '../../lib/copy/terms.js';

function TickerHeader({ ticker, priceHistory, storyIntelligence }) {
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
      {(ticker.notations?.length > 0 || ticker.uma || ticker.suspension) && (
        <div className="wb-overview-flags text-warning">
          {[...(ticker.notations || []), ...(ticker.uma ? ['UMA'] : []), ...(ticker.suspension ? ['SUSPENDED'] : [])].join(' · ')}
        </div>
      )}
      {(ticker.regulatoryNotices || []).length > 0 && (
        <div className="wb-regulatory-notices" aria-label="Official IDX notices">
          {(ticker.regulatoryNotices || []).map((notice) => (
            <a key={notice.sourceRef} href={notice.sourceUrl} target="_blank" rel="noopener noreferrer">
              <strong>{notice.noticeType.toUpperCase()}</strong>
              <span>{notice.title}</span>
              <small>{notice.noticeDate} · Official IDX source ↗</small>
            </a>
          ))}
        </div>
      )}
      {(storyIntelligence?.events || []).length > 0 && (
        <div className="wb-regulatory-notices" aria-label="Official IDX disclosures">
          {storyIntelligence.events.slice(0, 6).map((event) => (
            <a key={event.sourceRef || event.eventId} href={event.sourceUrl} target="_blank" rel="noopener noreferrer">
              <strong>{event.categoryLabel || event.category}</strong>
              <span>{event.title}</span>
              <small>{event.effectiveDate || event.publishedAt} · Official IDX source ↗</small>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceSummary({ grade, stance, scorecard, dataQuality }) {
  const warnings = dataQuality?.warnings || [];
  const factors = scorecard?.factors || [];
  return (
    <section className="wb-method">
      <div className="wb-evidence-summary">
        <div><span>{LABELS.grade} <InfoTip title={LABELS.grade}>Weighted broker-flow, momentum, structure and risk score. A ≥82%, B ≥68%, C ≥54%, D ≥40%. It is not a win probability.</InfoTip></span><strong>{grade?.grade || '—'}</strong></div>
        <div><span>{LABELS.priceTrend} <InfoTip title={LABELS.priceTrend}>Trending when moving-average separation, returns and distance from MA20 produce strength ≥7; otherwise range-bound. This is not IHSG.</InfoTip></span><strong>{grade?.regime || 'Unknown'}</strong></div>
        <div><span>{LABELS.lean} <InfoTip title={LABELS.lean}>Whether the evidence leans constructive, defensive, or mixed. Not a buy or sell call.</InfoTip></span><strong>{leanLabel(stance?.stance)}</strong></div>
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
      <details className="wb-method__details">
        <summary>Platform thresholds & analytical boundaries</summary>
        <div className="wb-method__lenses">
          <div><strong>Screener windows</strong><span>Structure is longer than behavior</span><small>Broker and compression windows may not exceed their support window. All windows end on the displayed as-of date.</small></div>
          <div><strong>Broker persistence</strong><span>Full: ≥10 observed sessions and ≥80% complete</span><small>Five to nine sessions is labeled early read. Below five, only raw totals are shown.</small></div>
          <div><strong>Window cost</strong><span>Shown only at ≥10 sessions and ≥90% completeness</span><small>It starts at zero on the selected window's first date. It is not holdings or confirmed cost basis.</small></div>
          <div><strong>Inventory curve</strong><span>Early curve: ≥5 sessions · full interpretation: ≥10</span><small>Gaps and the selected anchor can materially change the curve.</small></div>
          <div><strong>Deliberate exclusions</strong><span>No indicator pile-up</span><small>No Ichimoku, Fibonacci suite, candlestick oracle, volume-profile approximation, or single bandar score without evidence that supports the claim.</small></div>
        </div>
      </details>
    </section>
  );
}

function SetupOverview({ scenario, geometry, question }) {
  const setup = geometry || scenario?.geometry;
  if (!scenario && !setup) return null;
  const framing = setup?.framing || 'unavailable';
  const longSetup = framing === 'long_setup';
  const clearsPrice = longSetup ? setup?.confirmation?.price ?? setup?.trigger?.price : null;
  const failsPrice = setup?.invalidation?.price ?? setup?.defensiveExit?.price;
  const upsidePrice = longSetup ? setup?.target?.price : null;
  return (
    <section className="wb-setup-overview" aria-label="Setup overview">
      {question?.title && <p className="wb-setup-overview__question">{question.title}</p>}
      <div className="wb-overview-grid">
        <div>
          <span>{LABELS.setupType}</span>
          <strong>{setupTypeLabel(scenario?.scenario)}</strong>
          <small className="text-tertiary">
            {setup?.labels?.summary || `${framingLabel(framing)} · ${scenario?.fitScore || 0}% evidence fit`}
          </small>
        </div>
        <div>
          <span>{priceLevelCaption(framing, { longLabel: LABELS.clearsAbove, defensiveLabel: LABELS.longEntry })}</span>
          <strong className="tabular">{formatPrice(clearsPrice)}</strong>
          <small className="text-tertiary">{setup?.labels?.confirmation || setup?.unavailableReason || 'No fabricated last-close entry'}</small>
        </div>
        <div>
          <span>{priceLevelCaption(framing, { longLabel: LABELS.failsBelow, defensiveLabel: LABELS.damageIfLost })}</span>
          <strong className="tabular">{formatPrice(failsPrice)}</strong>
          <small className="text-tertiary">{setup?.labels?.invalidation || (longSetup ? 'Daily close through this price ends the setup' : 'Unavailable')}</small>
        </div>
        <div>
          <span>{LABELS.upsideTo}</span>
          <strong className={`tabular ${upsidePrice != null ? 'text-positive' : ''}`}>{formatPrice(upsidePrice)}</strong>
          <small className={upsidePrice != null ? 'text-positive' : 'text-tertiary'}>
            {setup?.labels?.target || (upsidePrice != null ? 'Geometry aim, not a forecast' : 'No long upside')}
          </small>
        </div>
      </div>
    </section>
  );
}

function CompactGrade({ grade, stance }) {
  return (
    <div className="wb-evidence-summary" aria-label="Score summary">
      <div><span>{LABELS.grade}</span><strong>{grade?.grade || '—'}</strong></div>
      <div><span>{LABELS.priceTrend}</span><strong>{grade?.regime || 'Unknown'}</strong></div>
      <div><span>{LABELS.lean}</span><strong>{leanLabel(stance?.stance)}</strong></div>
    </div>
  );
}

function WhatChangedPanel({ data }) {
  const contradictions = data?.investigation?.contradictions || [];
  const health = data?.storyIntelligence?.health;
  return (
    <div className="wb-changed-panel">
      {health?.warnings?.length > 0 && (
        <p className="wb-story-health text-warning" role="status">
          Official disclosures: {health.freshness || 'unknown'}
          {health.lastRun?.error ? ` · ${health.lastRun.error}` : ''}
          {health.counts?.unmapped ? ` · ${health.counts.unmapped} unmapped issuers` : ''}
        </p>
      )}
      {data?.groundedSynthesis?.available && (
        <section className="wb-grounded" aria-label="Grounded evidence narrative">
          <h3 className="wb-section__title text-tertiary">Evidence narrative</h3>
          <ul>
            {(data.groundedSynthesis.evidenceNarrative || []).map((row) => (
              <li key={row.text}>
                <p>{row.text}</p>
                <small>{(row.refs || []).join(' · ')}</small>
              </li>
            ))}
          </ul>
          {(data.groundedSynthesis.changeBrief || []).length > 0 && (
            <>
              <h3 className="wb-section__title text-tertiary">Change brief</h3>
              <ul>
                {data.groundedSynthesis.changeBrief.map((row) => (
                  <li key={row.text}>
                    <p>{row.text}</p>
                    <small>{(row.refs || []).join(' · ')}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="wb-grounded__limit">{(data.groundedSynthesis.limitations || [])[0]}</p>
        </section>
      )}
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
  const [capturingCase, setCapturingCase] = useState(false);
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
      setCapturingCase(false);
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
        return <RiskSimulator ticker={data.ticker} geometry={data.riskGeometry} scenarioGeometry={data.scenarioGeometry} atr14Pct={data.priceHistory?.atr14Pct} />;
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
            <TickerHeader
              ticker={displayed.data.ticker}
              priceHistory={displayed.data.priceHistory}
              storyIntelligence={displayed.data.storyIntelligence}
            />
            <SetupOverview
              scenario={displayed.data.scenario}
              geometry={displayed.data.scenarioGeometry}
              question={displayed.data.investigation?.question}
            />
            {privateWritesEnabled && (
              <div className="wb-case-action">
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  aria-expanded={capturingCase}
                  onClick={() => setCapturingCase((value) => !value)}
                >
                  {capturingCase ? 'Cancel save' : 'Save setup'}
                </button>
              </div>
            )}
            {capturingCase && (
              <CaseCapturePanel
                ticker={displayed.ticker}
                source="Stock Analysis"
                snapshot={{
                  dataAsOf: displayed.data.chart?.source?.lastDate || null,
                  capitalTier: displayed.data.capitalTier || null,
                  tradingProfile: displayed.data.ticker?.tier || null,
                  isFca: displayed.data.ticker?.isFca === true,
                  board: displayed.data.ticker?.board || null,
                  score: Number.isFinite(displayed.data.grade?.score)
                    ? displayed.data.grade.score * 100
                    : null,
                  dataQuality: displayed.data.dataQuality,
                  reasons: (displayed.data.debate?.bull || []).map(
                    (item) => item?.reason || item?.factor || String(item),
                  ),
                  risks: (displayed.data.debate?.bear || []).map(
                    (item) => item?.reason || item?.factor || String(item),
                  ),
                  contradictions: displayed.data.investigation?.contradictions || [],
                  levels: displayed.data.riskGeometry || {},
                  brokerSummary: displayed.data.broker || {},
                  scenario: displayed.data.scenario?.scenario || null,
                  scenarioFitScore: displayed.data.scenario?.fitScore ?? null,
                  structureState: displayed.data.scenario || displayed.data.grade || {},
                  scenarioGeometry: displayed.data.scenarioGeometry || null,
                }}
                defaults={{
                  confirmation: displayed.data.scenarioGeometry?.labels?.confirmation
                    || (displayed.data.scenarioGeometry?.framing === 'long_setup'
                      && displayed.data.scenarioGeometry?.trigger?.price
                      ? `Daily close above ${displayed.data.scenarioGeometry.trigger.price}`
                      : displayed.data.scenarioGeometry?.unavailableReason
                        || 'Wait for a confirmed daily close above the setup level'),
                  triggerPrice: displayed.data.scenarioGeometry?.trigger?.price ?? null,
                  invalidationPrice: displayed.data.scenarioGeometry?.invalidation?.price
                    ?? displayed.data.scenarioGeometry?.defensiveExit?.price
                    ?? displayed.data.supportResistance?.supports?.[0]?.price,
                  targetPrice: displayed.data.scenarioGeometry?.framing === 'long_setup'
                    ? displayed.data.scenarioGeometry?.target?.price ?? null
                    : null,
                }}
                onCancel={() => setCapturingCase(false)}
              />
            )}
            <div className="wb-chart-panel">
              <MarketChart
                chart={displayed.data.chart}
                geometry={displayed.data.riskGeometry}
                scenarioGeometry={displayed.data.scenarioGeometry}
                ticker={displayed.data.ticker}
                macro={displayed.data.macro}
              />
            </div>
            <DetailDrawer
              key={displayed.ticker || 'empty'}
              storageKey={displayed.ticker ? `nalar-drawer:${displayed.ticker}` : null}
            >
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
