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
  });
});

function appStoreTitleForUrl(url: string): string {
  const term = new URL(url).searchParams.get("term") ?? "";
  const app = ["SNOW", "SODA", "Foodie", "EPIK", "B612", "BeautyPlus", "Meitu", "Remini"].find((name) =>
    term.toLowerCase().includes(name.toLowerCase()),
  );
  return app ? `${app} - AI Photo Editor` : "EPIK - AI Photo Editor";
}
