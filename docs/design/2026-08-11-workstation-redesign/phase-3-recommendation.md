# Phase 3 — Recommendation

**Recommended: Direction A — Paper Ledger, Second Pass**, with two narrowly-scoped
imports from Direction B (drawer thinking stays optional; the merged broker ranking
stays a flagged product option) and none of C's shell changes.

## Scored against the brief's criteria

| Criterion | A · Paper Ledger, Second Pass | B · Graphite Ledger | C · Broadsheet |
|---|---|---|---|
| Scanability | High — real tables, shared numeric axes, calm labels | High — densest rows; dark-on-dark hairlines are slightly harder to track | Highest for tables; weakest for controls (text-toggles must be learned) |
| Long-session comfort | Best for the stated use: warm paper, low glare, daylit pre-market prep | Best in a dark room; fatiguing as an all-day default for most | Good, but underline-everything controls add reading work |
| Information density | High | Highest | Medium-high (kickers and folios cost vertical space) |
| Implementation risk | **Low** — tokens and component tree stay; ~85% of the work is CSS + markup re-arrangement | High — inverts the default theme, restructures Workbench into a drawer, changes Broker Flow's default composition | Medium — replaces the shell (rail → masthead), retouches every feature |
| Reuse of existing components | ~85% — every feature file survives with the same props | ~45% — Workbench and Broker Flow partially re-composed | ~60% — features survive, shell replaced |
| Accessibility | AA text ramp restored (10.5px floor, 4.5:1 tertiary), unified focus ring, no behavior regressions | Good contrast, but luminous accent invites misuse; AA holds only if discipline holds | AA in light; **no dark theme in v1** — a real gap against the current build |
| Visual distinctiveness | Lowest of the three — but the paper identity is already the approved differentiator | High | Highest |

## Why A

1. **The current direction was already approved and is not the problem.** The audit
   shows the Paper Ledger *concept* (warm neutral surfaces, dark chart canvas, olive
   restraint, Zen Kaku pairing) landed six days ago and reads correctly. What fails is
   execution underneath it: two stapled type systems, dead CSS, card-bands instead of
   tables, sub-10px labels. Replacing the identity to fix executional drift would pay
   a re-theme cost for no diagnostic benefit.
2. **The constraints favor it.** "Light-first analytical workstation, warm neutrals,
   dark chart canvas, optional dark theme" is A's definition. B contradicts the
   light-first mandate; C ships without the dark theme the current build already has.
3. **The highest-value repairs are theme-independent.** Real tables, tabular numerals,
   AA text, one control grammar, accent discipline, dead-code removal — all of these
   are A's core, and none of them require B's dark default or C's masthead.
4. **Risk budget.** A touches every screen but changes no route, no contract, no state
   shape, and no chart behavior, and the 112 frontend tests stay green with class-name
   updates. B and C both force structural re-composition that the constraint list
   (routes, handoffs, chart semantics) makes delicate.

## What to preserve from the current Paper Ledger implementation

- **The semantic token contract** (`tokens.css` two-scope structure) — extend it, don't
  replace it. This is the build's best asset.
- **Light default + persisted dark theme** (`nalar-theme` localStorage, `data-theme`
  attribute), including the dark chart canvas in both themes.
- **Shell geometry**: 190px rail, 46px top bar, 4-item nav, command-bar ticker entry.
- **The chart implementation as-is** (scale rule, MA toggle, fullscreen, TradingView
  link) — only its *colors* become tokenized.
- **The 22px/700 Antique page-title intent** of the Paper Ledger tightening block —
  implemented by *replacing* the stale base rules, not layering over them.
- **EmptyState/ErrorState/InfoTip components and every data state** enumerated in the
  audit's preservation list.

## What changes (all from the audit)

- Real tables replace card-bands on Screener, Custom Screener results, and Watchlist;
  one shared table primitive (sticky header, 40px rows, mono column labels,
  right-aligned tabular numerics, group-divider rows).
- Type ramp floor 10.5px; tertiary text contrast raised to ≥4.5:1; weights restricted
  to loaded 400/500/700; `tabular-nums` applied at table/metric level.
- Accent restricted to nav, selection, tabs, focus, one primary action per screen;
  info-blue demoted to links; score bars go neutral.
- Chart colors tokenized; volume bars match candles at 32%; MA lines recolored to a
  neutral stepped family (visibility toggle unchanged).
- The 1D–60D window group leaves the global top bar (it only governs Broker Flow);
  top bar gains the resolved as-of date.
- Stock Analysis order becomes: context header → metric strip → chart → always-visible
  levels row → indicators + what-changed → Risk Simulator → collapsed full details →
  timeline. (The levels row uses existing `riskGeometry`/`supportResistance` data; the
  chart footer's setup strip merges into it.)
- ~600 lines of dead CSS and two dead components removed; duplicate cascade rules
  merged; broken `var(--accent)` / `var(--warning)` references repaired.

## Deliberately deferred (flagged product decisions, not part of the base restyle)

1. **P1 — merged signed broker ranking** (B's default): adopt only on explicit approval.
2. **P3 — "Invalidation simulator" → "Risk Simulator"** copy rename.
3. **P5 — Watchlist count pill in the rail** (requires the shell to know the count).
4. **P6 — house number format** (`9,450` / `−4.06%` / `Rp22.74B` / U+2212): the mockups
   render this style; the live formatters are byte-identical across three repos.
   Formatter change is a separate decision with cross-repo blast radius.
5. **Drawer restructure of Stock Analysis** (B's signature): only if, after living with
   A's levels row, the detail drawer still feels necessary.

## If the appetite is bigger than a restyle

Ship A first (it is the repair either way), then evaluate B as a **theme-level**
follow-up: because B is specified on the same token names, most of it can later land as
a re-valued dark theme plus the Workbench drawer, without re-auditing the product.
C should only be chosen if the goal is re-identification, not repair — it is the best
looking of the three on a wall and the least efficient at a desk.
