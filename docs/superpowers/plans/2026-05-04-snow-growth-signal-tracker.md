# SNOW Growth Signal Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google Sheets plus Google Apps Script weekly tracker that records SNOW-family and competitor growth signals, scores changes, and writes a one-page weekly summary.

**Architecture:** Keep Google Sheets as the human-facing workbook and Apps Script as the runtime. Implement business logic in testable TypeScript modules, bundle the Apps Script entrypoint into `build/Code.js`, and expose only menu/runner/trigger functions globally.

**Tech Stack:** TypeScript, Vitest, esbuild, Google Apps Script V8, clasp, SpreadsheetApp, UrlFetchApp, ScriptApp.

---

## Reference Docs

- Google Apps Script custom menus: https://developers.google.com/apps-script/guides/menus
- Google Apps Script simple triggers and `onOpen`: https://developers.google.com/apps-script/guides/triggers
- Google Apps Script installable triggers: https://developers.google.com/apps-script/guides/triggers/installable
- Google Apps Script TypeScript with clasp: https://developers.google.com/apps-script/guides/typescript
- Google Apps Script `UrlFetchApp`: https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app

## File Structure

Create this project structure:

```text
.
├── appsscript.json
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── scripts/
│   └── build-gas.mjs
├── src/
│   ├── config.ts
│   ├── connectors.ts
│   ├── domain.ts
│   ├── gas.ts
│   ├── runner.ts
│   ├── scoring.ts
│   ├── sheets.ts
│   └── summary.ts
├── tests/
│   ├── connectors.test.ts
│   ├── runner.test.ts
│   ├── schema.test.ts
│   ├── scoring.test.ts
│   └── summary.test.ts
└── docs/
    ├── apps-script-setup.md
    └── superpowers/
        ├── plans/
        │   └── 2026-05-04-snow-growth-signal-tracker.md
        └── specs/
            └── 2026-05-04-snow-growth-signal-tracker-design.md
```

Responsibilities:

- `src/domain.ts`: shared enums, types, required sheet schemas, and row builders.
- `src/config.ts`: default tracked apps, markets, channels, source definitions, and scoring weights.
- `src/sheets.ts`: sheet gateway interface, Apps Script adapter, in-memory test adapter, schema creation, and append/replace helpers.
- `src/connectors.ts`: source connector interface plus App Store search, public URL, and manual queue connectors.
- `src/scoring.ts`: prior-week comparison, confidence handling, and growth signal scoring.
- `src/summary.ts`: weekly summary model and row generation.
- `src/runner.ts`: orchestration flow.
- `src/gas.ts`: Apps Script global entrypoints: `onOpen`, `runWeeklyTracker`, `runWeeklyTrackerDryRun`, and `installWeeklyTrigger`.
- `scripts/build-gas.mjs`: bundles `src/gas.ts` to `build/Code.js` and copies `appsscript.json`.

## Task 1: Scaffold the Local Apps Script Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `appsscript.json`
- Create: `scripts/build-gas.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Write the package and compiler files**

Create `package.json`:

```json
{
  "name": "snow-growth-signal-tracker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "node scripts/build-gas.mjs",
    "verify": "npm run typecheck && npm run test && npm run build"
  },
  "devDependencies": {
    "@google/clasp": "^3.3.0",
    "@types/google-apps-script": "^2.0.8",
    "esbuild": "^0.28.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.5"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Node",
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["google-apps-script", "vitest/globals"],
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
```

Create `appsscript.json`:

```json
{
  "timeZone": "Asia/Seoul",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

Create `scripts/build-gas.mjs`:

```js
import { mkdir, copyFile } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("build", { recursive: true });

await build({
  entryPoints: ["src/gas.ts"],
  bundle: true,
  outfile: "build/Code.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  banner: {
    js: "/* Generated by npm run build. Do not edit build/Code.js directly. */",
  },
});

await copyFile("appsscript.json", "build/appsscript.json");
```

Modify `.gitignore` so build outputs and local clasp auth files are not committed:

```gitignore
.omx/
node_modules/
build/
.clasp.json
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with status `0`.

- [ ] **Step 3: Run the empty verification commands**

Run:

```bash
npm run typecheck
npm run test
```

Expected: typecheck succeeds. Vitest exits `0` with no tests because `--passWithNoTests` is enabled.

- [ ] **Step 4: Commit scaffold**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vitest.config.ts appsscript.json scripts/build-gas.mjs
git commit -m "Prepare local Apps Script development" -m "Constraint: Apps Script runtime code needs local tests before Sheets deployment.
Rejected: Edit Code.gs directly in the Apps Script UI | local source control and tests are required.
Confidence: high
Scope-risk: narrow
Directive: Keep generated build files out of git; source files are the reviewed surface.
Tested: npm run typecheck; npm run test
Not-tested: No Apps Script deployment yet."
```

## Task 2: Define Domain Types and Workbook Schema

**Files:**
- Create: `src/domain.ts`
- Create: `tests/schema.test.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `tests/schema.test.ts`:

```ts
import {
  REQUIRED_SHEETS,
  buildEmptyRow,
  normalizeWeek,
  type SheetName,
} from "../src/domain";

describe("workbook schema", () => {
  it("defines all approved workbook tabs in display order", () => {
    expect(REQUIRED_SHEETS.map((sheet) => sheet.name)).toEqual([
      "Weekly Summary",
      "Growth Signals",
      "App Matrix",
      "Store Keywords",
      "Ad Messages",
      "Social Patterns",
      "Sources & Runs",
      "Config",
    ]);
  });

  it("creates empty rows with every required column", () => {
    const row = buildEmptyRow("Growth Signals");
    expect(Object.keys(row)).toEqual([
      "week",
      "app",
      "market",
      "channel",
      "signal_type",
      "signal_summary",
      "growth_relevance",
      "change_strength",
      "confidence",
      "score",
      "evidence_url",
      "source_status",
      "manual_check_needed",
      "notes",
    ]);
  });

  it("normalizes ISO-like week labels", () => {
    expect(normalizeWeek("2026-W09")).toBe("2026-W09");
    expect(normalizeWeek("2026-W9")).toBe("2026-W09");
  });

  it("rejects invalid week labels", () => {
    expect(() => normalizeWeek("2026-09")).toThrow("Invalid week");
  });
});

describe("sheet names", () => {
  it("keeps sheet names as a closed union", () => {
    const name: SheetName = "Weekly Summary";
    expect(name).toBe("Weekly Summary");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/schema.test.ts
```

Expected: FAIL because `src/domain.ts` does not exist.

- [ ] **Step 3: Implement domain types and schemas**

Create `src/domain.ts`:

```ts
export const SHEET_NAMES = [
  "Weekly Summary",
  "Growth Signals",
  "App Matrix",
  "Store Keywords",
  "Ad Messages",
  "Social Patterns",
  "Sources & Runs",
  "Config",
] as const;

export type SheetName = (typeof SHEET_NAMES)[number];

export type Market = "KR" | "US" | "JP";
export type Channel =
  | "App Store"
  | "Google Play"
  | "Official Web"
  | "Ad Library"
  | "TikTok"
  | "Instagram"
  | "Manual";
export type SourceStatus = "ok" | "partial" | "blocked" | "changed_structure" | "manual_needed" | "error";
export type Confidence = "high" | "medium" | "low";

export type SheetSchema = {
  name: SheetName;
  columns: readonly string[];
};

export const REQUIRED_SHEETS: readonly SheetSchema[] = [
  {
    name: "Weekly Summary",
    columns: [
      "week",
      "section",
      "rank",
      "headline",
      "detail",
      "app",
      "market",
      "channel",
      "score",
      "confidence",
      "evidence_url",
      "manual_check_needed",
    ],
  },
  {
    name: "Growth Signals",
    columns: [
      "week",
      "app",
      "market",
      "channel",
      "signal_type",
      "signal_summary",
      "growth_relevance",
      "change_strength",
      "confidence",
      "score",
      "evidence_url",
      "source_status",
      "manual_check_needed",
      "notes",
    ],
  },
  {
    name: "App Matrix",
    columns: [
      "app",
      "market",
      "core_features",
      "ai_features",
      "paid_model",
      "price_summary",
      "subscription_or_credit_notes",
      "last_checked_at",
      "evidence_url",
      "confidence",
    ],
  },
  {
    name: "Store Keywords",
    columns: [
      "week",
      "app",
      "market",
      "store",
      "title",
      "subtitle_or_short_description",
      "keyword_or_message",
      "change_from_prior_week",
      "evidence_url",
      "confidence",
    ],
  },
  {
    name: "Ad Messages",
    columns: [
      "week",
      "app",
      "market",
      "source",
      "hook_message",
      "creative_format",
      "cta",
      "targeting_hint",
      "ai_or_growth_angle",
      "first_seen",
      "last_seen",
      "evidence_url",
      "confidence",
    ],
  },
  {
    name: "Social Patterns",
    columns: [
      "week",
      "app",
      "market",
      "platform",
      "pattern_summary",
      "content_format",
      "repeated_message",
      "observed_examples",
      "evidence_url",
      "source_status",
      "manual_check_needed",
      "confidence",
    ],
  },
  {
    name: "Sources & Runs",
    columns: [
      "run_id",
      "week",
      "source_name",
      "source_url",
      "app",
      "market",
      "status",
      "last_success_at",
      "error_message",
      "manual_check_needed",
      "next_action",
    ],
  },
  {
    name: "Config",
    columns: ["section", "key", "value", "enabled", "notes"],
  },
] as const;

export type TableRow = Record<string, string | number | boolean>;

export type GrowthSignal = {
  week: string;
  app: string;
  market: Market;
  channel: Channel;
  signal_type: string;
  signal_summary: string;
  growth_relevance: number;
  change_strength: number;
  confidence: Confidence;
  score: number;
  evidence_url: string;
  source_status: SourceStatus;
  manual_check_needed: boolean;
  notes: string;
};

export type SourceRun = {
  run_id: string;
  week: string;
  source_name: string;
  source_url: string;
  app: string;
  market: Market;
  status: SourceStatus;
  last_success_at: string;
  error_message: string;
  manual_check_needed: boolean;
  next_action: string;
};

export function schemaFor(sheetName: SheetName): SheetSchema {
  const schema = REQUIRED_SHEETS.find((sheet) => sheet.name === sheetName);
  if (!schema) {
    throw new Error(`Unknown sheet: ${sheetName}`);
  }
  return schema;
}

export function buildEmptyRow(sheetName: SheetName): TableRow {
  return Object.fromEntries(schemaFor(sheetName).columns.map((column) => [column, ""]));
}

export function normalizeWeek(input: string): string {
  const match = input.match(/^(\\d{4})-W(\\d{1,2})$/);
  if (!match) {
    throw new Error(`Invalid week: ${input}`);
  }
  const week = Number(match[2]);
  if (week < 1 || week > 53) {
    throw new Error(`Invalid week: ${input}`);
  }
  return `${match[1]}-W${String(week).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run schema tests**

Run:

```bash
npm run test -- tests/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit domain schema**

```bash
git add src/domain.ts tests/schema.test.ts
git commit -m "Define tracker workbook schema" -m "Constraint: Sheets are the operating surface, so schema must be explicit and testable.
Rejected: Create tabs ad hoc during the weekly run | silent schema drift would make summaries unreliable.
Confidence: high
Scope-risk: narrow
Directive: Add columns through schema tests before changing runner behavior.
Tested: npm run test -- tests/schema.test.ts
Not-tested: Apps Script SpreadsheetApp adapter not built yet."
```

## Task 3: Add Default Config and Sheet Gateway

**Files:**
- Create: `src/config.ts`
- Create: `src/sheets.ts`
- Extend: `tests/schema.test.ts`

- [ ] **Step 1: Add failing tests for defaults and in-memory sheets**

Append to `tests/schema.test.ts`:

```ts
import { DEFAULT_TRACKED_APPS, DEFAULT_MARKETS, DEFAULT_SCORING_WEIGHTS } from "../src/config";
import { InMemorySheetGateway, ensureWorkbookSchema } from "../src/sheets";

describe("default config", () => {
  it("tracks SNOW-family apps and competitor apps", () => {
    expect(DEFAULT_TRACKED_APPS.map((app) => app.name)).toEqual([
      "SNOW",
      "SODA",
      "Foodie",
      "EPIK",
      "B612",
      "BeautyPlus",
      "Meitu",
      "Remini",
    ]);
  });

  it("tracks KR, US, and JP", () => {
    expect(DEFAULT_MARKETS).toEqual(["KR", "US", "JP"]);
  });

  it("keeps scoring weights normalized to 100", () => {
    const total = Object.values(DEFAULT_SCORING_WEIGHTS).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(100);
  });
});

describe("sheet gateway", () => {
  it("creates all required sheets with headers", () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);
    expect(gateway.getSheetNames()).toContain("Weekly Summary");
    expect(gateway.getRows("Growth Signals")[0]).toEqual([
      "week",
      "app",
      "market",
      "channel",
      "signal_type",
      "signal_summary",
      "growth_relevance",
      "change_strength",
      "confidence",
      "score",
      "evidence_url",
      "source_status",
      "manual_check_needed",
      "notes",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- tests/schema.test.ts
```

Expected: FAIL because `src/config.ts` and `src/sheets.ts` do not exist.

- [ ] **Step 3: Implement default config**

Create `src/config.ts`:

```ts
import type { Market } from "./domain";

export type TrackedApp = {
  name: string;
  company: "SNOW" | "Competitor";
  searchTerms: Record<Market, string>;
};

export type ScoringWeights = {
  changeStrength: number;
  growthRelevance: number;
  confidence: number;
  repetition: number;
};

export const DEFAULT_MARKETS: readonly Market[] = ["KR", "US", "JP"] as const;

export const DEFAULT_TRACKED_APPS: readonly TrackedApp[] = [
  { name: "SNOW", company: "SNOW", searchTerms: { KR: "SNOW 스노우", US: "SNOW camera", JP: "SNOW camera" } },
  { name: "SODA", company: "SNOW", searchTerms: { KR: "SODA 카메라", US: "SODA camera", JP: "SODA camera" } },
  { name: "Foodie", company: "SNOW", searchTerms: { KR: "Foodie 푸디", US: "Foodie camera", JP: "Foodie camera" } },
  { name: "EPIK", company: "SNOW", searchTerms: { KR: "EPIK 에픽", US: "EPIK photo editor", JP: "EPIK photo editor" } },
  { name: "B612", company: "Competitor", searchTerms: { KR: "B612 카메라", US: "B612 camera", JP: "B612 camera" } },
  { name: "BeautyPlus", company: "Competitor", searchTerms: { KR: "BeautyPlus", US: "BeautyPlus", JP: "BeautyPlus" } },
  { name: "Meitu", company: "Competitor", searchTerms: { KR: "Meitu", US: "Meitu", JP: "Meitu" } },
  { name: "Remini", company: "Competitor", searchTerms: { KR: "Remini", US: "Remini", JP: "Remini" } },
];

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  changeStrength: 35,
  growthRelevance: 30,
  confidence: 20,
  repetition: 15,
};
```

- [ ] **Step 4: Implement sheet gateway**

Create `src/sheets.ts`:

```ts
import { REQUIRED_SHEETS, type SheetName, type TableRow } from "./domain";

export interface SheetGateway {
  getSheetNames(): string[];
  createSheet(name: SheetName): void;
  getRows(name: SheetName): unknown[][];
  replaceRows(name: SheetName, rows: unknown[][]): void;
  appendRows(name: SheetName, rows: unknown[][]): void;
}

export class InMemorySheetGateway implements SheetGateway {
  private readonly sheets = new Map<string, unknown[][]>();

  getSheetNames(): string[] {
    return [...this.sheets.keys()];
  }

  createSheet(name: SheetName): void {
    if (!this.sheets.has(name)) {
      this.sheets.set(name, []);
    }
  }

  getRows(name: SheetName): unknown[][] {
    return this.sheets.get(name)?.map((row) => [...row]) ?? [];
  }

  replaceRows(name: SheetName, rows: unknown[][]): void {
    this.sheets.set(name, rows.map((row) => [...row]));
  }

  appendRows(name: SheetName, rows: unknown[][]): void {
    const existing = this.getRows(name);
    this.sheets.set(name, [...existing, ...rows.map((row) => [...row])]);
  }
}

export class AppsScriptSheetGateway implements SheetGateway {
  constructor(private readonly spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) {}

  getSheetNames(): string[] {
    return this.spreadsheet.getSheets().map((sheet) => sheet.getName());
  }

  createSheet(name: SheetName): void {
    if (!this.spreadsheet.getSheetByName(name)) {
      this.spreadsheet.insertSheet(name);
    }
  }

  getRows(name: SheetName): unknown[][] {
    const sheet = this.mustGetSheet(name);
    const range = sheet.getDataRange();
    const values = range.getValues();
    return values.length === 1 && values[0].length === 1 && values[0][0] === "" ? [] : values;
  }

  replaceRows(name: SheetName, rows: unknown[][]): void {
    const sheet = this.mustGetSheet(name);
    sheet.clearContents();
    if (rows.length > 0) {
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }

  appendRows(name: SheetName, rows: unknown[][]): void {
    if (rows.length === 0) {
      return;
    }
    const sheet = this.mustGetSheet(name);
    const startRow = Math.max(sheet.getLastRow(), 0) + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }

  private mustGetSheet(name: SheetName): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet = this.spreadsheet.getSheetByName(name);
    if (!sheet) {
      throw new Error(`Missing sheet: ${name}`);
    }
    return sheet;
  }
}

export function ensureWorkbookSchema(gateway: SheetGateway): void {
  for (const schema of REQUIRED_SHEETS) {
    if (!gateway.getSheetNames().includes(schema.name)) {
      gateway.createSheet(schema.name);
    }
    const rows = gateway.getRows(schema.name);
    if (rows.length === 0) {
      gateway.replaceRows(schema.name, [[...schema.columns]]);
      continue;
    }
    const header = rows[0].map(String);
    const missing = schema.columns.filter((column) => !header.includes(column));
    if (missing.length > 0) {
      throw new Error(`Sheet "${schema.name}" is missing columns: ${missing.join(", ")}`);
    }
  }
}

export function rowsToObjects<T extends TableRow>(headers: string[], rows: unknown[][]): T[] {
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  ) as T[];
}

export function objectsToRows(headers: readonly string[], rows: readonly TableRow[]): unknown[][] {
  return rows.map((row) => headers.map((header) => row[header] ?? ""));
}
```

- [ ] **Step 5: Run schema tests**

Run:

```bash
npm run test -- tests/schema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit config and sheet gateway**

```bash
git add src/config.ts src/sheets.ts tests/schema.test.ts
git commit -m "Add tracker config and sheet gateway" -m "Constraint: Workbook state must be testable without live Google Sheets access.
Rejected: Couple all logic directly to SpreadsheetApp | local tests need an in-memory adapter.
Confidence: high
Scope-risk: moderate
Directive: Keep business logic behind SheetGateway so Apps Script remains a thin adapter.
Tested: npm run test -- tests/schema.test.ts
Not-tested: Live SpreadsheetApp writes."
```

## Task 4: Implement Source Connectors

**Files:**
- Create: `src/connectors.ts`
- Create: `tests/connectors.test.ts`

- [ ] **Step 1: Write connector tests**

Create `tests/connectors.test.ts`:

```ts
import {
  AppStoreSearchConnector,
  ManualQueueConnector,
  PublicUrlConnector,
  type FetchText,
} from "../src/connectors";

const fixedNow = () => "2026-05-04T00:00:00.000Z";

describe("AppStoreSearchConnector", () => {
  it("maps Apple search results into store keyword and app matrix records", async () => {
    const fetchText: FetchText = async () =>
      JSON.stringify({
        resultCount: 1,
        results: [
          {
            trackName: "EPIK - AI Photo Editor",
            description: "AI headshot, photo editor, and templates.",
            formattedPrice: "Free",
            trackViewUrl: "https://apps.apple.com/us/app/epik/id1577705074",
          },
        ],
      });

    const connector = new AppStoreSearchConnector(fetchText, fixedNow);
    const result = await connector.collect({ week: "2026-W19", app: "EPIK", market: "US", term: "EPIK photo editor" });

    expect(result.status).toBe("ok");
    expect(result.storeKeywords).toHaveLength(1);
    expect(result.storeKeywords[0].keyword_or_message).toContain("AI headshot");
    expect(result.appMatrix[0].price_summary).toBe("Free");
  });

  it("returns manual_needed when no App Store result is found", async () => {
    const fetchText: FetchText = async () => JSON.stringify({ resultCount: 0, results: [] });
    const connector = new AppStoreSearchConnector(fetchText, fixedNow);
    const result = await connector.collect({ week: "2026-W19", app: "Unknown", market: "JP", term: "Unknown app" });
    expect(result.status).toBe("manual_needed");
    expect(result.sourceRun.next_action).toContain("Verify App Store listing manually");
  });
});

describe("PublicUrlConnector", () => {
  it("extracts title and description from public HTML", async () => {
    const fetchText: FetchText = async () =>
      "<html><head><title>AI Selfie Trend</title><meta name=\"description\" content=\"Turn selfies into profile photos\"></head></html>";
    const connector = new PublicUrlConnector(fetchText, fixedNow);
    const result = await connector.collect({
      week: "2026-W19",
      app: "Remini",
      market: "US",
      channel: "Official Web",
      sourceName: "Remini official",
      sourceUrl: "https://example.com/remini",
    });
    expect(result.status).toBe("partial");
    expect(result.signals[0].signal_summary).toContain("AI Selfie Trend");
    expect(result.signals[0].confidence).toBe("medium");
  });

  it("marks blocked pages as manual checks", async () => {
    const fetchText: FetchText = async () => {
      throw new Error("HTTP 403");
    };
    const connector = new PublicUrlConnector(fetchText, fixedNow);
    const result = await connector.collect({
      week: "2026-W19",
      app: "SNOW",
      market: "KR",
      channel: "TikTok",
      sourceName: "TikTok public search",
      sourceUrl: "https://www.tiktok.com/search?q=SNOW%20AI",
    });
    expect(result.status).toBe("blocked");
    expect(result.sourceRun.manual_check_needed).toBe(true);
  });
});

describe("ManualQueueConnector", () => {
  it("creates an explicit manual check source run", async () => {
    const connector = new ManualQueueConnector(fixedNow);
    const result = await connector.collect({
      week: "2026-W19",
      app: "BeautyPlus",
      market: "JP",
      channel: "Instagram",
      sourceName: "Instagram public check",
      sourceUrl: "https://www.instagram.com/explore/search/keyword/?q=BeautyPlus",
      nextAction: "Review public Instagram search results without logging in.",
    });
    expect(result.status).toBe("manual_needed");
    expect(result.sourceRun.next_action).toContain("Review public Instagram");
  });
});
```

- [ ] **Step 2: Run connector tests to verify failure**

Run:

```bash
npm run test -- tests/connectors.test.ts
```

Expected: FAIL because `src/connectors.ts` does not exist.

- [ ] **Step 3: Implement connectors**

Create `src/connectors.ts`:

```ts
import type { Channel, Confidence, GrowthSignal, Market, SourceRun, SourceStatus, TableRow } from "./domain";

export type FetchText = (url: string) => Promise<string>;
export type Now = () => string;

export type ConnectorResult = {
  status: SourceStatus;
  sourceRun: SourceRun;
  signals: GrowthSignal[];
  storeKeywords: TableRow[];
  appMatrix: TableRow[];
};

export type AppStoreCollectInput = {
  week: string;
  app: string;
  market: Market;
  term: string;
};

export type PublicUrlCollectInput = {
  week: string;
  app: string;
  market: Market;
  channel: Channel;
  sourceName: string;
  sourceUrl: string;
};

export type ManualCollectInput = PublicUrlCollectInput & {
  nextAction: string;
};

export class AppStoreSearchConnector {
  constructor(
    private readonly fetchText: FetchText,
    private readonly now: Now,
  ) {}

  async collect(input: AppStoreCollectInput): Promise<ConnectorResult> {
    const url = `https://itunes.apple.com/search?entity=software&country=${encodeURIComponent(input.market)}&term=${encodeURIComponent(input.term)}`;
    try {
      const payload = JSON.parse(await this.fetchText(url)) as { results?: Array<Record<string, unknown>> };
      const first = payload.results?.[0];
      if (!first) {
        return this.emptyResult(input, url, "manual_needed", "Verify App Store listing manually; search returned no app result.");
      }
      const title = String(first.trackName ?? input.app);
      const description = String(first.description ?? "");
      const price = String(first.formattedPrice ?? "Unknown");
      const evidenceUrl = String(first.trackViewUrl ?? url);
      const keyword = [title, description].filter(Boolean).join(" | ");

      return {
        status: "ok",
        sourceRun: this.sourceRun(input.week, "App Store Search", url, input.app, input.market, "ok", "", false, "Review extracted listing changes."),
        signals: [],
        storeKeywords: [
          {
            week: input.week,
            app: input.app,
            market: input.market,
            store: "App Store",
            title,
            subtitle_or_short_description: description.slice(0, 240),
            keyword_or_message: keyword.slice(0, 500),
            change_from_prior_week: "",
            evidence_url: evidenceUrl,
            confidence: "high",
          },
        ],
        appMatrix: [
          {
            app: input.app,
            market: input.market,
            core_features: "",
            ai_features: extractAiKeywords(description),
            paid_model: price === "Free" ? "Free app; in-app purchases require manual pricing check" : "Paid app",
            price_summary: price,
            subscription_or_credit_notes: "Manual paywall or subscription check required for exact in-app pricing.",
            last_checked_at: this.now(),
            evidence_url: evidenceUrl,
            confidence: "high",
          },
        ],
      };
    } catch (error) {
      return this.emptyResult(input, url, "error", errorMessage(error));
    }
  }

  private emptyResult(input: AppStoreCollectInput, url: string, status: SourceStatus, nextAction: string): ConnectorResult {
    return {
      status,
      sourceRun: this.sourceRun(input.week, "App Store Search", url, input.app, input.market, status, status === "error" ? nextAction : "", true, nextAction),
      signals: [],
      storeKeywords: [],
      appMatrix: [],
    };
  }

  private sourceRun(
    week: string,
    sourceName: string,
    sourceUrl: string,
    app: string,
    market: Market,
    status: SourceStatus,
    error: string,
    manual: boolean,
    nextAction: string,
  ): SourceRun {
    return {
      run_id: `${week}-${sourceName}-${app}-${market}`.replace(/\\s+/g, "-"),
      week,
      source_name: sourceName,
      source_url: sourceUrl,
      app,
      market,
      status,
      last_success_at: status === "ok" ? this.now() : "",
      error_message: error,
      manual_check_needed: manual,
      next_action: nextAction,
    };
  }
}

export class PublicUrlConnector {
  constructor(
    private readonly fetchText: FetchText,
    private readonly now: Now,
  ) {}

  async collect(input: PublicUrlCollectInput): Promise<ConnectorResult> {
    try {
      const html = await this.fetchText(input.sourceUrl);
      const title = extractTag(html, /<title[^>]*>([\\s\\S]*?)<\\/title>/i);
      const description = extractTag(html, /<meta\\s+name=["']description["']\\s+content=["']([^"']*)["'][^>]*>/i);
      const summary = [title, description].filter(Boolean).join(" | ").trim();
      const status: SourceStatus = summary ? "partial" : "changed_structure";
      const confidence: Confidence = input.channel === "Official Web" ? "medium" : "low";
      return {
        status,
        sourceRun: this.sourceRun(input, status, "", status !== "partial", status === "partial" ? "Review extracted public page summary." : "Review source manually; parser found no title or description."),
        signals: summary
          ? [
              {
                week: input.week,
                app: input.app,
                market: input.market,
                channel: input.channel,
                signal_type: "public_page_message",
                signal_summary: summary.slice(0, 500),
                growth_relevance: containsGrowthLanguage(summary) ? 70 : 40,
                change_strength: 0,
                confidence,
                score: 0,
                evidence_url: input.sourceUrl,
                source_status: status,
                manual_check_needed: confidence === "low",
                notes: "Public page extraction; compare with prior week before ranking.",
              },
            ]
          : [],
        storeKeywords: [],
        appMatrix: [],
      };
    } catch (error) {
      return {
        status: "blocked",
        sourceRun: this.sourceRun(input, "blocked", errorMessage(error), true, "Open the public source manually without logging in and record visible patterns."),
        signals: [],
        storeKeywords: [],
        appMatrix: [],
      };
    }
  }

  private sourceRun(input: PublicUrlCollectInput, status: SourceStatus, error: string, manual: boolean, nextAction: string): SourceRun {
    return {
      run_id: `${input.week}-${input.sourceName}-${input.app}-${input.market}`.replace(/\\s+/g, "-"),
      week: input.week,
      source_name: input.sourceName,
      source_url: input.sourceUrl,
      app: input.app,
      market: input.market,
      status,
      last_success_at: status === "partial" || status === "ok" ? this.now() : "",
      error_message: error,
      manual_check_needed: manual,
      next_action: nextAction,
    };
  }
}

export class ManualQueueConnector {
  constructor(private readonly now: Now) {}

  async collect(input: ManualCollectInput): Promise<ConnectorResult> {
    return {
      status: "manual_needed",
      sourceRun: {
        run_id: `${input.week}-${input.sourceName}-${input.app}-${input.market}`.replace(/\\s+/g, "-"),
        week: input.week,
        source_name: input.sourceName,
        source_url: input.sourceUrl,
        app: input.app,
        market: input.market,
        status: "manual_needed",
        last_success_at: "",
        error_message: "",
        manual_check_needed: true,
        next_action: `${input.nextAction} Created at ${this.now()}.`,
      },
      signals: [],
      storeKeywords: [],
      appMatrix: [],
    };
  }
}

function extractAiKeywords(description: string): string {
  const matches = description.match(/\\b(AI|artificial intelligence|headshot|avatar|retouch|enhance|filter|template)\\b/gi);
  return [...new Set(matches ?? [])].join(", ");
}

function containsGrowthLanguage(text: string): boolean {
  return /AI|viral|trend|template|avatar|headshot|beauty|edit|share|photo/i.test(text);
}

function extractTag(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return decodeHtml(match?.[1]?.replace(/\\s+/g, " ").trim() ?? "");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 4: Run connector tests**

Run:

```bash
npm run test -- tests/connectors.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit connectors**

```bash
git add src/connectors.ts tests/connectors.test.ts
git commit -m "Add public source connectors" -m "Constraint: Social sources use non-login public access only.
Rejected: Treat blocked TikTok or Instagram pages as hard failures | blocked public pages must become manual checks.
Confidence: medium
Scope-risk: moderate
Directive: Keep connector results structured even when public fetching fails.
Tested: npm run test -- tests/connectors.test.ts
Not-tested: Live public URL behavior from Apps Script IP ranges."
```

## Task 5: Implement Change Detection and Scoring

**Files:**
- Create: `src/scoring.ts`
- Create: `tests/scoring.test.ts`

- [ ] **Step 1: Write scoring tests**

Create `tests/scoring.test.ts`:

```ts
import { compareStoreKeywordRows, scoreSignal } from "../src/scoring";
import type { GrowthSignal, TableRow } from "../src/domain";

const baseSignal: GrowthSignal = {
  week: "2026-W19",
  app: "EPIK",
  market: "US",
  channel: "TikTok",
  signal_type: "public_page_message",
  signal_summary: "AI headshot template appears repeatedly",
  growth_relevance: 85,
  change_strength: 80,
  confidence: "low",
  score: 0,
  evidence_url: "https://example.com/evidence",
  source_status: "partial",
  manual_check_needed: true,
  notes: "",
};

describe("scoreSignal", () => {
  it("scores high-importance low-confidence social signals below high-confidence evidence", () => {
    const lowConfidence = scoreSignal({ ...baseSignal }, 70);
    const highConfidence = scoreSignal({ ...baseSignal, channel: "App Store", confidence: "high", manual_check_needed: false }, 70);
    expect(highConfidence.score).toBeGreaterThan(lowConfidence.score);
    expect(lowConfidence.score).toBeGreaterThan(0);
  });

  it("keeps evidence-free signals out of ranking by assigning score zero", () => {
    const scored = scoreSignal({ ...baseSignal, evidence_url: "" }, 80);
    expect(scored.score).toBe(0);
    expect(scored.notes).toContain("Excluded from Top 5");
  });
});

describe("compareStoreKeywordRows", () => {
  it("detects new keyword messages against prior week rows", () => {
    const previous: TableRow[] = [
      { week: "2026-W18", app: "EPIK", market: "US", store: "App Store", keyword_or_message: "Photo editor", evidence_url: "a", confidence: "high" },
    ];
    const current: TableRow[] = [
      { week: "2026-W19", app: "EPIK", market: "US", store: "App Store", keyword_or_message: "AI headshot photo editor", evidence_url: "b", confidence: "high" },
    ];
    const result = compareStoreKeywordRows(previous, current);
    expect(result[0].change_from_prior_week).toBe("changed");
  });
});
```

- [ ] **Step 2: Run scoring tests to verify failure**

Run:

```bash
npm run test -- tests/scoring.test.ts
```

Expected: FAIL because `src/scoring.ts` does not exist.

- [ ] **Step 3: Implement scoring**

Create `src/scoring.ts`:

```ts
import { DEFAULT_SCORING_WEIGHTS } from "./config";
import type { Confidence, GrowthSignal, TableRow } from "./domain";

const CONFIDENCE_VALUE: Record<Confidence, number> = {
  high: 100,
  medium: 65,
  low: 35,
};

export function scoreSignal(signal: GrowthSignal, repetition: number): GrowthSignal {
  if (!signal.evidence_url) {
    return {
      ...signal,
      score: 0,
      notes: appendNote(signal.notes, "Excluded from Top 5 because evidence_url is empty."),
    };
  }

  const raw =
    signal.change_strength * (DEFAULT_SCORING_WEIGHTS.changeStrength / 100) +
    signal.growth_relevance * (DEFAULT_SCORING_WEIGHTS.growthRelevance / 100) +
    CONFIDENCE_VALUE[signal.confidence] * (DEFAULT_SCORING_WEIGHTS.confidence / 100) +
    repetition * (DEFAULT_SCORING_WEIGHTS.repetition / 100);

  return {
    ...signal,
    score: Math.round(raw),
  };
}

export function compareStoreKeywordRows(previousRows: TableRow[], currentRows: TableRow[]): TableRow[] {
  return currentRows.map((row) => {
    const prior = previousRows.find(
      (candidate) =>
        candidate.app === row.app &&
        candidate.market === row.market &&
        candidate.store === row.store,
    );
    const priorMessage = String(prior?.keyword_or_message ?? "");
    const currentMessage = String(row.keyword_or_message ?? "");
    return {
      ...row,
      change_from_prior_week: prior ? (priorMessage === currentMessage ? "unchanged" : "changed") : "new",
    };
  });
}

export function rankSignals(signals: GrowthSignal[]): GrowthSignal[] {
  return [...signals].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return confidenceRank(b.confidence) - confidenceRank(a.confidence);
  });
}

export function repetitionScore(signal: GrowthSignal, allSignals: GrowthSignal[]): number {
  const sameMessageCount = allSignals.filter(
    (candidate) =>
      candidate.app === signal.app &&
      candidate.market === signal.market &&
      candidate.signal_summary.toLowerCase() === signal.signal_summary.toLowerCase(),
  ).length;
  return Math.min(100, sameMessageCount * 35);
}

function confidenceRank(confidence: Confidence): number {
  return CONFIDENCE_VALUE[confidence];
}

function appendNote(existing: string, note: string): string {
  return existing ? `${existing} ${note}` : note;
}
```

- [ ] **Step 4: Run scoring tests**

Run:

```bash
npm run test -- tests/scoring.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit scoring**

```bash
git add src/scoring.ts tests/scoring.test.ts
git commit -m "Score weekly growth signals" -m "Constraint: Importance and confidence must remain separate.
Rejected: Rank social observations only by perceived importance | low-confidence evidence needs visible caution.
Confidence: high
Scope-risk: moderate
Directive: Any new ranking feature must preserve evidence_url and confidence safeguards.
Tested: npm run test -- tests/scoring.test.ts
Not-tested: Real week-over-week historical sheets."
```

## Task 6: Generate the Weekly Summary

**Files:**
- Create: `src/summary.ts`
- Create: `tests/summary.test.ts`

- [ ] **Step 1: Write summary tests**

Create `tests/summary.test.ts`:

```ts
import { buildWeeklySummaryRows } from "../src/summary";
import type { GrowthSignal, SourceRun } from "../src/domain";

function signal(overrides: Partial<GrowthSignal>): GrowthSignal {
  return {
    week: "2026-W19",
    app: "EPIK",
    market: "US",
    channel: "App Store",
    signal_type: "store_keyword",
    signal_summary: "AI headshot keywords added to store listing",
    growth_relevance: 90,
    change_strength: 80,
    confidence: "high",
    score: 88,
    evidence_url: "https://apps.apple.com/example",
    source_status: "ok",
    manual_check_needed: false,
    notes: "",
    ...overrides,
  };
}

describe("buildWeeklySummaryRows", () => {
  it("puts the highest eligible signal first", () => {
    const rows = buildWeeklySummaryRows({
      week: "2026-W19",
      signals: [signal({ app: "SNOW", score: 60 }), signal({ app: "EPIK", score: 88 })],
      sourceRuns: [],
    });
    expect(rows[1].section).toBe("Top Growth Signal");
    expect(rows[1].app).toBe("EPIK");
  });

  it("excludes evidence-free signals from top changes", () => {
    const rows = buildWeeklySummaryRows({
      week: "2026-W19",
      signals: [signal({ score: 99, evidence_url: "" }), signal({ app: "SODA", score: 70 })],
      sourceRuns: [],
    });
    expect(rows.some((row) => row.section === "Top Changes" && row.evidence_url === "")).toBe(false);
  });

  it("adds manual check rows for blocked sources", () => {
    const sourceRuns: SourceRun[] = [
      {
        run_id: "run-1",
        week: "2026-W19",
        source_name: "TikTok public search",
        source_url: "https://www.tiktok.com/search?q=EPIK",
        app: "EPIK",
        market: "US",
        status: "blocked",
        last_success_at: "",
        error_message: "HTTP 403",
        manual_check_needed: true,
        next_action: "Open public search manually.",
      },
    ];
    const rows = buildWeeklySummaryRows({ week: "2026-W19", signals: [], sourceRuns });
    expect(rows.some((row) => row.section === "Manual Checks" && row.headline.includes("TikTok"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run summary tests to verify failure**

Run:

```bash
npm run test -- tests/summary.test.ts
```

Expected: FAIL because `src/summary.ts` does not exist.

- [ ] **Step 3: Implement summary generation**

Create `src/summary.ts`:

```ts
import type { GrowthSignal, SourceRun, TableRow } from "./domain";
import { rankSignals } from "./scoring";

export type SummaryInput = {
  week: string;
  signals: GrowthSignal[];
  sourceRuns: SourceRun[];
};

export function buildWeeklySummaryRows(input: SummaryInput): TableRow[] {
  const eligible = rankSignals(input.signals).filter(
    (signal) => signal.evidence_url && !(signal.confidence === "low" && signal.manual_check_needed),
  );
  const top = eligible[0];
  const rows: TableRow[] = [
    {
      week: input.week,
      section: "Overview",
      rank: "",
      headline: top ? `Top signal: ${top.signal_summary}` : "No eligible growth signal collected",
      detail: top ? `${top.app} / ${top.market} / ${top.channel}` : "Run produced no evidence-backed Top 5 item.",
      app: top?.app ?? "",
      market: top?.market ?? "",
      channel: top?.channel ?? "",
      score: top?.score ?? "",
      confidence: top?.confidence ?? "",
      evidence_url: top?.evidence_url ?? "",
      manual_check_needed: false,
    },
  ];

  if (top) {
    rows.push(toSummaryRow(input.week, "Top Growth Signal", 1, top));
  }

  eligible.slice(0, 5).forEach((signal, index) => {
    rows.push(toSummaryRow(input.week, "Top Changes", index + 1, signal));
  });

  const manualRuns = input.sourceRuns.filter((run) => run.manual_check_needed);
  manualRuns.forEach((run, index) => {
    rows.push({
      week: input.week,
      section: "Manual Checks",
      rank: index + 1,
      headline: `${run.source_name}: ${run.status}`,
      detail: run.next_action,
      app: run.app,
      market: run.market,
      channel: "",
      score: "",
      confidence: "",
      evidence_url: run.source_url,
      manual_check_needed: true,
    });
  });

  const lowConfidenceSignals = rankSignals(input.signals).filter(
    (signal) => signal.confidence === "low" && signal.evidence_url,
  );
  lowConfidenceSignals.slice(0, 5).forEach((signal, index) => {
    rows.push(toSummaryRow(input.week, "Observation Candidates", index + 1, signal));
  });

  return rows;
}

function toSummaryRow(week: string, section: string, rank: number, signal: GrowthSignal): TableRow {
  return {
    week,
    section,
    rank,
    headline: signal.signal_summary,
    detail: `${signal.signal_type}; ${signal.notes}`.trim(),
    app: signal.app,
    market: signal.market,
    channel: signal.channel,
    score: signal.score,
    confidence: signal.confidence,
    evidence_url: signal.evidence_url,
    manual_check_needed: signal.manual_check_needed,
  };
}
```

- [ ] **Step 4: Run summary tests**

Run:

```bash
npm run test -- tests/summary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit summary generation**

```bash
git add src/summary.ts tests/summary.test.ts
git commit -m "Generate evidence-backed weekly summaries" -m "Constraint: Top 5 summary rows require source evidence.
Rejected: Promote low-confidence social observations into the main Top 5 automatically | they belong in observation or manual-check sections.
Confidence: high
Scope-risk: moderate
Directive: Keep Weekly Summary readable as a one-page operating artifact.
Tested: npm run test -- tests/summary.test.ts
Not-tested: Visual formatting inside Google Sheets."
```

## Task 7: Implement the Weekly Runner

**Files:**
- Create: `src/runner.ts`
- Create: `tests/runner.test.ts`

- [ ] **Step 1: Write runner tests**

Create `tests/runner.test.ts`:

```ts
import { InMemorySheetGateway, ensureWorkbookSchema } from "../src/sheets";
import { runWeeklyTracker } from "../src/runner";

describe("runWeeklyTracker", () => {
  it("updates Weekly Summary, Growth Signals, App Matrix, Store Keywords, and Sources & Runs", async () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      fetchText: async (url) => {
        if (url.includes("itunes.apple.com")) {
          return JSON.stringify({
            results: [
              {
                trackName: "EPIK - AI Photo Editor",
                description: "AI headshot and viral photo templates.",
                formattedPrice: "Free",
                trackViewUrl: "https://apps.apple.com/us/app/epik/id1577705074",
              },
            ],
          });
        }
        return "<html><head><title>AI trend</title><meta name=\"description\" content=\"Viral AI photo edit\"></head></html>";
      },
      now: () => "2026-05-04T00:00:00.000Z",
      dryRun: false,
    });

    expect(gateway.getRows("Store Keywords").length).toBeGreaterThan(1);
    expect(gateway.getRows("App Matrix").length).toBeGreaterThan(1);
    expect(gateway.getRows("Growth Signals").length).toBeGreaterThan(1);
    expect(gateway.getRows("Weekly Summary").length).toBeGreaterThan(1);
    expect(gateway.getRows("Sources & Runs").length).toBeGreaterThan(1);
  });

  it("does not write collected rows during dry run", async () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      fetchText: async () => JSON.stringify({ results: [] }),
      now: () => "2026-05-04T00:00:00.000Z",
      dryRun: true,
    });

    expect(gateway.getRows("Weekly Summary")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run runner tests to verify failure**

Run:

```bash
npm run test -- tests/runner.test.ts
```

Expected: FAIL because `src/runner.ts` does not exist.

- [ ] **Step 3: Implement runner orchestration**

Create `src/runner.ts`:

```ts
import { DEFAULT_MARKETS, DEFAULT_TRACKED_APPS } from "./config";
import { AppStoreSearchConnector, PublicUrlConnector, type FetchText, type ConnectorResult, type Now } from "./connectors";
import { REQUIRED_SHEETS, type GrowthSignal, type TableRow } from "./domain";
import { buildWeeklySummaryRows } from "./summary";
import { compareStoreKeywordRows, repetitionScore, scoreSignal } from "./scoring";
import { ensureWorkbookSchema, objectsToRows, rowsToObjects, type SheetGateway } from "./sheets";

export type RunOptions = {
  gateway: SheetGateway;
  week: string;
  fetchText: FetchText;
  now: Now;
  dryRun: boolean;
};

export type RunResult = {
  week: string;
  collectedSignals: number;
  sourceRuns: number;
  dryRun: boolean;
};

export async function runWeeklyTracker(options: RunOptions): Promise<RunResult> {
  ensureWorkbookSchema(options.gateway);

  const results: ConnectorResult[] = [];
  const appStore = new AppStoreSearchConnector(options.fetchText, options.now);
  const publicUrl = new PublicUrlConnector(options.fetchText, options.now);

  for (const app of DEFAULT_TRACKED_APPS) {
    for (const market of DEFAULT_MARKETS) {
      results.push(await appStore.collect({ week: options.week, app: app.name, market, term: app.searchTerms[market] }));
      results.push(
        await publicUrl.collect({
          week: options.week,
          app: app.name,
          market,
          channel: "TikTok",
          sourceName: "TikTok public search",
          sourceUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(`${app.name} AI photo`)}`,
        }),
      );
      results.push(
        await publicUrl.collect({
          week: options.week,
          app: app.name,
          market,
          channel: "Instagram",
          sourceName: "Instagram public search",
          sourceUrl: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(app.name)}`,
        }),
      );
    }
  }

  const allSignals = results.flatMap((result) => result.signals);
  const scoredSignals = allSignals.map((signal) => scoreSignal(signal, repetitionScore(signal, allSignals)));
  const sourceRuns = results.map((result) => result.sourceRun);
  const appMatrix = results.flatMap((result) => result.appMatrix);
  const storeKeywordRows = results.flatMap((result) => result.storeKeywords);
  const previousStoreRows = readDataRows<TableRow>(options.gateway, "Store Keywords").filter((row) => row.week !== options.week);
  const comparedStoreRows = compareStoreKeywordRows(previousStoreRows, storeKeywordRows);
  const summaryRows = buildWeeklySummaryRows({ week: options.week, signals: scoredSignals, sourceRuns });

  if (!options.dryRun) {
    replaceDataRows(options.gateway, "Weekly Summary", summaryRows);
    replaceDataRows(options.gateway, "Growth Signals", scoredSignals as unknown as TableRow[]);
    replaceDataRows(options.gateway, "App Matrix", appMatrix);
    replaceDataRows(options.gateway, "Store Keywords", comparedStoreRows);
    replaceDataRows(options.gateway, "Sources & Runs", sourceRuns as unknown as TableRow[]);
  }

  return {
    week: options.week,
    collectedSignals: scoredSignals.length,
    sourceRuns: sourceRuns.length,
    dryRun: options.dryRun,
  };
}

function readDataRows<T extends TableRow>(gateway: SheetGateway, sheetName: "Store Keywords"): T[] {
  const schema = REQUIRED_SHEETS.find((sheet) => sheet.name === sheetName);
  if (!schema) {
    throw new Error(`Missing schema: ${sheetName}`);
  }
  const rows = gateway.getRows(sheetName);
  return rowsToObjects<T>([...schema.columns], rows.slice(1));
}

function replaceDataRows(gateway: SheetGateway, sheetName: typeof REQUIRED_SHEETS[number]["name"], rows: TableRow[]): void {
  const schema = REQUIRED_SHEETS.find((sheet) => sheet.name === sheetName);
  if (!schema) {
    throw new Error(`Missing schema: ${sheetName}`);
  }
  gateway.replaceRows(sheetName, [[...schema.columns], ...objectsToRows(schema.columns, rows)]);
}
```

- [ ] **Step 4: Run runner tests**

Run:

```bash
npm run test -- tests/runner.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 6: Commit runner**

```bash
git add src/runner.ts tests/runner.test.ts
git commit -m "Orchestrate weekly tracker runs" -m "Constraint: Weekly execution must update summary, signals, source status, and supporting tabs together.
Rejected: Write each tab through independent manual scripts | inconsistent weekly state would be easy to create.
Confidence: high
Scope-risk: moderate
Directive: Keep runner orchestration deterministic and covered by in-memory tests.
Tested: npm run test
Not-tested: UrlFetchApp live network execution."
```

## Task 8: Add Apps Script Entrypoints and Build Verification

**Files:**
- Create: `src/gas.ts`
- Create: `tests/build.test.ts` only if the build command needs a smoke check in Vitest; otherwise verify through `npm run build`.

- [ ] **Step 1: Implement Apps Script globals**

Create `src/gas.ts`:

```ts
import { runWeeklyTracker as runTrackerCore } from "./runner";
import { AppsScriptSheetGateway } from "./sheets";

function fetchText(url: string): Promise<string> {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      "User-Agent": "SNOW Growth Signal Tracker Apps Script",
    },
  });
  const code = response.getResponseCode();
  if (code >= 400) {
    throw new Error(`HTTP ${code}`);
  }
  return Promise.resolve(response.getContentText());
}

function now(): string {
  return new Date().toISOString();
}

function currentIsoWeek(): string {
  const date = new Date();
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu("Growth Tracker")
    .addItem("Run Weekly Tracker", "runWeeklyTracker")
    .addItem("Dry Run Weekly Tracker", "runWeeklyTrackerDryRun")
    .addItem("Install Weekly Trigger", "installWeeklyTrigger")
    .addToUi();
}

export async function runWeeklyTracker(): Promise<void> {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const gateway = new AppsScriptSheetGateway(spreadsheet);
  const result = await runTrackerCore({
    gateway,
    week: currentIsoWeek(),
    fetchText,
    now,
    dryRun: false,
  });
  SpreadsheetApp.getUi().alert(`Weekly tracker finished for ${result.week}. Signals: ${result.collectedSignals}; sources: ${result.sourceRuns}.`);
}

export async function runWeeklyTrackerDryRun(): Promise<void> {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const gateway = new AppsScriptSheetGateway(spreadsheet);
  const result = await runTrackerCore({
    gateway,
    week: currentIsoWeek(),
    fetchText,
    now,
    dryRun: true,
  });
  SpreadsheetApp.getUi().alert(`Dry run finished for ${result.week}. Signals: ${result.collectedSignals}; sources: ${result.sourceRuns}. No rows were written.`);
}

export function installWeeklyTrigger(): void {
  const existing = ScriptApp.getProjectTriggers().filter((trigger) => trigger.getHandlerFunction() === "runWeeklyTracker");
  existing.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("runWeeklyTracker").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  SpreadsheetApp.getUi().alert("Installed Monday 09:00 weekly trigger for runWeeklyTracker.");
}

Object.assign(globalThis, {
  onOpen,
  runWeeklyTracker,
  runWeeklyTrackerDryRun,
  installWeeklyTrigger,
});
```

- [ ] **Step 2: Run typecheck to catch Apps Script type errors**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Build the Apps Script bundle**

Run:

```bash
npm run build
```

Expected:

```text
build/Code.js exists
build/appsscript.json exists
```

Verify:

```bash
test -f build/Code.js
test -f build/appsscript.json
```

Expected: both commands exit `0`.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run verify
```

Expected: typecheck, tests, and build all pass.

- [ ] **Step 5: Commit Apps Script entrypoints**

```bash
git add src/gas.ts
git commit -m "Expose Apps Script tracker actions" -m "Constraint: Google Sheets operators need a menu action and weekly trigger installer.
Rejected: Require users to run hidden functions from the Apps Script editor | the workbook should expose the operating controls.
Confidence: high
Scope-risk: moderate
Directive: Keep Apps Script globals in src/gas.ts and core logic in tested modules.
Tested: npm run verify
Not-tested: Menu rendering in a live Google Sheet."
```

## Task 9: Add Deployment and Sheet Setup Documentation

**Files:**
- Create: `docs/apps-script-setup.md`

- [ ] **Step 1: Write setup documentation**

Create `docs/apps-script-setup.md`:

````md
# Apps Script Setup

This project builds a Google Apps Script bundle for a Google Sheets workbook.

## Local Verification

Run:

```bash
npm install
npm run verify
```

Expected:

- TypeScript passes.
- Vitest passes.
- `build/Code.js` and `build/appsscript.json` are generated.

## First Google Sheet Setup

1. Create a Google Sheets workbook named `SNOW Growth Signal Tracker`.
2. Open Extensions -> Apps Script.
3. Create or connect a clasp project for the workbook.
4. From this repo, run:

```bash
npm run build
npx clasp login
npx clasp create --type sheets --title "SNOW Growth Signal Tracker"
npx clasp push
```

If a `.clasp.json` already exists for the target workbook, skip `clasp create` and run only:

```bash
npm run build
npx clasp push
```

## First Run

1. Open the Google Sheet.
2. Reload the sheet so the `Growth Tracker` menu appears.
3. Run Growth Tracker -> Dry Run Weekly Tracker.
4. Authorize the script when Google prompts for permissions.
5. Run Growth Tracker -> Run Weekly Tracker.
6. Check these tabs:
   - `Weekly Summary`
   - `Growth Signals`
   - `Sources & Runs`

## Weekly Trigger

Use Growth Tracker -> Install Weekly Trigger to schedule Monday 09:00 execution in the script owner's timezone.

## Source Policy

TikTok and Instagram are non-login public checks only. If public access is blocked, the run writes a manual check item instead of treating the whole run as failed.
````

- [ ] **Step 2: Validate documentation commands are present**

Run:

```bash
rg -n "npm run verify|npx clasp push|Dry Run Weekly Tracker|Run Weekly Tracker" docs/apps-script-setup.md
```

Expected: four or more matches.

- [ ] **Step 3: Commit docs**

```bash
git add docs/apps-script-setup.md
git commit -m "Document Apps Script deployment" -m "Constraint: Live Google Sheets deployment requires account authorization outside local tests.
Rejected: Hide deployment behind undocumented manual steps | operators need a repeatable setup path.
Confidence: high
Scope-risk: narrow
Directive: Keep local verification separate from credentialed clasp deployment.
Tested: rg -n \"npm run verify|npx clasp push|Dry Run Weekly Tracker|Run Weekly Tracker\" docs/apps-script-setup.md
Not-tested: Google account clasp authorization."
```

## Task 10: Final Verification and Live Workbook Smoke Check

**Files:**
- Modify only files changed by prior tasks if verification exposes a concrete defect.

- [ ] **Step 1: Run local full verification**

Run:

```bash
npm run verify
git status --short
```

Expected: `npm run verify` passes and `git status --short` is empty.

- [ ] **Step 2: Push to Apps Script when a target workbook is available**

Run:

```bash
npm run build
npx clasp push
```

Expected: clasp uploads `build/Code.js` and `build/appsscript.json` to the target Apps Script project.

- [ ] **Step 3: Run live dry run**

In the target Google Sheet, run:

```text
Growth Tracker -> Dry Run Weekly Tracker
```

Expected: an alert says the dry run finished and no data rows were written.

- [ ] **Step 4: Run live weekly tracker**

In the target Google Sheet, run:

```text
Growth Tracker -> Run Weekly Tracker
```

Expected:

- `Weekly Summary` has an overview row plus Top Changes, Observation Candidates, or Manual Checks.
- `Growth Signals` has public-page signals when pages are reachable.
- `Sources & Runs` records `ok`, `partial`, `blocked`, `manual_needed`, or `error` statuses.
- Blocked TikTok/Instagram public access appears as manual checks.

- [ ] **Step 5: Commit any verification fix**

If a live smoke check exposes a defect in runtime orchestration, network handling, or summary output, fix it with the smallest patch and commit:

```bash
git status --short
git add src/connectors.ts src/gas.ts src/runner.ts src/summary.ts tests/connectors.test.ts tests/runner.test.ts tests/summary.test.ts
git commit -m "Fix live tracker smoke check" -m "Constraint: Live Apps Script behavior differed from local adapter tests.
Rejected: Leave live-only failure documented without a fix | first version must run from the Sheets menu.
Confidence: medium
Scope-risk: narrow
Directive: Add a local test for any live defect that can be reproduced without Google services.
Tested: npm run verify; live Dry Run Weekly Tracker; live Run Weekly Tracker
Not-tested: Long-term weekly trigger execution."
```

If the live defect is in a different file, stage that exact file path from `git status --short` instead of using `git add .`. If no fix is required, do not create an empty commit.

## Plan Self-Review

Spec coverage:

- Google Sheets operating surface: Tasks 2, 3, 7, and 8.
- Apps Script weekly orchestrator: Tasks 7 and 8.
- Core apps and competitors: Task 3 default config.
- KR/US/JP markets: Task 3 default config.
- Core features, AI features, paid price, app-store keywords, ads, social patterns: Tasks 4, 5, 6, and 7 create source rows, store rows, app matrix rows, growth signals, and manual checks.
- Non-login social policy: Tasks 4, 6, 7, and 9.
- Change detection, scoring, and action points: Tasks 5 and 6.
- Evidence and confidence safeguards: Tasks 5 and 6.
- Testing and completion criteria: Tasks 2 through 10.

Placeholder scan:

- No unfinished-marker strings, incomplete sections, or unspecified file paths.
- Every code-creating step names the file and provides concrete contents.
- Every test step gives an exact command and expected result.

Type consistency:

- `GrowthSignal`, `SourceRun`, `SheetGateway`, `FetchText`, and `Now` are introduced before use by subsequent tasks.
- Sheet names and column names match the approved design and schema tests.
- Apps Script globals call the same `runWeeklyTracker` core function defined in `src/runner.ts`.
