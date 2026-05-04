import { runWeeklyTracker as runTrackerCore, type RunResult } from "./runner";
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
  const result = await executeWeeklyTracker(false);
  SpreadsheetApp.getUi().alert(
    `Weekly tracker finished for ${result.week}. Signals: ${result.collectedSignals}; sources: ${result.sourceRuns}.`,
  );
}

export async function runWeeklyTrackerDryRun(): Promise<void> {
  const result = await executeWeeklyTracker(true);
  SpreadsheetApp.getUi().alert(
    `Dry run finished for ${result.week}. Signals: ${result.collectedSignals}; sources: ${result.sourceRuns}. No rows were written.`,
  );
}

export async function runWeeklyTrackerScheduled(): Promise<void> {
  try {
    const result = await executeWeeklyTracker(false);
    console.log(
      `Scheduled weekly tracker finished for ${result.week}. Signals: ${result.collectedSignals}; sources: ${result.sourceRuns}.`,
    );
  } catch (error) {
    console.error("Scheduled weekly tracker failed.", error);
    throw error;
  }
}

async function executeWeeklyTracker(dryRun: boolean): Promise<RunResult> {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const gateway = new AppsScriptSheetGateway(spreadsheet);
  return runTrackerCore({
    gateway,
    week: currentIsoWeek(),
    fetchText,
    now,
    dryRun,
  });
}

export function installWeeklyTrigger(): void {
  const existing = ScriptApp.getProjectTriggers().filter(
    (trigger) =>
      trigger.getHandlerFunction() === "runWeeklyTracker" ||
      trigger.getHandlerFunction() === "runWeeklyTrackerScheduled",
  );
  existing.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("runWeeklyTrackerScheduled").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  SpreadsheetApp.getUi().alert("Installed Monday 09:00 weekly trigger for runWeeklyTrackerScheduled.");
}

Object.assign(globalThis, {
  onOpen,
  runWeeklyTracker,
  runWeeklyTrackerDryRun,
  runWeeklyTrackerScheduled,
  installWeeklyTrigger,
});
