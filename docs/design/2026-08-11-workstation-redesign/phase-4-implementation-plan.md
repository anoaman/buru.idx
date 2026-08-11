# Phase 4 — Implementation plan (Direction A · Paper Ledger, Second Pass)

**Status: awaiting direction selection. No production code has been modified.**
This plan maps the recommended Direction A onto the existing tree. If B or C is
selected instead, the delta notes at the end describe what changes about the map.

Guiding constraints honored throughout: no calculation/ranking changes, no API or
data-field changes, no route or URL-parameter changes, chart scale/fullscreen/MA
behavior preserved, Screener new-tab handoffs preserved, all broker presets/custom
ranges preserved, 100-result limit preserved, every loading/empty/error/partial/
disabled/warning state preserved, no backend or database edits, no new dependencies.

---

## 1. File map

### Modified — styling layer (the bulk of the work)

| File | Change |
|---|---|
| `src/styles/tokens.css` | Extend, don't replace: add `--bg-sunken`, `--focus-ring`, table geometry tokens (row 40px, header 34px), raise `--text-tertiary` to `#677075` (light) / dark tertiary to `#9aa1a8`, add warn/positive/negative 26%-border variants. Dark scope: same names re-valued — no rename anywhere. |
| `src/styles/global.css` | Type ramp codified (21/16/17/13/12.5/11.5/10.5); `font-variant-numeric: tabular-nums` moved onto a base rule for tables/metric strips; link color = `--color-info`; remove `backdrop-filter` from anything; add `prefers-reduced-motion` guard; scrollbar styling kept. |
| `src/styles/components.css` | **Surgical rebuild, not append.** (1) Delete ~600 dead lines (§1.1 of the audit: `phase-foundation*`, `inv-question`, `inv-brief*`, `inv-contradictions*`, `wb-grade*`, `wb-scorecard*`, `wb-level-strip*`, `wb-chart-toggle*`, `wb-chart`/`__*`, `wb-tv*`, `wb-quality*`, `wb-broker__coverage*`, `wb-broker__consistency`, `wb-broker__date`, `wb-broker__flow`, `wb-broker__disclaimer`, `wf-actions*`, `wb-actions*`, `app-shell__nav-external`, `app-shell__delay-badge`, `app-shell__delay-copy`, `bi-date*`, `bi-panel`, `actor-map__eyebrow`, `wb-debate*`, `wb-geometry*`). (2) Merge the trailing "Paper Ledger tightening" block into the base rules it overrides (one rule per selector). (3) Add the shared grammar: `.btn`/`.btn--primary`/`--secondary`/`--ghost` (30px, 6px), `.chip`, `.segmented`, `.input`, `.switch`, and the table primitive (`.tbl`, `.tbl__scroll`, sticky `th`, group-row, selected-row rule). (4) Fix the broken `var(--accent)` and `var(--warning)` references. (5) Retire mobile-era `min-height:44px` control rules to the 30px grid; the <1024px behavior collapses to horizontal scroll per the brief (no mobile layout required). |

### Modified — shell & shared components

| File | Change |
|---|---|
| `src/components/AnalysisShell.jsx` | Remove the 1D/7D/14D/30D/60D group from the top bar (moves to Broker Flow, which already owns its own preset row); add resolved as-of date chip; keep theme toggle, command bar, 4-item nav. Optional (P5): Watchlist count pill — see flags. |
| `src/components/AnalysisContext.jsx` | No logic change expected. If P5 is approved, add a lazily-fetched cases count (one `getCases()` call, cached) — this is the only new data touch in the whole plan. |
| `src/components/EmptyState.jsx` / `ErrorState.jsx` | Restyle onto tokens (icon size, title 13px/600, actions use `.btn`). Props unchanged. |
| `src/components/InfoTip.jsx` | Widen trigger to 18px, allow keyboard focus visibility, cap popover within viewport. Props unchanged. |

### Modified — Screener (`src/features/radar/Radar.jsx`)

- Market Shortlist: `CandidateRow` grid → one shared table (columns: rank, ticker+lane
  markers, score (+neutral bar), why, levels trigger/fails, R/R, actions). Same fields,
  same lane filter (filter-only), same `openInvestigationTab`/`openBrokerFlowTab`
  handoffs, same three empty states and error/retry.
- Custom Screener: conditions grid → switch-grammar rows (same six conditions, same
  ranges, same custom-date behavior); results `ScoutCandidate` cards → table rows
  (same score breakdown available as an expandable secondary line or title — decide in
  review); near-misses become group-divider rows in the same table (same
  `failedCondition` copy); limit select 10/25/50/100 unchanged; "No AI · cached EOD"
  footer unchanged.

### Modified — Stock Analysis (`src/features/workbench/*`)

| File | Change |
|---|---|
| `Workbench.jsx` | Re-order composition: `TickerHeader` (metric strip moves out of the header card into a hairline strip) → `MarketChart` → new `LevelsStrip` → two-column `TechnicalEvidence` + `InvestigationBrief` → `RiskSimulator` → collapsed ledger (`EvidenceSummary`, `DynamicLevels`, `BrokerEvidence` unchanged inside). Remove the page-local search form (the shell command bar already does this — U4) *only after* confirming its tests; otherwise keep and restyle. |
| `MarketChart.jsx` | Colors become token-read (see T-note below); volume bars reuse candle colors at 32%; MA palette becomes a neutral stepped family; everything else — scale derivation, `setAutoScale(false)`, ≤60-candle window, fullscreen sync, MA toggle, TradingView link, price-line titles — **byte-for-byte behavior preservation**. |
| `RiskSimulator.jsx` | Title copy "Invalidation simulator" → "Risk Simulator" (P3, flagged); layout onto the shared form/results grammar; identical API call and result fields. |
| `TechnicalEvidence.jsx`, `DynamicLevels.jsx`, `BrokerEvidence.jsx`, `InvestigationBrief.jsx` | Restyle to shared classes; BrokerEvidence preset row adopts the chip grammar (all 10 presets + custom From/To unchanged). |
| `EvidenceDebate.jsx`, `TradeGeometry.jsx` | **Delete** (dead — imported nowhere). Note: the analyze contract's `debate` block stays unread, exactly as today. If anyone wants it surfaced later, it returns as a ledger section. |

### Modified — Broker Flow (`src/features/broker-intelligence/*`)

| File | Change |
|---|---|
| `BrokerIntelligence.jsx` | Composition unchanged (health strip → controls → summary → rankings → detail). Restyle: segmented lens control, chip presets (10 + custom), KPI band, ranking rows onto shared row grammar (38px), `Refreshing…` indicator placed so it never shifts layout. Broken CSS vars fixed on the stylesheet side. Ranking *order* untouched; P1 merged table is NOT part of the base plan. |
| `ActorMap.jsx` / `InventoryCurve.jsx` | Token colors; drop the decorative gradient on `actor-map`; SVG axis text stays legible at render size; zero-baseline logic untouched. |

### Modified — Watchlist (`src/features/cases/Cases.jsx`)

- Card grid → one shared table (sticky ticker column, status badge, saved score ±delta,
  levels, age, monitoring state, actions). Same fields, same `openInvestigation` /
  `openBrokerMap` behavior, same summary strip and empty/error states. Default sort
  stays as-returned; distance-to-fail sorting is a flagged option (needs no backend —
  the field isn't in the contract, so v1 keeps backend order).

### Touched only for copy/format decisions

| File | Change |
|---|---|
| `src/lib/format/market.js` | Remove dead `gradeColor` export. No formatter behavior changes. |
| `src/lib/format/number.js` | **Untouched** (byte-identical cross-repo contract) unless P6 is approved — see flags. |
| `index.html` | `<title>` → `NALAR — IDX Workstation`; font weights unchanged. |
| `ARCHITECTURE.md` | One paragraph: shared control/table grammar lives in `components.css`; page-specific visual systems remain prohibited. |

### Created

| File | Purpose |
|---|---|
| `docs/design/2026-08-11-workstation-redesign/` | This exploration package (already in this branch). |
| `src/lib/ui/chart-theme.js` | Tiny module that reads CSS custom properties once (via `getComputedStyle`) and exports the chart palette — keeps `MarketChart.jsx` token-driven without a build step or a new dependency. |

### Deleted

- `src/features/workbench/EvidenceDebate.jsx`, `src/features/workbench/TradeGeometry.jsx`
- ~600 lines of dead CSS listed above.

Nothing else. No route, guard, contract, client, server, or test-logic deletions.

---

## 2. Flags

**New dependencies:** none. The redesign is CSS + JSX markup + one 20-line JS module.

**New components:** `LevelsStrip` (composition of existing `riskGeometry` +
`supportResistance` data — the values already render in `TradeGeometry`-adjacent
surfaces and the chart footer). Optional shared React primitives (`Panel`, `Button`,
`Table`) are *not* introduced in v1 — CSS classes achieve the same consistency at a
fraction of the churn; primitives can be extracted later if a second consumer appears.

**Route or contract risks:** none in the base plan. No URL parameter is added, removed,
or reinterpreted; no guard changes; the 112-test suite should need only class-name /
markup updates, not assertion changes (any assertion that breaks for a non-class reason
is a signal the plan overstepped).

**Duplicated styling:** the plan's core mechanic is *removing* duplication (dead CSS +
override block + nine button styles). The one new duplication risk is per-feature table
markup; contained by the shared `.tbl` grammar.

**Features represented in the mockups that do not currently exist** (each is marked in
the HTML with a dashed amber outline and a `title` attribute):
1. **"Add to Watchlist"** on Stock Analysis — the product is read-only today
   (`getCases` reads `/api/watchlist`; the proxy allowlist exposes no write route).
   Showing it is a product proposal, not a restyle.
2. **"Export CSV"** on the Screener — no export exists today.
3. **Chart timeframe group (1D–60D)** on the chart panel — the chart currently has a
   fixed ≤60-trading-day default window and MA toggle only. A timeframe switch is
   client-side and contract-safe, but it is a new control.
4. **Per-period MA chips** (MA 10/20/50/200 as separate toggles) — today there is one
   "Hide MA lines" master toggle and the contract carries MA5 as well. Mockups show four
   periods; v1 keeps the single master toggle (constraint: preserve MA visibility
   controls) and per-period stays a proposal.
5. **Watchlist count pill** in the rail (P5) — needs one cached fetch in the shell.

**Product-decision flags carried from the audit:** P1 merged broker ranking; P3 Risk
Simulator rename; P6 house number format (cross-repo `number.js` blast radius —
`trading-analysis-platform` and `fca-dashboard` share the file byte-for-byte).

---

## 3. Suggested sequencing (each step independently shippable)

1. **Token + dead-code pass** — `tokens.css` extensions, dead CSS/component removal,
   broken var fixes, cascade merge. Zero visual regressions expected; tests untouched.
2. **Shared grammar** — buttons/inputs/chips/segmented/switch/table classes; restyle
   shell, EmptyState/ErrorState/InfoTip.
3. **Screener tables** — both tabs onto the table primitive.
4. **Stock Analysis re-composition** — header/strip/levels-row ordering, chart color
   tokenization (behavior untouched).
5. **Broker Flow + Watchlist** — grammar adoption, table conversions.
6. **Copy + polish** — P3 rename (if approved), tier/badge tones, dark-theme re-tune
   pass against the new tokens, reduced-motion, final AA contrast sweep.

## 4. If B or C is selected instead

- **B (Graphite Ledger):** the file map is the same shape, plus: default theme flips
  (`tokens.css` scopes swap, `nalar-theme` default changes), Workbench gains the drawer
  restructure (new `DetailDrawer` container; `TechnicalEvidence`/`DynamicLevels`/
  `BrokerEvidence`/`RiskSimulator` become tab panes — props unchanged), Broker Flow's
  merged ranking becomes default (P1 no longer optional). Test impact roughly doubles.
- **C (Broadsheet):** `AnalysisShell` is rebuilt as a masthead (the only shell
  replacement of the three), every panel loses its box in favor of rules, and the dark
  theme ships later — which regresses a feature the current build has. Highest
  distinctiveness, real cost.
