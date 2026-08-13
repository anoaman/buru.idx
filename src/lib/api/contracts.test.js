import { describe, expect, it } from 'vitest';
import {
  guardAnalyze,
  guardBrokerArchiveHealth,
  guardBrokerStockIntelligence,
  guardCases,
  guardOpportunities,
  guardRadarScout,
  guardStockBrokerIntelligence,
  normalizeServing,
} from './contracts.js';

const DISCLOSURES = [
  { code: 'top25_observed', label: 'Observed top-25 broker flow.' },
  { code: 'estimates_not_holdings', label: 'Estimates are not actual holdings.' },
];

const CURVE = [{
  date: '2026-07-21',
  netLots: 100,
  cumulativeNetLots: 100,
  netValue: 1_000_000,
  cumulativeNetValue: 1_000_000,
  estimatedInventoryLots: 100,
  estimatedAverageCost: 10_000,
}];

describe('public Stock Analysis contracts', () => {
  it('normalizes Workbench chart data and broker deep-link identity', () => {
    const result = guardAnalyze({
      success: true,
      data: {
        ticker: { symbol: 'BBCA' },
        chart: {
          candles: [{
            date: '2026-07-21',
            open: '9000',
            high: '9100',
            low: '8900',
            close: '9050',
            volume: '1000000',
          }],
          movingAverages: {},
          source: { name: 'chart-source', lastDate: '2026-07-21' },
        },
        broker: { available: true },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.chart.candles[0].close).toBe(9050);
    expect(result.data.chart.levels).toEqual({ supports: [], resistances: [] });
    expect(result.data.broker.symbol).toBe('BBCA');
  });

  it('normalizes scenario geometry without inventing a last-close entry', () => {
    const result = guardAnalyze({
      success: true,
      data: {
        ticker: { symbol: 'BBRI', close: 4500 },
        scenario: { scenario: 'distribution_risk', fitScore: 75 },
        scenarioGeometry: {
          scenario: 'distribution_risk',
          available: true,
          framing: 'defensive',
          trigger: null,
          confirmation: null,
          invalidation: { price: '4300', event: 'close_below' },
          labels: { confirmation: 'Not a long entry', summary: 'Defensive only' },
          reasons: ['observed broker flow is distributing'],
        },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.scenarioGeometry.framing).toBe('defensive');
    expect(result.data.scenarioGeometry.trigger).toBeNull();
    expect(result.data.scenarioGeometry.confirmation).toBeNull();
    expect(result.data.scenarioGeometry.invalidation.price).toBe(4300);
    expect(result.data.scenarioGeometry.labels.confirmation).toBe('Not a long entry');
    expect(result.data.scenario.geometry.framing).toBe('defensive');
  });

  it('keeps official disclosure source URLs and drops social links', () => {
    const result = guardAnalyze({
      success: true,
      data: {
        ticker: { symbol: 'BBRI' },
        storyIntelligence: {
          available: true,
          events: [{
            category: 'rights_issue',
            categoryLabel: 'Rights issue',
            title: 'HMETD',
            publishedAt: '2026-08-11',
            sourceUrl: 'https://www.idx.co.id/id/berita/pengumuman/',
            sourceRef: 'idx:announcement:1',
          }, {
            title: 'Rumor',
            sourceUrl: 'https://t.me/rumor',
            sourceRef: 'social:1',
          }],
          health: {
            available: true,
            freshness: 'partial',
            warnings: ['Official disclosure ingest completed with gaps'],
            counts: { events: 2, unmapped: 1, superseded: 0 },
          },
        },
        investigation: {
          timeline: [{
            date: '2026-08-11',
            type: 'official',
            title: 'Rights issue: HMETD',
            detail: 'Official IDX disclosure.',
            sourceUrl: 'https://www.idx.co.id/id/berita/pengumuman/',
            brokerContext: { available: true, netValue: 1, note: 'Observed broker net buying.' },
          }],
        },
      },
    });
    expect(result.data.storyIntelligence.events).toHaveLength(1);
    expect(result.data.storyIntelligence.events[0].sourceUrl).toMatch(/idx\.co\.id/);
    expect(result.data.investigation.timeline[0].sourceUrl).toMatch(/idx\.co\.id/);
    expect(result.data.storyIntelligence.health.freshness).toBe('partial');
  });

  it('drops uncited grounded synthesis and keeps failure from breaking analysis', () => {
    const failed = guardAnalyze({
      success: true,
      data: {
        ticker: { symbol: 'BBRI' },
        groundedSynthesis: {
          available: false,
          status: 'failed',
          error: 'uncited',
          evidenceNarrative: [{ text: 'Buy now', refs: [] }],
        },
      },
    });
    expect(failed.data.groundedSynthesis.available).toBe(false);
    expect(failed.data.groundedSynthesis.evidenceNarrative).toEqual([]);

    const ok = guardAnalyze({
      success: true,
      data: {
        ticker: { symbol: 'BBRI' },
        groundedSynthesis: {
          available: true,
          status: 'success',
          provider: 'deterministic',
          promptVersion: 'grounded-v1',
          evidenceNarrative: [{ text: 'BBRI grade is B.', refs: ['grade.grade'] }],
          changeBrief: [{ text: 'Scenario remains trend_pullback.', refs: ['scenario.scenario'] }],
        },
      },
    });
    expect(ok.data.groundedSynthesis.available).toBe(true);
    expect(ok.data.groundedSynthesis.evidenceNarrative[0].refs).toEqual(['grade.grade']);
  });

  it('guards archive health without inventing coverage', () => {
    const result = guardBrokerArchiveHealth({
      success: true,
      data: {
        available: true,
        canonicalTickers: 900,
        latestCompletedDate: '2026-07-21',
        coverage: 0.92,
        latestDate: { date: '2026-07-22', accounted: 800, expected: 900, complete: false },
      },
      meta: {
        calendarCoverage: { status: 'ok', uncoveredWeekdays: [] },
        disclosures: DISCLOSURES,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.coverage).toBe(0.92);
    expect(result.data.latestDate.complete).toBe(false);
    expect(result.meta.disclosures).toHaveLength(2);
  });

  it('preserves signed stock-lens broker values and nullable cost', () => {
    const result = guardStockBrokerIntelligence({
      success: true,
      data: {
        ticker: 'bbca',
        window: { days: 30, populatedSessions: 20 },
        observedFlow: { netValue: -500, netLots: -2 },
        accumulation: [{
          code: 'yp',
          netValue: 1000,
          netLots: 10,
          estimatedAverageCost: 9000,
          curve: CURVE,
        }],
        distribution: [{
          code: 'ak',
          netValue: -700,
          netLots: -7,
          estimatedAverageCost: null,
        }],
      },
      meta: {
        archive: { calendarCoverage: { status: 'ok' } },
        disclosures: DISCLOSURES,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.ticker).toBe('BBCA');
    expect(result.data.observedFlow.netValue).toBe(-500);
    expect(result.data.distribution[0].estimatedAverageCost).toBeNull();
    expect(result.data.accumulation[0].curve).toHaveLength(1);
  });

  it('normalizes broker-lens rankings and zero summary values', () => {
    const result = guardBrokerStockIntelligence({
      success: true,
      data: {
        broker: { code: 'yp', sourceTypes: ['Foreign'] },
        window: { days: 7 },
        summary: {
          observedStocks: 0,
          accumulationStocks: 0,
          distributionStocks: 0,
          netValue: 0,
          netLots: 0,
        },
        accumulation: [],
        distribution: [],
      },
      meta: { disclosures: DISCLOSURES },
    });

    expect(result.ok).toBe(true);
    expect(result.data.broker.code).toBe('YP');
    expect(result.data.summary.netValue).toBe(0);
    expect(result.data.accumulation).toEqual([]);
  });

  it('normalizes serving status and rejects malformed contracts', () => {
    expect(normalizeServing({ servingAvailable: true, servingRows: 42 }))
      .toMatchObject({ servingAvailable: true, servingRows: 42 });
    expect(guardAnalyze({ success: false, error: 'offline' }).ok).toBe(false);
    expect(guardBrokerArchiveHealth(null).ok).toBe(false);
    expect(guardStockBrokerIntelligence({ success: true, data: {} }).ok).toBe(false);
    expect(guardBrokerStockIntelligence({ success: true, data: {} }).ok).toBe(false);
    expect(guardOpportunities({ success: false, error: 'scan store unavailable' }).ok).toBe(false);
    expect(guardOpportunities({ success: true }).ok).toBe(false);
    expect(guardCases({ success: false, error: 'offline' }).ok).toBe(false);
  });

  it('normalizes a scan run into a view model and drops the deprecated alias', () => {
    const result = guardOpportunities({
      success: true,
      data: {
        run: {
          id: 41,
          scanned_at: '2026-08-10T02:15:00.000Z',
          data_as_of: '2026-08-07',
          total_seen: 812,
          total_eligible: 96,
          total_shortlisted: 2,
        },
        opportunities: [
          {
            ticker: 'bbri',
            lane: 'first-liner',
            eligible: true,
            rank: 1,
            score: 74.2,
            dataQuality: 'high',
            confidence: 'high',
            levels: { trigger: 4550, invalidation: 4180, netRewardRisk: 2.4 },
            features: { isFca: true },
            reasons: ['compression resolved', ''],
            risks: ['thin traded value'],
            freshness: { priceDate: '2026-08-07', priceAgeDays: 1 },
          },
          { lane: 'orphan-row-without-ticker' },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.run.dataAsOf).toBe('2026-08-07');
    expect(result.data.run.totalShortlisted).toBe(2);
    expect(result.data.candidates).toHaveLength(1);

    const [candidate] = result.data.candidates;
    expect(candidate.ticker).toBe('BBRI');
    expect(candidate.dataQuality).toBe('high');
    expect(candidate).not.toHaveProperty('confidence');
    expect(candidate.isFca).toBe(true);
    expect(candidate.ineligible).toBe(false);
    expect(candidate.reasons).toEqual(['compression resolved']);
    expect(result.data.lanes).toEqual(['first-liner']);
    expect(result.data.dataQualityTally).toEqual({ high: 1, medium: 0, low: 0, unknown: 0 });
  });

  it('reads net reward/risk from features.risk when levels omits it', () => {
    const result = guardOpportunities({
      success: true,
      data: {
        run: null,
        opportunities: [{
          ticker: 'BJTM',
          levels: { support: 500, trigger: 515, invalidation: 500 },
          features: { risk: { netRewardRisk: 9.27 } },
        }],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.candidates[0].levels.netRewardRisk).toBe(9.27);
  });

  it('prefers netRewardRisk on levels over the features.risk fallback', () => {
    const result = guardOpportunities({
      success: true,
      data: {
        run: null,
        opportunities: [{
          ticker: 'BJTM',
          levels: { netRewardRisk: 2.4 },
          features: { risk: { netRewardRisk: 9.27 } },
        }],
      },
    });

    expect(result.data.candidates[0].levels.netRewardRisk).toBe(2.4);
  });

  it('keeps a scoreless, levelless candidate renderable and marks unknown quality', () => {
    const result = guardOpportunities({
      success: true,
      data: {
        run: null,
        opportunities: [{ ticker: 'ADRO', score: null, rank: null, confidence: 'bogus' }],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.run).toBeNull();
    expect(result.data.candidates[0]).toMatchObject({
      score: null,
      rank: null,
      dataQuality: 'unknown',
      ineligible: false,
      reasons: [],
      risks: [],
    });
    expect(result.data.candidates[0].levels.trigger).toBeNull();
  });

  it('only flags a candidate as gated when the scan says so explicitly', () => {
    const gated = guardOpportunities({
      success: true,
      data: { run: null, opportunities: [{ ticker: 'ABCD', eligible: false }] },
    });
    expect(gated.data.candidates[0].ineligible).toBe(true);

    const unstated = guardOpportunities({
      success: true,
      data: { run: null, opportunities: [{ ticker: 'ABCD' }] },
    });
    expect(unstated.data.candidates[0].ineligible).toBe(false);
  });

  it('preserves frozen case evidence and backend monitoring state', () => {
    const result = guardCases({
      success: true,
      data: {
        items: [
          {
            id: 7,
            ticker: 'bbri',
            status: 'watching',
            thesis: '  Compression above support  ',
            triggerPrice: 4550,
            invalidationPrice: 4180,
            snapshot: {
              score: 71.5,
              confidence: 'high',
              reasons: ['compression resolved'],
              risks: ['broker cache is stale'],
              levels: { trigger: 4550, invalidation: 4180 },
            },
            monitoring: {
              state: 'meaningful_change',
              material: true,
              snapshotStale: true,
              snapshotAgeDays: 6.4,
              current: { runId: 42, score: 58.5, scoreDelta: -13, confidence: 'medium' },
            },
            addedAt: '2026-08-06T04:00:00.000Z',
          },
          { ticker: 'NOID' },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.items).toHaveLength(1);

    const [item] = result.data.items;
    expect(item.ticker).toBe('BBRI');
    expect(item.thesis).toBe('Compression above support');
    expect(item.snapshot.dataQuality).toBe('high');
    expect(item.snapshot).not.toHaveProperty('confidence');
    expect(item.monitoring.snapshotStale).toBe(true);
    expect(item.monitoring.current.scoreDelta).toBe(-13);
    expect(item.monitoring.current.dataQuality).toBe('medium');
    expect(result.data.changedCount).toBe(1);
    expect(result.data.staleCount).toBe(1);
  });

  it('keeps frozen scenario geometry on a saved case without recalculating it', () => {
    const result = guardCases({
      success: true,
      data: {
        items: [{
          id: 8,
          ticker: 'BBRI',
          triggerPrice: 4550,
          invalidationPrice: 4180,
          snapshot: {
            levels: { trigger: 4550, invalidation: 4180, framing: 'long_setup', target: 5000 },
            scenarioGeometry: {
              scenario: 'compression_breakout',
              available: true,
              framing: 'long_setup',
              trigger: { price: 4550 },
              invalidation: { price: 4180 },
            },
          },
        }],
      },
    });
    expect(result.data.items[0].snapshot.levels.framing).toBe('long_setup');
    expect(result.data.items[0].snapshot.levels.target).toBe(5000);
    expect(result.data.items[0].snapshot.scenarioGeometry.trigger.price).toBe(4550);
  });

  it('keeps unknown snapshot age distinct from a fresh snapshot', () => {
    const result = guardCases({
      success: true,
      data: {
        items: [{ id: 1, ticker: 'ABCD', monitoring: { state: 'nonsense' } }],
      },
    });

    expect(result.data.items[0].monitoring).toMatchObject({
      state: 'unavailable',
      material: false,
      snapshotStale: null,
      snapshotAgeDays: null,
      current: null,
    });
    expect(result.data.staleCount).toBe(0);
  });
});

describe('Radar Scout contracts', () => {
  const scoutPrice = {
    lastPrice: 1000,
    priceDate: '2026-08-11',
    support: 900,
    supportTouches: 3,
    distanceFromSupportPct: 0.02,
    consolidationRangePct: 0.05,
    averageValue: 1_000_000_000,
  };

  it('preserves evidence band, score breakdown, and null failedCondition for qualified candidates', () => {
    const result = guardRadarScout({
      success: true,
      data: {
        recipe: { id: 'quiet_accumulation', label: 'Quiet accumulation' },
        candidates: [{
          ticker: 'bbri',
          name: 'Bank BRI',
          rank: 1,
          score: 82.5,
          evidenceBand: 'high',
          scoreBreakdown: { broker: 40, support: 30, compression: 12.5, junk: 'x' },
          failedCondition: null,
          price: scoutPrice,
          reasons: ['lead buyer near support'],
          risks: [],
        }],
        nearMisses: [],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.candidates[0]).toMatchObject({
      ticker: 'BBRI',
      evidenceBand: 'high',
      failedCondition: null,
      scoreBreakdown: { broker: 40, support: 30, compression: 12.5, junk: null },
    });
  });

  it('preserves failedCondition and defaults evidenceBand for near-miss candidates', () => {
    const result = guardRadarScout({
      success: true,
      data: {
        recipe: { id: 'quiet_accumulation', label: 'Quiet accumulation' },
        candidates: [],
        nearMisses: [{
          ticker: 'ELSA',
          rank: 1,
          score: 55,
          evidenceBand: 'suspicious',
          failedCondition: 'Missed liquidity floor ≥ Rp500M/day',
          scoreBreakdown: { broker: 20, support: 18, liquidity: null },
          price: scoutPrice,
          reasons: [],
          risks: ['thin average value'],
        }],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.nearMisses[0]).toMatchObject({
      ticker: 'ELSA',
      evidenceBand: 'low',
      failedCondition: 'Missed liquidity floor ≥ Rp500M/day',
      scoreBreakdown: { broker: 20, support: 18, liquidity: null },
    });
  });
});
