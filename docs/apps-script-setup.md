# Apps Script Setup

This project builds a Google Apps Script bundle for a Google Sheets workbook. The workbook runs the SNOW growth signal tracker from the `Growth Tracker` menu and writes weekly output into `Weekly Summary`, `Growth Signals`, `App Matrix`, `Store Keywords`, and `Sources & Runs`.

## Local Verification

Install dependencies and verify the local build before any Apps Script deployment:

```bash
npm ci
npm run verify
```

Expected local result:

- TypeScript passes.
- Vitest passes.
- `build/Code.js` and `build/appsscript.json` are generated.

`npm run verify` runs typecheck, tests, and the Apps Script build. It does not authenticate to Google, push code, or execute a live workbook run.

## First Google Sheet Setup

Before using `clasp`, make sure the Apps Script API is enabled for the Google account that will own the script. If `clasp create` reports that the Apps Script API is disabled, open the URL printed by `clasp`, enable the API, wait briefly, and rerun the command.

### Option A: Create A New Bound Workbook From This Repo

This is the shortest path for a fresh QA workbook:

```bash
npm run build
npx clasp login
npx clasp create --type sheets --title "SNOW Growth Signal Tracker" --rootDir build
npx clasp push
```

`clasp create --type sheets` creates both the Google Sheet and the bound Apps Script project. Keep the generated `.clasp.json` local.

### Option B: Attach To An Existing Bound Workbook

1. Create a Google Sheets workbook named `SNOW Growth Signal Tracker`.
2. Open Extensions -> Apps Script once so Google creates the bound Apps Script project surface.
3. In Apps Script Project Settings, copy the Script ID for that bound project.
4. From this repo, authenticate clasp and create a local `.clasp.json` that points at the bound project and uploads only generated files from `build/`:

```bash
npm run build
npx clasp login
npx clasp clone <SCRIPT_ID> --rootDir build
npx clasp push
```

The resulting `.clasp.json` should stay local and should look like this shape:

```json
{
  "scriptId": "<SCRIPT_ID>",
  "rootDir": "build"
}
```

If a `.clasp.json` already exists for the target workbook, confirm it has `"rootDir": "build"`. Then build and push to the existing project:

```bash
npm run build
npx clasp status
npx clasp push
```

`npx clasp status` should list only `Code.js` and `appsscript.json` from the `build/` root. If it lists source files, root-level `appsscript.json`, or `node_modules`, fix `.clasp.json` before pushing.

After `npx clasp push`, Apps Script should contain the generated `Code.js` bundle and `appsscript.json` manifest from `build/`. Reload the Sheet after pushing so the custom menu is rebuilt by `onOpen`.

## Deployment And QA Checklist

Use this checklist after every Apps Script push:

1. Reload the Google Sheet.
2. Confirm the `Growth Tracker` menu appears.
3. Run Growth Tracker -> Dry Run Weekly Tracker.
4. Authorize the script if Google prompts for permissions.
5. Confirm the dry-run alert says no weekly data rows were written. On a new workbook, the dry run may still create missing tabs and header rows.
6. Run Growth Tracker -> Run Weekly Tracker.
7. Confirm these tabs exist:
   - `Weekly Summary`
   - `Growth Signals`
   - `App Matrix`
   - `Store Keywords`
   - `Ad Messages`
   - `Social Patterns`
   - `Sources & Runs`
   - `Config`
8. Confirm the current week appears in `Weekly Summary`, `Growth Signals`, `Store Keywords`, and `Sources & Runs`.
9. Confirm App Store source rows are `ok` where reachable.
10. Confirm TikTok/Instagram blocked or partial rows become manual-check items instead of failing the whole run.

Use Growth Tracker -> Dry Run Weekly Tracker first whenever credentials, workbook binding, or Apps Script permissions changed. Use Growth Tracker -> Run Weekly Tracker only after the dry run completes successfully.

## Weekly Trigger

Use Growth Tracker -> Install Weekly Trigger to schedule Monday 09:00 execution in the script owner's timezone.

The menu item installs an Apps Script time trigger for `runWeeklyTrackerScheduled`. The installer removes older weekly tracker triggers for `runWeeklyTracker` and `runWeeklyTrackerScheduled` before creating the new Monday trigger, so repeated installs should leave one scheduled handler.

The scheduled handler runs the same non-dry workflow as Growth Tracker -> Run Weekly Tracker, but logs completion or failure instead of showing a Sheet UI alert.

## CLI Execution Caveat

The Sheet menu is the supported live QA path. The manifest limits Apps Script Execution API access to the deploying user, and `npx clasp run runWeeklyTrackerScheduled` can still fail after a successful `clasp push` if the local Google OAuth client has not been approved for Apps Script Execution API sensitive scopes. Treat that as a CLI authorization limitation, not proof that the Sheet menu workflow is broken.

Use the Sheet menu and spreadsheet readback for live QA unless you intentionally configure and approve the Apps Script Execution API path.

## Source Policy

The tracker uses public, non-login checks for TikTok and Instagram. Do not add personal login cookies, scraped authenticated sessions, or private-account access to the Apps Script project.

If public TikTok or Instagram access is blocked, rate-limited, or too low-confidence to trust automatically, the run records a source status such as `blocked`, `partial`, or `manual_needed` and writes a manual-check item instead of treating the entire weekly run as failed.

## Generated Build Outputs

`npm run build` writes generated deployment files under `build/`:

- `build/Code.js`
- `build/appsscript.json`

These files are deployment artifacts and are ignored by git. Regenerate them locally with `npm run build` or `npm run verify` before `npx clasp push`.

## Credential and Auth Caveats

- `.clasp.json` is local workbook binding state and is ignored by git.
- `npx clasp login` opens Google account authorization and stores local clasp credentials outside this repo.
- `npx clasp push` requires the authenticated account to have write access to the target Apps Script project.
- First live execution from the Sheet may require Google authorization for Spreadsheet, UrlFetch, and Script trigger APIs.
- Local tests and `npm run verify` cannot prove Google account authorization, live network reachability from Apps Script, or long-term weekly trigger execution.
