import { schemaFor, type SheetName, type TableRow } from "../src/domain";
import { InMemorySheetGateway, ensureWorkbookSchema } from "../src/sheets";
import { runWeeklyTracker } from "../src/runner";
import { DEFAULT_MARKETS, DEFAULT_TRACKED_APPS } from "../src/config";

describe("runWeeklyTracker", () => {
  it("updates Weekly Summary, Growth Signals, App Matrix, Store Keywords, and Sources & Runs", async () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      fetchText: async (url) => {
        if (url.includes("itunes.apple.com")) {
          const title = appStoreTitleForUrl(url);
          return JSON.stringify({
            results: [
              {
                trackName: title,
                description: "AI headshot and viral photo templates.",
                formattedPrice: "Free",
                trackViewUrl: `https://apps.apple.com/us/app/${title.toLowerCase()}`,
              },
            ],
          });
        }
        return '<html><head><title>AI trend</title><meta name="description" content="Viral AI photo edit"></head></html>';
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
    expect(gateway.getRows("Growth Signals")).toHaveLength(1);
    expect(gateway.getRows("App Matrix")).toHaveLength(1);
    expect(gateway.getRows("Store Keywords")).toHaveLength(1);
    expect(gateway.getRows("Sources & Runs")).toHaveLength(1);
  });

  it("prefetches planned source URLs before collecting sources", async () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);
    const events: string[] = [];
    const prefetchedUrls: string[] = [];

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      prefetchText: async (urls) => {
        events.push("prefetch");
        prefetchedUrls.push(...urls);
      },
      fetchText: async (url) => {
        events.push(`fetch:${url}`);
        return matchingAppStoreAndEmptyPublicPages(url);
      },
      now: () => "2026-05-04T00:00:00.000Z",
      dryRun: true,
    });

    expect(events[0]).toBe("prefetch");
    expect(new Set(prefetchedUrls).size).toBe(prefetchedUrls.length);
    expect(prefetchedUrls.length).toBeGreaterThanOrEqual(DEFAULT_TRACKED_APPS.length * 3);
    expect(prefetchedUrls.length).toBeLessThanOrEqual(DEFAULT_TRACKED_APPS.length * DEFAULT_MARKETS.length * 3);
    expect(prefetchedUrls.some((url) => url.includes("itunes.apple.com/search"))).toBe(true);
    expect(prefetchedUrls.some((url) => url.includes("tiktok.com/search"))).toBe(true);
    expect(prefetchedUrls.some((url) => url.includes("instagram.com/explore/search"))).toBe(true);
  });

  it("preserves older week rows while replacing only current week rows", async () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);
    writeObjects(gateway, "Weekly Summary", [
      { week: "2026-W18", section: "Overview", headline: "Older summary" },
      { week: "2026-W19", section: "Overview", headline: "Stale current summary" },
    ]);
    writeObjects(gateway, "Growth Signals", [
      { week: "2026-W18", app: "SNOW", market: "KR", channel: "App Store", signal_summary: "Older signal" },
      { week: "2026-W19", app: "SNOW", market: "KR", channel: "App Store", signal_summary: "Stale current signal" },
    ]);
    writeObjects(gateway, "Store Keywords", [
      {
        week: "2026-W18",
        app: "SNOW",
        market: "KR",
        store: "App Store",
        title: "SNOW",
        keyword_or_message: "Older keyword",
      },
      {
        week: "2026-W19",
        app: "SNOW",
        market: "KR",
        store: "App Store",
        title: "SNOW",
        keyword_or_message: "Stale current keyword",
      },
    ]);
    writeObjects(gateway, "Sources & Runs", [
      { run_id: "older-run", week: "2026-W18", source_name: "Older source" },
      { run_id: "stale-current-run", week: "2026-W19", source_name: "Stale current source" },
    ]);
    writeObjects(gateway, "App Matrix", [
      { app: "ExternalApp", market: "US", core_features: "Preserve unrelated matrix row" },
      { app: "SNOW", market: "KR", core_features: "Replace collected matrix row" },
    ]);

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      fetchText: matchingAppStoreAndEmptyPublicPages,
      now: () => "2026-05-04T00:00:00.000Z",
      dryRun: false,
    });

    expect(columnValues(gateway, "Weekly Summary", "headline")).toContain("Older summary");
    expect(columnValues(gateway, "Weekly Summary", "headline")).not.toContain("Stale current summary");
    expect(columnValues(gateway, "Growth Signals", "signal_summary")).toContain("Older signal");
    expect(columnValues(gateway, "Growth Signals", "signal_summary")).not.toContain("Stale current signal");
    expect(columnValues(gateway, "Store Keywords", "keyword_or_message")).toContain("Older keyword");
    expect(columnValues(gateway, "Store Keywords", "keyword_or_message")).not.toContain("Stale current keyword");
    expect(columnValues(gateway, "Sources & Runs", "run_id")).toContain("older-run");
    expect(columnValues(gateway, "Sources & Runs", "run_id")).not.toContain("stale-current-run");
    expect(columnValues(gateway, "App Matrix", "app")).toContain("ExternalApp");
    expect(columnValues(gateway, "App Matrix", "core_features")).not.toContain("Replace collected matrix row");
  });

  it("re-running the same week replaces current-week rows instead of duplicating them", async () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      fetchText: matchingAppStoreAndEmptyPublicPages,
      now: () => "2026-05-04T00:00:00.000Z",
      dryRun: false,
    });
    const firstCounts = outputDataCounts(gateway);

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      fetchText: matchingAppStoreAndEmptyPublicPages,
      now: () => "2026-05-04T00:00:00.000Z",
      dryRun: false,
    });

    expect(outputDataCounts(gateway)).toEqual(firstCounts);
  });

  it("turns changed Store Keyword rows into Growth Signals and Weekly Summary entries", async () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);
    writeObjects(gateway, "Store Keywords", [
      {
        week: "2026-W18",
        app: "SNOW",
        market: "KR",
        store: "App Store",
        title: "SNOW",
        keyword_or_message: "SNOW | Previous positioning",
      },
    ]);

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      fetchText: matchingAppStoreAndEmptyPublicPages,
      now: () => "2026-05-04T00:00:00.000Z",
      dryRun: false,
    });

    expect(columnValues(gateway, "Growth Signals", "signal_type")).toContain("store_keyword");
    expect(columnValues(gateway, "Weekly Summary", "detail").some((detail) => String(detail).includes("store_keyword"))).toBe(true);
  });

  it("compares Store Keywords against the latest previous week for each app, market, and store", async () => {
    const gateway = new InMemorySheetGateway();
    ensureWorkbookSchema(gateway);
    writeObjects(gateway, "Store Keywords", [
      {
        week: "2026-W17",
        app: "SNOW",
        market: "KR",
        store: "App Store",
        title: "SNOW",
        keyword_or_message: "SNOW - AI Photo Editor | Older positioning",
      },
      {
        week: "2026-W18",
        app: "SNOW",
        market: "KR",
        store: "App Store",
        title: "SNOW - AI Photo Editor",
        keyword_or_message: "SNOW - AI Photo Editor | AI headshot and viral photo templates.",
      },
    ]);

    await runWeeklyTracker({
      gateway,
      week: "2026-W19",
      fetchText: matchingAppStoreAndEmptyPublicPages,
      now: () => "2026-05-04T00:00:00.000Z",
      dryRun: false,
    });

    const currentSnowRow = rowsAsObjects(gateway, "Store Keywords").find(
      (row) => row.week === "2026-W19" && row.app === "SNOW" && row.market === "KR" && row.store === "App Store",
    );
    expect(currentSnowRow?.change_from_prior_week).toBe("unchanged");
  });
});

async function matchingAppStoreAndEmptyPublicPages(url: string): Promise<string> {
  if (url.includes("itunes.apple.com")) {
    const title = appStoreTitleForUrl(url);
    return JSON.stringify({
      results: [
        {
          trackName: title,
          description: "AI headshot and viral photo templates.",
          formattedPrice: "Free",
          trackViewUrl: `https://apps.apple.com/us/app/${title.toLowerCase()}`,
        },
      ],
    });
  }
  return "<html><head></head></html>";
}

function appStoreTitleForUrl(url: string): string {
  const term = new URL(url).searchParams.get("term") ?? "";
  const app = ["SNOW", "SODA", "Foodie", "EPIK", "B612", "BeautyPlus", "Meitu", "Remini"].find((name) =>
    term.toLowerCase().includes(name.toLowerCase()),
  );
  return app ? `${app} - AI Photo Editor` : "EPIK - AI Photo Editor";
}

function writeObjects(gateway: InMemorySheetGateway, sheetName: SheetName, rows: TableRow[]): void {
  const schema = schemaFor(sheetName);
  gateway.replaceRows(sheetName, [[...schema.columns], ...rows.map((row) => schema.columns.map((column) => row[column] ?? ""))]);
}

function rowsAsObjects(gateway: InMemorySheetGateway, sheetName: SheetName): Record<string, unknown>[] {
  const rows = gateway.getRows(sheetName);
  const headers = rows[0].map(String);
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function columnValues(gateway: InMemorySheetGateway, sheetName: SheetName, column: string): unknown[] {
  return rowsAsObjects(gateway, sheetName).map((row) => row[column]);
}

function outputDataCounts(gateway: InMemorySheetGateway): Record<string, number> {
  return Object.fromEntries(
    (["Weekly Summary", "Growth Signals", "App Matrix", "Store Keywords", "Sources & Runs"] as const).map((sheetName) => [
      sheetName,
      gateway.getRows(sheetName).length - 1,
    ]),
  );
}
