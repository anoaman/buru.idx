# UX polish — premium interaction layer (Graphite)

**Status:** Proposal for implementation (not approved yet)  
**Pairs with:** Direction B — Graphite Ledger (`decision-graphite.md`)  
**Constraint:** No fake latency, no decorative motion that hides data, respect `prefers-reduced-motion`. Do not change calculation semantics, chart scale rules, or API contracts.

Today the workstation is functionally dense but interactionally flat: page switches blank to “Loading…”, ticker changes wipe the previous analysis, hover is mostly a background fill, focus rings are inconsistent, and there is almost no shared motion language. Graphite’s dark density will feel *more* dated without this layer — dark UIs expose abruptness.

---

## Design principles

1. **Continuity over blankness** — keep the last good frame visible while the next loads; dim/refresh, don’t erase.
2. **Motion has a job** — enter, exit, selection, and feedback only. Cap intentional motions to a small set (see tokens below).
3. **Hover reveals affordance, not chrome** — row hover, button lift, chart crosshair, tooltip — never glow stacks or emoji.
4. **Keyboard equals mouse** — every hover state has a `:focus-visible` twin.
5. **Fast paths stay fast** — cached Broker Flow already does this well; extend that pattern to Analysis and Scout.

---

## Motion tokens (add to `tokens.css`)

```css
--motion-fast: 120ms;
--motion-base: 180ms;
--motion-slow: 280ms;
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

With:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

No new npm dependency for v1 — CSS transitions + a tiny `usePrefersReducedMotion` helper if needed. Framer/Motion only if drawer spring physics proves necessary later (justify then).

---

## Proposed upgrades (prioritized)

### P0 — Continuity when switching ticker / page (biggest “outdated” fix)

| ID | Change | Why it feels premium |
|---|---|---|
| **U1** | **Stale-while-revalidate on Stock Analysis** — on ticker change, keep previous header + chart + levels visible at ~55% opacity with a thin top progress bar / “Analyzing DSSA…” chip; swap when the new payload arrives (request-id guard already exists). | Trading desks never flash white; Bloomberg/Thinkorswim keep the frame. |
| **U2** | **Route transitions** — fade/slide main pane 120–180ms on SC ↔ SA ↔ BF ↔ WL; keep shell (rail + top bar) pinned. Use `view-transition` API where supported, CSS fallback otherwise. | Shell stability = app, not website. |
| **U3** | **Skeleton frames** replace bare “Loading the latest qualified scan…” / “Loading watchlist…” — shape-matched placeholders for table rows, metric strip, chart canvas (chart skeleton = dark rect + axis ticks, not a spinner over cream). | Spinners say “web app 2016”; skeletons say “product.” |
| **U4** | **Optimistic nav selection** — rail highlights the destination instantly on click, content catches up. | Removes the half-second of “did it register?” |
| **U5** | **Broker Flow pattern → Workbench** — BI already resolves from client cache to avoid blank transitions (`BrokerIntelligence.jsx`); give Analysis a short in-memory ticker cache (last N analyzes, TTL ~45s) so back/forth DSSA↔BBRI feels instant. | Same trick, wider. |

### P1 — Hover, press, focus (interaction craft)

| ID | Change | Detail |
|---|---|---|
| **U6** | **Shared interactive row** | Screener / Scout / Watchlist / Broker ranking rows: hover → `--bg-hover` + left accent hairline (1–2px); active press → `--bg-active` scale≈0.998; selected → accent dim fill. Transition `background/border-color` only (`--motion-fast`). |
| **U7** | **Button grammar** | Primary: hover darkens fill (`--color-accent-hover`), press translates `Y(1px)`. Ghost/secondary: border → `--border-strong`, text → primary. Disabled: no hover. One focus ring token everywhere (`outline: 2px solid accent; outline-offset: 2px`). |
| **U8** | **Chip / tab / switch hover** | Tabs: underline grows via `scaleX` (not color jump only). Switches: thumb eases `--motion-fast`. Segmented lens (By stock \| By broker): sliding pill behind selection (transform, not layout thrash). |
| **U9** | **Icon/button tooltips on hover delay** | 300ms delay tooltips for Fullscreen, TradingView, theme, InfoTip — replace sudden popovers where possible; keep click for dense InfoTip content. |
| **U10** | **Chart hover** | Ensure crosshair + OHLC readout follow pointer; MA legend highlights the series under cursor; S/R label soft-emphasizes on nearby hover. No new overlays that affect scale. |
| **U11** | **Link / handoff hover** | “Open Analysis” / “Broker Flow” show a subtle trailing affordance (chevron or external mark) on hover only — reduces always-on clutter. |

### P2 — Micro-feedback & state choreography

| ID | Change | Detail |
|---|---|---|
| **U12** | **Number updates** | When a metric changes after refresh (price, score delta on Watchlist), brief flash of positive/negative dim background (180ms) — “tick” acknowledgment without animation noise. |
| **U13** | **Theme toggle** | Cross-fade surfaces `--motion-base`; chart canvas stays dark in both themes so the expensive repaint feels intentional. Persist immediately (already does). |
| **U14** | **Drawer tabs (Graphite)** | Content cross-fade 150ms; tab indicator slides. Remember last tab per ticker in `sessionStorage`. |
| **U15** | **Command bar** | Valid ticker: OPEN enables with color ease. Submit: brief indeterminate bar under top bar. Invalid: gentle shake **or** border warning — prefer border (shake is dated unless reduced-motion-safe and rare). |
| **U16** | **Scout Run** | Button → “Screening…” with determinate feel if coverage counts stream; results list stagger-in max 6 rows at 30ms (cap; rest appear immediately) — optional, kill if it feels gimmicky. |
| **U17** | **Empty / error states** | Fade in; Retry has clear hover/focus; never layout-jump the page title. |
| **U18** | **Scroll restoration** | Per-route scroll position when returning from Analysis → Screener; chart drawer scroll independent of page scroll. |

### P3 — Premium density details (Graphite-native)

| ID | Change | Detail |
|---|---|---|
| **U19** | **Hairline separators that respond** | Section rules use `--border-subtle`; on section hover (optional) strengthen to `--border-default` — almost subliminal. |
| **U20** | **Sticky table headers** | Screener/Watchlist/Broker tables: sticky thead with translucent Graphite scrim (`backdrop-filter: blur(8px)` + elevated bg). |
| **U21** | **Cursor language** | `pointer` on all clickable rows; `progress` only during blocking submit; `zoom-in` reserved if chart reset-zoom is added later. |
| **U22** | **Selection persistence** | Highlight the ticker that matches the command-bar / URL across Screener results and Broker rankings when you land from a handoff. |
| **U23** | **Copy-to-clipboard** | Hover a ticker → ghost “Copy” / click copies symbol with a 1s “Copied” toast at bottom-center (non-blocking). Power-user delight. |
| **U24** | **Keyboard studio** | Document and polish: `⌘K` focus command bar, `1–4` rail sections, `Esc` close drawer/tooltip, `←/→` drawer tabs. Show a one-line footer hint once per session. |
| **U25** | **Quiet sounds: none** | No UI sounds. Premium here is silence + responsiveness. |

---

## What *not* to do (keeps it premium, not trendy)

- No purple glow, glassmorphism stacks, or bouncing page transitions.
- No full-page spinners that hide the shell.
- No autoplay chart animations on every load (candles should appear, not “grow”).
- No skeleton shimmer that never resolves — always pair with timeout → error state.
- No motion that shifts numeric columns (tabular alignment must stay rock-still).

---

## Implementation sketch (for the coding agent)

1. **Tokens** — motion + reduced-motion block in `tokens.css`.
2. **Primitives** — `.ui-row`, `.ui-btn`, `.ui-tabs`, `.ui-skeleton`, `.ui-progress` in `components.css` (Graphite values).
3. **Shell** — optimistic nav (U4), route fade (U2), top progress (U1/U15).
4. **Workbench** — stale-while-revalidate + analyze cache (U1/U5); wire Graphite drawer tab motion (U14).
5. **Radar / Cases / BI** — skeletons (U3), shared row hover (U6), sticky headers (U20).
6. **Pass for focus-visible parity** (U7) across BI buttons that already partially do this.

Estimated surface: mostly CSS + small React state in Workbench/Shell. No backend changes. Tests: interaction tests for “previous analysis remains until new request id resolves”; reduced-motion smoke.

---

## Acceptance feel-check (manual)

After implementation, a reviewer should feel:

1. Switching DSSA → BBRI never whites out the chart.
2. Rail click feels instant; content eases in.
3. Hovering a screener row clearly says “this is clickable” without shouting.
4. Tab / theme / drawer changes are audible in the eyes, not distracting.
5. With OS “reduce motion” on, nothing breaks — instant cuts only.

---

## Suggested message to the implementation agent

> Visual direction is **Graphite (B)**. Also implement the **UX polish layer** in `docs/design/2026-08-11-workstation-redesign/ux-polish-premium.md` — at minimum P0 (U1–U5) and P1 (U6–U11) in the same pass as the Graphite restyle so the dark UI doesn’t ship feeling abrupt. P2/P3 can follow. No new motion libraries unless drawer physics needs them.
