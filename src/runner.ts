import { DEFAULT_MARKETS, DEFAULT_TRACKED_APPS } from "./config";
import {
  AppStoreSearchConnector,
  PublicUrlConnector,
  appStoreSearchUrl,
  type ConnectorResult,
  type FetchText,
  type Now,
} from "./connectors";
import { REQUIRED_SHEETS, type Confidence, type GrowthSignal, type SheetName, type TableRow } from "./domain";
import { compareStoreKeywordRows, repetitionScore, scoreSignal } from "./scoring";
import { ensureWorkbookSchema, objectsToRows, rowsToObjects, type SheetGateway } from "./sheets";
import { buildWeeklySummaryRows } from "./summary";

export type RunOptions = {
  gateway: SheetGateway;
  week: string;
  fetchText: FetchText;
  prefetchText?: PrefetchText;
  now: Now;
  dryRun: boolean;
};

export type PrefetchText = (urls: readonly string[]) => Promise<void>;

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
  const plans = buildCollectionPlans(options.week, appStore, publicUrl);

  await options.prefetchText?.(uniqueUrls(plans.map((plan) => plan.url)));

  for (const plan of plans) {
    results.push(await plan.collect());
  }

  const storeKeywordRows = results.flatMap((result) => result.storeKeywords);
  const previousStoreRows = latestPriorStoreRows(readDataRows<TableRow>(options.gateway, "Store Keywords"), options.week);
  const comparedStoreRows = compareStoreKeywordRows(previousStoreRows, storeKeywordRows);
  const storeKeywordSignals = buildStoreKeywordSignals(options.week, comparedStoreRows);
  const allSignals = [...results.flatMap((result) => result.signals), ...storeKeywordSignals];
  const scoredSignals = allSignals.map((signal) => scoreSignal(signal, repetitionScore(signal, allSignals)));
  const sourceRuns = results.map((result) => result.sourceRun);
  const appMatrix = results.flatMap((result) => result.appMatrix);
  const summaryRows = buildWeeklySummaryRows({ week: options.week, signals: scoredSignals, sourceRuns });

  if (!options.dryRun) {
    replaceWeekRows(options.gateway, "Weekly Summary", options.week, summaryRows);
    replaceWeekRows(options.gateway, "Growth Signals", options.week, scoredSignals as unknown as TableRow[]);
    replaceAppMatrixRows(options.gateway, appMatrix);
    replaceWeekRows(options.gateway, "Store Keywords", options.week, comparedStoreRows);
    replaceWeekRows(options.gateway, "Sources & Runs", options.week, sourceRuns as unknown as TableRow[]);
  }

  return {
    week: options.week,
    collectedSignals: scoredSignals.length,
    sourceRuns: sourceRuns.length,
    dryRun: options.dryRun,
  };
}

type CollectionPlan = {
  url: string;
  collect: () => Promise<ConnectorResult>;
};

function buildCollectionPlans(
  week: string,
  appStore: AppStoreSearchConnector,
  publicUrl: PublicUrlConnector,
): CollectionPlan[] {
  const plans: CollectionPlan[] = [];

  for (const app of DEFAULT_TRACKED_APPS) {
    for (const market of DEFAULT_MARKETS) {
      const appStoreInput = { week, app: app.name, market, term: app.searchTerms[market] };
      const tiktokInput = {
        week,
        app: app.name,
        market,
        channel: "TikTok" as const,
        sourceName: "TikTok public search",
        sourceUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(`${app.name} AI photo`)}`,
      };
      const instagramInput = {
        week,
        app: app.name,
        market,
        channel: "Instagram" as const,
        sourceName: "Instagram public search",
        sourceUrl: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(app.name)}`,
      };

      plans.push({ url: appStoreSearchUrl(appStoreInput), collect: () => appStore.collect(appStoreInput) });
      plans.push({ url: tiktokInput.sourceUrl, collect: () => publicUrl.collect(tiktokInput) });
      plans.push({ url: instagramInput.sourceUrl, collect: () => publicUrl.collect(instagramInput) });
    }
  }

  return plans;
}

function uniqueUrls(urls: readonly string[]): string[] {
  return [...new Set(urls)];
}

function readDataRows<T extends TableRow>(gateway: SheetGateway, sheetName: SheetName): T[] {
  const schema = REQUIRED_SHEETS.find((sheet) => sheet.name === sheetName);
  if (!schema) {
    throw new Error(`Missing schema: ${sheetName}`);
  }
  const rows = gateway.getRows(sheetName);
  return rowsToObjects<T>([...schema.columns], rows.slice(1));
}

function replaceWeekRows(gateway: SheetGateway, sheetName: SheetName, week: string, rows: TableRow[]): void {
  const existingRows = readDataRows<TableRow>(gateway, sheetName).filter((row) => row.week !== week);
  replaceDataRows(gateway, sheetName, [...existingRows, ...rows]);
}

function replaceAppMatrixRows(gateway: SheetGateway, rows: TableRow[]): void {
  const replacementKeys = new Set(rows.map((row) => appMarketKey(row)));
  const existingRows = readDataRows<TableRow>(gateway, "App Matrix").filter((row) => !replacementKeys.has(appMarketKey(row)));
  replaceDataRows(gateway, "App Matrix", [...existingRows, ...rows]);
}

function replaceDataRows(gateway: SheetGateway, sheetName: SheetName, rows: TableRow[]): void {
  const schema = REQUIRED_SHEETS.find((sheet) => sheet.name === sheetName);
  if (!schema) {
    throw new Error(`Missing schema: ${sheetName}`);
  }
  gateway.replaceRows(sheetName, [[...schema.columns], ...objectsToRows(schema.columns, rows)]);
}

function latestPriorStoreRows(rows: TableRow[], currentWeek: string): TableRow[] {
  const currentRank = weekRank(currentWeek);
  const latestRows = new Map<string, { rank: number; row: TableRow }>();

  for (const row of rows) {
    const rank = weekRank(String(row.week ?? ""));
    if (rank >= currentRank) {
      continue;
    }
    const key = storeKeywordKey(row);
    const existing = latestRows.get(key);
    if (!existing || rank > existing.rank) {
      latestRows.set(key, { rank, row });
    }
  }

  return [...latestRows.values()].map((entry) => entry.row);
}

function buildStoreKeywordSignals(week: string, rows: TableRow[]): GrowthSignal[] {
  return rows
    .filter((row) => row.change_from_prior_week === "new" || row.change_from_prior_week === "changed")
    .map((row) => {
      const change = String(row.change_from_prior_week);
      return {
        week,
        app: String(row.app),
        market: String(row.market) as GrowthSignal["market"],
        channel: "App Store",
        signal_type: "store_keyword",
        signal_summary: `${row.app} ${row.market} App Store keywords ${change}: ${row.keyword_or_message}`.slice(0, 500),
        growth_relevance: change === "new" ? 65 : 75,
        change_strength: change === "new" ? 60 : 70,
        confidence: confidenceFromRow(row),
        score: 0,
        evidence_url: String(row.evidence_url ?? ""),
        source_status: "ok",
        manual_check_needed: false,
        notes: `Store keyword row marked ${change} versus latest prior week.`,
      };
    });
}

function confidenceFromRow(row: TableRow): Confidence {
  if (row.confidence === "high" || row.confidence === "medium" || row.confidence === "low") {
    return row.confidence;
  }
  return "medium";
}

function storeKeywordKey(row: TableRow): string {
  return [row.app, row.market, row.store].map((value) => String(value ?? "")).join("\u0000");
}

function appMarketKey(row: TableRow): string {
  return [row.app, row.market].map((value) => String(value ?? "")).join("\u0000");
}

function weekRank(week: string): number {
  const match = week.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) {
    return Number.NEGATIVE_INFINITY;
  }
  return Number(match[1]) * 100 + Number(match[2]);
}
