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
});
