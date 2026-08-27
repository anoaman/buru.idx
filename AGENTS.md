# Analysis Platform Agent Rules

## Default workflow

- Start normal feature work from `develop`.
- Create `feature/<task-name>` for non-trivial changes.
- Merge and verify feature work on `develop` before promoting it to `main`.
- `develop` owns `staging.analysis.tombaklepas.app`.
- `main` owns `analysis.tombaklepas.app`.

## Cursor local-only boundary

- Cursor may inspect, edit, test, and build this checkout locally.
- Cursor must not run any `deploy:*` command, `wrangler deploy`, Cloudflare
  mutation, SSH/VPS command, database migration/write, collector, timer, or
  production operation unless Kibz explicitly authorizes that exact action.
- Cursor must not request, store, or use Cloudflare, Access, tunnel, VPS,
  upstream API, database, or production credentials. Use placeholders in local
  environment files and keep every secret out of Git.
- Cursor must not merge `develop` into `main`, merge `main` into `develop`, or
  push either protected branch. Prepare local commits or feature branches for
  human review.
- Production and staging are separate release lines. Port only explicitly
  selected, reviewed changes between them; never assume branch parity.

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
