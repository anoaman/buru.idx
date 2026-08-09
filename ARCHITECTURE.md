# Stock Analysis Architecture

## Purpose

Public, static Vite/React presentation for two existing IDX decision-support
features: Workbench and Broker Intelligence.

## Boundaries

- `src/features/workbench/` owns ticker analysis presentation and chart views.
- `src/features/broker-intelligence/` owns stock/broker lenses and inventory
  curve presentation.
- `src/lib/api/client.js` is the only first-party network boundary and prefixes
  every API path with `VITE_API_BASE`.
- `src/lib/api/contracts.js` normalizes only the contracts consumed by these two
  features.
- `src/lib/format/market.js` owns only the market formatters they consume.
- `src/components/PublicShell.jsx` owns the public navigation and delayed-data
  disclosure.

The frontend performs no analysis, ranking, broker inventory, or coverage
calculation. Those remain backend responsibilities.

## Routes

- `/workbench`
- `/broker-intelligence`

The root and unknown routes redirect to `/workbench`.

## Deployment boundary

The build is static. This project contains no hosting adapter, API proxy,
credentials, or deployment configuration. Production must supply a reachable,
CORS-enabled `VITE_API_BASE`.
