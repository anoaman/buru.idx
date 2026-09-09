import { describe, expect, it } from 'vitest';
import {
  guardAnalyze,
  guardBrokerArchiveHealth,
  guardBrokerStockIntelligence,
  guardCases,
  guardCollectorHealth,
  guardDisclosureAnomalies,
  guardDisclosureDetail,
  guardDisclosures,
  guardFundamentalStatements,
  guardFundamentalsSnapshot,
  guardFundamentalsPeriods,
  guardFundamentalsFacts,
  guardFundamentalsFiling,
  guardFundamentalsDerived,
  guardFundamentalsSources,
  guardNewsDetector,
  guardDataHealth,
  guardRadarScout,
  guardStockBrokerIntelligence,
  officialIdxUrl,
  normalizeSetupGeometry,
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

  it('uses scenario entry for upside and signs invalidation as downside', () => {
    const geometry = normalizeSetupGeometry({
      ticker: { close: 120 },
      riskGeometry: { nearestSupport: 95, nearestResistance: 120, upsidePct: 0 },
      scenarioGeometry: {
        available: true,
        framing: 'long_setup',
        confirmation: { price: 100 },
        invalidation: { price: 95 },
        target: { price: 120 },
        risk: { stopDistPct: 5, targetDistPct: 20, rr: 4, netRR: 3.7, costPct: 0.3 },
        labels: { confirmation: 'Close above range resistance' },
      },
    });

    expect(geometry.bestSetup.entry).toBe(100);
    expect(geometry.downsidePct).toBeCloseTo(-20.83, 2);
    expect(geometry.upsidePct).toBe(20);
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
    expect(guardCases({ success: false, error: 'offline' }).ok).toBe(false);
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
    // No detail on the wire is null, not a fabricated zero-sized miss.
    expect(result.data.nearMisses[0].failedDetail).toBeNull();
  });

  it('carries the miss margin, and keeps an unmeasurable miss distinct from a zero one', () => {
    const nearMiss = (failedDetail) => ({
      ticker: 'ELSA', rank: 1, score: 55, evidenceBand: 'low',
      failedCondition: failedDetail.id, failedDetail, price: scoutPrice, reasons: [], risks: [],
    });
    const result = guardRadarScout({
      success: true,
      data: {
        recipe: { id: 'quiet_accumulation', label: 'Quiet accumulation' },
        candidates: [],
        nearMisses: [
          nearMiss({
            id: 'min_average_value', label: 'Liquidity floor', unit: 'IDR', comparison: 'min',
            available: true, expected: 500_000_000, observed: 40_000_000,
            gap: 460_000_000, gapPct: 92, reason: 'threshold',
          }),
          nearMiss({
            id: 'min_rs_vs_ihsg_pct', label: 'Minimum RS versus IHSG', unit: '%', comparison: 'min',
            available: false, expected: 2, observed: null, gap: null, gapPct: null, reason: 'unavailable',
          }),
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.nearMisses[0].failedDetail).toMatchObject({
      label: 'Liquidity floor', unit: 'IDR', available: true, gap: 460_000_000, gapPct: 92,
    });
    const unmeasured = result.data.nearMisses[1].failedDetail;
    expect(unmeasured.available).toBe(false);
    expect(unmeasured.gap).toBeNull();
    expect(unmeasured.reason).toBe('unavailable');
  });

  it('preserves roadmap evidence, qualification history, FCA and requested coverage without turning unavailable into zero', () => {
    const result = guardRadarScout({
      success: true,
      data: {
        recipe: { id: 'range_resolution', label: 'Range resolution + participation' },
        asOf: { brokerSessions: 7, requestedBrokerSessions: 10 },
        candidates: [{
          ticker: 'ANTM',
          isFca: true,
          relativeStrengthVsIhsgPct: null,
          evidence: { valueExpansion: 2.1, frequencyExpansion: null, breadthPass: false },
          price: scoutPrice,
        }],
        nearMisses: [],
        dailyDiff: {
          new: [],
          still: [{ ticker: 'ANTM', qualificationState: 'still', qualificationStreak: 3, price: scoutPrice }],
          dropped: [{ ticker: 'ELSA', qualificationState: 'dropped', failedCondition: 'breadth_narrow', price: scoutPrice }],
        },
      },
    });

    expect(result.data.asOf).toMatchObject({ brokerSessions: 7, requestedBrokerSessions: 10 });
    expect(result.data.candidates[0]).toMatchObject({
      isFca: true,
      relativeStrengthVsIhsgPct: null,
      evidence: { valueExpansion: 2.1, frequencyExpansion: null, breadthPass: false },
    });
    expect(result.data.dailyDiff.still[0]).toMatchObject({ qualificationState: 'still', qualificationStreak: 3 });
    expect(result.data.dailyDiff.dropped[0].failedCondition).toBe('breadth_narrow');
  });
});

describe('Keterbukaan and Fundamentals contracts', () => {
  it('keeps official IDX URLs and drops filesystem paths', () => {
    expect(officialIdxUrl('https://www.idx.co.id/news/a')).toBe('https://www.idx.co.id/news/a');
    expect(officialIdxUrl('/home/kibz66/.openclaw/workspace/trading-db/idx.db')).toBeNull();
  });

  it('normalizes the disclosure feed and unavailable tables', () => {
    const ready = guardDisclosures({
      success: true,
      data: {
        items: [{
          eventId: 'div-1',
          ticker: 'bbca',
          title: 'Dividend',
          sourceUrl: 'https://www.idx.co.id/news/div-1',
          hasCorrection: true,
        }],
        nextCursor: 25,
        total: 40,
      },
    });
    expect(ready.ok).toBe(true);
    expect(ready.data.items[0].ticker).toBe('BBCA');
    expect(ready.data.items[0].sourceUrl).toBe('https://www.idx.co.id/news/div-1');

    const missing = guardDisclosures({
      success: true,
      data: { available: false, status: 'unavailable', reason: 'disclosure tables are not present.' },
    });
    expect(missing.ok).toBe(true);
    expect(missing.data.available).toBe(false);
    expect(missing.data.items).toEqual([]);
    expect(guardDisclosures({ success: false, error: 'offline' }).ok).toBe(false);
  });

  it('strips leaked paths from detail evidence and documents', () => {
    const result = guardDisclosureDetail({
      success: true,
      data: {
        eventId: 'div-1',
        ticker: 'BBCA',
        sourceUrl: '/tmp/secret.pdf',
        signals: [{
          type: 'correction',
          evidence: { snippet: 'koreksi', officialUrl: 'file:///tmp/x' },
        }],
        documents: [{ documentId: 1, sourceUrl: 'https://www.idx.co.id/a.pdf' }],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.sourceUrl).toBeNull();
    expect(result.data.signals[0].evidence.officialUrl).toBeNull();
    expect(result.data.documents[0].sourceUrl).toBe('https://www.idx.co.id/a.pdf');
  });

  it('keeps statement periods separate and drops inferred facts', () => {
    const result = guardFundamentalStatements({
      success: true,
      data: {
        items: [{
          periodLabel: 'FY2025',
          sourceUrl: 'https://www.idx.co.id/fs.pdf',
          parserStatus: 'ok',
          facts: [
            { fieldKey: 'revenue', valueNumeric: 1, statementType: 'income_statement' },
            { fieldKey: 'pe', valueNumeric: 12, valueKind: 'inferred' },
          ],
        }],
      },
    });
    expect(result.data.items[0].facts.map((row) => row.fieldKey)).toEqual(['revenue']);
    expect(guardDisclosureAnomalies({ success: false, error: 'offline' }).ok).toBe(false);
    expect(guardCollectorHealth({
      success: true,
      data: { available: true, status: 'ready', feeds: [{ feed: 'idx', lastSuccessAt: '2026-08-14T00:00:00Z' }] },
    }).data.status).toBe('ready');
  });
});

describe('v18 Fundamentals contracts', () => {
  it('guardFundamentalsSnapshot: normalizes available snapshot', () => {
    const result = guardFundamentalsSnapshot({
      success: true,
      data: {
        available: true,
        ticker: 'BBCA',
        companyType: 'bank',
        filingCount: 2,
        latestPeriod: 'FY2024',
        latestFiscalYear: 2024,
        latestFilingId: 'BBCA-2024-A-fs',
        latestExtractionStatus: 'success',
        latestFactCount: 100,
        latestParsedAt: '2025-01-01',
        periods: ['FY2024', 'FY2023'],
        filings: [
          {
            filingId: 'BBCA-2024-A-fs',
            companyType: 'bank',
            fiscalYear: 2024,
            fiscalPeriod: 'A',
            periodLabel: 'FY2024',
            extractionStatus: 'success',
            factCount: 100,
            parsedAt: '2025-01-01',
            sourceUrl: 'https://www.idx.co.id/bbca.pdf',
            publishedAt: '2025-02-01',
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.available).toBe(true);
    expect(result.data.companyType).toBe('bank');
    expect(result.data.filingCount).toBe(2);
    expect(result.data.filings[0].sourceUrl).toBe('https://www.idx.co.id/bbca.pdf');
    expect(result.data.filings[0].fiscalYear).toBe(2024);
  });

  it('guardFundamentalsSnapshot: returns unavailable when tables missing', () => {
    const result = guardFundamentalsSnapshot({
      success: true,
      data: { available: false, reason: 'v18 fundamentals tables are not present.', ticker: 'BBCA' },
    });
    expect(result.ok).toBe(true);
    expect(result.data.available).toBe(false);
    expect(result.data.reason).toMatch(/v18/);
  });

  it('guardFundamentalsSnapshot: fails on error envelope', () => {
    expect(guardFundamentalsSnapshot({ success: false, error: 'db down' }).ok).toBe(false);
  });

  it('guardFundamentalsFacts: normalizes v18 facts and handles unavailable', () => {
    const result = guardFundamentalsFacts({
      success: true,
      data: {
        available: true,
        filingId: 'BBCA-2024-A-fs',
        items: [
          {
            factId: 1,
            filingId: 'BBCA-2024-A-fs',
            statementType: 'income_statement',
            section: 'revenue',
            columnLabel: 'FY2024',
            periodLabel: 'FY2024',
            fieldKey: 'net_income',
            valueNumeric: 48600000000000,
            unit: 'IDR',
            confidence: 0.95,
            evidence: { page: 45, snippet: 'Laba bersih', officialUrl: 'https://www.idx.co.id/x.pdf' },
            extractedAt: '2025-01-01',
            companyType: 'bank',
          },
        ],
        total: 1,
        cursor: 0,
        limit: 50,
        nextCursor: null,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.available).toBe(true);
    expect(result.data.items[0].fieldKey).toBe('net_income');
    expect(result.data.items[0].evidence.officialUrl).toBe('https://www.idx.co.id/x.pdf');
    expect(result.data.items[0].confidence).toBe(0.95);

    const missing = guardFundamentalsFacts({
      success: true,
      data: { available: false, reason: 'v18 fundamental_facts table is not present.' },
    });
    expect(missing.ok).toBe(true);
    expect(missing.data.available).toBe(false);
    expect(missing.data.items).toEqual([]);
  });

  it('guardFundamentalsDerived: normalizes metrics with formula and inputs', () => {
    const result = guardFundamentalsDerived({
      success: true,
      data: {
        available: true,
        filingId: 'BBCA-2024-A-fs',
        periodLabel: 'FY2024',
        companyType: 'bank',
        metrics: [
          {
            key: 'net_margin',
            label: 'Net Profit Margin',
            formula: 'net_income / revenue × 100',
            unit: '%',
            section: 'profitability',
            available: true,
            value: 31.5,
            inputs: {
              numerator: { factId: 1, fieldKey: 'net_income', valueNumeric: 486e11, unit: 'IDR', confidence: 0.95, evidence: { page: 45, officialUrl: 'https://www.idx.co.id/x.pdf' }, periodLabel: 'FY2024' },
              denominator: { factId: 2, fieldKey: 'net_revenue', valueNumeric: 154.3e13, unit: 'IDR', confidence: 0.95, evidence: {}, periodLabel: 'FY2024' },
            },
            rejectionReason: null,
          },
          {
            key: 'gross_margin',
            label: 'Gross Margin',
            formula: 'gross_profit / revenue × 100',
            unit: '%',
            section: 'profitability',
            available: false,
            value: null,
            inputs: { numerator: null, denominator: null },
            rejectionReason: 'numerator unavailable (tried: gross_profit, laba_kotor, gross_income)',
          },
          {
            key: 'eps',
            label: 'Earnings Per Share',
            formula: 'net_income / shares',
            unit: 'IDR',
            section: 'per_share',
            available: false,
            value: null,
            inputs: { numerator: { factId: 1, fieldKey: 'net_income', valueNumeric: 486e11, unit: 'IDR', confidence: 0.9, evidence: {}, periodLabel: 'FY2024' }, denominator: { factId: 5, fieldKey: 'shares', valueNumeric: -100, unit: 'shares', confidence: 0.5, evidence: {}, periodLabel: 'FY2024' } },
            rejectionReason: 'denominator must be positive',
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.available).toBe(true);
    expect(result.data.companyType).toBe('bank');
    expect(result.data.metrics).toHaveLength(3);

    const margin = result.data.metrics.find((m) => m.key === 'net_margin');
    expect(margin.available).toBe(true);
    expect(margin.value).toBe(31.5);
    expect(margin.formula).toBe('net_income / revenue × 100');
    expect(margin.inputs.numerator.fieldKey).toBe('net_income');
    expect(margin.inputs.numerator.evidence.officialUrl).toBe('https://www.idx.co.id/x.pdf');

    const gross = result.data.metrics.find((m) => m.key === 'gross_margin');
    expect(gross.available).toBe(false);
    expect(gross.rejectionReason).toMatch(/numerator unavailable/);
    expect(gross.inputs.numerator).toBeNull();

    const eps = result.data.metrics.find((m) => m.key === 'eps');
    expect(eps.available).toBe(false);
    expect(eps.rejectionReason).toBe('denominator must be positive');
    expect(eps.inputs.numerator).not.toBeNull();
  });

  it('guardFundamentalsDerived: handles unavailable tables', () => {
    const result = guardFundamentalsDerived({
      success: true,
      data: { available: false, reason: 'v18 fundamental_facts table is not present.' },
    });
    expect(result.ok).toBe(true);
    expect(result.data.available).toBe(false);
    expect(result.data.metrics).toEqual([]);
    expect(guardFundamentalsDerived({ success: false, error: 'offline' }).ok).toBe(false);
  });

  it('guardFundamentalsSources: strips non-IDX source URLs', () => {
    const result = guardFundamentalsSources({
      success: true,
      data: {
        available: true,
        ticker: 'BBCA',
        sources: [
          {
            filingId: 'BBCA-2024-A-fs',
            periodLabel: 'FY2024',
            fiscalYear: 2024,
            fiscalPeriod: 'A',
            eventId: 'evt-1',
            sourceUrl: 'https://www.idx.co.id/fs.pdf',
            publishedAt: '2025-02-01',
            title: 'FS 2024',
          },
          {
            filingId: 'BBCA-2023-A-fs',
            periodLabel: 'FY2023',
            fiscalYear: 2023,
            fiscalPeriod: 'A',
            eventId: 'evt-2',
            sourceUrl: '/home/user/secret.pdf',
            publishedAt: '2024-02-01',
            title: 'FS 2023',
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.sources[0].sourceUrl).toBe('https://www.idx.co.id/fs.pdf');
    expect(result.data.sources[1].sourceUrl).toBeNull();
  });

  it('guardFundamentalsSnapshot and guardFundamentalsFiling preserve fiscal year as number', () => {
    const snap = guardFundamentalsSnapshot({
      success: true,
      data: {
        available: true,
        ticker: 'BBCA',
        companyType: 'common',
        filingCount: 1,
        latestPeriod: 'FY2024',
        latestFiscalYear: 2024,
        latestFilingId: 'x',
        latestExtractionStatus: 'success',
        latestFactCount: 10,
        latestParsedAt: null,
        periods: ['FY2024'],
        filings: [{ filingId: 'x', companyType: 'common', fiscalYear: 2024, fiscalPeriod: 'A', periodLabel: 'FY2024', extractionStatus: 'success', factCount: 10, parsedAt: null }],
      },
    });
    expect(snap.data.filings[0].fiscalYear).toBe(2024);
  });

  it('guardNewsDetector normalizes camelCase and snake_case scan payloads', () => {
    const result = guardNewsDetector({
      success: true,
      data: {
        available: true,
        run: { id: 3, scan_date: '2026-08-04', taxonomy_version: '1', material_count: 1, total_disclosures: 2 },
        items: [{
          event_id: 'e1', ticker: 'ASII', title: 'Akuisisi', disposition: 'material',
          category: 'acquisition', signal_score: 0.9,
          official_source_url: 'https://www.idx.co.id/e1',
          evidence: [{ kind: 'title_keyword', quote: 'Akuisisi' }],
        }],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.run.scanDate).toBe('2026-08-04');
    expect(result.data.run.materialCount).toBe(1);
    expect(result.data.items[0].eventId).toBe('e1');
    expect(result.data.items[0].officialSourceUrl).toBe('https://www.idx.co.id/e1');
  });
});

describe('data health contract', () => {
  it('lets the oldest cache set the headline rather than averaging it away', () => {
    const result = guardDataHealth({
      success: true,
      data: {
        overall: 'stale',
        tradingCalendar: { lastCompletedSession: '2026-08-25' },
        priceCache: { freshness: 'stale', ageDays: 11.9, sessionsBehind: 7, lastDate: '2026-08-14' },
        brokerCache: { freshness: 'stale', ageDays: 13.9, sessionsBehind: 9, lastDate: '2026-08-12' },
      },
    });

    expect(result.ok).toBe(true);
    // A fresh price cache must not be allowed to disguise a nine-session-old
    // broker cache; the screen is only as current as its slowest input.
    expect(result.data.worstSessionsBehind).toBe(9);
    expect(result.data.lastCompletedSession).toBe('2026-08-25');
  });

  it('reports unknown lag as unknown instead of zero', () => {
    const result = guardDataHealth({ success: true, data: { overall: 'unknown' } });
    expect(result.ok).toBe(true);
    expect(result.data.worstSessionsBehind).toBeNull();
    expect(result.data.priceCache.freshness).toBe('unknown');
  });

  it('fails closed on an error envelope', () => {
    expect(guardDataHealth({ success: false, error: 'db locked' }).ok).toBe(false);
    expect(guardDataHealth({ success: true }).ok).toBe(false);
  });
});
