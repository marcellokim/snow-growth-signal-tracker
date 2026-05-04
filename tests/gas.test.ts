import { vi } from "vitest";

const runTrackerCore = vi.fn();

vi.mock("../src/runner", () => ({
  runWeeklyTracker: runTrackerCore,
}));

describe("Apps Script entrypoints", () => {
  beforeEach(() => {
    vi.resetModules();
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

  it("describes dry runs as skipping weekly data rows only", async () => {
    const alert = vi.fn();
    vi.stubGlobal("SpreadsheetApp", {
      getActiveSpreadsheet: vi.fn(() => spreadsheetStub),
      getUi: vi.fn(() => ({ alert })),
    });
    vi.stubGlobal("UrlFetchApp", {
      fetch: vi.fn(),
    });

    const { runWeeklyTrackerDryRun } = await import("../src/gas");

    await runWeeklyTrackerDryRun();

    expect(alert).toHaveBeenCalledWith(expect.stringContaining("No weekly data rows were written."));
  });

  it("prefetches source URLs through UrlFetchApp.fetchAll before fetchText reads the cache", async () => {
    const fetch = vi.fn();
    const fetchAll = vi.fn(() => [responseFor(200, "cached app store"), responseFor(403, "blocked social")]);
    vi.stubGlobal("SpreadsheetApp", {
      getActiveSpreadsheet: vi.fn(() => spreadsheetStub),
    });
    vi.stubGlobal("UrlFetchApp", {
      fetch,
      fetchAll,
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { runWeeklyTrackerScheduled } = await import("../src/gas");

    await runWeeklyTrackerScheduled();

    const options = runTrackerCore.mock.calls[0][0];
    await options.prefetchText(["https://example.com/app", "https://example.com/social", "https://example.com/app"]);

    await expect(options.fetchText("https://example.com/app")).resolves.toBe("cached app store");
    await expect(options.fetchText("https://example.com/social")).rejects.toThrow("HTTP 403");
    expect(fetchAll).toHaveBeenCalledWith([
      expect.objectContaining({ url: "https://example.com/app", muteHttpExceptions: true, followRedirects: true }),
      expect.objectContaining({ url: "https://example.com/social", muteHttpExceptions: true, followRedirects: true }),
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to individual fetches when fetchAll fails", async () => {
    const fetch = vi.fn(() => responseFor(200, "fallback body"));
    const fetchAll = vi.fn(() => {
      throw new Error("fetchAll unavailable");
    });
    vi.stubGlobal("SpreadsheetApp", {
      getActiveSpreadsheet: vi.fn(() => spreadsheetStub),
    });
    vi.stubGlobal("UrlFetchApp", {
      fetch,
      fetchAll,
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { runWeeklyTrackerScheduled } = await import("../src/gas");

    await runWeeklyTrackerScheduled();

    const options = runTrackerCore.mock.calls[0][0];
    await options.prefetchText(["https://example.com/fallback"]);

    await expect(options.fetchText("https://example.com/fallback")).resolves.toBe("fallback body");
    expect(fetch).toHaveBeenCalledWith("https://example.com/fallback", expect.objectContaining({ muteHttpExceptions: true }));
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

function responseFor(code: number, body: string): GoogleAppsScript.URL_Fetch.HTTPResponse {
  return {
    getResponseCode: () => code,
    getContentText: () => body,
  } as GoogleAppsScript.URL_Fetch.HTTPResponse;
}
