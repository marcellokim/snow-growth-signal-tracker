# Apps Script Setup

This project builds a Google Apps Script bundle for a Google Sheets workbook. The workbook runs the SNOW growth signal tracker from the `Growth Tracker` menu and writes weekly output into `Weekly Summary`, `Growth Signals`, `App Matrix`, `Store Keywords`, and `Sources & Runs`.

## Local Verification

Install dependencies and verify the local build before any Apps Script deployment:

```bash
npm install
npm run verify
```

Expected local result:

- TypeScript passes.
- Vitest passes.
- `build/Code.js` and `build/appsscript.json` are generated.

`npm run verify` runs typecheck, tests, and the Apps Script build. It does not authenticate to Google, push code, or execute a live workbook run.

## First Google Sheet Setup

1. Create a Google Sheets workbook named `SNOW Growth Signal Tracker`.
2. Open Extensions -> Apps Script once so Google creates the bound Apps Script project surface.
3. Create or connect a clasp project for the workbook.
4. From this repo, build and push the generated Apps Script files:

```bash
npm run build
npx clasp login
npx clasp create --type sheets --title "SNOW Growth Signal Tracker"
npx clasp push
```

If a `.clasp.json` already exists for the target workbook, do not create a second project. Build and push to the existing project:

```bash
npm run build
npx clasp push
```

After `npx clasp push`, Apps Script should contain the generated `build/Code.js` bundle and `build/appsscript.json` manifest. Reload the Sheet after pushing so the custom menu is rebuilt by `onOpen`.

## First Dry Run and Run Workflow

1. Open the Google Sheet.
2. Reload the sheet so the `Growth Tracker` menu appears.
3. Run Growth Tracker -> Dry Run Weekly Tracker.
4. Authorize the script when Google prompts for permissions.
5. Confirm the dry-run alert says no rows were written.
6. Run Growth Tracker -> Run Weekly Tracker.
7. Check these tabs:
   - `Weekly Summary`
   - `Growth Signals`
   - `Sources & Runs`

Use Growth Tracker -> Dry Run Weekly Tracker first whenever credentials, workbook binding, or Apps Script permissions changed. Use Growth Tracker -> Run Weekly Tracker only after the dry run completes successfully.

## Weekly Trigger

Use Growth Tracker -> Install Weekly Trigger to schedule Monday 09:00 execution in the script owner's timezone.

The menu item installs an Apps Script time trigger for `runWeeklyTrackerScheduled`. The installer removes older weekly tracker triggers for `runWeeklyTracker` and `runWeeklyTrackerScheduled` before creating the new Monday trigger, so repeated installs should leave one scheduled handler.

The scheduled handler runs the same non-dry workflow as Growth Tracker -> Run Weekly Tracker, but logs completion or failure instead of showing a Sheet UI alert.

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
