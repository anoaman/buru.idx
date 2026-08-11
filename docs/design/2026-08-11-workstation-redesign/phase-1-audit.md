# Phase 1 — Audit of the existing NALAR workstation

**Scope:** `projects/stock-analysis` at branch `nova/radar-scout-20260811` (tip `f8c51be`,
"feat(ui): add Paper Ledger workstation theme"). Audit-only: no production files were
modified. Line references are to the files at that commit.

**Method:** full read of every source file (20 JSX/JS modules, 3 stylesheets,
`index.html`, tests), the contract guards in `src/lib/api/contracts.js`, the uploaded
design bundle (`design_handoff_nalar_workstation/`, used as visual input only), and the
test suites that lock behavior in place.

---

## 1. What exists today

### 1.1 Application structure

```
src/main.jsx                      loads global.css + components.css
src/App.jsx                       BrowserRouter > AnalysisProvider > AnalysisShell > Routes
                                    /  → /workbench        /radar      → Radar (Screener)
                                    /workbench → Workbench (Stock Analysis)
                                    /broker-intelligence → BrokerIntelligence (Broker Flow)
                                    /cases     → Cases (Watchlist)     * → /workbench
src/components/
  AnalysisShell.jsx (138)         left rail (brand, 4 nav items w/ 2-letter mono marks,
                                  footer "IDX workstation · Private · delayed data"),
                                  46px top bar (menu button, NALAR / section breadcrumb,
                                  CommandBar, theme toggle persisted to localStorage
                                  'nalar-theme', sets documentElement data-theme)
    └─ CommandBar                 ticker input (maxLength 4, OPEN disabled until valid),
                                  current-ticker chip, 1D/7D/14D/30D/60D window buttons
  AnalysisContext.jsx (139)       global ticker / days / asOf / brokerRange, URL sync,
                                  investigationUrl / brokerFlowUrl, openInvestigation(Tab),
                                  openBrokerFlow(Tab), openBrokerMap, updateWindow
  EmptyState.jsx (12)             ∅ icon + title + message + optional action
  ErrorState.jsx (16)             ⚠ icon + title + error + Retry
  InfoTip.jsx (14)                15px "?" trigger, click-toggle popover
src/features/
  radar/Radar.jsx (322)           view tabs: Market Shortlist | Custom Screener
    Market Shortlist              ScanProvenance strip, "How stocks qualify" <details>,
                                  lane filter chips, CandidateRow grid-rows
                                  (rank · ticker+lane/FCA/gated · score+dataQuality ·
                                  why+risk · trigger/invalidation/R:R · actions)
    Scout (Custom Screener)       recipe <select> (3 recipes, each sets condition toggles),
                                  6 condition rows (toggle + value input; custom date range
                                  for the broker condition), limit select 10/25/50/100,
                                  Run Screener; results = ScoutCandidate cards (rank, name,
                                  board, score + evidence band, score breakdown chips,
                                  6 metric cells, why-passed / check-manually columns,
                                  actions), near-miss section, disclosures
  workbench/Workbench.jsx (227)   own ticker search form, request-id guard, then:
    TickerHeader                  symbol, name, close, change, tier badge, 8-cell
                                  overview grid (O/H/L, VWAP, value, volume+baseline,
                                  frequency, foreign net, RSI/ATR, returns 5/20/60),
                                  notation/UMA flag line
    MarketChart.jsx (118)         lightweight-charts: candles + volume histogram +
                                  MA5/10/20/50/200 lines (toggle) + up to 3 support /
                                  3 resistance price lines + unconfirmed-day-high line +
                                  setup stop/target lines; header = source date, MA toggle,
                                  fullscreen, TradingView link; footer = legend + setup
                                  strip; manual price range from last ≤60 candles,
                                  autoscale disabled; ResizeObserver + fullscreen sync
    RiskSimulator.jsx (93)        5 inputs (entry/stop/target/capital/maxRiskPct),
                                  server-calculated via /api/risk-simulation, request guard,
                                  6-cell result grid
    inv-ledger <details>          EvidenceSummary (grade/regime/pattern/bias + InfoTips +
                                  data warnings; lenses + scorecard in nested <details>),
                                  DynamicLevels (MA-as-S/R table, confluence badge, slope,
                                  unavailable note), TechnicalEvidence (6 mini-sections),
                                  BrokerEvidence (10 presets + custom range, top buyers /
                                  sellers, FlowBars diverging list, "Open Broker Flow" link)
    InvestigationBrief.jsx (42)   setup timeline, 1W/1M period toggle
  broker-intelligence/
    BrokerIntelligence.jsx (837)  ArchiveHealthStrip (hidden when healthy; error /
                                  unavailable / partial / degraded variants), controls
                                  (lens segmented By stock | By broker · Across market;
                                  validated search; 10 presets + custom from/to), summary
                                  (window dates, incomplete badge, missing-days warning,
                                  preferred-broker share, observed net value, rotation
                                  handoff, behavioral fingerprint in broker lens),
                                  two ranking panels (accumulation / distribution),
                                  selection → InventoryCurve + SelectedDetail w/ cross-links,
                                  Disclosures <details>, prefetch + 45s client cache
    ActorMap.jsx (57)             lead-actor strip: 3 metrics + per-session bar replay
    InventoryCurve.jsx (133)      hand-rolled SVG line, zero baseline, start/end labels
  cases/Cases.jsx (175)           summary strip (N open · changed · stale), CaseCard grid
                                  (status, monitoring state, thesis, levels, saved score ±
                                  delta, data quality, risk line, snapshot age, actions)
src/lib/
  api/client.js (168)             fetch wrapper: JSON, error sanitization (Stockbit/token
                                  wording → generic message), 45s/64-entry GET cache +
                                  in-flight dedupe for /api/broker-intelligence/*
  api/contracts.js (709)          guard/normalize per endpoint; drops deprecated
                                  `confidence` alias in favour of dataQuality
  format/number.js (80)           formatIDR/Price/Pct/Number/Compact/Shares/Lots/Ratio/Date
                                  — marked "keep byte-identical across the three trading
                                  surfaces" (canonical module trading-surface-number-format/v1)
  format/market.js (58)           re-exports + formatRelativeDays + gradeColor
  public-api-allowlist.js         server-side read-only proxy allowlist (+ tests)
```

Dead on arrival (imported nowhere, no tests): `features/workbench/EvidenceDebate.jsx`,
`features/workbench/TradeGeometry.jsx`. Their CSS (`wb-debate*`, `wb-geometry*`) is
likewise unreachable, along with `phase-foundation*`, `inv-question`, `inv-brief*`,
`inv-contradictions*`, `wb-grade*`, `wb-scorecard*`, `wb-level-strip*`, `wb-chart-toggle*`,
`wb-chart`/`wb-chart__*` (superseded by `wb-market-chart`), `wb-tv*` (retired TradingView
iframe embed), `wb-quality*`, `wb-broker__coverage*`, `wb-broker__consistency`,
`wb-broker__date`, `wb-broker__flow`, `wb-broker__disclaimer`, `wf-actions*`,
`wb-actions*`, `app-shell__nav-external`, `app-shell__delay-badge`, `app-shell__delay-copy`,
`bi-date*`, `bi-panel`, `actor-map__eyebrow`. Roughly 600 of components.css's 2,768 lines
(≈22%) style components that no longer exist.

### 1.2 The semantic token layer (`src/styles/tokens.css`, 95 lines)

Two scopes — `:root` (light, default) and `:root[data-theme='dark']` — over the same
semantic names: 6 surfaces (incl. dedicated `--bg-chart`), 3 border strengths, 4 text
steps, positive/negative/warning/info + dim variants, accent trio, neutral bar,
freshness aliases, 3 font roles, spacing scale 4→40, shell geometry, 3 radii,
density aliases, `--panel-shadow: none`.

This is a real semantic contract and the single best thing the current build has. The
problems are coverage and discipline, not the idea:

- `--font-tabular` is an alias of `--font-ui` (tokens.css:43). `font-variant-numeric:
  tabular-nums` is only applied by the `.tabular` utility class (global.css:41), and
  many numeric cells set `font-family: var(--font-tabular)` *without* the class
  (`.wb-overview-grid strong`, `.bi-rank__net`, `.inv-simulator__result strong`,
  `.case-card__levels dd`, the whole InvTimeline). Numbers in those cells are proportional.
- Undefined custom properties in live rules: `.bi-summary__metrics > .bi-summary__primary`
  references `var(--accent)` (components.css:1802) and `.bi-rotation` references
  `var(--warning)` (1821) — neither exists post-Paper-Ledger, so the preferred-broker
  highlight cell and the broker-handoff banner silently lose their border/background.
  (Dead rules additionally reference `--surface-raised` and a `#60a5fa` accent fallback.)
- No tokens for row heights, table header treatment, selected-row treatment, or focus
  ring width — every component improvises its own.
- `gradeColor()` (market.js:49) returns hard-coded dark-theme hexes (`#81c995`,
  `#f28b82`) and is unused by any component — dead export waiting to confuse someone.

### 1.3 The chart (hard constraints verified in code)

`MarketChart.jsx` already satisfies the two non-negotiables, and both must survive any
redesign:

- Price scale is derived from the last ≤60 candles only (`visibleLow/visibleHigh` +
  8% padding, then `setAutoScale(false)` — lines 77–84). Support/resistance are
  `createPriceLine` calls, which in lightweight-charts never expand the scale. ✔
- No entry line is drawn; only stop ("SETUP FAILS BELOW") and target lines from
  `geometry.bestSetup`. ✔
- MA visibility toggle, fullscreen (`requestFullscreen` + resize sync), and the
  TradingView outbound link are present and must be preserved. ✔

Chart-specific issues: the five MA colors are a blue/violet/amber/orange/red rainbow
(`MA_COLORS`, line 10) — the single strongest "crypto terminal" signal in the product;
volume bars use hard-coded `rgba(52,211,153,.3)` / `rgba(248,113,113,.3)` (line 57) —
a *different* green/red pair than the candles (`#3fae6f`/`#d9564d`) on the same canvas;
all chart colors are JS literals, so the dark canvas is fine in both themes but nothing
about it is token-driven; header/footer chrome hard-codes `#14181c`/`#e4e7ea`/`#98a0a8`
(components.css:2692–2705), bypassing tokens.

---

## 2. Findings

Severity: ● high · ◐ medium · ○ low. Category per item.

### Visual issues

| # | Sev | Finding |
|---|-----|---------|
| V1 | ● | **Two type systems collide.** Base rules still carry the pre-Paper-Ledger display scale (`.module-heading h2` at `clamp(30px, 4vw, 48px)`, components.css:2445) while the "Paper Ledger tightening" block re-declares the same selectors at 22px (2554). The cascade only resolves correctly because the override happens to come later. Similar duplicate pairs: `.radar-view-tabs button` (2448 vs 2577), `.radar-lanes button` (2457 vs 2596), `.scout-controls button` (2492 vs 2660), `.app-shell__delay-label` (124 vs 2138 vs 2726), `.wb-broker__presets button` (1131 vs 2599). The stylesheet is two themes stapled together. |
| V2 | ● | **Text below the readable floor is everywhere.** 8px (`app-shell__edition`, `analysis-command__date`), 8.5px (nav marks), 9px (window buttons, section heads, chart legend, broker presets, scout labels/toggles/footer, timeline dates, disclosures, near-miss tags), 9.5–10px across cards and strips. Combined with `--text-tertiary` `#7b8287` on `#f3f1eb` (≈3.3:1) these fail WCAG AA for small text (4.5:1) and are genuinely hard to read over long sessions. |
| V3 | ● | **Non-tabular numerals in aligned contexts** — see tokens §1.2. Scores, net values, R:R and levels jump sideways as digits change width. |
| V4 | ◐ | **Accent discipline is partial.** The olive `#536b13` still lands on: every "Run Screener" (filled), every lane/recipe active chip, every timeline dot, tab underlines, link hover, nav active, focus rings, InfoTip hover. Meanwhile a second accent — info blue `#315f72` — owns links and all Broker Flow focus rings (1705–1711), and `gradeColor()` adds dark-theme pastels. Three hues doing overlapping work. |
| V5 | ◐ | **Chart palette fights itself** — MA rainbow + mismatched volume greens/reds (§1.3). |
| V6 | ◐ | **Screener rows are card-bands, not a table.** `.radar-row` (2461) is a 6-track grid where "why" and "levels" are free text of varying length; scores, prices and R:R don't share vertical axes across rows, so 30 results can't be scanned as columns. Scout results are full cards (~200px each): the 50/100-result limits the brief requires produce an endless card feed. |
| V7 | ◐ | **Panels inside panels.** `TickerHeader` is a card containing an 8-cell bordered grid; the ledger is a bordered box containing bordered boxes (`.wb-method__lenses/factors`, `wb-dyn`, `wb-broker`, `wb-debate`). Nesting + border + radius on every level flattens hierarchy instead of creating it. |
| V8 | ○ | **Inconsistent corner language.** radius-sm 3 / md 6 / lg 8 exist, but inputs in the simulator are square (553), chips are 3px, cards 6px, chart 8px, some buttons pill-ish; no rule governs which gets what. |
| V9 | ○ | **`backdrop-filter: blur(10px)` on the top bar** (142) — the one glassmorphism note in an otherwise flat product; also a paint cost on every scroll. |
| V10 | ○ | **Zebra of grays in dark mode is fine, but dim-warning/info backgrounds** (`--color-warning-dim` at 8–10% opacity) sit close to panel backgrounds; state chips barely differ from neutral ones at a glance. |

### Usability issues

| # | Sev | Finding |
|---|-----|---------|
| U1 | ● | **Nothing is sortable.** Screener candidates, broker rankings, watchlist — no column sorting anywhere; ranking order is fixed and broker accumulation/distribution can't be compared side-by-side because they live in two stacked panels with separate 320px scrollers. |
| U2 | ● | **The 1D/7D/14D/30D/60D group sits in the global top bar but only affects Broker Flow.** On Screener, Stock Analysis and Watchlist it mutates invisible context (its own title attribute admits "Keep N-day window for Broker Map"). Users will read it as applying to the current page. Either scope it to Broker Flow or label it honestly. |
| U3 | ● | **Stock Analysis buries the levels under the chart.** The workflow (judge a setup) needs entry / fails-below / target / R:R *while* reading the chart. Today: a 4-item setup strip in the chart footer, the full levels two scrolls down inside a collapsed `<details>`, and the Risk Simulator between them. |
| U4 | ◐ | **Two ticker inputs, one page.** Workbench renders its own search form (156) while the identical command bar sits 46px above it. Broker Flow adds a third input (with different placeholder copy). Three slightly different ways to do one thing. |
| U5 | ◐ | **Repeated low-information strings.** `consistencyLabel` prints e.g. "buy · 100%" on every Broker Flow row; "Avg Unavailable" repeats for every row without a cost basis; every Watchlist card repeats "Data quality high"; Market Shortlist rows print "No recorded counter-evidence" when risks are empty. Noise that trains users to ignore real warnings. |
| U6 | ◐ | **Disabled/empty states don't teach.** Command-bar OPEN is disabled with no reason; Scout's Run is disabled while loading (fine) but the limit select and recipe copy never say what "100 stocks" costs; ErrorState shows the sanitized string but no next step beyond Retry. EmptyState has an optional action slot that only the lane-filter empty state uses. |
| U7 | ◐ | **InfoTip popover** is 15px, click-to-open, closes on blur, `pointer-events:none` — unreachable content for keyboard users who tab past, and unpositionable on small widths (fixed 220–280px at `left:50%`). |
| U8 | ◐ | **Asymmetric handoffs.** Screener rows open Analysis/Flow in new tabs (correct, preserves the result set); Watchlist cards navigate the same tab (loses the list position). Not a defect per the constraints (only Screener new-tabs are mandated) but worth a deliberate decision. |
| U9 | ○ | **Refresh state vs loading state** in Broker Flow: `Refreshing…` spinner row appears above content while stale data stays visible (good), but loading replaces everything with one centered line, so first paint and refresh feel arbitrarily different. |
| U10 | ○ | **Raw values with no tooltip.** Full-precision values (e.g. un-shortened Rupiah, exact ratios) are truncated by formatting with no way to see the raw number. |

### Product suggestions (not defects — need a decision)

| # | Suggestion |
|---|-----------|
| P1 | Merge Broker Flow's two ranking panels into one signed, sortable table (Buy/Sell badge column + diverging bar), as the uploaded Ledger reference proposes. Ranking *order* is backend-computed and preserved as the default sort; client-side sort only re-orders returned rows (same contract as the existing lane filter). |
| P2 | Suppress zero-value status lines globally ("buy · 100%", "No recorded counter-evidence", per-row "Avg Unavailable") and keep data warnings strictly conditional (mostly true today — the health strip already hides when healthy). |
| P3 | Rename "Invalidation simulator" → "Risk Simulator" everywhere (matches how the brief and nav talk about it). |
| P4 | Promote Screener from card-band rows to a real table (see V6) with sticky header; keep lane filter + new-tab handoffs. Add the "almost matched" near-miss concept from Scout to the Market Shortlist table only if the backend already returns it (it does not — that would be a contract change; out of scope). |
| P5 | Add a Watchlist count badge to the rail (the reference bundle shows `Watchlist 5`); count is already derivable from the cases response. Cheap, genuinely useful. |
| P6 | Formatting alignment: the brief's house style ("9,450", "−4.06%", "Rp22.74B", U+2212 minus) differs from the live formatters (id-ID grouping "9.450", period decimals, ASCII signs, "Rp22,7M"-style compaction). `number.js` is contractually byte-identical across three repos — changing it touches `trading-analysis-platform` and `fca-dashboard`. Decide: adopt the brief's format in a NALAR-local layer, or update the canonical module everywhere at once. |
| P7 | The uploaded reference proposes surfacing lead-broker + 5-day net accumulation as screener columns. Scout's contract already returns `broker.lead`/`netValue`; Market Shortlist's contract does not. So: feasible for Custom Screener, contract change for Market Shortlist. |

### Technical implementation issues

| # | Sev | Finding |
|---|-----|---------|
| T1 | ● | ~22% of `components.css` is dead (§1.1 list), including entire retired subsystems (old `.wb-chart`, `.wb-tv` iframe embed, `.wb-grade`, `.wb-scorecard`, `.phase-foundation`). Dead CSS is where the duplicate cascade rules (V1) breed. |
| T2 | ● | Undefined-token references in live rules (§1.2): `var(--accent)`, `var(--warning)` — silently dropped declarations; the preferred-broker highlight and handoff banner render differently than intended. |
| T3 | ◐ | `EvidenceDebate.jsx` and `TradeGeometry.jsx` are unimported dead components. Either wire them in deliberately (the analyze contract still ships `debate`/`stance` — EvidenceSummary uses `stance` but `debate` is never rendered) or delete them. Note: the *data* is fetched either way. |
| T4 | ◐ | `components.css` has become page-specific despite ARCHITECTURE.md saying it owns "shared shell, panel, table, control and responsive geometry" — feature blocks (radar, scout, cases, bi-*, wb-*) live there with no shared `Table`/`Panel`/`Button` primitives. Every feature re-declares paddings, label styles and button skins. |
| T5 | ◐ | Buttons are restyled ~9 times across the file with different heights (28/30/32/34/44px) and radii; there is no `btn` base class. 44px minimums (bi-lens/bi-window/bi-search, 1681–1747) are mobile-era leftovers in a desktop-first product. |
| T6 | ◐ | No `SkeletonRows`-style loading: all loading states are plain centered text lines ("Loading the latest qualified scan…"), so content jumps when data lands. |
| T7 | ○ | `prefers-reduced-motion` is not honored anywhere (spinner animation, theme transition, sidebar slide). |
| T8 | ○ | `.wb-market-chart__actions` uses `!important` twice (852) — a smell that the header grid rule fights the actions row. |
| T9 | ○ | `Cases` and `Radar` loading text aren't wrapped in the panel frame they load into, so layout shifts (same class of issue as T6). |
| T10 | ○ | `server.js`/`vite.config.js` untouched by design work; no risk there. `number.js`'s byte-identical constraint (P6) is the one hidden cross-repo coupling to respect. |

---

## 3. Functionality that must be preserved (contract of this redesign)

**Routes & URLs** — `/` → `/workbench`; `/radar`; `/workbench?ticker=XXXX`;
`/broker-intelligence?lens=stock|broker&ticker=|code=&days=1|7|14|30|60&date=&preset=latest|previous|7d|14d|1m|3m|6m|1y|ytd|custom&from=&to=`;
`/cases`; unknown → `/workbench`. Ticker = 4 letters, broker code = 2 letters.
Deep links: ranking row → broker lens (`Open broker view`), → workbench (`Open in
Workbench`), Workbench → Broker Flow link carrying `date`.

**Screener** — Market Shortlist: auto-load on mount; provenance (data date, age,
count); qualification <details>; lane chips (filter-only, never re-rank); candidate
fields rank/ticker/lane/FCA/gated/score/dataQuality/reasons/risks/levels(trigger,
invalidation, netRewardRisk); new-tab handoffs to Analysis and Broker Flow. Custom
Screener: 3 recipes each pinning condition toggles; 6 conditions (broker concentration
w/ range preset + custom dates ≤60d, repeated support 5–120d, sideways compression
5–60d, max price, liquidity floor, lead-broker minimum); limit 10/25/50/100; run
state ("Screening…"); candidates with score breakdown, 6 metric cells, reasons/risks;
near-misses with failed-condition label; disclosures; zero-match empty state.

**Stock Analysis** — ticker validation + error naming the failed ticker; retry re-runs
the failed ticker; stale-response discard; leaving ticker in URL drives load, removing
it clears state. Header: symbol/name/close/change/tier/OHLC/VWAP/value/volume+baseline/
frequency/foreign net/RSI/ATR/returns 5-20-60/notations/UMA. Chart: candles+volume,
MA5–MA200 with visibility toggle, S/R lines (≤3 each, never scale-controlling),
unconfirmed-day-high fallback line, stop/target setup lines, last-≤60-candle manual
range, fullscreen, TradingView link, empty-history state. Risk Simulator: 5 inputs,
server-side calculation, stale-result guard, full result grid. Ledger: evidence summary
(grade/regime/pattern/bias + warnings), methodology lenses+scorecard, dynamic MA levels
with confluence/slope/unavailable notes, technical evidence (or unavailable state),
broker evidence with all 10 presets + custom range + snapshot fallback + incomplete
warnings. Setup timeline with 1W/1M toggle and empty-period line.

**Broker Flow** — archive health strip (hidden when healthy; error/unavailable/
partial/degraded variants with retry + cache invalidation); lens switch preserving
window; validated identity search with inline errors; all 10 presets + custom range
with both-dates requirement; window summary (dates, completeness badge, missing-day
count, preferred-broker share when observed, observed net value, rotation handoff,
broker fingerprint in broker lens); both rankings with selection; inventory curve with
empty state; selected-row detail with cross-links; disclosures (server-provided or
default five); loading/refreshing distinction; date-mismatch guard; prefetch of sibling
windows; 45s cache.

**Watchlist** — summary strip (open count, changed-since-freeze w/ explanation,
stale count); cards with status, monitoring state (changed / no-change / absent),
thesis or frozen-reason fallback, trigger/invalidation (live override or snapshot),
saved score ± delta, data quality, top risk, snapshot age (incl. unknown-age tri-state),
added age; actions (Analysis same-tab, Broker Flow 7D).

**Cross-cutting** — light default + persisted dark theme; sanitized error messages;
`.tabular` numerals; EmptyState/ErrorState components; the 4-item nav; command bar
ticker open; loading/empty/error/partial/disabled/warning states enumerated in §2 of
each test file (112 frontend tests encode most of this list — they are the executable
version of this contract).

**Explicit non-negotiables re-verified in code:** no entry line on the chart (none
exists); S/R overlays don't touch the price scale (manual range from candles only);
MA visibility control (single toggle today — any redesign must keep at least an
equivalent); Screener new-tab handoffs (`window.open` with `noopener`); broker date
presets and custom ranges (10 presets, two places); result limits up to 100 (Scout
limit select); all calculation and ranking stays backend-side (frontend never
re-scores — the lane-filter comment at Radar.jsx:223 is the norm).

---

## 4. What the audit points to

The current build's bones are good: semantic tokens with a working dark theme, a sane
route/context split, honest data states, and a chart that already obeys the two hard
rules. What drags it below "serious workstation" is not any single screen but the
accumulation of: two stapled-together type/space systems, ~600 lines of dead CSS,
card-shaped answers to table-shaped questions (Screener, Watchlist, Broker rankings),
labels below the readable floor, and three hues competing for "interactive".

Phase 2 explores three directions that all fix those; they differ in *what the product
feels like*, not in whether it stays truthful.
