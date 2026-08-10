# Stock Analysis Architecture

## Purpose

Private Vite/React workstation for IDX investigation and broker intelligence.
This is the primary analysis product. It will absorb discovery and lightweight
case tracking from the retiring cockpit without duplicating backend engines.

## Boundaries

- `src/features/workbench/` owns ticker analysis presentation and chart views.
  Its Phase 2 investigation order is current question, chart, setup timeline,
  contradictions, invalidation simulator, then the collapsed evidence ledger.
- `src/features/broker-intelligence/` owns stock/broker lenses and inventory
  curve presentation.
- `src/lib/api/client.js` is the only first-party network boundary and prefixes
  every API path with `VITE_API_BASE`.
- `src/lib/api/contracts.js` normalizes only the contracts consumed by these two
  features.
- `src/lib/format/market.js` owns only the market formatters they consume.
- `src/components/AnalysisShell.jsx` owns private navigation and the global
  ticker/window command bar.
- `src/components/AnalysisContext.jsx` owns cross-route ticker, window and as-of
  context. Feature pages remain responsible for their own network state.
- `src/features/radar/` and `src/features/cases/` are Phase 1 route foundations;
  they contain no duplicated scanner or workflow logic.

The frontend performs no analysis, ranking, broker inventory, or coverage
calculation. Those remain backend responsibilities.

## Routes

- `/workbench`
- `/broker-intelligence`
- `/radar`
- `/cases`

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

## Analysis V2 baseline (Phase 0)

- Existing routes remain `/workbench` and `/broker-intelligence` until the new
  shell lands.
- Broker Intelligence defaults to one calendar day. The 7/14/30/60-day windows
  are explicit comparisons and must display the full resolved range.
- Cockpit data remains canonical in `trading-db/idx.db`; no migration, copy, or
  deletion occurs during shell work.
- Opportunity evaluations, frozen watchlist snapshots, trade plans, and trade
  outcomes are preserved until replacement routes are verified against the
  same records.
- FCA remains independently deployed and outside the Analysis V2 UI rewrite.
