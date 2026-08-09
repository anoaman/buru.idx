export function guardAnalyze(raw) {
  if (!raw || raw.success === false) {
    return { ok: false, error: raw?.error || 'Invalid response', data: null };
  }
  const data = raw.data || null;
  if (!data) return { ok: true, error: null, data: null };

  // Normalize the chart payload added in Phase 2.  The backend returns a
  // bounded chart object (candles, movingAverages, levels, source) derived
  // from the already-fetched daily history.  This is presentation data only.
  const chart = data.chart || null;
  const normalizedChart = chart ? {
    candles: Array.isArray(chart.candles) ? chart.candles.map((c) => ({
      date: c.date,
      open: Number(c.open) || 0,
      high: Number(c.high) || 0,
      low: Number(c.low) || 0,
      close: Number(c.close) || 0,
      volume: Number(c.volume) || 0,
    })) : [],
    movingAverages: chart.movingAverages || {},
    levels: {
      supports: Array.isArray(chart.levels?.supports) ? chart.levels.supports : [],
      resistances: Array.isArray(chart.levels?.resistances) ? chart.levels.resistances : [],
    },
    source: {
      name: chart.source?.name || 'unknown',
      lastDate: chart.source?.lastDate || null,
    },
  } : null;

  // Attach ticker identity onto broker so Workbench deep links can use
  // broker.symbol without changing Workbench.jsx (Session 6 scope).
  const broker = data.broker && typeof data.broker === 'object'
    ? {
        ...data.broker,
        symbol: data.broker.symbol || data.ticker?.symbol || null,
      }
    : data.broker;

  // Dynamic levels (MA20/50/200 as S/R). Normalized so a malformed or partial
  // block renders as "unavailable" rather than throwing inside the panel.
  const dyn = data.dynamicLevels;
  const normalizedDynamicLevels = dyn && typeof dyn === 'object' ? {
    available: Boolean(dyn.available) && Array.isArray(dyn.levels) && dyn.levels.length > 0,
    reason: dyn.reason || null,
    levels: Array.isArray(dyn.levels) ? dyn.levels.map((l) => ({
      period: l.period,
      label: l.label || `MA${l.period}`,
      price: Number(l.price),
      role: l.role || 'unknown',
      distancePct: Number.isFinite(l.distancePct) ? l.distancePct : null,
      slope: l.slope || 'unknown',
      slopePctPerSession: Number.isFinite(l.slopePctPerSession) ? l.slopePctPerSession : null,
      confluence: Array.isArray(l.confluence) ? l.confluence : [],
      converging: l.converging ?? null,
    })) : [],
    unavailable: Array.isArray(dyn.unavailable) ? dyn.unavailable : [],
    nearest: dyn.nearest || { support: null, resistance: null },
  } : null;

  return {
    ok: true,
    error: null,
    data: {
      ...data,
      dynamicLevels: normalizedDynamicLevels,
      chart: normalizedChart,
      broker,
    },
  };
}

function normalizeDisclosures(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object' && item.code && item.label)
    .map((item) => ({ code: String(item.code), label: String(item.label) }));
}

function normalizeCalendarCoverage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { status: 'degraded', reason: 'calendar_missing', uncoveredWeekdays: [] };
  }
  const status = raw.status === 'ok' ? 'ok' : 'degraded';
  return {
    status,
    reason: raw.reason ?? null,
    uncoveredWeekdays: Array.isArray(raw.uncoveredWeekdays) ? raw.uncoveredWeekdays : [],
  };
}

function normalizeConsistency(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      observedSessions: 0,
      buySessions: 0,
      sellSessions: 0,
      neutralSessions: 0,
      dominantSide: 'mixed',
      consistencyRatio: null,
      multiDayMeaningful: false,
    };
  }
  return {
    observedSessions: Number.isFinite(raw.observedSessions) ? raw.observedSessions : 0,
    buySessions: Number.isFinite(raw.buySessions) ? raw.buySessions : 0,
    sellSessions: Number.isFinite(raw.sellSessions) ? raw.sellSessions : 0,
    neutralSessions: Number.isFinite(raw.neutralSessions) ? raw.neutralSessions : 0,
    dominantSide: raw.dominantSide || 'mixed',
    consistencyRatio: Number.isFinite(raw.consistencyRatio) ? raw.consistencyRatio : null,
    multiDayMeaningful: Boolean(raw.multiDayMeaningful),
  };
}

function normalizeCurvePoint(point) {
  if (!point || typeof point !== 'object' || !point.date) return null;
  return {
    date: point.date,
    netLots: Number.isFinite(point.netLots) ? point.netLots : 0,
    cumulativeNetLots: Number.isFinite(point.cumulativeNetLots) ? point.cumulativeNetLots : 0,
    netValue: Number.isFinite(point.netValue) ? point.netValue : 0,
    cumulativeNetValue: Number.isFinite(point.cumulativeNetValue) ? point.cumulativeNetValue : 0,
    estimatedInventoryLots: Number.isFinite(point.estimatedInventoryLots)
      ? point.estimatedInventoryLots
      : 0,
    estimatedAverageCost: Number.isFinite(point.estimatedAverageCost)
      ? point.estimatedAverageCost
      : null,
  };
}

function normalizeCurve(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCurvePoint).filter(Boolean);
}

function preserveFiniteOrNull(value) {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}

function preserveFiniteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function normalizeStockBrokerRow(row) {
  if (!row || typeof row !== 'object' || !row.code) return null;
  return {
    code: String(row.code).toUpperCase(),
    sourceType: row.sourceType || null,
    buyValue: preserveFiniteOrZero(row.buyValue),
    sellValue: preserveFiniteOrZero(row.sellValue),
    netValue: preserveFiniteOrZero(row.netValue),
    buyLots: preserveFiniteOrZero(row.buyLots),
    sellLots: preserveFiniteOrZero(row.sellLots),
    netLots: preserveFiniteOrZero(row.netLots),
    weightedBuyPrice: preserveFiniteOrNull(row.weightedBuyPrice),
    weightedSellPrice: preserveFiniteOrNull(row.weightedSellPrice),
    frequency: Number.isFinite(row.frequency) ? row.frequency : 0,
    consistency: normalizeConsistency(row.consistency),
    estimatedInventoryLots: preserveFiniteOrZero(row.estimatedInventoryLots),
    estimatedAverageCost: preserveFiniteOrNull(row.estimatedAverageCost),
    curve: normalizeCurve(row.curve),
  };
}

function normalizeBrokerStockRow(row) {
  if (!row || typeof row !== 'object' || !row.ticker) return null;
  return {
    ticker: String(row.ticker).toUpperCase(),
    name: row.name || row.ticker,
    observedSessions: Number.isFinite(row.observedSessions) ? row.observedSessions : 0,
    buyValue: preserveFiniteOrZero(row.buyValue),
    sellValue: preserveFiniteOrZero(row.sellValue),
    netValue: preserveFiniteOrZero(row.netValue),
    buyLots: preserveFiniteOrZero(row.buyLots),
    sellLots: preserveFiniteOrZero(row.sellLots),
    netLots: preserveFiniteOrZero(row.netLots),
    weightedBuyPrice: preserveFiniteOrNull(row.weightedBuyPrice),
    weightedSellPrice: preserveFiniteOrNull(row.weightedSellPrice),
    sourceType: row.sourceType || null,
    consistency: normalizeConsistency(row.consistency),
    estimatedInventoryLots: preserveFiniteOrZero(row.estimatedInventoryLots),
    estimatedAverageCost: preserveFiniteOrNull(row.estimatedAverageCost),
    curve: normalizeCurve(row.curve),
  };
}

function normalizeBrokerRows(rows, mapper) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapper).filter(Boolean);
}

export function normalizeServing(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      servingAvailable: false,
      servingStatus: 'unavailable',
      servingReason: null,
      servingRows: 0,
      servingEarliest: null,
      servingLatest: null,
      materializedAt: null,
      sourceThroughDate: null,
      lastFailure: null,
    };
  }
  const lf = raw.lastFailure && typeof raw.lastFailure === 'object' ? raw.lastFailure : null;
  return {
    servingAvailable: raw.servingAvailable === true,
    servingStatus: raw.servingStatus || 'unavailable',
    servingReason: raw.servingReason || null,
    servingRows: Number.isFinite(raw.servingRows) ? raw.servingRows : 0,
    servingEarliest: raw.servingEarliest || null,
    servingLatest: raw.servingLatest || null,
    materializedAt: raw.materializedAt || null,
    sourceThroughDate: raw.sourceThroughDate || null,
    lastFailure: lf
      ? {
          startedAt: lf.startedAt || null,
          finishedAt: lf.finishedAt || null,
          error: lf.error || null,
          mode: lf.mode || null,
        }
      : null,
  };
}

export function guardBrokerArchiveHealth(raw) {
  if (!raw || raw.success === false) {
    return { ok: false, error: raw?.error || 'Invalid response', data: null, meta: null };
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Missing archive health data', data: null, meta: null };
  }

  const meta = raw.meta || {};
  const latestDate = data.latestDate && typeof data.latestDate === 'object'
    ? {
        date: data.latestDate.date || null,
        accounted: Number.isFinite(data.latestDate.accounted) ? data.latestDate.accounted : null,
        expected: Number.isFinite(data.latestDate.expected) ? data.latestDate.expected : null,
        complete: data.latestDate.complete === true,
      }
    : null;

  return {
    ok: true,
    error: null,
    data: {
      available: data.available === true,
      reason: data.reason || null,
      canonicalTickers: Number.isFinite(data.canonicalTickers) ? data.canonicalTickers : 0,
      earliestAvailableDate: data.earliestAvailableDate || null,
      latestAvailableDate: data.latestAvailableDate || null,
      latestCompletedDate: data.latestCompletedDate || null,
      verifiedTradingDates: Number.isFinite(data.verifiedTradingDates) ? data.verifiedTradingDates : 0,
      populatedStockDays: Number.isFinite(data.populatedStockDays) ? data.populatedStockDays : 0,
      gapStockDays: Number.isFinite(data.gapStockDays) ? data.gapStockDays : 0,
      accountedStockDays: Number.isFinite(data.accountedStockDays) ? data.accountedStockDays : 0,
      expectedStockDays: Number.isFinite(data.expectedStockDays) ? data.expectedStockDays : 0,
      coverage: Number.isFinite(data.coverage) ? data.coverage : null,
      latestDate,
      serving: normalizeServing(data.serving),
    },
    meta: {
      calendarCoverage: normalizeCalendarCoverage(meta.calendarCoverage),
      disclosures: normalizeDisclosures(meta.disclosures),
    },
  };
}

export function guardStockBrokerIntelligence(raw) {
  if (!raw || raw.success === false) {
    return { ok: false, error: raw?.error || 'Invalid response', data: null, meta: null };
  }
  const data = raw.data;
  if (!data || typeof data !== 'object' || !data.ticker) {
    return { ok: false, error: 'Missing stock broker intelligence identity', data: null, meta: null };
  }

  const window = data.window && typeof data.window === 'object' ? data.window : {};
  const observedFlow = data.observedFlow && typeof data.observedFlow === 'object'
    ? data.observedFlow
    : {};
  const meta = raw.meta || {};
  const archive = meta.archive && typeof meta.archive === 'object' ? meta.archive : {};

  return {
    ok: true,
    error: null,
    data: {
      ticker: String(data.ticker).toUpperCase(),
      name: data.name || data.ticker,
      window: {
        days: Number.isFinite(window.days) ? window.days : null,
        from: window.from || null,
        to: window.to || null,
        asOf: window.asOf || null,
        tradingSessions: Number.isFinite(window.tradingSessions) ? window.tradingSessions : 0,
        populatedSessions: Number.isFinite(window.populatedSessions) ? window.populatedSessions : 0,
        gapSessions: Number.isFinite(window.gapSessions) ? window.gapSessions : 0,
        missingSessions: Number.isFinite(window.missingSessions) ? window.missingSessions : 0,
        complete: window.complete === true,
      },
      observedFlow: {
        netValue: preserveFiniteOrZero(observedFlow.netValue),
        netLots: preserveFiniteOrZero(observedFlow.netLots),
        buyValue: preserveFiniteOrZero(observedFlow.buyValue),
        sellValue: preserveFiniteOrZero(observedFlow.sellValue),
        daily: Array.isArray(observedFlow.daily) ? observedFlow.daily : [],
      },
      preferredBroker: {
        codes: Array.isArray(data.preferredBroker?.codes) ? data.preferredBroker.codes : [],
        observedCodes: Array.isArray(data.preferredBroker?.observedCodes) ? data.preferredBroker.observedCodes : [],
        netValue: preserveFiniteOrZero(data.preferredBroker?.netValue),
        totalPositiveNetValue: preserveFiniteOrZero(data.preferredBroker?.totalPositiveNetValue),
        share: preserveFiniteOrNull(data.preferredBroker?.share),
      },
      rotationHandoff: data.rotationHandoff && typeof data.rotationHandoff === 'object'
        ? data.rotationHandoff
        : null,
      accumulation: normalizeBrokerRows(data.accumulation, normalizeStockBrokerRow),
      distribution: normalizeBrokerRows(data.distribution, normalizeStockBrokerRow),
      brokers: normalizeBrokerRows(data.brokers, normalizeStockBrokerRow),
    },
    meta: {
      archive: {
        earliestAvailableDate: archive.earliestAvailableDate || null,
        latestAvailableDate: archive.latestAvailableDate || null,
        latestCompletedDate: archive.latestCompletedDate || null,
        topN: Number.isFinite(archive.topN) ? archive.topN : null,
        calendarCoverage: normalizeCalendarCoverage(archive.calendarCoverage),
      },
      methodology: meta.methodology || null,
      disclosures: normalizeDisclosures(meta.disclosures),
    },
  };
}

export function guardBrokerStockIntelligence(raw) {
  if (!raw || raw.success === false) {
    return { ok: false, error: raw?.error || 'Invalid response', data: null, meta: null };
  }
  const data = raw.data;
  if (!data || typeof data !== 'object' || !data.broker?.code) {
    return { ok: false, error: 'Missing broker stock intelligence identity', data: null, meta: null };
  }

  const window = data.window && typeof data.window === 'object' ? data.window : {};
  const summary = data.summary && typeof data.summary === 'object' ? data.summary : {};
  const meta = raw.meta || {};
  const archive = meta.archive && typeof meta.archive === 'object' ? meta.archive : {};

  return {
    ok: true,
    error: null,
    data: {
      broker: {
        code: String(data.broker.code).toUpperCase(),
        sourceTypes: Array.isArray(data.broker.sourceTypes) ? data.broker.sourceTypes : [],
      },
      window: {
        days: Number.isFinite(window.days) ? window.days : null,
        from: window.from || null,
        to: window.to || null,
        asOf: window.asOf || null,
        tradingSessions: Number.isFinite(window.tradingSessions) ? window.tradingSessions : 0,
      },
      summary: {
        observedStocks: Number.isFinite(summary.observedStocks) ? summary.observedStocks : 0,
        accumulationStocks: Number.isFinite(summary.accumulationStocks) ? summary.accumulationStocks : 0,
        distributionStocks: Number.isFinite(summary.distributionStocks) ? summary.distributionStocks : 0,
        netValue: preserveFiniteOrZero(summary.netValue),
        netLots: preserveFiniteOrZero(summary.netLots),
      },
      accumulation: normalizeBrokerRows(data.accumulation, normalizeBrokerStockRow),
      distribution: normalizeBrokerRows(data.distribution, normalizeBrokerStockRow),
    },
    meta: {
      archive: {
        earliestAvailableDate: archive.earliestAvailableDate || null,
        latestAvailableDate: archive.latestAvailableDate || null,
        latestCompletedDate: archive.latestCompletedDate || null,
        topN: Number.isFinite(archive.topN) ? archive.topN : null,
        calendarCoverage: normalizeCalendarCoverage(archive.calendarCoverage),
      },
      methodology: meta.methodology || null,
      disclosures: normalizeDisclosures(meta.disclosures),
    },
  };
}
