import { DEFAULT_MARKETS, DEFAULT_TRACKED_APPS } from "./config";
import {
  AppStoreSearchConnector,
  PublicUrlConnector,
  type ConnectorResult,
  type FetchText,
  type Now,
} from "./connectors";
import { REQUIRED_SHEETS, type TableRow } from "./domain";
import { compareStoreKeywordRows, repetitionScore, scoreSignal } from "./scoring";
import { ensureWorkbookSchema, objectsToRows, rowsToObjects, type SheetGateway } from "./sheets";
import { buildWeeklySummaryRows } from "./summary";

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

function replaceDataRows(gateway: SheetGateway, sheetName: (typeof REQUIRED_SHEETS)[number]["name"], rows: TableRow[]): void {
  const schema = REQUIRED_SHEETS.find((sheet) => sheet.name === sheetName);
  if (!schema) {
    throw new Error(`Missing schema: ${sheetName}`);
  }
  gateway.replaceRows(sheetName, [[...schema.columns], ...objectsToRows(schema.columns, rows)]);
}
