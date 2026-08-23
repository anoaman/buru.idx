# Buru IDX

Buru IDX is an IDX market-analysis workstation for screening opportunities,
investigating individual stocks, reading broker flow, and tracking setups. It
combines deterministic market data with an auditable interface: the frontend
explains the evidence it receives but does not invent scores, levels, or trade
signals.

## Platform capabilities

- **Market Shortlist** — ranked opportunities that pass the platform's
  liquidity, structure, confirmation, and reward/risk gates.
- **Custom Screener** — configurable scans for broker accumulation, support,
  compression, price, liquidity, and lead-broker activity.
- **Stock Analysis** — candlestick and volume charting, MA5/10/20/50/200,
  technical levels, indicators, trade geometry, change history, broker
  evidence, and risk simulation.
- **Broker Flow** — stock and broker lenses across preset or custom date ranges,
  including buyer/seller rankings and estimated inventory behavior.
- **Watchlist** — monitored setups and frozen analysis snapshots supplied by the
  backend workflow.
- **Shared investigation context** — ticker selection carries between Stock
  Analysis and Broker Flow, while screener handoffs preserve the originating
  result set.

## Application routes

- `/radar` — Market Shortlist and Custom Screener
- `/workbench` — Stock Analysis
- `/broker-intelligence` — Broker Flow
- `/cases` — Watchlist

The root route redirects to `/workbench`.

## Architecture

The repository contains a Vite/React frontend plus two production boundaries:

All first-party requests are made through `src/lib/api/client.js` and are
prefixed with `VITE_API_BASE`. Leave `VITE_API_BASE` empty for same-origin
dev/`npm start`. Keterbukaan and Fundamentals GETs are served locally from
`trading-db` when `TRADING_DB_PATH` is set. Production `server.js` fails
closed if that path is missing. The demo fixture
`fixtures/keterbukaan-demo.sqlite` is created only when
`STOCK_ANALYSIS_DISCLOSURE_FIXTURE=1` is set for Vite; never production
`idx.db` as a side effect. Analyze and Broker Flow still proxy to the
delayed analysis API on `:8787`.

- `server.js` serves the production build and proxies an allowlisted subset of
  the analysis API for private-network deployments.
- `worker/index.js` provides the equivalent static and API boundary for
  Cloudflare deployments.

All first-party requests pass through `src/lib/api/client.js`. Analysis,
ranking, broker inventory, and data-coverage calculations remain backend
responsibilities; the browser only submits bounded inputs and renders returned
evidence. See [ARCHITECTURE.md](./ARCHITECTURE.md) for ownership rules and
contracts.

## Local development

Requirements: Node.js 20+ and a compatible analysis API.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_API_BASE` in `.env.local` to the API origin. Never place credentials
or secrets in `VITE_*` variables because Vite embeds them in the browser bundle.

## Verification

```bash
npm test
npm run build
```

Run the production-style Node service after building:

```bash
npm start
```

## Data and usage boundary

The platform is decision-support software built on delayed, cached, or
asynchronously refreshed market data. It is not a live quote terminal,
brokerage connection, order-entry system, or recommendation engine. Coverage
and methodology disclosures must remain visible wherever evidence is shown.

## Deployment lanes

- `develop` deploys to the Access-protected staging environment at
  `staging.analysis.tombaklepas.app`.
- `main` deploys to production at `analysis.tombaklepas.app`.
- Feature work starts from `develop`; an explicitly requested tiny production
  fix may start from `main`.

The deployment commands fail when the checked-out branch does not match the
target environment:

```bash
npm run deploy:staging
npm run deploy:production
```
