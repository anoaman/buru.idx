# File map — Graphite + UX implementation (`cursor/nalar-graphite-ux-20260811`)

Exact touch list before coding (ARCHITECTURE.md + design package).

## Create
- `src/features/workbench/DetailDrawer.jsx` — accessible tab drawer
- `src/components/Skeleton.jsx` — shared skeleton + status text (Phase 7 / used earlier)

## Modify
- `src/styles/tokens.css` — Paper + Graphite tokens, motion, reduced-motion
- `src/styles/global.css` — type floor, focus, reduced-motion
- `src/styles/components.css` — shared table/row/btn/tab/drawer/skeleton grammar
- `src/components/AnalysisShell.jsx` — remove global window chips; as-of; theme default Paper
- `src/components/AnalysisContext.jsx` — only if as-of surface needs it
- `src/lib/api/client.js` — extend cache to `/api/analyze` successes
- `src/lib/api/client.test.js` — analyze cache tests
- `src/features/workbench/Workbench.jsx` — drawer, SWR continuity, remove duplicate ticker form
- `src/features/workbench/MarketChart.jsx` — tokenized colors only if needed; hover OHLC if safe
- `src/features/workbench/RiskSimulator.jsx` — rename title
- `src/features/workbench/EvidenceDebate.jsx` — wire into What Changed (keep)
- `src/features/radar/Radar.jsx` — table grammar + Scout split layout
- `src/features/broker-intelligence/BrokerIntelligence.jsx` — merged signed ranking table
- `src/features/cases/Cases.jsx` — table/skeleton restyle
- `ARCHITECTURE.md` — drawer + theme ownership
- Matching `*.test.jsx` / `*.test.js`

## Delete (only after unused confirmation)
- `src/features/workbench/TradeGeometry.jsx` (+ CSS if unused)
- Dead CSS selectors proven unused after structure lands

## Do not touch
- `src/lib/format/number.js`
- Backend / DB
- Unrelated workspace projects
