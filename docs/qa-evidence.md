# QA Evidence

This file records non-secret verification evidence for portfolio review. It intentionally avoids account-specific Google Sheet URLs, Apps Script IDs, OAuth callback URLs, auth codes, and local credential paths.

## Local Verification

Run from a fresh clone after installing dependencies:

```bash
npm ci
npm run verify
```

`npm run verify` runs:

- `npm run typecheck`
- `npm run test`
- `npm run build`

The build generates the Apps Script deployment artifacts under `build/`, which is ignored by git.

## CI Verification

GitHub Actions runs the same verification path on pushes to `main` and pull requests:

```bash
npm ci
npm run verify
```

The workflow is defined in `.github/workflows/ci.yml`.

## Live Google Sheets QA

Live QA was performed on 2026-05-05 KST against a private Google Sheet bound to the generated Apps Script project.

Verified workbook behavior:

- The `Growth Tracker` Sheet menu rendered after `clasp push` and Sheet reload.
- A weekly run populated rows for `2026-W19`.
- Required tabs existed:
  - `Weekly Summary`
  - `Growth Signals`
  - `App Matrix`
  - `Store Keywords`
  - `Ad Messages`
  - `Social Patterns`
  - `Sources & Runs`
  - `Config`
- `Weekly Summary` contained overview, top growth signal, top changes, and manual-check sections.
- `Store Keywords` contained App Store rows for the tracked app and market matrix.
- `Growth Signals` contained public TikTok and Instagram signal rows with low-confidence/manual-check flags where appropriate.
- `Sources & Runs` recorded App Store rows as `ok` where reachable, and social rows as `partial` or `blocked` when public pages were rate-limited or low-confidence.

Known live QA caveats:

- The private QA workbook is not a public demo link.
- TikTok and Instagram checks are public non-login checks, so manual review rows are expected when those sources block, rate-limit, or return generic login/search pages.
- Apps Script Execution API access is limited to the deploying user in `appsscript.json`.
- `clasp run` is not required for the Sheet menu workflow and may fail if the local Google OAuth client lacks Apps Script Execution API approval for sensitive scopes.
