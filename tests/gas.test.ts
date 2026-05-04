import { vi } from "vitest";

const runTrackerCore = vi.fn();

vi.mock("../src/runner", () => ({
  runWeeklyTracker: runTrackerCore,
}));

describe("Apps Script entrypoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runTrackerCore.mockResolvedValue({
      week: "2026-W19",
      collectedSignals: 3,
      sourceRuns: 2,
      dryRun: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("installs the weekly trigger with the UI-free scheduled handler", async () => {
    const oldMenuTrigger = triggerFor("runWeeklyTracker");
    const oldScheduledTrigger = triggerFor("runWeeklyTrackerScheduled");
    const unrelatedTrigger = triggerFor("otherHandler");
    const deleteTrigger = vi.fn();
    const create = vi.fn();
    const atHour = vi.fn(() => ({ create }));
    const onWeekDay = vi.fn(() => ({ atHour }));
    const timeBased = vi.fn(() => ({ onWeekDay }));
    const newTrigger = vi.fn(() => ({ timeBased }));
    const alert = vi.fn();

    vi.stubGlobal("ScriptApp", {
      WeekDay: { MONDAY: "MONDAY" },
      getProjectTriggers: vi.fn(() => [oldMenuTrigger, oldScheduledTrigger, unrelatedTrigger]),
      deleteTrigger,
      newTrigger,
    });
    vi.stubGlobal("SpreadsheetApp", {
      getUi: vi.fn(() => ({ alert })),
    });

    const { installWeeklyTrigger } = await import("../src/gas");

    installWeeklyTrigger();

    expect(deleteTrigger).toHaveBeenCalledWith(oldMenuTrigger);
    expect(deleteTrigger).toHaveBeenCalledWith(oldScheduledTrigger);
    expect(deleteTrigger).not.toHaveBeenCalledWith(unrelatedTrigger);
    expect(newTrigger).toHaveBeenCalledWith("runWeeklyTrackerScheduled");
    expect(onWeekDay).toHaveBeenCalledWith("MONDAY");
    expect(atHour).toHaveBeenCalledWith(9);
    expect(create).toHaveBeenCalledOnce();
  });

  it("runs the scheduled tracker without requesting Spreadsheet UI", async () => {
    const getUi = vi.fn(() => ({ alert: vi.fn() }));
    vi.stubGlobal("SpreadsheetApp", {
      getActiveSpreadsheet: vi.fn(() => spreadsheetStub),
      getUi,
    });
    vi.stubGlobal("UrlFetchApp", {
      fetch: vi.fn(),
    });
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { runWeeklyTrackerScheduled } = await import("../src/gas");

    await runWeeklyTrackerScheduled();

    expect(getUi).not.toHaveBeenCalled();
    expect(runTrackerCore).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        gateway: expect.any(Object),
        fetchText: expect.any(Function),
        now: expect.any(Function),
      }),
    );
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Scheduled weekly tracker finished"));
  });
});

function triggerFor(handler: string): GoogleAppsScript.Script.Trigger {
  return {
    getHandlerFunction: () => handler,
  } as GoogleAppsScript.Script.Trigger;
}

const spreadsheetStub = {
  getSheets: vi.fn(() => []),
  getSheetByName: vi.fn(() => null),
  insertSheet: vi.fn(),
} as unknown as GoogleAppsScript.Spreadsheet.Spreadsheet;
