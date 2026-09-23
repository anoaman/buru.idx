# Deferred — chart hover OHLC / MA legend highlight

**Status:** OHLC inspection implemented in the stock analysis UX pass (2026-09-23).
MA hover highlighting remains deferred.

The chart now provides date, OHLC and volume inspection through
`subscribeCrosshairMove`, with previous/next session buttons and keyboard
navigation. The subscription is cleaned up on unmount. Inspection updates only
the readout and crosshair; it does not recreate the chart or change its scale.
Moving averages have individual visibility controls instead of hover highlighting.

## Original scope

Optional Phase 4 enhancement was: show OHLC under crosshair and soft-highlight
the MA series under the pointer using existing Lightweight Charts APIs, without
recreating the chart or changing logical/price scale.

Deferred because a safe, subscription-cleaned implementation was not verified
in this pass. Prefer documenting over faking. Revisit in a follow-up that:

1. Uses `subscribeCrosshairMove` (or current v5 equivalent) only.
2. Cleans up on unmount.
3. Never calls `setVisibleLogicalRange` / autoscaling as a side effect.
4. Does not mutate series data for legend highlighting.
