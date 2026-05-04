import {
  REQUIRED_SHEETS,
  buildEmptyRow,
  normalizeWeek,
  type SheetName,
} from "../src/domain";
import { DEFAULT_TRACKED_APPS, DEFAULT_MARKETS, DEFAULT_SCORING_WEIGHTS } from "../src/config";
import { InMemorySheetGateway, ensureWorkbookSchema } from "../src/sheets";

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
    // @ts-expect-error Invalid sheet names must be rejected at compile time.
    const invalidName: SheetName = "Invalid Sheet";
    expect(name).toBe("Weekly Summary");
    expect(invalidName).toBe("Invalid Sheet");
  });
});

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
    expect(gateway.getSheetNames()).toEqual(REQUIRED_SHEETS.map((sheet) => sheet.name));
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

  it("rejects required headers in the wrong order", () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);
    const growthSignalHeaders = [...REQUIRED_SHEETS.find((sheet) => sheet.name === "Growth Signals")!.columns];
    gateway.replaceRows("Growth Signals", [[growthSignalHeaders[1], growthSignalHeaders[0], ...growthSignalHeaders.slice(2)]]);

    expect(() => ensureWorkbookSchema(gateway)).toThrow(
      'Sheet "Growth Signals" header must match required column order',
    );
  });

  it("rejects required headers with an extra trailing column", () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);
    const growthSignalHeaders = [...REQUIRED_SHEETS.find((sheet) => sheet.name === "Growth Signals")!.columns];
    gateway.replaceRows("Growth Signals", [[...growthSignalHeaders, "unexpected_column"]]);

    expect(() => ensureWorkbookSchema(gateway)).toThrow(
      'Sheet "Growth Signals" header must match required column order',
    );
  });

  it("rejects ragged replacement rows before changing existing rows", () => {
    const gateway = new InMemorySheetGateway();
    const existingRows = [
      ["week", "app"],
      ["2026-W09", "SNOW"],
    ];
    gateway.replaceRows("Growth Signals", existingRows);

    expect(() => gateway.replaceRows("Growth Signals", [["a"], ["b", "c"]])).toThrow(
      "Rows for sheet \"Growth Signals\" must be rectangular",
    );
    expect(gateway.getRows("Growth Signals")).toEqual(existingRows);
  });

  it("rejects zero-width replacement rows before changing existing rows", () => {
    const gateway = new InMemorySheetGateway();
    const existingRows = [
      ["week", "app"],
      ["2026-W09", "SNOW"],
    ];
    gateway.replaceRows("Growth Signals", existingRows);

    expect(() => gateway.replaceRows("Growth Signals", [[]])).toThrow(
      'Rows for sheet "Growth Signals" must have at least one column',
    );
    expect(gateway.getRows("Growth Signals")).toEqual(existingRows);
  });

  it("rejects ragged appended rows before appending anything", () => {
    const gateway = new InMemorySheetGateway();
    const existingRows = [
      ["week", "app"],
      ["2026-W09", "SNOW"],
    ];
    gateway.replaceRows("Growth Signals", existingRows);

    expect(() => gateway.appendRows("Growth Signals", [["a"], ["b", "c"]])).toThrow(
      "Rows for sheet \"Growth Signals\" must be rectangular",
    );
    expect(gateway.getRows("Growth Signals")).toEqual(existingRows);
  });

  it("rejects zero-width appended rows before appending anything", () => {
    const gateway = new InMemorySheetGateway();
    const existingRows = [
      ["week", "app"],
      ["2026-W09", "SNOW"],
    ];
    gateway.replaceRows("Growth Signals", existingRows);

    expect(() => gateway.appendRows("Growth Signals", [[]])).toThrow(
      'Rows for sheet "Growth Signals" must have at least one column',
    );
    expect(gateway.getRows("Growth Signals")).toEqual(existingRows);
  });
});
