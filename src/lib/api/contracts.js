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

export function guardRiskSimulation(raw) {
  if (!raw || raw.success === false || !raw.data) {
    return { ok: false, error: raw?.error || 'Invalid risk simulation', data: null };
  }
  const data = raw.data;
  const required = ['entry', 'stop', 'target', 'capital', 'maxRiskPct', 'lots', 'shares'];
  if (!required.every((key) => Number.isFinite(data[key]))) {
    return { ok: false, error: 'Incomplete risk simulation', data: null };
  }
  return { ok: true, error: null, data };
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
      completedLagSessions: Number.isFinite(data.completedLagSessions) ? data.completedLagSessions : null,
      completedCoverageStalled: data.completedCoverageStalled === true,
      completedCoverageReason: data.completedCoverageReason || null,
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

// ── Radar and Cases ───────────────────────────────────────────────
//
// Both surfaces used to read store rows directly. They arrive as raw SQLite
// shapes (snake_case run columns, JSON blobs) and carry one field that is
// actively misleading: `confidence` is a deprecated pre-1.2 alias that measures
// source freshness and coverage, not outcome probability. The backend states
// that new consumers must display it as data quality, so the view models expose
// `dataQuality` only and there is no `confidence` key left for a component to
// render under the wrong label.

const DATA_QUALITY_LEVELS = ['high', 'medium', 'low'];

function normalizeDataQuality(raw) {
  const value = String(raw ?? '').toLowerCase();
  return DATA_QUALITY_LEVELS.includes(value) ? value : 'unknown';
}

function normalizeStringList(raw, limit) {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());
  return Number.isFinite(limit) ? items.slice(0, limit) : items;
}

// fallbackNetRewardRisk: the shortlist API carries net reward/risk under
// features.risk, not levels, so every row rendered "Reward / risk —". Levels is
// the right shape for the UI, so the drift is reconciled here rather than
// teaching the component about two payload paths.
function normalizeOpportunityLevels(raw, fallbackNetRewardRisk) {
  const levels = raw && typeof raw === 'object' ? raw : {};
  return {
    last: preserveFiniteOrNull(levels.last),
    support: preserveFiniteOrNull(levels.support),
    resistance: preserveFiniteOrNull(levels.resistance),
    trigger: preserveFiniteOrNull(levels.trigger),
    invalidation: preserveFiniteOrNull(levels.invalidation),
    netRewardRisk: preserveFiniteOrNull(levels.netRewardRisk ?? fallbackNetRewardRisk),
  };
}

function normalizeOpportunityFreshness(raw) {
  const freshness = raw && typeof raw === 'object' ? raw : {};
  return {
    priceDate: freshness.priceDate || null,
    priceAgeDays: preserveFiniteOrNull(freshness.priceAgeDays),
    priceSource: freshness.priceSource || null,
    brokerDate: freshness.brokerDate || null,
    marketDate: freshness.marketDate || null,
  };
}

function normalizeOpportunityRow(row) {
  if (!row || typeof row !== 'object' || !row.ticker) return null;
  const features = row.features && typeof row.features === 'object' ? row.features : {};
  return {
    ticker: String(row.ticker).toUpperCase(),
    lane: row.lane || null,
    rank: Number.isFinite(row.rank) ? row.rank : null,
    score: preserveFiniteOrNull(row.score),
    evidenceBand: ['high', 'medium', 'low'].includes(row.evidenceBand) ? row.evidenceBand : 'low',
    failedCondition: typeof row.failedCondition === 'string' ? row.failedCondition : null,
    scoreBreakdown: row.scoreBreakdown && typeof row.scoreBreakdown === 'object'
      ? Object.fromEntries(Object.entries(row.scoreBreakdown).map(([key, value]) => [key, preserveFiniteOrNull(value)]))
      : {},
    dataQuality: normalizeDataQuality(row.dataQuality ?? row.confidence),
    // Absent is not the same as false. The default scan query only returns
    // eligible rows, so only an explicit false may be shown as a gate failure.
    ineligible: row.eligible === false,
    isFca: features.isFca === true,
    levels: normalizeOpportunityLevels(row.levels, features.risk?.netRewardRisk),
    freshness: normalizeOpportunityFreshness(row.freshness),
    reasons: normalizeStringList(row.reasons, 6),
    risks: normalizeStringList(row.risks, 8),
  };
}

export function guardOpportunities(raw) {
  if (!raw || raw.success === false) {
    return { ok: false, error: raw?.error || 'Invalid response', data: null };
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Missing scan data', data: null };
  }

  const run = data.run && typeof data.run === 'object' ? data.run : null;
  const candidates = Array.isArray(data.opportunities)
    ? data.opportunities.map(normalizeOpportunityRow).filter(Boolean)
    : [];

  // A tally, not a re-score. Radar shows how many candidates the backend graded
  // at each data-quality level so a shortlist built on thin sources is visible
  // before any row is opened.
  const dataQualityTally = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const candidate of candidates) dataQualityTally[candidate.dataQuality] += 1;

  return {
    ok: true,
    error: null,
    data: {
      run: run
        ? {
            id: Number.isFinite(run.id) ? run.id : null,
            scannedAt: run.scanned_at || null,
            dataAsOf: run.data_as_of || null,
            universe: run.universe || null,
            configVersion: run.config_version || null,
            totalSeen: Number.isFinite(run.total_seen) ? run.total_seen : null,
            totalEligible: Number.isFinite(run.total_eligible) ? run.total_eligible : null,
            totalShortlisted: Number.isFinite(run.total_shortlisted) ? run.total_shortlisted : null,
            marketCacheAsOf: run.market_cache_as_of || null,
          }
        : null,
      candidates,
      lanes: [...new Set(candidates.map((row) => row.lane).filter(Boolean))].sort(),
      dataQualityTally,
    },
  };
}

function normalizeScoutCandidate(row) {
  if (!row || typeof row !== 'object' || !row.ticker) return null;
  const price = row.price && typeof row.price === 'object' ? row.price : {};
  const broker = row.broker && typeof row.broker === 'object' ? row.broker : null;
  return {
    ticker: String(row.ticker).toUpperCase(),
    name: row.name || row.ticker,
    board: row.board || null,
    rank: Number.isFinite(row.rank) ? row.rank : null,
    score: preserveFiniteOrNull(row.score),
    evidenceBand: ['high', 'medium', 'low'].includes(row.evidenceBand) ? row.evidenceBand : 'low',
    failedCondition: typeof row.failedCondition === 'string' ? row.failedCondition : null,
    scoreBreakdown: row.scoreBreakdown && typeof row.scoreBreakdown === 'object'
      ? Object.fromEntries(Object.entries(row.scoreBreakdown).map(([key, value]) => [key, preserveFiniteOrNull(value)]))
      : {},
    price: {
      lastPrice: preserveFiniteOrNull(price.lastPrice),
      priceDate: price.priceDate || null,
      support: preserveFiniteOrNull(price.support),
      supportTouches: Number.isFinite(price.supportTouches) ? price.supportTouches : 0,
      distanceFromSupportPct: preserveFiniteOrNull(price.distanceFromSupportPct),
      consolidationRangePct: preserveFiniteOrNull(price.consolidationRangePct),
      recentAtrPct: preserveFiniteOrNull(price.recentAtrPct),
      priorAtrPct: preserveFiniteOrNull(price.priorAtrPct),
      volatilityContracting: price.volatilityContracting === true,
      averageValue: preserveFiniteOrNull(price.averageValue),
      ma20: preserveFiniteOrNull(price.ma20),
      aboveMa20: price.aboveMa20 === true,
      ma20SlopePct: preserveFiniteOrNull(price.ma20SlopePct),
      volumeContracting: price.volumeContracting === true,
      zeroVolumeSessions: Number.isFinite(price.zeroVolumeSessions) ? price.zeroVolumeSessions : 0,
      distinctCloses: Number.isFinite(price.distinctCloses) ? price.distinctCloses : 0,
    },
    broker: broker
      ? {
          observedSessions: Number.isFinite(broker.observedSessions) ? broker.observedSessions : 0,
          expectedSessions: Number.isFinite(broker.expectedSessions) ? broker.expectedSessions : 0,
          lead: broker.lead && broker.lead.code
            ? {
                code: String(broker.lead.code).toUpperCase(),
                netValue: preserveFiniteOrNull(broker.lead.netValue),
                buySessions: Number.isFinite(broker.lead.buySessions) ? broker.lead.buySessions : 0,
                sellSessions: Number.isFinite(broker.lead.sellSessions) ? broker.lead.sellSessions : 0,
              }
            : null,
          second: broker.second?.code
            ? { code: String(broker.second.code).toUpperCase(), netValue: preserveFiniteOrNull(broker.second.netValue) }
            : null,
          leadToSecondRatio: preserveFiniteOrNull(broker.leadToSecondRatio),
          leadSharePct: preserveFiniteOrNull(broker.leadSharePct),
        }
      : null,
    reasons: normalizeStringList(row.reasons, 6),
    risks: normalizeStringList(row.risks, 6),
  };
}

export function guardRadarScout(raw) {
  if (!raw || raw.success === false) {
    return { ok: false, error: raw?.error || 'Invalid Scout response', data: null };
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Missing Scout data', data: null };
  }
  const recipe = data.recipe && typeof data.recipe === 'object' ? data.recipe : {};
  const asOf = data.asOf && typeof data.asOf === 'object' ? data.asOf : {};
  const coverage = data.coverage && typeof data.coverage === 'object' ? data.coverage : {};
  return {
    ok: true,
    error: null,
    data: {
      recipe: {
        id: recipe.id || null,
        label: recipe.label || 'Scout',
        description: recipe.description || null,
      },
      options: data.options && typeof data.options === 'object' ? data.options : {},
      asOf: {
        priceDate: asOf.priceDate || null,
        brokerFrom: asOf.brokerFrom || null,
        brokerTo: asOf.brokerTo || null,
        brokerSessions: Number.isFinite(asOf.brokerSessions) ? asOf.brokerSessions : 0,
      },
      coverage: {
        evaluated: Number.isFinite(coverage.evaluated) ? coverage.evaluated : 0,
        matched: Number.isFinite(coverage.matched) ? coverage.matched : 0,
        returned: Number.isFinite(coverage.returned) ? coverage.returned : 0,
        nearMisses: Number.isFinite(coverage.nearMisses) ? coverage.nearMisses : 0,
        insufficientHistorySkipped: Number.isFinite(coverage.insufficientHistorySkipped) ? coverage.insufficientHistorySkipped : 0,
      },
      candidates: Array.isArray(data.candidates)
        ? data.candidates.map(normalizeScoutCandidate).filter(Boolean)
        : [],
      nearMisses: Array.isArray(data.nearMisses)
        ? data.nearMisses.map(normalizeScoutCandidate).filter(Boolean)
        : [],
      disclosures: normalizeStringList(data.disclosures, 6),
    },
  };
}

function normalizeCaseMonitoring(raw) {
  const monitoring = raw && typeof raw === 'object' ? raw : {};
  const current = monitoring.current && typeof monitoring.current === 'object'
    ? monitoring.current
    : null;
  const state = ['meaningful_change', 'no_material_change', 'unavailable'].includes(monitoring.state)
    ? monitoring.state
    : 'unavailable';
  return {
    state,
    material: monitoring.material === true,
    // Tri-state on purpose: null means the frozen snapshot carried no price date,
    // which is not the same as a snapshot known to be current.
    snapshotStale: typeof monitoring.snapshotStale === 'boolean' ? monitoring.snapshotStale : null,
    snapshotAgeDays: preserveFiniteOrNull(monitoring.snapshotAgeDays),
    current: current
      ? {
          runId: Number.isFinite(current.runId) ? current.runId : null,
          scannedAt: current.scannedAt || null,
          lane: current.lane || null,
          eligible: current.eligible === true,
          score: preserveFiniteOrNull(current.score),
          dataQuality: normalizeDataQuality(current.dataQuality ?? current.confidence),
          scoreDelta: preserveFiniteOrNull(current.scoreDelta),
          reasons: normalizeStringList(current.reasons, 6),
          risks: normalizeStringList(current.risks, 8),
        }
      : null,
  };
}

function normalizeCaseItem(item) {
  // Identity only needs to exist and be stable. Rejecting a non-numeric id would
  // silently drop a real saved case, which is the one failure this module cannot
  // have.
  if (!item || typeof item !== 'object' || !item.ticker || item.id == null) return null;
  const snapshot = item.snapshot && typeof item.snapshot === 'object' ? item.snapshot : {};
  return {
    id: item.id,
    ticker: String(item.ticker).toUpperCase(),
    status: item.status || 'watching',
    thesis: typeof item.thesis === 'string' && item.thesis.trim() ? item.thesis.trim() : null,
    triggerPrice: preserveFiniteOrNull(item.triggerPrice),
    invalidationPrice: preserveFiniteOrNull(item.invalidationPrice),
    snapshot: {
      lane: snapshot.lane || null,
      score: preserveFiniteOrNull(snapshot.score),
      dataQuality: normalizeDataQuality(snapshot.dataQuality ?? snapshot.confidence),
      reasons: normalizeStringList(snapshot.reasons, 6),
      risks: normalizeStringList(snapshot.risks, 8),
      levels: normalizeOpportunityLevels(snapshot.levels),
      freshness: normalizeOpportunityFreshness(snapshot.freshness),
    },
    monitoring: normalizeCaseMonitoring(item.monitoring),
    addedAt: item.addedAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export function guardCases(raw) {
  if (!raw || raw.success === false) {
    return { ok: false, error: raw?.error || 'Invalid response', data: null };
  }
  const items = Array.isArray(raw.data?.items)
    ? raw.data.items.map(normalizeCaseItem).filter(Boolean)
    : [];
  return {
    ok: true,
    error: null,
    data: {
      items,
      changedCount: items.filter((item) => item.monitoring.state === 'meaningful_change').length,
      staleCount: items.filter((item) => item.monitoring.snapshotStale === true).length,
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
      actorMap: data.actorMap && typeof data.actorMap === 'object'
        ? {
            ...data.actorMap,
            replay: Array.isArray(data.actorMap.replay) ? data.actorMap.replay : [],
          }
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
      fingerprint: data.fingerprint && typeof data.fingerprint === 'object'
        ? data.fingerprint
        : null,
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

const IDX_SOURCE = /^https:\/\/([^/]+\.)?idx\.co\.id\//i;

export function officialIdxUrl(url) {
  const text = String(url || '').trim();
  return IDX_SOURCE.test(text) ? text : null;
}

function failEnvelope(raw, fallback) {
  return { ok: false, error: raw?.error || fallback, data: null };
}

function normalizeEvidence(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { page: null, snippet: null, officialUrl: null };
  }
    const snippet = raw.snippet ?? raw.text ?? raw.quote ?? '';
  return {
    page: raw.page ?? raw.pageNumber ?? null,
    snippet: String(snippet).trim() || null,
    officialUrl: officialIdxUrl(raw.officialUrl || raw.sourceUrl),
  };
}

function unavailablePage(data) {
  return {
    available: false,
    status: data?.status || 'unavailable',
    reason: data?.reason || null,
    items: [],
    nextCursor: null,
    cursor: 0,
    limit: 0,
    total: 0,
    partial: false,
  };
}

function pagedUnavailable(raw, fallback) {
  if (!raw || raw.success === false) return failEnvelope(raw, fallback);
  const data = raw.data;
  if (!data || typeof data !== 'object') return failEnvelope(raw, fallback);
  if (data.available === false) {
    return { ok: true, error: null, data: unavailablePage(data) };
  }
  return null;
}

function normalizeFeedItem(row) {
  if (!row || typeof row !== 'object' || !row.eventId) return null;
  return {
    eventId: String(row.eventId),
    ticker: row.ticker ? String(row.ticker).toUpperCase() : null,
    issuerName: row.issuerName || null,
    category: row.category || null,
    title: row.title || null,
    publishedAt: row.publishedAt || null,
    effectiveDate: row.effectiveDate || null,
    sourceUrl: officialIdxUrl(row.sourceUrl || row.officialUrl),
    status: row.status || null,
    correctionOf: row.correctionOf || null,
    mappingStatus: row.mappingStatus || null,
    groupId: row.groupId || null,
    eventFamily: row.eventFamily || null,
    hasCorrection: row.hasCorrection === true,
  };
}

function normalizeSignal(row) {
  if (!row || typeof row !== 'object') return null;
  const type = row.type || row.signalType;
  if (!type) return null;
  return {
    anomalyId: row.anomalyId || null,
    type: String(type),
    severity: row.severity || null,
    confidence: preserveFiniteOrNull(row.confidence),
    reason: row.reason || null,
    ruleVersion: row.ruleVersion || null,
    evidence: normalizeEvidence(row.evidence),
    detectedAt: row.detectedAt || null,
    ticker: row.ticker ? String(row.ticker).toUpperCase() : null,
    groupId: row.groupId || null,
  };
}

function normalizeDocument(row) {
  if (!row || typeof row !== 'object' || row.documentId == null) return null;
  return {
    documentId: row.documentId,
    eventId: row.eventId || null,
    sourceUrl: officialIdxUrl(row.sourceUrl),
    contentHash: row.contentHash || null,
    mimeType: row.mimeType || null,
    byteSize: Number.isFinite(row.byteSize) ? row.byteSize : null,
    downloadStatus: row.downloadStatus || null,
    observedAt: row.observedAt || null,
    extraction: row.extraction && typeof row.extraction === 'object'
      ? {
          processorVersion: row.extraction.processorVersion || null,
          method: row.extraction.method || null,
          status: row.extraction.status || null,
          qualityScore: preserveFiniteOrNull(row.extraction.qualityScore),
          pageCount: Number.isFinite(row.extraction.pageCount) ? row.extraction.pageCount : null,
        }
      : null,
  };
}

function isInferredFact(row) {
  const kind = String(row?.valueKind || row?.factKind || '').toLowerCase();
  if (kind === 'inferred' || kind === 'derived' || kind === 'ratio' || kind === 'valuation') return true;
  return row?.inferred === true || row?.isInferred === true;
}

function normalizeStatementFact(row) {
  if (!row || typeof row !== 'object' || isInferredFact(row)) return null;
  const fieldKey = row.fieldKey || row.metricKey;
  if (!fieldKey && row.valueNumeric == null && !row.valueText) return null;
  return {
    statementType: row.statementType || null,
    fieldKey: fieldKey || null,
    label: row.label || fieldKey || null,
    valueNumeric: preserveFiniteOrNull(row.valueNumeric),
    valueText: row.valueText || null,
    unit: row.unit || null,
    confidence: preserveFiniteOrNull(row.confidence),
    evidence: normalizeEvidence(row.evidence),
  };
}

function normalizePeriod(row) {
  if (!row || typeof row !== 'object') return null;
  const facts = Array.isArray(row.facts)
    ? row.facts.map(normalizeStatementFact).filter(Boolean)
    : [];
  return {
    periodLabel: row.periodLabel || row.period || 'unspecified',
    eventId: row.eventId || null,
    title: row.title || null,
    publishedAt: row.publishedAt || null,
    sourceUrl: officialIdxUrl(row.sourceUrl || row.officialUrl),
    parserStatus: row.parserStatus || null,
    parserMethod: row.parserMethod || null,
    parserVersion: row.parserVersion || null,
    facts,
  };
}

export function guardDisclosures(raw) {
  const unavailable = pagedUnavailable(raw, 'Disclosure feed is unavailable.');
  if (unavailable) return unavailable;
  const data = raw.data;
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      items: Array.isArray(data.items) ? data.items.map(normalizeFeedItem).filter(Boolean) : [],
      nextCursor: data.nextCursor ?? null,
      cursor: Number.isFinite(data.cursor) ? data.cursor : 0,
      limit: Number.isFinite(data.limit) ? data.limit : 0,
      total: Number.isFinite(data.total) ? data.total : 0,
      partial: data.partial === true,
    },
  };
}

export function guardDisclosureDetail(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Disclosure detail is unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object' || !data.eventId) {
    return failEnvelope(raw, 'Disclosure not found.');
  }
  return {
    ok: true,
    error: null,
    data: {
      ...normalizeFeedItem(data),
      summary: data.summary || null,
      supersededBy: data.supersededBy || null,
      destination: data.destination || 'keterbukaan',
      correctionChain: Array.isArray(data.correctionChain) ? data.correctionChain : [],
      facts: Array.isArray(data.facts)
        ? data.facts.map((fact) => ({
            key: fact.key,
            valueText: fact.valueText || null,
            valueNumeric: preserveFiniteOrNull(fact.valueNumeric),
            valueDate: fact.valueDate || null,
            unit: fact.unit || null,
            confidence: preserveFiniteOrNull(fact.confidence),
            ruleVersion: fact.ruleVersion || null,
            evidence: normalizeEvidence(fact.evidence),
          }))
        : [],
      signals: Array.isArray(data.signals) ? data.signals.map(normalizeSignal).filter(Boolean) : [],
      documents: Array.isArray(data.documents) ? data.documents.map(normalizeDocument).filter(Boolean) : [],
    },
  };
}

export function guardDisclosureTimeline(raw) {
  const unavailable = pagedUnavailable(raw, 'Disclosure timeline is unavailable.');
  if (unavailable) return unavailable;
  const data = raw.data;
  const items = Array.isArray(data.items)
    ? data.items.map((group) => {
      if (!group || typeof group !== 'object' || !group.groupId) return null;
      return {
        groupId: group.groupId,
        ticker: group.ticker ? String(group.ticker).toUpperCase() : null,
        eventFamily: group.eventFamily || null,
        anchorDate: group.anchorDate || null,
        effectiveDate: group.effectiveDate || null,
        publishedAt: group.publishedAt || null,
        memberCount: Number.isFinite(group.memberCount) ? group.memberCount : 0,
        hasCorrection: group.hasCorrection === true,
        ruleVersion: group.ruleVersion || null,
        members: Array.isArray(group.members)
          ? group.members.map((member) => ({
              eventId: member.eventId,
              role: member.role || null,
              title: member.title || null,
              publishedAt: member.publishedAt || null,
              sourceUrl: officialIdxUrl(member.sourceUrl),
              status: member.status || null,
            }))
          : [],
        anomalies: Array.isArray(group.anomalies) ? group.anomalies.map(normalizeSignal).filter(Boolean) : [],
      };
    }).filter(Boolean)
    : [];
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      items,
      nextCursor: data.nextCursor ?? null,
      total: Number.isFinite(data.total) ? data.total : items.length,
    },
  };
}

export function guardDisclosureAnomalies(raw) {
  const unavailable = pagedUnavailable(raw, 'Disclosure anomalies are unavailable.');
  if (unavailable) return unavailable;
  const data = raw.data;
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      items: Array.isArray(data.items) ? data.items.map(normalizeSignal).filter(Boolean) : [],
      nextCursor: data.nextCursor ?? null,
      total: Number.isFinite(data.total) ? data.total : 0,
      partial: data.partial === true,
    },
  };
}

export function guardDisclosureDocuments(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Document metadata is unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return failEnvelope(raw, 'Document not found.');
  }
  if (Array.isArray(data.items) || data.documentId == null) {
    const items = Array.isArray(data.items)
      ? data.items.map(normalizeDocument).filter(Boolean)
      : [];
    return { ok: true, error: null, data: { items } };
  }
  const document = normalizeDocument(data);
  if (!document) return failEnvelope(raw, 'Document not found.');
  return { ok: true, error: null, data: document };
}

export function guardFundamentalStatements(raw) {
  const unavailable = pagedUnavailable(raw, 'Fundamental statements are unavailable.');
  if (unavailable) return unavailable;
  const data = raw.data;
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      items: Array.isArray(data.items) ? data.items.map(normalizePeriod).filter(Boolean) : [],
      nextCursor: data.nextCursor ?? null,
      total: Number.isFinite(data.total) ? data.total : 0,
      partial: data.partial === true,
    },
  };
}

function normalizeFiling(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    filingId: row.filingId || null,
    eventId: row.eventId || null,
    filingType: row.filingType || null,
    periodLabel: row.periodLabel || null,
    fiscalYear: Number.isFinite(row.fiscalYear) ? row.fiscalYear : null,
    fiscalPeriod: row.fiscalPeriod || null,
    companyType: row.companyType || 'common',
    extractionStatus: row.extractionStatus || null,
    factCount: Number.isFinite(row.factCount) ? row.factCount : 0,
    parsedAt: row.parsedAt || null,
    sourceUrl: officialIdxUrl(row.sourceUrl),
    publishedAt: row.publishedAt || null,
    title: row.title || null,
  };
}

export function guardFundamentalsSnapshot(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Fundamentals snapshot is unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return failEnvelope(raw, 'Missing fundamentals snapshot data.');
  }
  if (data.available === false) {
    return {
      ok: true,
      error: null,
      data: {
        available: false,
        reason: data.reason || 'v18 fundamentals tables are not present.',
        ticker: data.ticker || null,
      },
    };
  }
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      ticker: data.ticker || null,
      companyType: data.companyType || null,
      filingCount: Number.isFinite(data.filingCount) ? data.filingCount : 0,
      latestPeriod: data.latestPeriod || null,
      latestFiscalYear: Number.isFinite(data.latestFiscalYear) ? data.latestFiscalYear : null,
      latestFilingId: data.latestFilingId || null,
      latestExtractionStatus: data.latestExtractionStatus || null,
      latestFactCount: Number.isFinite(data.latestFactCount) ? data.latestFactCount : 0,
      latestParsedAt: data.latestParsedAt || null,
      periods: Array.isArray(data.periods) ? data.periods.filter(Boolean) : [],
      filings: Array.isArray(data.filings) ? data.filings.map(normalizeFiling).filter(Boolean) : [],
    },
  };
}

export function guardFundamentalsPeriods(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Fundamentals periods are unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return failEnvelope(raw, 'Missing fundamentals periods data.');
  }
  return {
    ok: true,
    error: null,
    data: {
      available: data.available === true,
      ticker: data.ticker || null,
      filings: Array.isArray(data.filings) ? data.filings.map(normalizeFiling).filter(Boolean) : [],
      legacy: Array.isArray(data.legacy)
        ? data.legacy.map((row) => ({
            source: 'legacy',
            eventId: row.eventId || null,
            periodLabel: row.periodLabel || null,
            publishedAt: row.publishedAt || null,
            factCount: Number.isFinite(row.factCount) ? row.factCount : 0,
          }))
        : [],
    },
  };
}

function normalizeFact(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.factId == null && !row.fieldKey) return null;
  return {
    factId: row.factId ?? null,
    filingId: row.filingId || null,
    statementType: row.statementType || null,
    section: row.section || null,
    columnLabel: row.columnLabel || null,
    periodLabel: row.periodLabel || null,
    fieldKey: row.fieldKey || null,
    valueNumeric: preserveFiniteOrNull(row.valueNumeric),
    unit: row.unit || null,
    confidence: preserveFiniteOrNull(row.confidence),
    evidence: normalizeEvidence(row.evidence),
    extractedAt: row.extractedAt || null,
    companyType: row.companyType || null,
  };
}

export function guardFundamentalsFacts(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Fundamentals facts are unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return failEnvelope(raw, 'Missing fundamentals facts data.');
  }
  if (data.available === false) {
    return {
      ok: true,
      error: null,
      data: {
        available: false,
        reason: data.reason || 'v18 fundamental_facts table is not present.',
        filingId: null,
        items: [],
        total: 0,
        nextCursor: null,
      },
    };
  }
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      filingId: data.filingId || null,
      items: Array.isArray(data.items) ? data.items.map(normalizeFact).filter(Boolean) : [],
      total: Number.isFinite(data.total) ? data.total : 0,
      cursor: Number.isFinite(data.cursor) ? data.cursor : 0,
      limit: Number.isFinite(data.limit) ? data.limit : 0,
      nextCursor: data.nextCursor ?? null,
    },
  };
}

export function guardFundamentalsFiling(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Fundamentals filing is unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return failEnvelope(raw, 'Missing fundamentals filing data.');
  }
  if (data.available === false) {
    return {
      ok: true,
      error: null,
      data: {
        available: false,
        reason: data.reason || 'v18 fundamentals tables are not present.',
      },
    };
  }
  if (Array.isArray(data.filings)) {
    return {
      ok: true,
      error: null,
      data: {
        available: true,
        ticker: data.ticker || null,
        filings: data.filings.map(normalizeFiling).filter(Boolean),
      },
    };
  }
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      ...(normalizeFiling(data) || {}),
      parserVersion: data.parserVersion || null,
      statementCount: Number.isFinite(data.statementCount) ? data.statementCount : 0,
      updatedAt: data.updatedAt || null,
    },
  };
}

function normalizeDerivedInput(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    factId: raw.factId ?? null,
    fieldKey: raw.fieldKey || null,
    valueNumeric: preserveFiniteOrNull(raw.valueNumeric),
    unit: raw.unit || null,
    confidence: preserveFiniteOrNull(raw.confidence),
    evidence: normalizeEvidence(raw.evidence),
    periodLabel: raw.periodLabel || null,
  };
}

function normalizeDerivedMetric(row) {
  if (!row || typeof row !== 'object' || !row.key) return null;
  return {
    key: String(row.key),
    label: row.label || row.key,
    formula: row.formula || null,
    unit: row.unit || null,
    section: row.section || null,
    available: row.available === true,
    value: preserveFiniteOrNull(row.value),
    inputs: {
      numerator: normalizeDerivedInput(row.inputs?.numerator),
      denominator: normalizeDerivedInput(row.inputs?.denominator),
    },
    rejectionReason: row.rejectionReason || null,
  };
}

export function guardFundamentalsDerived(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Derived metrics are unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return failEnvelope(raw, 'Missing derived metrics data.');
  }
  if (data.available === false) {
    return {
      ok: true,
      error: null,
      data: {
        available: false,
        reason: data.reason || 'v18 fundamental_facts table is not present.',
        filingId: null,
        periodLabel: null,
        companyType: null,
        metrics: [],
      },
    };
  }
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      filingId: data.filingId || null,
      periodLabel: data.periodLabel || null,
      companyType: data.companyType || 'common',
      metrics: Array.isArray(data.metrics)
        ? data.metrics.map(normalizeDerivedMetric).filter(Boolean)
        : [],
    },
  };
}

export function guardFundamentalsSources(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Fundamentals sources are unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return failEnvelope(raw, 'Missing fundamentals sources data.');
  }
  if (data.available === false) {
    return {
      ok: true,
      error: null,
      data: {
        available: false,
        reason: data.reason || 'v18 fundamentals tables are not present.',
        ticker: null,
        sources: [],
      },
    };
  }
  return {
    ok: true,
    error: null,
    data: {
      available: true,
      ticker: data.ticker || null,
      sources: Array.isArray(data.sources)
        ? data.sources.map((row) => ({
            filingId: row.filingId || null,
            periodLabel: row.periodLabel || null,
            fiscalYear: Number.isFinite(row.fiscalYear) ? row.fiscalYear : null,
            fiscalPeriod: row.fiscalPeriod || null,
            eventId: row.eventId || null,
            sourceUrl: officialIdxUrl(row.sourceUrl),
            publishedAt: row.publishedAt || null,
            title: row.title || null,
          }))
        : [],
    },
  };
}

export function guardNewsDetector(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'News Detector is unavailable.');
  }
  const data = raw.data;
  if (!data || typeof data !== 'object') {
    return failEnvelope(raw, 'Missing News Detector data.');
  }
  if (data.available === false) {
    return {
      ok: true,
      error: null,
      data: {
        available: false,
        reason: data.reason || 'News Detector schema v18 is unavailable.',
        run: null,
        items: [],
      },
    };
  }
  const run = data.run && typeof data.run === 'object'
    ? {
        id: data.run.id ?? null,
        scanDate: data.run.scanDate || data.run.scan_date || null,
        taxonomyVersion: data.run.taxonomyVersion || data.run.taxonomy_version || null,
        status: data.run.status || null,
        totalDisclosures: Number(data.run.totalDisclosures ?? data.run.total_disclosures ?? 0),
        scoredCount: Number(data.run.scoredCount ?? data.run.scored_count ?? 0),
        suppressedCount: Number(data.run.suppressedCount ?? data.run.suppressed_count ?? 0),
        materialCount: Number(data.run.materialCount ?? data.run.material_count ?? 0),
        error: data.run.error || null,
        startedAt: data.run.startedAt || data.run.started_at || null,
        finishedAt: data.run.finishedAt || data.run.finished_at || null,
      }
    : null;
  const items = Array.isArray(data.items)
    ? data.items.map((row) => {
      if (!row || typeof row !== 'object') return null;
      return {
        eventId: row.eventId || row.event_id || null,
        ticker: row.ticker || null,
        title: row.title || null,
        publishedAt: row.publishedAt || row.published_at || null,
        disposition: row.disposition || 'inconclusive',
        category: row.category || 'unclassified',
        signalScore: Number(row.signalScore ?? row.signal_score ?? 0),
        suppressionReason: row.suppressionReason || row.suppression_reason || null,
        taxonomyVersion: row.taxonomyVersion || row.taxonomy_version || null,
        ruleVersion: row.ruleVersion || row.rule_version || null,
        scoreBreakdown: row.scoreBreakdown || row.score_breakdown || {},
        evidence: Array.isArray(row.evidence) ? row.evidence : [],
        officialSourceUrl: officialIdxUrl(row.officialSourceUrl || row.official_source_url),
        processedAt: row.processedAt || row.processed_at || null,
      };
    }).filter(Boolean)
    : [];
  return {
    ok: true,
    error: null,
    data: { available: true, run, items },
  };
}

export function guardCollectorHealth(raw) {
  if (!raw || raw.success === false) {
    return failEnvelope(raw, 'Collector health is unavailable.');
  }
  const data = raw.data && typeof raw.data === 'object' ? raw.data : {};
  const feeds = Array.isArray(data.feeds)
    ? data.feeds.map((feed) => ({
        feed: feed.feed || null,
        dateFrom: feed.dateFrom || null,
        dateTo: feed.dateTo || null,
        lastSuccessAt: feed.lastSuccessAt || null,
        lastPartialAt: feed.lastPartialAt || null,
        lastFailureAt: feed.lastFailureAt || null,
        exhausted: feed.exhausted === true,
        lastError: feed.lastError || null,
        updatedAt: feed.updatedAt || null,
      }))
    : [];
  return {
    ok: true,
    error: null,
    data: {
      available: data.available === true,
      status: data.status || 'unavailable',
      feeds,
    },
  };
}
