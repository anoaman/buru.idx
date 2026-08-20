# Analysis Platform Agent Rules

## Default workflow

- Start normal feature work from `develop`.
- Create `feature/<task-name>` for non-trivial changes.
- Merge and verify feature work on `develop` before promoting it to `main`.
- `develop` owns `staging.analysis.tombaklepas.app`.
- `main` owns `analysis.tombaklepas.app`.

## Production boundary

- Never deploy production from `develop` or a feature branch.
- Never deploy staging from `main`.
- A tiny fix may target `main` only when Kibz explicitly says it is a direct
  production fix.
- Never point staging at the production database or enable collectors, refresh
  timers, or other scheduled writes in staging.
- Never place upstream credentials or Access secrets in browser-visible
  `VITE_*` variables.

## Required verification

Run `npm test` and `npm run build` before either deployment. Report the source
branch, commit, target hostname, test result, and build result.
