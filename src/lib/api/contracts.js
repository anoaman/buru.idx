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
    scenario: row.scenario || features.scenario?.scenario || null,
    scenarioFitScore: preserveFiniteOrNull(row.scenarioFitScore ?? features.scenario?.fitScore),
    structureState: row.structureState || features.scenario || null,
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
  const windows = data.windows && typeof data.windows === 'object' ? data.windows : {};
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
      windows: {
        asOf: windows.asOf || null,
        structural: windows.structural && typeof windows.structural === 'object' ? windows.structural : null,
        behavioral: windows.behavioral && typeof windows.behavioral === 'object' ? windows.behavioral : {},
        rules: normalizeStringList(windows.rules, 6),
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
  const lifecycleEvents = Array.isArray(monitoring.lifecycleEvents)
    ? monitoring.lifecycleEvents.slice(0, 20).map((event) => ({
        id: event?.id ?? null,
        eventDate: event?.eventDate || null,
        eventType: event?.eventType || 'unknown',
        severity: ['info', 'warning', 'critical'].includes(event?.severity) ? event.severity : 'info',
        message: typeof event?.message === 'string' ? event.message : '',
        evidence: event?.evidence && typeof event.evidence === 'object' ? event.evidence : {},
      })).filter((event) => event.message)
    : [];
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
    lifecycleEvents,
    latestLifecycleEvent: lifecycleEvents[0] || null,
  };
}

function normalizeCaseItem(item) {
  // Identity only needs to exist and be stable. Rejecting a non-numeric id would
  // silently drop a real saved case, which is the one failure this module cannot
  // have.
  if (!item || typeof item !== 'object' || !item.ticker || item.id == null) return null;
  const snapshot = item.snapshot && typeof item.snapshot === 'object' ? item.snapshot : {};
  const outcome = item.outcome && typeof item.outcome === 'object' ? item.outcome : null;
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
    outcome: outcome ? {
      startDate: outcome.startDate || null,
      horizonSessions: preserveFiniteOrNull(outcome.horizonSessions),
      observedSessions: preserveFiniteOrNull(outcome.observedSessions),
      horizonElapsed: outcome.horizonElapsed === true,
      triggeredDate: outcome.triggeredDate || null,
      mfePct: preserveFiniteOrNull(outcome.mfePct),
      maePct: preserveFiniteOrNull(outcome.maePct),
      benchmarkReturnPct: preserveFiniteOrNull(outcome.benchmarkReturnPct),
      excessReturnPct: preserveFiniteOrNull(outcome.excessReturnPct),
      calculatedThrough: outcome.calculatedThrough || null,
    } : null,
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
        corporateActionAnomalies: Array.isArray(window.corporateActionAnomalies)
          ? window.corporateActionAnomalies.filter((item) => item?.date)
          : [],
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
      flowPersistence: data.flowPersistence && typeof data.flowPersistence === 'object'
        ? {
            brokerCode: data.flowPersistence.brokerCode || null,
            brokerNetValue: preserveFiniteOrNull(data.flowPersistence.brokerNetValue),
            observedSessions: preserveFiniteOrZero(data.flowPersistence.observedSessions),
            positiveSessions: preserveFiniteOrZero(data.flowPersistence.positiveSessions),
            negativeSessions: preserveFiniteOrZero(data.flowPersistence.negativeSessions),
            dominantSide: data.flowPersistence.dominantSide || 'mixed',
            persistenceRatio: preserveFiniteOrNull(data.flowPersistence.persistenceRatio),
            currentStreak: preserveFiniteOrZero(data.flowPersistence.currentStreak),
            streakSide: data.flowPersistence.streakSide || null,
            priceChangePct: preserveFiniteOrNull(data.flowPersistence.priceChangePct),
            divergence: data.flowPersistence.divergence || 'unavailable',
            meaningful: data.flowPersistence.meaningful === true,
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
