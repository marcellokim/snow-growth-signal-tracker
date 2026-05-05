# SNOW Growth Signal Tracker

SNOW Growth Signal Tracker is a TypeScript and Google Apps Script workbook automation for monitoring weekly growth signals across SNOW-family camera apps and comparable photo-editing competitors in Google Sheets.

It tracks SNOW, SODA, Foodie, EPIK, B612, BeautyPlus, Meitu, and Remini across KR, US, and JP. The workbook captures App Store positioning, AI-related feature signals, public TikTok/Instagram search checks, source status, manual review needs, and a one-page weekly summary.

```bash
npm ci
npm run verify
```

`npm run verify` runs TypeScript checks, Vitest tests, and the Apps Script bundle build.

## What It Does

- Creates and validates the required Google Sheets workbook tabs.
- Runs weekly collection plans for App Store Search and public TikTok/Instagram search pages.
- Scores growth signals by change strength, growth relevance, confidence, and repetition.
- Preserves historical rows while replacing only the current week's generated rows.
- Writes a compact `Weekly Summary` plus supporting tables for signals, keywords, app matrix rows, and source runs.
- Records blocked, partial, or low-confidence public sources as manual-check items instead of hiding them.
- Provides Apps Script menu actions for dry runs, live weekly runs, and Monday trigger installation.

## Tech Stack

- TypeScript
- Google Apps Script V8
- SpreadsheetApp, UrlFetchApp, and ScriptApp
- clasp for deployment to a bound Apps Script project
- esbuild for bundling
- Vitest for local tests

## Repository Layout

```text
src/domain.ts       Sheet names, schemas, row types, and week normalization
src/config.ts       Tracked apps, markets, and scoring weights
src/connectors.ts   App Store, public URL, and manual queue connectors
src/scoring.ts      Keyword comparison and growth signal scoring
src/summary.ts      Weekly summary row generation
src/runner.ts       Weekly orchestration and sheet row replacement
src/gas.ts          Apps Script menu, dry run, scheduled run, and trigger entrypoints
src/sheets.ts       Sheet gateway adapters for Apps Script and tests
tests/              Vitest coverage for schema, connectors, runner, scoring, summary, and GAS entrypoints
scripts/build-gas.mjs
docs/apps-script-setup.md
```

## Local Setup

Prerequisites:

- Node.js 22 is recommended, matching CI.
- npm, using the committed `package-lock.json`.
- A Google account with access to the target Google Sheet is required only for live Apps Script deployment.

Install and verify:

```bash
npm ci
npm run verify
```

Useful commands:

```bash
npm run typecheck   # TypeScript only
npm test            # Vitest only
npm run build       # Generate build/Code.js and build/appsscript.json
npm run verify      # Typecheck, test, and build
```

## Configuration And Credentials

No `.env` file is required for local tests or builds.

Live deployment uses Google authentication handled by `clasp`:

- `.clasp.json` binds this repo to a specific Apps Script project and is intentionally ignored.
- `npx clasp login` stores Google auth outside this repo.
- The Apps Script OAuth scopes are declared in [appsscript.json](appsscript.json).
- Apps Script Execution API access is limited to the deploying user; the Sheet menu workflow remains the supported live execution path.
- Do not commit Google credentials, local workbook bindings, copied cookies, or private social account access.

See [.env.example](.env.example) for the current no-secret local environment contract.

## Google Sheets Deployment

The recommended deployment target is a bound Google Apps Script project attached to a Google Sheets workbook.

Start with the full setup guide:

- [docs/apps-script-setup.md](docs/apps-script-setup.md)

Short version:

```bash
npm run build
npx clasp login
npx clasp create --type sheets --title "SNOW Growth Signal Tracker" --rootDir build
npx clasp push
```

If a bound Apps Script project already exists, use `npx clasp clone <SCRIPT_ID> --rootDir build` instead of `npx clasp create`.

After pushing, reload the Google Sheet and use the `Growth Tracker` menu:

- `Dry Run Weekly Tracker`
- `Run Weekly Tracker`
- `Install Weekly Trigger`

Live Google authorization, menu rendering, `clasp push`, and trigger execution must be verified in the target Google account. Local verification does not prove those external account steps. Current non-secret QA evidence is tracked in [docs/qa-evidence.md](docs/qa-evidence.md).

`clasp run` is not the primary QA path for this project. It can fail when the local Google OAuth client lacks Apps Script Execution API approval for sensitive scopes. The Sheet menu path is the supported live execution path.

## Source Policy

TikTok and Instagram checks are public, non-login checks only. The tracker should not use personal login cookies, authenticated scraping sessions, or private-account access.

Blocked, rate-limited, or low-confidence sources become source-status rows and manual-check items instead of causing the entire weekly run to fail.

## Current Verification

- Local verification: `npm run verify`.
- CI verification: GitHub Actions runs `npm ci` and `npm run verify` on pushes to `main` and pull requests.
- Live workbook QA: verified against a private bound Google Sheet with the `Growth Tracker` menu. The run populated `Weekly Summary`, `Growth Signals`, `Store Keywords`, and `Sources & Runs` for `2026-W19`.

The live workbook is not published as a demo link because it is an account-bound Google Sheet, not a public hosted product.

## Screenshots

No screenshots are included yet. The primary UI is the target Google Sheets workbook after Apps Script deployment.

## License

No open-source license has been declared yet. Add one before encouraging reuse outside the project owner.
