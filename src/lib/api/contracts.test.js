import { describe, expect, it } from 'vitest';
import {
  guardAnalyze,
  guardBrokerArchiveHealth,
  guardBrokerStockIntelligence,
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
  });
});
