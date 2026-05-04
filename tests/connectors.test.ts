import {
  AppStoreSearchConnector,
  ManualQueueConnector,
  PublicUrlConnector,
  type FetchText,
} from "../src/connectors";

const fixedNow = () => "2026-05-04T00:00:00.000Z";

describe("AppStoreSearchConnector", () => {
  it("maps Apple search results into store keyword and app matrix records", async () => {
    const fetchText: FetchText = async () =>
      JSON.stringify({
        resultCount: 1,
        results: [
          {
            trackName: "EPIK - AI Photo Editor",
            description: "AI headshot, photo editor, and templates.",
            formattedPrice: "Free",
            trackViewUrl: "https://apps.apple.com/us/app/epik/id1577705074",
          },
        ],
      });

    const connector = new AppStoreSearchConnector(fetchText, fixedNow);
    const result = await connector.collect({ week: "2026-W19", app: "EPIK", market: "US", term: "EPIK photo editor" });

    expect(result.status).toBe("ok");
    expect(result.storeKeywords).toHaveLength(1);
    expect(result.storeKeywords[0].keyword_or_message).toContain("AI headshot");
    expect(result.appMatrix[0].price_summary).toBe("Free");
  });

  it("returns manual_needed when no App Store result is found", async () => {
    const fetchText: FetchText = async () => JSON.stringify({ resultCount: 0, results: [] });
    const connector = new AppStoreSearchConnector(fetchText, fixedNow);
    const result = await connector.collect({ week: "2026-W19", app: "Unknown", market: "JP", term: "Unknown app" });
    expect(result.status).toBe("manual_needed");
    expect(result.sourceRun.next_action).toContain("Verify App Store listing manually");
  });
});

describe("PublicUrlConnector", () => {
  it("extracts title and description from public HTML", async () => {
    const fetchText: FetchText = async () =>
      '<html><head><title>AI Selfie Trend</title><meta name="description" content="Turn selfies into profile photos"></head></html>';
    const connector = new PublicUrlConnector(fetchText, fixedNow);
    const result = await connector.collect({
      week: "2026-W19",
      app: "Remini",
      market: "US",
      channel: "Official Web",
      sourceName: "Remini official",
      sourceUrl: "https://example.com/remini",
    });
    expect(result.status).toBe("partial");
    expect(result.signals[0].signal_summary).toContain("AI Selfie Trend");
    expect(result.signals[0].confidence).toBe("medium");
  });

  it("marks blocked pages as manual checks", async () => {
    const fetchText: FetchText = async () => {
      throw new Error("HTTP 403");
    };
    const connector = new PublicUrlConnector(fetchText, fixedNow);
    const result = await connector.collect({
      week: "2026-W19",
      app: "SNOW",
      market: "KR",
      channel: "TikTok",
      sourceName: "TikTok public search",
      sourceUrl: "https://www.tiktok.com/search?q=SNOW%20AI",
    });
    expect(result.status).toBe("blocked");
    expect(result.sourceRun.manual_check_needed).toBe(true);
  });
});

describe("ManualQueueConnector", () => {
  it("creates an explicit manual check source run", async () => {
    const connector = new ManualQueueConnector(fixedNow);
    const result = await connector.collect({
      week: "2026-W19",
      app: "BeautyPlus",
      market: "JP",
      channel: "Instagram",
      sourceName: "Instagram public check",
      sourceUrl: "https://www.instagram.com/explore/search/keyword/?q=BeautyPlus",
      nextAction: "Review public Instagram search results without logging in.",
    });
    expect(result.status).toBe("manual_needed");
    expect(result.sourceRun.next_action).toContain("Review public Instagram");
  });
});
