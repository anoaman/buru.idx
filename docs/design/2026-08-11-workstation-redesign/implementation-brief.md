# Implementation brief — NALAR Graphite + UX + capability fixes

**For:** coding agent (Nova / Cursor / Claude Code)  
**Owner:** Kibz  
**Date:** 2026-08-11  
**Repo:** `anoaman/workspace` · app folder `projects/stock-analysis`  
**Design branch / PR:** `cursor/nalar-workstation-redesign-b63d` · https://github.com/anoaman/workspace/pull/2  
**Base:** `nova/radar-scout-20260811` (Paper Ledger tip)  
**This message is an explicit approval to implement** the scope below.

---

## TASK

Implement the **Graphite Ledger (Direction B)** visual redesign of the NALAR IDX workstation, plus the **premium UX polish layer (P0 + P1 minimum)**, plus the **high-leverage capability fixes** listed under Scope C. Do not invent a fourth visual direction. Do not ship Broadsheet or Paper-Ledger-second-pass as the default identity.

Work from the design package (source of truth):

```
projects/stock-analysis/docs/design/2026-08-11-workstation-redesign/
  decision-graphite.md          ← visual direction = B
  ux-polish-premium.md          ← interaction layer
  phase-1-audit.md              ← preserved behaviors + findings
  phase-2-directions.md         ← Direction B spec
  phase-4-implementation-plan.md← file map; use “If B selected” delta
  mockups/b-graphite-ledger/    ← visual target (HTML, not paste-into-React)
  screenshots/                  ← full-page captures of B
  implementation-brief.md       ← this file
```

Open and read those files before writing code. Match Graphite mockups for layout/hierarchy; rebuild in the existing React/CSS system — do not copy mockup HTML into production.

---

## INPUT

- Live app: `projects/stock-analysis` (Vite/React)
- Semantic tokens: `src/styles/tokens.css`
- Shared CSS: `src/styles/components.css`, `global.css`
- Shell: `src/components/AnalysisShell.jsx`, `AnalysisContext.jsx`
- Features: `src/features/{radar,workbench,broker-intelligence,cases}/`
- API: `src/lib/api/{client,contracts}.js`, `src/lib/public-api-allowlist.js`
- Formatters: `src/lib/format/number.js` — **byte-identical cross-repo; do not change unless explicitly told (P6 deferred)**

---

## SCOPE A — Graphite visual (Direction B)

1. **Dark-first default** — revalue `tokens.css` so Graphite is the default theme; keep a light theme toggle working. Persist via existing `nalar-theme` / `data-theme`.
2. **Stock Analysis** — full-width chart; **docked detail drawer** under chart with tabs: Levels · Indicators · What changed · Risk Simulator · Methodology. Move `TechnicalEvidence` / `DynamicLevels` / `BrokerEvidence` / `RiskSimulator` into tab panes (**props/API unchanged**).
3. **Custom Screener** — ~352px conditions column beside results **table** (not card-bands).
4. **Broker Flow** — **merged signed ranking table as default (product flag P1)** — Buy/Sell badge + diverging bar; preserve backend rank order as default sort.
5. **Shared grammar** — real tables (sticky header, tabular nums), type floor ≥10.5px, AA tertiary contrast, accent only for nav/selection/tabs/focus/one primary CTA, chart colors tokenized, dead CSS (~22%) + dead components `EvidenceDebate.jsx` / `TradeGeometry.jsx` removed **or** EvidenceDebate wired into a drawer tab if you surface debate (preferred — see Scope C).
6. **Shell** — keep 4-item rail (SC / SA / BF / WL); move global 1D–60D window chips out of the top bar (they only govern Broker Flow); show resolved as-of date in top bar; optional Watchlist count pill (P5 — cheap, do it).
7. **Copy** — rename “Invalidation simulator” → “Risk Simulator” (P3).

Visual reference: `mockups/b-graphite-ledger/*.html` and `screenshots/b-*.png`.

---

## SCOPE B — Premium UX polish (required with Graphite)

Full detail: `ux-polish-premium.md`. **Ship P0 + P1 in the same PR as Graphite.** P2/P3 nice-to-have in-pass if cheap.

### P0 — Continuity (must)
- **U1** Stale-while-revalidate on ticker change (keep previous Analysis frame dimmed + progress; request-id guard stays)
- **U2** Route transitions: fade main pane only; shell pinned
- **U3** Skeleton frames (not bare “Loading…” text)
- **U4** Optimistic rail selection
- **U5** Short in-memory analyze cache (mirror Broker Flow’s 45s cache pattern)

### P1 — Hover / press / focus (must)
- **U6** Shared interactive row (hover bg + left accent hairline)
- **U7** Unified button + focus-ring grammar
- **U8** Tabs / chips / segmented control motion (sliding pill / scaleX underline)
- **U9** 300ms hover tooltips for icon actions
- **U10** Chart hover: crosshair/OHLC; MA legend highlight; no scale change
- **U11** Handoff link hover affordance

### Motion rules
- Add `--motion-fast/base/slow` + easings to `tokens.css`
- Honor `prefers-reduced-motion`
- **No new npm motion library** unless drawer physics truly needs it (justify)
- **Do not:** glow stacks, bouncing page transitions, candle grow-in, UI sounds, motion that shifts numeric columns

---

## SCOPE C — Capability fixes (high leverage; same initiative)

Do these; they make Graphite honest, not just pretty:

1. **Scout allowlist** — forward UI params that are currently dropped: broker custom range (`brokerPreset` / `brokerFrom` / `brokerTo` or the allowlist’s equivalent) and lead-broker minimum (`minLeadBrokerValue` / `useLeadBrokerValue`). Align `public-api-allowlist.js` with what `Radar.jsx` sends and what the upstream API accepts.
2. **Scout contract** — stop stripping `scoreBreakdown`, `evidenceBand`, `failedCondition` in `normalizeScoutCandidate` so breakdown chips / near-miss “Missed: …” work.
3. **Watchlist honesty** — empty state must not promise “Add from screener…” unless writes exist. Either fix copy **or** add a gated write path (prefer copy fix in this pass unless writes are already designed).
4. **Surface existing analyze data in the Graphite drawer:**
   - Always-visible / Levels tab: setup levels + **cost drag** (`bestSetup.costPct`) beside R:R
   - Wire **bull/bear debate** (component exists) into a drawer tab or Methodology
   - Show investigation **contradictions** (today mostly buried)
5. **Noise (P2)** — suppress zero-value status lines (“buy · 100%”, “Avg Unavailable”) unless they carry real info.
6. **Dedupe ticker entry** — one primary command bar path; don’t leave three competing search UIs feeling equal.

### Explicitly out of scope for this pass
- House number format change (P6 — cross-repo `number.js`)
- Backend scoring / calibration changes
- Cockpit trade-plans / journal import
- Public hosting
- Intraday Telegram watcher integration (document as follow-up only)
- New feature epics: multi-ticker compare, outcome loop, saved recipes, CSV export — **backlog only** unless trivial

---

## CONSTRAINTS (non-negotiable)

Preserve all of these from the audit:

- Calculations and ranking logic unchanged (UI may re-order displayed rows client-side only where already allowed)
- API contracts stable except Scout allowlist/normalize fixes above (additive / corrective, not semantic score changes)
- Routes and URL params continue to work
- Chart: candle-only price scale; **no entry line on canvas**; S/R must **not** drive autoscaling; MA visibility toggle; fullscreen; TradingView link
- Screener → Analysis / Broker Flow **new-tab** handoffs
- Broker presets (10) + custom range
- Scout result limit options up to **100**
- All existing empty / error / loading / partial / degraded UI states still exist (restyled)
- No backend/DB schema migration
- No new dependencies without a one-paragraph justification in the PR
- No blind `git add -A` — review files before commit
- Do not edit unrelated workspace projects

---

## OUTPUT

1. Production code changes under `projects/stock-analysis/src/**` (+ allowlist if needed)
2. Tests updated/green (`npm test` / project’s usual suite); build passes
3. Short PR description: Graphite + UX P0/P1 + Scope C fixes; screenshots of SC / SA / BF / WL
4. Note any deferred P2/P3 UX items or follow-ups

Suggested branch name pattern: `cursor/nalar-graphite-ux-<suffix>` off the appropriate base (`nova/radar-scout-20260811` or mainline Kibz designates).

---

## SUCCESS CRITERIA

- [ ] Default UI matches Graphite identity (dark-first, drawer under chart, screener split, merged broker ranking)
- [ ] Switching ticker never whites out Analysis (U1/U5)
- [ ] Rail navigation feels instant; main pane eases (U2/U4)
- [ ] Loading uses skeletons (U3)
- [ ] Rows/buttons/tabs have coherent hover + `:focus-visible` (U6–U8)
- [ ] Scout custom broker range + lead-min actually affect results through the proxy
- [ ] Scout near-miss / breakdown fields render after normalize
- [ ] Watchlist empty copy is truthful
- [ ] Chart scale rules unchanged (verify with existing chart tests)
- [ ] Frontend tests pass; production build passes
- [ ] `prefers-reduced-motion` respected
- [ ] Dead unreachable CSS substantially reduced

---

## SUGGESTED SEQUENCE

1. Map files (per phase-4) → confirm with checklist above  
2. Tokens + motion + reduced-motion  
3. Shared table/button/row grammar  
4. Shell (window chips out, as-of, optimistic nav, watchlist pill)  
5. Workbench Graphite drawer + stale-while-revalidate + analyze cache  
6. Radar tables + Scout allowlist/contract fixes  
7. Broker Flow merged ranking + noise suppression  
8. Cases table + honest empty state  
9. Wire debate / cost / contradictions into drawer  
10. Dead code purge  
11. AA contrast + reduced-motion pass  
12. Tests, build, screenshots  

---

## COPY-PASTE ONE-LINER (if the agent needs a short opener)

> Implement NALAR **Graphite Ledger (Direction B)** per `projects/stock-analysis/docs/design/2026-08-11-workstation-redesign/` — especially `decision-graphite.md`, `ux-polish-premium.md` (P0+P1), and phase-4 “If B selected”. Also fix Scout allowlist/normalize, watchlist empty copy, surface cost drag + debate + contradictions in the drawer, merge broker ranking (P1), rename Risk Simulator (P3), add watchlist rail count (P5). Preserve chart scale rules, routes, contracts, handoffs, Scout limit ≤100. No P6 number format change. No new motion library. Tests + build must pass.
