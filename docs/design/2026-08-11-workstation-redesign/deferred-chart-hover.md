# Deferred — chart hover OHLC / MA legend highlight

**Status:** Deferred from Graphite UX pass (2026-08-11)

Optional Phase 4 enhancement was: show OHLC under crosshair and soft-highlight
the MA series under the pointer using existing Lightweight Charts APIs, without
recreating the chart or changing logical/price scale.

Deferred because a safe, subscription-cleaned implementation was not verified
in this pass. Prefer documenting over faking. Revisit in a follow-up that:

1. Uses `subscribeCrosshairMove` (or current v5 equivalent) only.
2. Cleans up on unmount.
3. Never calls `setVisibleLogicalRange` / autoscaling as a side effect.
4. Does not mutate series data for legend highlighting.
