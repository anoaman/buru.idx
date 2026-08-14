# Stock Analysis

Private Vite/React workstation for IDX investigation and broker intelligence.
It is the primary analysis product and will absorb the useful discovery and
case-tracking capabilities from the retiring Trading Analysis Platform cockpit.

## Routes

- `/workbench` provides ticker analysis, technical evidence, trade geometry,
  broker evidence, and the optional TradingView comparison.
- `/broker-intelligence` provides stock and broker lenses over observed broker
  flow and estimated inventory curves.
- `/keterbukaan` is the standalone Keterbukaan Informasi feed: official IDX
  disclosures, filters, event/signal cards, correction timelines, evidence,
  and Collector freshness. Story Intelligence stays off this surface.
- `/` redirects to `/workbench`.
- Stock Analysis also has a Fundamentals drawer tab for parsed statement
  periods. It does not compute ratios or inferred values.

## Private delayed-data intent

This private surface is decision-support software built around delayed, cached,
or asynchronously refreshed market data. It is not a live quote terminal,
brokerage connection, order-entry system, or recommendation engine. Coverage
and methodology disclosures from the backend remain visible in the interface.

The application is private-only. Bind it to loopback or the host's Tailscale
address and never expose the raw analysis API. The read-only route allowlist and
rate limiter remain in place as defense in depth while Analysis V2 introduces
private Radar and Cases workflows.

## Backend boundary

All first-party requests are made through `src/lib/api/client.js` and are
prefixed with `VITE_API_BASE`. Leave `VITE_API_BASE` empty for same-origin
dev/`npm start`. Keterbukaan and Fundamentals GETs are served locally from
`trading-db` when `TRADING_DB_PATH` is set. Production `server.js` fails
closed if that path is missing. The demo fixture
`fixtures/keterbukaan-demo.sqlite` is created only when
`STOCK_ANALYSIS_DISCLOSURE_FIXTURE=1` is set for Vite; never production
`idx.db` as a side effect. Analyze and Broker Flow still proxy to the
delayed analysis API on `:8787`.

`server.js` serves the production build and proxies a strict read-only subset of
the loopback API. It is not an internet edge and must remain on the private
network until application authentication exists.

Private Stockbit/token maintenance errors are sanitized in the browser client.
The preferred production backend is still a delayed/cache-serving API, not a
live token-dependent endpoint exposed raw.

```bash
cp .env.example .env.local
# Edit VITE_API_BASE for the API environment.
npm install
npm run dev
```

The production-style local service runs with:

```bash
npm run build
npm start
```

Do not put Stockbit credentials, upstream tokens, or other secrets in
`VITE_API_BASE` or any `VITE_*` variable because Vite embeds them in the browser
bundle.

## Verification

```bash
npm test
npm run build
```
