/**
 * Stabilization visual capture — mocked API, both themes.
 * Run: node scripts/capture-stabilization-screens.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Install Playwright temporarily: npm install -D playwright && npx playwright install chromium');
  process.exit(1);
}

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const OUT = fileURLToPath(new URL('../docs/design/2026-08-11-workstation-redesign/screenshots/stabilization/', import.meta.url));
const ARTIFACTS = '/opt/cursor/artifacts/nalar-graphite-stabilization';

mkdirSync(OUT, { recursive: true });
mkdirSync(ARTIFACTS, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function candles(n = 60) {
  const rows = [];
  let close = 4400;
  for (let i = 0; i < n; i += 1) {
    const open = close;
    const high = open + 40 + (i % 7);
    const low = open - 35 - (i % 5);
    close = open + ((i % 3) - 1) * 18;
    const date = new Date(Date.UTC(2026, 4, 1 + i));
    rows.push({
      date: date.toISOString().slice(0, 10),
      open, high, low, close,
      volume: 8_000_000 + i * 50_000,
    });
  }
  return rows;
}

const CANDLES = candles();

const FIXTURES = {
  opportunities: {
    success: true,
    data: {
      run: {
        id: 41, scanned_at: '2026-08-10T02:15:00.000Z', data_as_of: '2026-08-07',
        universe: 'idx-all', config_version: '1.4.0',
        total_seen: 812, total_eligible: 96, total_shortlisted: 3,
        market_cache_as_of: '2026-08-07',
      },
      opportunities: [
        {
          ticker: 'BJTM', lane: 'second-liner', eligible: true, rank: 1, score: 74.25,
          dataQuality: 'high',
          levels: { support: 520, resistance: 610, trigger: 560, invalidation: 505, last: 548, netRewardRisk: 2.1 },
          features: { isFca: false },
          reasons: ['compression resolved'], risks: ['thin traded value'],
          freshness: { priceDate: '2026-08-07', priceAgeDays: 1 },
        },
        {
          ticker: 'BBRI', lane: 'first-liner', eligible: true, rank: 2, score: 71.1,
          dataQuality: 'high',
          levels: { support: 4200, resistance: 5000, trigger: 4550, invalidation: 4180, last: 4500, netRewardRisk: 2.4 },
          features: { isFca: false },
          reasons: ['rising volume'], risks: ['near resistance'],
          freshness: { priceDate: '2026-08-07', priceAgeDays: 1 },
        },
      ],
    },
  },
  scout: {
    success: true,
    data: {
      recipe: { id: 'quiet_accumulation', label: 'Quiet Accumulation Near Support' },
      options: { brokerSessions: 7 },
      asOf: { priceDate: '2026-08-10', brokerFrom: '2026-07-31', brokerTo: '2026-08-10', brokerSessions: 7 },
      coverage: { evaluated: 900, matched: 2, returned: 2, nearMisses: 1 },
      candidates: [
        {
          ticker: 'AHAP', name: 'Asuransi Harta Aman Pratama Tbk', board: 'Development',
          rank: 1, score: 88.4, evidenceBand: 'high', failedCondition: null,
          scoreBreakdown: { broker: 41, support: 32, compression: 12.5 },
          price: {
            lastPrice: 101, priceDate: '2026-08-10', support: 98, supportTouches: 4,
            distanceFromSupportPct: 3.06, consolidationRangePct: 7.1, recentAtrPct: 2,
            priorAtrPct: 3, volatilityContracting: true, averageValue: 1_100_000_000, zeroVolumeSessions: 0,
          },
          broker: {
            observedSessions: 7, expectedSessions: 7,
            lead: { code: 'CC', netValue: 1_200_000_000, buySessions: 6, sellSessions: 1 },
            second: { code: 'YP', netValue: 300_000_000 },
            leadToSecondRatio: 4, leadSharePct: 58,
          },
          reasons: ['CC accumulated across 6/7 sessions.'],
          risks: ['CC distributed in 1 observed session.'],
        },
      ],
      nearMisses: [
        {
          ticker: 'SMMA', name: 'Sinarmas Multiartha', board: 'Main',
          rank: null, score: 62, evidenceBand: 'low', failedCondition: 'liquidity',
          scoreBreakdown: { broker: 20, support: 22, compression: 10 },
          price: {
            lastPrice: 720, priceDate: '2026-08-10', support: 700, supportTouches: 2,
            distanceFromSupportPct: 2.8, consolidationRangePct: 9, recentAtrPct: 3,
            priorAtrPct: 3.2, volatilityContracting: false, averageValue: 400_000_000, zeroVolumeSessions: 0,
          },
          broker: {
            observedSessions: 7, expectedSessions: 7,
            lead: { code: 'YP', netValue: 200_000_000, buySessions: 4, sellSessions: 2 },
            second: { code: 'CC', netValue: 100_000_000 },
            leadToSecondRatio: 2, leadSharePct: 40,
          },
          reasons: [], risks: ['Average value below recipe floor.'],
        },
      ],
      disclosures: ['Observed flow is not a holdings ledger.'],
    },
  },
  analyze: {
    success: true,
    data: {
      ticker: {
        symbol: 'BBRI', name: 'Bank Rakyat Indonesia', close: 4500, change: 50, changePct: 1.12,
        open: 4450, high: 4520, low: 4430, vwap: 4480, value: 450_000_000_000,
        volume: 12_500_000, frequency: 42000, fnet: 15_000_000_000, tier: 'liquid',
        notations: [], uma: false,
      },
      priceHistory: { rsi14: 58.2, atr14Pct: 2.1, ret5d: 3.2, ret20d: 5.1, ret60d: 8.4 },
      grade: { grade: 'B+', regime: 'trending', structurePhase: 'established', lenses: {} },
      stance: { stance: 'LONG_LEAN' },
      scorecard: { factors: [{ factor: 'Momentum', signal: 1, reason: 'RSI above 50' }] },
      riskGeometry: {
        nearestSupport: 4300, nearestResistance: 4700, downsidePct: 4.44, upsidePct: 4.44,
        rewardRisk: 1, netRewardRisk: 0.85,
        bestSetup: { entry: 4520, stop: 4300, target: 4700, rr: 1, netRR: 0.85, costPct: 0.3 },
      },
      chart: {
        candles: CANDLES,
        movingAverages: {
          ma20: CANDLES.map((row, i) => ({ date: row.date, value: i < 19 ? null : 4450 + (i % 9) })),
        },
        levels: {
          supports: [{ price: 4300, touches: 3 }],
          resistances: [{ price: 4700, touches: 2 }],
        },
        source: { name: 'stockbit-chartbit', lastDate: CANDLES.at(-1).date },
      },
      supportResistance: { supports: [{ price: 4300 }], resistances: [{ price: 4700 }] },
      broker: {
        available: true, symbol: 'BBRI', from: '2026-08-07',
        buyers: [{ code: 'NI', sourceType: 'Local', netValue: 2e11 }],
        sellers: [{ code: 'YU', sourceType: 'Foreign', netValue: -2e11 }],
      },
      debate: { bull: [], bear: [] },
      dataQuality: { sources: ['stockbit'], warnings: [] },
      investigation: { question: { title: 'What confirms the structure?' }, timeline: [], contradictions: [] },
    },
  },
  brokerHealth: {
    success: true,
    data: {
      available: true, canonicalTickers: 957, latestCompletedDate: '2026-08-07', coverage: 0.87,
      latestDate: { date: '2026-08-07', accounted: 830, expected: 957, complete: false },
      serving: { mode: 'delayed', asOf: '2026-08-07' },
      completedLagSessions: 1, completedCoverageStalled: false, gapStockDays: 0,
    },
    meta: { calendarCoverage: { status: 'ok', uncoveredWeekdays: [] }, disclosures: [] },
  },
  brokerStock: {
    success: true,
    data: {
      ticker: 'BBRI', name: 'Bank Rakyat Indonesia',
      window: { days: 1, from: '2026-08-07', to: '2026-08-07', tradingSessions: 1, populatedSessions: 1, gapSessions: 0, missingSessions: 0, complete: true },
      observedFlow: { netValue: 1e10 },
      preferredBroker: { codes: ['NI'], observedCodes: ['NI'], netValue: 2e11, totalPositiveNetValue: 3e11, share: 0.42 },
      accumulation: [
        { code: 'NI', sourceType: 'Local', netValue: 2e11, netLots: 12000, estimatedAverageCost: 4400, consistency: 'persistent' },
        { code: 'PD', sourceType: 'Local', netValue: 4e10, netLots: 2000 },
      ],
      distribution: [
        { code: 'YU', sourceType: 'Foreign', netValue: -1.5e11, netLots: -9000 },
        { code: 'YP', sourceType: 'Local', netValue: -3e10, netLots: -1800 },
      ],
      rotationHandoff: null,
      actorMap: { replay: [] },
    },
    meta: { disclosures: [] },
  },
  cases: { success: true, data: { items: [], changedCount: 0, staleCount: 0 } },
};

function mockBody(url) {
  const path = url.split('?')[0];
  if (path === '/api/opportunities') return FIXTURES.opportunities;
  if (path === '/api/radar/scout') return FIXTURES.scout;
  if (path.startsWith('/api/analyze')) return FIXTURES.analyze;
  if (path === '/api/broker-intelligence/health') return FIXTURES.brokerHealth;
  if (path.startsWith('/api/broker-intelligence/stock')) return FIXTURES.brokerStock;
  if (path === '/api/watchlist') return FIXTURES.cases;
  return { success: false, error: `no fixture for ${path}` };
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = req.url || '/';
      if (url.startsWith('/api/')) {
        const body = mockBody(url);
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(body));
        return;
      }
      let filePath = join(ROOT, url === '/' ? 'index.html' : decodeURIComponent(url.split('?')[0]));
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        filePath = join(ROOT, 'index.html');
      }
      const type = TYPES[extname(filePath)] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function setTheme(page, theme) {
  await page.evaluate((value) => {
    localStorage.setItem('nalar-theme', value);
    document.documentElement.dataset.theme = value;
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
}

async function shot(page, name) {
  const file = `${name}.png`;
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage: true });
  const copy = join(ARTIFACTS, file);
  readFileSync(path); // ensure written
  await page.screenshot({ path: copy, fullPage: true });
  console.log('wrote', file);
}

async function main() {
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(`${base}/radar`, { waitUntil: 'networkidle' });
    await setTheme(page, 'dark');
    await page.waitForSelector('text=BJTM');
    await shot(page, '01-dark-market-shortlist');

    await setTheme(page, 'light');
    await page.waitForSelector('text=BJTM');
    await shot(page, '02-light-market-shortlist');

    await page.getByRole('tab', { name: /Custom Screener/i }).click();
    await page.getByRole('button', { name: /Run Screener/i }).click();
    await page.locator('.scout-results').getByText('AHAP').waitFor({ state: 'visible' });
    await page.locator('.scout-results').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot(page, '04-light-custom-screener');

    await setTheme(page, 'dark');
    await page.getByRole('tab', { name: /Custom Screener/i }).click();
    await page.getByRole('button', { name: /Run Screener/i }).click();
    await page.locator('.scout-results').getByText('AHAP').waitFor({ state: 'visible' });
    await page.locator('.scout-results').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot(page, '03-dark-custom-screener');

    await page.setViewportSize({ width: 1366, height: 768 });
    await shot(page, '09-1366-custom-screener');
    await page.setViewportSize({ width: 1440, height: 900 });

    await setTheme(page, 'dark');
    await page.goto(`${base}/workbench?ticker=BBRI`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Price & volume');
    await page.waitForTimeout(600);
    await shot(page, '05-dark-stock-analysis');

    await setTheme(page, 'light');
    await page.goto(`${base}/workbench?ticker=BBRI`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Price & volume');
    await page.waitForTimeout(600);
    await shot(page, '06-light-stock-analysis-light-chart');

    await setTheme(page, 'dark');
    await page.goto(`${base}/broker-intelligence?lens=stock&ticker=BBRI&days=1`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.bi-window__btn');
    await page.waitForTimeout(600);
    await shot(page, '07-dark-broker-flow');

    await setTheme(page, 'light');
    await page.goto(`${base}/broker-intelligence?lens=stock&ticker=BBRI&days=1`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.bi-window__btn');
    await page.waitForTimeout(600);
    await shot(page, '08-light-broker-flow');

    await setTheme(page, 'dark');
    await page.goto(`${base}/cases`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Your watchlist is empty');
    await shot(page, '10-dark-watchlist-empty');

    await setTheme(page, 'light');
    await page.goto(`${base}/cases`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Your watchlist is empty');
    await shot(page, '11-light-watchlist-empty');

    await setTheme(page, 'dark');
    await page.goto(`${base}/workbench`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Enter a ticker');
    await shot(page, '12-dark-stock-analysis-empty');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
