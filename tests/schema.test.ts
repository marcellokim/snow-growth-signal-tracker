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
