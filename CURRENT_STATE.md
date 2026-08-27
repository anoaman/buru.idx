# Buru IDX — Current State

Status captured: 2026-08-27 WIB.

## Release lines

### Production (`main`)

- Baseline SHA before the current local hardening: `ee071e6`.
- Public application: `analysis.tombaklepas.app`.
- Product surface: Screener, Stock Analysis, and Broker Flow.
- The current-price/setup geometry corrections are present.
- Production remains deployed from its existing remote SHA. The hardening audit
  in this checkout has not deployed anything.

### Staging (`develop`)

- Remote baseline before the current local work: `f4d9fb9`.
- Local staging line includes selective forward-ports `d2d7acd` and `6e8c796`
  for production's setup-geometry/current-price corrections.
- Public staging application: `staging.analysis.tombaklepas.app`.
- Staging has the newer usability reset: a smaller daily-use navigation,
  simplified Screener controls, freshness-first Stock Analysis, and richer
  across-market Broker Flow filters.
- Fundamentals and News Detector remain parked. Their source may exist, but
  routes/navigation must stay unavailable until explicitly approved.
- No current audit work has been deployed.

## Intentional divergence

`develop` and `main` are separate release lines. Do not merge either branch into
the other. A production change is recreated or cherry-picked selectively after
review; a staging feature reaches production only through an explicit promotion
decision.

This matters because staging contains product changes that are not approved for
production, while production may contain surgical fixes that staging still
needs. Branch ancestry is not a release decision.

## Hardening state in the current local checkouts

The 2026-08-27 audit prepared matching, independent hardening changes for both
lines:

- bounded request targets and allowlisted query values;
- minimal upstream header forwarding, excluding browser cookies and
  authorization headers;
- 30-second Cloudflare-origin request deadlines with sanitized failures;
- consistent security headers on health, readiness, API, and static responses;
- NanoID advisory removal through dependency-lock refresh;
- route-level lazy loading on production without importing staging features.

These changes passed the full test/build/audit gate and are kept as separate
commits on each release line. They are not authorization to deploy.

## Verified baseline before hardening

- `develop`: 212 tests passed and the Vite build completed.
- `main`: 154 tests passed and the Vite build completed.
- Runtime dependency audit: zero known vulnerabilities.
- Full dependency audit initially found one high-severity development-only
  NanoID advisory through Vite/PostCSS; the local lock refresh targets it.
- Production initially emitted one 519 KB application chunk; local route-level
  lazy loading targets that warning without changing the production routes.

## Recommended next development sequence

1. Finish and verify the independent hardening commits. Do not deploy from
   Cursor.
2. Continue product work on a local `feature/<task-name>` branch based on
   `develop`.
3. Keep Fundamentals and News Detector parked unless Kibz explicitly reopens
   them.
4. Preserve the verdict-first and freshness-visible Stock Analysis direction.
5. Treat backend/API changes as a separate project requiring an explicit API
   contract and credentials decision; this frontend repository alone cannot
   mutate Cloudflare staging or the private backend.

## Cursor authority

Cursor is local-only. It may edit, run tests, build, and prepare reviewable
commits. It may not deploy, access Cloudflare or the VPS, use staging/production
secrets, write databases, run collectors/timers, push protected branches, or
merge release lines without Kibz explicitly authorizing the exact operation.
