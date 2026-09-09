# Stock Analysis Architecture

## Purpose

Private Vite/React workstation for IDX investigation and broker intelligence.
This is the primary analysis product. It will absorb discovery and lightweight
case tracking from the retiring cockpit without duplicating backend engines.

## Boundaries

- `src/features/workbench/` owns ticker analysis presentation and chart views.
  Layout order is market overview, full-width market chart, then a docked
  accessible `DetailDrawer` with tabs: Setup · Indicators · Broker Flow ·
  Risk Simulator. Setup owns levels and meaningful changes; Methodology is a
  compact disclosure below the drawer. The chart uses TradingView
  Lightweight Charts so first-party levels remain auditable. Nothing on the
  page may be labelled from a stale request: cold loads use skeletons; warm
  ticker switches keep the previous completed frame (still labelled with its
  own ticker) dimmed under a non-blocking “Loading {ticker}…” overlay; a
  response that is no longer the newest request is discarded rather than
  rendered; failures name the ticker that failed and do not silently replace
  a prior good frame.
- `src/features/workbench/DetailDrawer.jsx` owns tablist/tab/tabpanel
  semantics and keyboard Left/Right/Home/End navigation. Network-triggering
  panels such as BrokerEvidence mount only when their tab is selected.
- `src/features/keterbukaan/` owns the legacy Keterbukaan Informasi passive
  feed, filters, event/signal cards, anomaly indicators, correction timeline,
  evidence, official IDX links, and Collector freshness. `/keterbukaan` will
  temporarily redirect to `/news-detector` once News Detector reaches parity;
  the Keterbukaan feature is removed only after that redirect is verified.
  Story Intelligence remains a backend engine and has no user-facing tab.
- `src/features/fundamentals/` retains the parked standalone Fundamentals product.
  Sections: snapshot, key numbers, trends, profitability, health, cash
  quality, per-share, full statements, learning explanations, and sources.
  Every derived metric exposes its formula, input facts, evidence page/quote,
  and rejection reason when unavailable. No ratio uses a non-positive
  denominator. Bank-specific metrics activate only when company_type is
  `bank`. The feature never invents figures: all values must trace to a
  `fundamental_facts` row with confidence ≥ threshold and a linked
  `official_source_url`. Its navigation is hidden and route redirects to Stock
  Analysis until coverage and freshness are reliable enough for daily use.
- `src/features/news-detector/` retains the parked News Detector product: selected-date
  EOD scan trigger, scan progress, ranked material digest, signal score
  breakdown, suppressed-count summary with reasons, evidence drawer, and
  `All Disclosures` view. Users select a date and trigger an on-demand scan;
  the backend runs metadata-first suppression then bounded deep-parse for
  candidates. The feature renders results from `news_detector_scan_runs` and
  `news_detector_scan_items` and never contacts the IDX API directly. Its
  navigation is hidden and route redirects to Stock Analysis while parked.
- `src/features/broker-intelligence/` owns stock/broker lenses, bounded
  across-market filters for price, liquidity, broker net value, foreign flow,
  and FCA status, the merged
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
- `src/features/radar/` and `src/features/cases/` read the scan and owner-scoped Monitored
  contracts through `contracts.js` like every other feature. They rank nothing,
  score nothing, and decide no material change; those all arrive already
  computed. Radar's lane filter only hides rows the backend already ranked.
  Custom Screener uses grouped checkbox filters + results layout. It fetches the
  backend-owned registry from `/api/radar/scout/conditions`, submits at most 20
  explicit condition/value pairs, and forwards broker evidence windows through
  the public allowlist. Numeric inputs accept readable K/M/B/T abbreviations;
  the compact filter UI never owns or reimplements condition formulas.
- `confidence` is a deprecated pre-1.2 alias for source freshness and coverage,
  not outcome probability. The view models expose it as `dataQuality` and drop
  the alias, so no component can render it under the wrong label.
- Radar's Scout sub-view reads deterministic `/api/radar/scout` results. The
  backend owns condition definitions, template defaults, measurements,
  qualification and ranking; React only submits bounded filters and renders the returned evidence,
  component score breakdown, evidence band, and separately labelled near misses.
  Recipe parameters, FCA exclusion and IHSG-relative-strength filters are sent
  unchanged to the backend; React never evaluates their formulas. The saved-screen
  UI is parked and existing local browser data is left untouched. Qualification history and
  New/Still/Dropped daily diffs come only from the backend response. Query state
  is permalinkable and may pin the displayed as-of date.
- Trader-facing labels use Screener / Stock Analysis / Broker Flow / Monitored / Glossary.
  Parked route names remain stable as redirects. The subnav order is fixed:
  Screener → Stock Analysis → Broker Flow → Glossary. The
  global ticker selection is shared by Stock Analysis and Broker Flow; Screener
  handoffs open in new tabs so the originating result set is preserved.
- Broker Flow and Custom Screener expose named and custom calendar ranges while
  reporting the actual observed trading-day count. Chart defaults show the
  latest 60 trading days, exclude overlays from the initial price range, keep
  manual scale control, and allow moving-average lines to be hidden.
  The broker lens may render backend-ranked accumulation persistence and streaks.
  It always identifies requested versus observed sessions and warns that a
  broker code aggregates unrelated clients; it never infers a single actor.
  Across-market Broker Flow filters use draft state and only request new data
  after the trader presses Apply filters; typing in a numeric field never
  triggers a network request.
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
- `/monitored` (Cloudflare Access authenticated)
- `/keterbukaan` (temporary redirect to `/news-detector` after parity)
- `/cases`
- `/fundamentals`
- `/news-detector`

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

Monitored is never added to `PUBLIC_ROUTES`. The Worker accepts `/api/monitored`
only after Cloudflare Access supplies a verified email, hashes the normalized
identity, and forwards the opaque owner key with `NALAR_PROXY_SECRET`. Raw email
and browser credentials never reach the analysis API. Local private use derives
the same key from `NALAR_PRIVATE_OWNER_EMAIL`; missing configuration fails closed.

Parked Keterbukaan, Fundamentals, and News Detector routes are not exposed by
the anonymous proxy. Disclosure ingestion and analysis remain private backend
capabilities. A future ticker-context disclosure strip must add one narrow,
server-bounded read with a forced 30-day window rather than restoring the old
route family. `/api/collector/health` remains public because the live shell
uses it for freshness status. Production `server.js` serves that route only
when `TRADING_DB_PATH` is set and fails closed otherwise. Demo fixture creation requires
`STOCK_ANALYSIS_DISCLOSURE_FIXTURE=1` and is allowed only in the Vite
middleware, never as the `server.js` default. Analyze/broker routes still
proxy to the analysis API. The Worker forwards the same allowlist and does
not open SQLite.

Cloudflare production uses `worker/index.js` as the same-origin static asset and
API boundary. The public hostname is deployment configuration, not product
identity, so a later rename changes Cloudflare routes without moving data or
rewriting application code. The Worker reaches the loopback API only through a
Tunnel hostname protected by a Cloudflare Access service token stored as Worker
secrets; neither credential nor the origin hostname enters the browser bundle.
The Worker forwards a newly constructed minimal header set, applies a 30-second
origin deadline, bounds request targets and allowlisted parameter values, and
returns sanitized failures with the same security headers as static responses.

Production is deployed only from `main` to `analysis.tombaklepas.app`. Staging
is deployed only from `develop` to `staging.analysis.tombaklepas.app`; normal
feature branches merge into `develop` before promotion to `main`. Staging uses
the existing V2 service lane on ports 8793/8788, a separate bounded database,
and a separate Access-protected Tunnel origin. It never runs scheduled market
refreshes or disclosure collectors. `scripts/deploy.js` enforces the branch to
environment mapping before invoking Wrangler.

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
