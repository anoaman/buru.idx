# Stock Analysis Architecture

## Purpose

Private Vite/React workstation for IDX investigation and broker intelligence.
This is the primary analysis product. It will absorb discovery and lightweight
case tracking from the retiring cockpit without duplicating backend engines.

## Boundaries

- `src/features/workbench/` owns ticker analysis presentation and chart views.
  Layout order is market overview, full-width market chart, then a docked
  accessible `DetailDrawer` with tabs: Levels · Indicators · Broker Flow ·
  What Changed · Risk Simulator · Methodology. The chart uses TradingView
  Lightweight Charts so first-party levels remain auditable. Nothing on the
  page may be labelled from a stale request: cold loads use skeletons; warm
  ticker switches keep the previous completed frame (still labelled with its
  own ticker) dimmed under a non-blocking “Loading {ticker}…” overlay; a
  response that is no longer the newest request is discarded rather than
  rendered; failures name the ticker that failed and do not silently replace
  a prior good frame.
- `src/features/workbench/DetailDrawer.jsx` owns tablist/tab/tabpanel
  semantics and keyboard Left/Right/Home/End navigation. Network-triggering
  panels (BrokerEvidence) mount only when their tab is selected.
- `src/features/broker-intelligence/` owns stock/broker lenses, the merged
  signed ranking table (frontend display merge of accumulation + distribution
  arrays only), and inventory curve presentation.
- `src/lib/api/client.js` is the only first-party network boundary and prefixes
  every API path with `VITE_API_BASE`. Successful GET responses for
  `/api/broker-intelligence/*` and `/api/analyze` are cached ~45s with
  in-flight dedupe; failures are never cached.
  `invalidateBrokerCache()` clears only broker-intelligence keys.
- `src/lib/api/contracts.js` normalizes only the contracts consumed by these
  features. Scout candidates keep `evidenceBand`, `failedCondition`, and
  `scoreBreakdown`.
- `src/lib/format/market.js` owns only the market formatters they consume.
- `src/components/AnalysisShell.jsx` owns private navigation and the global
  ticker command bar. Broker date windows are owned by Broker Flow, not the
  shell. Theme preference uses `localStorage` key `nalar-theme` and
  `document.documentElement.dataset.theme`. First visit defaults to Graphite
  Ledger (`dark`); Paper Ledger is the redesigned `light` theme. Chart canvas
  follows the active theme (light chart in Paper, dark chart in Graphite).
  Stock Analysis uses the global command-bar ticker field only — there is no
  page-level duplicate search.
- `src/components/AnalysisContext.jsx` owns cross-route ticker, window and as-of
  context. Feature pages remain responsible for their own network state.
- `src/features/radar/` and `src/features/cases/` read the scan and case
  contracts through `contracts.js` like every other feature. They rank nothing,
  score nothing, and decide no material change; those all arrive already
  computed. Radar's lane filter only hides rows the backend already ranked.
  Custom Screener uses a split layout (conditions column + results table) and
  forwards broker custom range / lead-broker minimum through the public
  allowlist.
- `confidence` is a deprecated pre-1.2 alias for source freshness and coverage,
  not outcome probability. The view models expose it as `dataQuality` and drop
  the alias, so no component can render it under the wrong label.
- Radar's Scout sub-view reads deterministic `/api/radar/scout` results. The
  backend owns recipes, thresholds, measurements, qualification and ranking;
  React only submits bounded filters and renders the returned evidence,
  component score breakdown, evidence band, and separately labelled near misses.
- Trader-facing labels use Screener / Market Shortlist / Custom Screener / Stock
  Analysis / Broker Flow / Watchlist. Internal route names remain stable. The
  global ticker selection is shared by Stock Analysis and Broker Flow; Screener
  handoffs open in new tabs so the originating result set is preserved.
- Broker Flow and Custom Screener expose named and custom calendar ranges while
  reporting the actual observed trading-day count. Chart defaults show the
  latest 60 trading days, exclude overlays from the initial price range, keep
  manual scale control, and allow moving-average lines to be hidden.
- `src/styles/tokens.css` owns the Paper Ledger (light) and Graphite Ledger
  (dark) semantic theme contract plus motion tokens. Feature styles consume
  semantic tokens rather than theme-specific color literals.
- `src/styles/global.css` owns typography, numerical rendering and universal
  interaction states (including `prefers-reduced-motion`).
  `src/styles/components.css` owns shared shell, panel, table, control,
  drawer and responsive geometry; feature components may supply class
  structure but must not create independent visual systems.

The frontend performs no analysis, ranking, broker inventory, or coverage
calculation. Those remain backend responsibilities.

## Routes

- `/workbench`
- `/broker-intelligence`
- `/radar`
- `/cases`

The root and unknown routes redirect to `/workbench`.

## Deployment boundary

`server.js` serves the build and proxies an allowlisted subset of the loopback
analysis API. The service must bind only to loopback or the host's Tailscale
address. Private-only is a product boundary, not a temporary deployment detail.
The raw API remains loopback-only and no upstream credential may enter the
browser bundle.

The existing read-only allowlist, delayed-mode enforcement, error sanitization,
and rate limiting remain as defense in depth. Radar and Cases may add private
read/write routes only after their exact contracts are reviewed; they must not
turn the proxy into a wildcard forwarder.

## Analysis V2 baseline

- Broker Intelligence defaults to one completed trading session. Named ranges
  and custom inclusive dates must display both resolved endpoints and the
  observed trading-session count.
- Cockpit data remains canonical in `trading-db/idx.db`; no migration, copy, or
  deletion occurs during shell work.
- Opportunity evaluations, frozen watchlist snapshots, trade plans, and trade
  outcomes are preserved until replacement routes are verified against the
  same records.
- FCA remains independently deployed and outside the Analysis V2 UI rewrite.

## Deferred (Graphite pass)

- Chart OHLC hover readout / MA legend highlight: only if implementable via
  existing Lightweight Charts APIs without recreating the chart or changing
  scale — deferred rather than faked.
- Watchlist write workflow and rail count pill.
- House number format (P6 / cross-repo `number.js`).
