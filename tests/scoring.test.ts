import { compareStoreKeywordRows, scoreSignal } from "../src/scoring";
import type { GrowthSignal, TableRow } from "../src/domain";

const baseSignal: GrowthSignal = {
  week: "2026-W19",
  app: "EPIK",
  market: "US",
  channel: "TikTok",
  signal_type: "public_page_message",
  signal_summary: "AI headshot template appears repeatedly",
  growth_relevance: 85,
  change_strength: 80,
  confidence: "low",
  score: 0,
  evidence_url: "https://example.com/evidence",
  source_status: "partial",
  manual_check_needed: true,
  notes: "",
};

describe("scoreSignal", () => {
  it("scores high-importance low-confidence social signals below high-confidence evidence", () => {
    const lowConfidence = scoreSignal({ ...baseSignal }, 70);
    const highConfidence = scoreSignal(
      { ...baseSignal, channel: "App Store", confidence: "high", manual_check_needed: false },
      70,
    );
    expect(highConfidence.score).toBeGreaterThan(lowConfidence.score);
    expect(lowConfidence.score).toBeGreaterThan(0);
  });

  it("keeps evidence-free signals out of ranking by assigning score zero", () => {
    const scored = scoreSignal({ ...baseSignal, evidence_url: "" }, 80);
    expect(scored.score).toBe(0);
    expect(scored.notes).toContain("Excluded from Top 5");
  });
});

describe("compareStoreKeywordRows", () => {
  it("detects new keyword messages against prior week rows", () => {
    const previous: TableRow[] = [
      {
        week: "2026-W18",
        app: "EPIK",
        market: "US",
        store: "App Store",
        keyword_or_message: "Photo editor",
        evidence_url: "a",
        confidence: "high",
      },
    ];
    const current: TableRow[] = [
      {
        week: "2026-W19",
        app: "EPIK",
        market: "US",
        store: "App Store",
        keyword_or_message: "AI headshot photo editor",
        evidence_url: "b",
        confidence: "high",
      },
    ];
    const result = compareStoreKeywordRows(previous, current);
    expect(result[0].change_from_prior_week).toBe("changed");
  });
});
