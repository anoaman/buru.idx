# Decision — Visual direction

**Date:** 2026-08-11  
**Decision:** Ship **Direction B — Graphite Ledger** (not A).

Kibz chose Graphite after reviewing A/B/C mockups. Phase 3 had recommended A on
implementation-risk grounds; that recommendation is superseded for visual identity.

**Implication for implementation:** follow `phase-4-implementation-plan.md` “If B
selected” delta — dark-first token revaluation, Workbench drawer under chart,
Custom Screener split layout, **P1 merged signed broker ranking as default**.
Still preserve chart scale rules, routes, API contracts, MA toggle, Screener
new-tab handoffs, Scout limit ≤100, broker presets, and all enumerated UI states.

**UX polish:** ship with the premium interaction layer in
`ux-polish-premium.md` (P0 continuity + P1 hover/focus at minimum) so Graphite
does not land feeling abrupt.

**Do not start production UI work until Kibz explicitly approves an
implementation pass** (this file records direction preference only).
