import { buildWeeklySummaryRows } from "../src/summary";
import type { GrowthSignal, SourceRun } from "../src/domain";

function signal(overrides: Partial<GrowthSignal>): GrowthSignal {
  return {
    week: "2026-W19",
    app: "EPIK",
    market: "US",
    channel: "App Store",
    signal_type: "store_keyword",
    signal_summary: "AI headshot keywords added to store listing",
    growth_relevance: 90,
    change_strength: 80,
    confidence: "high",
    score: 88,
    evidence_url: "https://apps.apple.com/example",
    source_status: "ok",
    manual_check_needed: false,
    notes: "",
    ...overrides,
  };
}

describe("buildWeeklySummaryRows", () => {
  it("puts the highest eligible signal first", () => {
    const rows = buildWeeklySummaryRows({
      week: "2026-W19",
      signals: [signal({ app: "SNOW", score: 60 }), signal({ app: "EPIK", score: 88 })],
      sourceRuns: [],
    });
    expect(rows[1].section).toBe("Top Growth Signal");
    expect(rows[1].app).toBe("EPIK");
  });

  it("excludes evidence-free signals from top changes", () => {
    const rows = buildWeeklySummaryRows({
      week: "2026-W19",
      signals: [signal({ score: 99, evidence_url: "" }), signal({ app: "SODA", score: 70 })],
      sourceRuns: [],
    });
    expect(rows.some((row) => row.section === "Top Changes" && row.evidence_url === "")).toBe(false);
  });

  it("excludes whitespace-only evidence from top changes", () => {
    const rows = buildWeeklySummaryRows({
      week: "2026-W19",
      signals: [signal({ score: 99, evidence_url: "   " }), signal({ app: "SODA", score: 70 })],
      sourceRuns: [],
    });
    expect(rows.some((row) => row.section === "Top Changes" && row.evidence_url === "   ")).toBe(false);
  });

  it("excludes whitespace-only evidence from observation candidates", () => {
    const rows = buildWeeklySummaryRows({
      week: "2026-W19",
      signals: [
        signal({
          app: "SNOW",
          confidence: "low",
          evidence_url: "   ",
          manual_check_needed: true,
          score: 90,
        }),
      ],
      sourceRuns: [],
    });
    expect(rows.some((row) => row.section === "Observation Candidates")).toBe(false);
  });

  it("adds manual check rows for blocked sources", () => {
    const sourceRuns: SourceRun[] = [
      {
        run_id: "run-1",
        week: "2026-W19",
        source_name: "TikTok public search",
        source_url: "https://www.tiktok.com/search?q=EPIK",
        app: "EPIK",
        market: "US",
        status: "blocked",
        last_success_at: "",
        error_message: "HTTP 403",
        manual_check_needed: true,
        next_action: "Open public search manually.",
      },
    ];
    const rows = buildWeeklySummaryRows({ week: "2026-W19", signals: [], sourceRuns });
    expect(rows.some((row) => row.section === "Manual Checks" && String(row.headline).includes("TikTok"))).toBe(true);
  });
});
