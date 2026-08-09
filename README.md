# Stock Analysis

Independent public Vite/React frontend for the IDX Stock Analysis surface. It
extracts the existing Workbench and Broker Intelligence experiences from the
private Trading Analysis Platform without coupling the public build to that
application.

## Routes

- `/workbench` provides ticker analysis, technical evidence, trade geometry,
  broker evidence, and the optional TradingView comparison.
- `/broker-intelligence` provides stock and broker lenses over observed broker
  flow and estimated inventory curves.
- `/` redirects to `/workbench`.

## Delayed-data intent

This public surface is decision-support software built around delayed, cached,
or asynchronously refreshed market data. It is not a live quote terminal,
brokerage connection, order-entry system, or recommendation engine. Coverage
and methodology disclosures from the backend remain visible in the interface.

## Backend boundary

All first-party requests are made through `src/lib/api/client.js` and are
prefixed with `VITE_API_BASE`. The value must point at an API origin that exposes
the existing `/api/analyze` and `/api/broker-intelligence/*` contracts and allows
the frontend origin through CORS.

No production proxy is implemented in this project. Hosting and backend routing
remain separate decisions.

Private Stockbit/token maintenance errors are sanitized in the public client.
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
