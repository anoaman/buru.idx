# Phase 2 — Three design directions

Three ways to make NALAR feel like a serious research workstation. They share the same
skeleton constraints — same routes, same contracts, same chart behavior, same fonts
(Zen Kaku Gothic Antique + Zen Kaku Gothic New), green/red reserved for market meaning,
desktop 1024–1920 — and differ in posture, not in truthfulness.

| | **A · Paper Ledger, Second Pass** | **B · Graphite Ledger** | **C · Broadsheet** |
|---|---|---|---|
| Posture | Evolve what exists | Dark-first terminal calm | Editorial print grid |
| Default theme | Light (dark optional) | Dark (light optional) | Light only at first |
| Shell | Left rail (unchanged geometry) | Left rail (unchanged geometry) | Top masthead, no rail |
| Signature | Hairline metric strips, real tables | Drawer under chart, signed broker table | Ruled open grid, masthead |
| Rework level | Low | High | Medium |

Mockups (static HTML, 1440px design width, real content shape per the current
contracts): `mockups/a-paper-ledger/`, `mockups/b-graphite-ledger/`,
`mockups/c-broadsheet/` — each with `stock-analysis.html` and `custom-screener.html`.
They are visual input for translation into the React component tree, not code to paste.

---

## Direction A — Paper Ledger, Second Pass

*Evolves the existing Paper Ledger system. This is the "fix what's actually wrong"
direction: keep the warm paper identity Kibz already approved, and repair hierarchy,
density, numeric alignment and control consistency.*

### Rationale
The audit shows the concept is right and the execution drifted: a semantic token layer
exists but is under-used; two type systems are stapled together; card-bands answer
table-shaped questions. Direction A is the Paper Ledger contract completed, not replaced.

### Color system (light default)
- Surfaces: base `#f3f1eb`, elevated `#fffefa`, sunken inputs `#edebe3`, hover
  `#eeece5`, active `#e6e3d9`, chart canvas `#0c0f12` (dark in both themes — unchanged).
- Borders: `rgba(31,38,43,.10)` hairline / `.16` default / `.26` strong.
- Text (all ≥4.5:1 on their surface): primary `#1f262b`, secondary `#4c555c`,
  tertiary `#677075`, disabled `#9aa0a3`. *(Fixes V2: tertiary moves from 3.3:1 to ~4.6:1.)*
- Market meaning only: up `#18784a`, down `#b43f38`, warning `#a96808`, each with a
  10% tint + 26% border variant for chips/state rows.
- Brand accent (restrained olive) `#536b13`, hover `#40540d`, on-fill `#ffffff`.
  **Allowed on:** active nav, selected row (6% tint + 2px left rule), active tab
  underline, focus ring, the single primary action per screen. **Never on a number,
  never on a badge, never on a chart element.**
- Info `#315f72` is demoted to links-only; focus rings unify on the accent.
- Dark theme: existing dark token set, with tertiary raised `#8f979e → #9aa1a8` for the
  same AA floor. Chart canvas identical in both.

### Typography
One ramp, no display sizes: **21** page title (Antique 700) · **16** panel title
(Antique 500) · **17/700** KPI numerals (ZK GN) · **13** body · **12.5** dense body ·
**11.5** small · **10.5** label floor (uppercase, letter-spacing .06em, mono only for
table column labels). Tickers always Antique 700 with `letter-spacing:.03em`.
`font-variant-numeric: tabular-nums` is applied once at the table/metric level, not
cell-by-cell. Weights limited to loaded 400/500/700 (no synthetic 620/650/750).

### Surface & border
Flat paper panels with 1px hairlines, 6px control / 8px panel radius, zero shadows,
no blur (top bar loses `backdrop-filter`). Sections on a page are separated by spacing
+ one hairline; panels nest at most one level deep.

### Navigation
Unchanged geometry: 190px rail, brand block, four items, footer market status. Watchlist
gains a count pill (P5 — count already exists in the cases response). Top bar keeps the
command bar; the 1D–60D window group **moves out of the top bar into the Broker Flow
control row** (U2), and the top bar gains the resolved as-of date (`August 11, 2026`)
where the window group used to sit.

### Tables (the core repair)
One shared table primitive everywhere: sticky 34px header, mono 10.5px uppercase column
labels, 40px data rows, hairline row separators, right-aligned tabular numerics, hover
fill, selected row = accent tint + left rule, group divider rows for near-misses /
net-sellers. Screener results become a real table: `# · Ticker (+tier) · Last · Chg ·
Score (+neutral bar) · Why it appeared · Lead broker · Net accum. · Breakout / fails ·
R/R · actions`. Watchlist becomes a table sorted by distance-to-fail ascending with a
sticky ticker column. Broker Flow keeps its two rankings by default; the merged signed
table is shown as the flagged product option (P1).

### Filters & controls
One grammar: 30px-high controls, 6px radius; segmented group for exclusive choices
(lens), chips for presets (all 10 broker presets + dashed `Custom…`), switches for
conditions, inputs with unit suffixes. Buttons: primary (olive fill — one per screen),
secondary (raised fill + border), ghost (borderless). Disabled always pairs with a
reason tooltip.

### Chart integration
Canvas unchanged in behavior (scale rule, MA toggle, fullscreen, TradingView link).
Visuals tokenized: candles keep `#3fae6f`/`#d9564d`; volume bars reuse candle color at
32% opacity (fixes V5); MAs reduce to two neutral lines by default (fast `#9aa4ac`,
slow `#6b747c`) with the full set behind the existing toggle; S/R as dashed
`#8a929a` rules with right-edge labels.

### Light/dark behavior
Light is the workstation default; dark is the persisted preference. The chart canvas
stays dark in both. All new values live in tokens — no per-component literals.

### Strengths
Lowest implementation risk; highest component reuse; fixes every audit high-severity
item; preserves the approved identity; long-session comfort (warm paper, no glare).

### Tradeoffs
Least visually distinctive of the three — it's an evolution, and reads as "the same
product, finally consistent." If Kibz wants the workstation to *feel* different, A
won't deliver that by itself.

---

## Direction B — Graphite Ledger

*Dark-first. A cool graphite dealing-desk surface where the dark chart stops being a
panel and becomes the medium everything else hangs from. Evolves the uploaded "Ledger"
reference (approach 1a) rather than the current light build — the reference bundle's
mockups are the visual starting point, simplified to this spec.*

### Rationale
The product is used pre-open and post-close, often in low light, next to a dark chart.
A dark-first build removes the light/dark seam entirely: the chart canvas *is* the app
background family, so the analysis surface feels continuous instead of embedded.

### Color system (dark default)
- Surfaces: app `#0c0e10`, sunken (rail, inputs, plot) `#08090b`, panel `#14181c`,
  raised `#191d21`, sticky header `#191e23`, quiet rows `#0f1216`.
- Borders: `#232830` panel / `#191e23` row separator / `#2f3641` control.
- Text: `#e4e7ea` / `#c3c9ce` / `#98a0a8` / `#6a727a` / disabled `#565d64`.
- Market: up `#3fae6f`, down `#d9564d`, warning `#d99a34`, 10% tints + 26% borders.
- Accent `#a8c93a` (the olive pushed luminous for dark surfaces), restricted exactly as
  in Direction A. Score/signal bars use neutral `#7f8a96` — a score is not P/L.
- Optional light theme = Direction A's paper set, derived from the same token names.

### Typography
Same ramp as A plus a 22px page title. Column labels are the only monospace (10px,
uppercase, .08em). Identical font pairing and tabular rule.

### Surface & border
Hairlines only; no shadows anywhere; radius 3/6/8. The dark theme removes the last
visual difference between "panel" and "canvas": chart, tables and rail share one
graphite family separated by rules, so the eye tracks data, not containers.

### Navigation
Same 190px rail (sunken `#08090b`), active item = 10% accent fill + 2px left rule,
Watchlist count pill, footer market status + clock. Top bar: breadcrumb left, ticker
field + Open + theme toggle right.

### Tables
Same shared table primitive as A, tuned dark: 34px sticky header on `#191e23`, 44px
screener rows, 38px broker rows, `max-height` scrollers instead of pagination.
Broker Flow adopts the merged signed ranking (P1) as its default view: Broker · Side
(Buy/Sell word badge) · Net value ↓ · diverging bar from a centre axis · Avg price ·
Net lots, with net sellers under a quiet group row.

### Filters & controls
Same grammar as A, plus the Custom Screener's condition builder as a 352px left column
beside the results table (two views of one screen), and the screener recipe panel as
chips + plain-language description + active-condition chips with ✕.

### Chart integration
Chart runs full width on the app background; header carries MA segmented group +
timeframe + Fullscreen + TradingView. Every level/indicator moves into a **docked
detail drawer** beneath the plot (tabs: Levels · Indicators · What changed · Risk
Simulator · Methodology), so the plot area holds only candles, volume, MAs and the
dashed S/R rules. No entry line; scale rule unchanged.

### Light/dark behavior
Dark is primary and designed first; light is the derived alternate (A's palette through
the same tokens). This inverts the current default — a deliberate product statement,
and the direction's biggest single cost.

### Strengths
Most distinctive and most "serious desk"; zero seam between chart and app; the uploaded
reference already proves the system end-to-end; densest readable layout of the three.

### Tradeoffs
Contradicts the stated light-first direction; highest rework (theme inversion, drawer
restructure of Workbench, merged broker ranking as default); lime-on-graphite accents
risk reading "crypto terminal" if the accent ever leaks onto numbers — the discipline
rules are what stand between this direction and that failure mode.

---

## Direction C — Broadsheet

*Editorial print grid. The markets page of a serious newspaper, rebuilt as a workstation:
ink on ivory, ruled hairlines instead of boxes, a masthead instead of a rail. The most
typography-led of the three.*

### Rationale
Paper Ledger still thinks in panels. Broadsheet removes the panels: content sits on one
ivory field, separated by horizontal rules and a strict 12-column grid, the way a
broadsheet's markets page packs tables, figures and commentary without a single card.
Distinctiveness comes from structure and type, not color.

### Color system (light first)
- One field: ivory `#f7f5f0`; ink `#20242a`; secondary `#4b535b`; tertiary `#6b7278`
  (AA-checked); rules `#dcd8cc` hairline / `#c4bfb0` strong.
- Accent: deep olive ink `#46580f` — masthead mark, active section, primary action,
  focus. Never on numbers.
- Market: up `#177348`, down `#b23b34`, warning `#9c6205`. State backgrounds are tints
  at 8% with a 1px 24% border, used sparingly (state rows only).
- Dark theme: deferred — designed as a later "night edition" (ink reversed onto
  `#14161a`), not part of the first pass. This is C's honest limitation.

### Typography
The widest expressive range of the three: masthead Antique 700 at 24px with the date
line beneath; section kickers 10.5px mono uppercase carried on a full-width hairline
(`LABEL ──────────`); body 13px; numerals always tabular; page furniture (folios,
"Page 1 of 1"-style footers) 11px. Antique also appears in table column headers — the
one place A and B use mono — which gives tables a printed-almanac character.

### Surface & border
No boxes by default. Separation = whitespace + rules. Double hairlines (1px + 3px gap +
1px) mark major section breaks, single hairlines minor ones. Controls are the exception:
inputs and buttons get a 1px strong rule and 3px radius — squared, print-form-like.

### Navigation
Top masthead replaces the left rail: brand mark + `NALAR` + `IDX ANALYSIS` left;
section links (`Screener · Stock Analysis · Broker Flow · Watchlist · Risk Simulator`)
as a horizontal row under the masthead rule, active = 2px accent underline; ticker
command + theme toggle right-aligned in the masthead. This frees 190px of horizontal
space for tables — the width goes to the data.

### Tables
The star of this direction: full-width ruled tables, horizontal rules only (no vertical
borders), column headers Antique 600 11px with a rule above and below, 38px rows,
right-aligned numerics on the 12-col grid, group dividers as italic centered spans on a
double rule. Sort indicators are `↑/↓` glyphs in the header. Reads like a well-set
financial page; scans like a terminal.

### Filters & controls
A single "query ribbon" pattern: one ruled band per screen holding all controls inline
(recipe select, condition switches as checkbox + label pairs in small caps, preset
chips as underlined text toggles, `Run screener` as the one filled button). Fewer
boxed controls, more typographic control states (underline = selected).

### Chart integration
The chart is a *figure*: dark canvas (unchanged behavior and rules) set inside a
hairline frame with a caption line above (`FIG. 1 — DSSA · price & volume · 30 trading
days to August 11, 2026`) and the legend/setup line as a caption below — matching how
the current footer already works, but framed editorially. Levels sit in a ruled six-cell
row directly under the figure, always visible (fixes U3 without a drawer).

### Light/dark behavior
Light only in v1; the dark chart canvas stays as the deliberate "plate" in the page.
A night edition is a later token inversion.

### Strengths
Most distinctive identity of the three; extraordinary table scanability; maximum width
for data (no rail); lowest visual noise; Antique finally gets real expressive work.

### Tradeoffs
Top nav costs vertical space and is the farthest departure from the current shell;
controls are less conventional (users must learn "underline = selected"); no dark theme
in the first pass; if density discipline slips it tips into "newsletter", not
workstation — the ruled grid must stay tight.

---

## Cross-direction decisions deferred to Phase 3/4

1. **House number format** (P6): mockups render the brief's style — `9,450`, `−4.06%`,
   `Rp22.74B`, `August 11, 2026`, `22 trading days`. Live formatters currently produce
   `9.450`, `+13.17%`, `Rp22,7M`. Adopting the brief's style is a formatter change with
   a three-repo blast radius (canonical `number.js`); flagged, not assumed.
2. **Merged broker ranking** (P1): default in B, optional in A/C. Contract-safe
   (client-side re-order of returned rows only).
3. **Window buttons leave the top bar** (U2): assumed in all three directions.
4. **Risk Simulator naming** (P3) and **Watchlist rail count** (P5): assumed in all
   three; both are copy/presentation changes on existing data.
