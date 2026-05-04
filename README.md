# SNOW Growth Signal Tracker

Google Sheets and Apps Script tracker for weekly growth signals across SNOW-family apps and competitors.

Tracked apps include SNOW, SODA, Foodie, EPIK, B612, BeautyPlus, Meitu, and Remini. The tracker records App Store positioning, public social/search signals, source status, AI/growth-related changes, and a one-page weekly summary.

## What It Builds

- Google Sheets workbook schema for weekly tracking tabs.
- Apps Script menu actions for dry run, weekly run, and trigger install.
- Weekly runner that scores growth signals and preserves historical rows.
- Evidence-gated summary rows for changes, observations, and manual checks.
- Local TypeScript/Vitest verification before deployment.

## Local Verification

```bash
npm install
npm run verify
```

`npm run verify` runs TypeScript checks, Vitest tests, and builds Apps Script artifacts into `build/`.

## Deployment

See [docs/apps-script-setup.md](docs/apps-script-setup.md) for the clasp and Google Sheets setup flow.

Important deployment notes:

- `build/Code.js` and `build/appsscript.json` are generated artifacts.
- `.clasp.json` is local workbook binding state and is intentionally ignored.
- Live Google authorization, `clasp push`, Sheet menu rendering, and weekly trigger execution must be verified in the target Google account.

## Source Policy

TikTok and Instagram checks are public, non-login checks only. Blocked or low-confidence sources become manual-check rows instead of failing the entire weekly run.
