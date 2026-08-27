# Buru IDX — Project Introduction for Cursor

## What this project is

Buru IDX is an IDX decision-support workstation for screening the market,
investigating a ticker, reading broker flow, and evaluating setup risk. It uses
delayed, cached, or asynchronously refreshed data. It is not a brokerage,
order-entry system, live quote terminal, or recommendation engine.

This repository owns the Vite/React frontend and two HTTP boundaries:

- `server.js` serves a production build locally and proxies an explicit API
  allowlist to a private analysis service.
- `worker/index.js` is the Cloudflare static/API edge. It forwards only approved
  routes and parameters to an Access-protected origin.

The backend owns all analysis, ranking, setup geometry, broker calculations,
data freshness, and coverage decisions. React validates and presents returned
contracts; it must not reproduce backend formulas.

## Read these first

1. `AGENTS.md` — mandatory local-only and branch-safety rules.
2. `CURRENT_STATE.md` — the exact staging/production split and next work.
3. `ARCHITECTURE.md` — component ownership, routes, and deployment boundaries.
4. `README.md` — local setup and standard commands.

## Main code ownership

- `src/features/radar/` — Screener UI. The backend defines conditions,
  qualification, and ranking.
- `src/features/workbench/` — Stock Analysis, chart, setup evidence, broker
  evidence, and risk simulation.
- `src/features/broker-intelligence/` — stock/broker flow lenses.
- `src/components/AnalysisShell.jsx` — navigation, theme, and global ticker.
- `src/components/AnalysisContext.jsx` — cross-route ticker/window context.
- `src/lib/api/client.js` — the only browser API boundary.
- `src/lib/api/contracts.js` — browser-facing contract normalization.
- `src/lib/public-api-allowlist.js` — Node proxy route/method/query boundary.
- `worker/index.js` — Cloudflare route/method/query and response boundary.
- `src/styles/` — shared visual tokens and layout system.

Parked staging code for Fundamentals, News Detector, and disclosures remains in
the repository but is not a green light to expose those products. Follow
`CURRENT_STATE.md` and `ARCHITECTURE.md` before changing routes or navigation.

## Local workflow

Use Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Leave `VITE_API_BASE` empty for same-origin behavior, or point it only to a
developer-provided local/mock API. Every `VITE_*` value is browser-visible; it
must never contain a credential.

Before handing work back:

```bash
npm test
npm run build
npm audit
```

Do not run a deployment command. Cursor's job is local implementation,
verification, and a reviewable diff or feature-branch commit.

## Engineering invariants

- Search before creating utilities or components.
- Keep one function focused on one job and reuse existing contract/formatter
  layers.
- Preserve stale-request protection when changing ticker-driven screens.
- Keep API routes, methods, and query parameters explicitly allowlisted.
- Never forward browser credentials or arbitrary request headers upstream.
- Never expose filesystem paths, SQL, private positions, operator errors, or
  upstream credentials in public responses.
- Keep evidence age, methodology, and limitations visible to the trader.
- Add regression tests for every behavior or boundary change.

## Branch model

- `develop` is the staging development line.
- `main` is the production line.
- They are intentionally not merged wholesale.
- Production advances through selective reviewed ports only.

Cursor must work locally from `develop` or a `feature/<task-name>` branch and
must not push or merge protected branches without explicit authorization.
