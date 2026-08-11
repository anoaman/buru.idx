# Graphite stabilization screenshots (2026-08-12)

Captured from the built app with mocked API fixtures via
`scripts/capture-stabilization-screens.mjs`.

Requires an ephemeral Playwright install to regenerate:

```bash
npm run build
npm install -D playwright@1.62.1
npx playwright install chromium
node scripts/capture-stabilization-screens.mjs
```

Do not leave Playwright in `package.json` unless the team decides to keep it
as a permanent visual-regression tool.
