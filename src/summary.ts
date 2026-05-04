import type { GrowthSignal, SourceRun, TableRow } from "./domain";
import { rankSignals } from "./scoring";

export type SummaryInput = {
  week: string;
  signals: GrowthSignal[];
  sourceRuns: SourceRun[];
};

export function buildWeeklySummaryRows(input: SummaryInput): TableRow[] {
  const eligible = rankSignals(input.signals).filter(
    (signal) => hasEvidence(signal) && !(signal.confidence === "low" && signal.manual_check_needed),
  );
  const top = eligible[0];
  const rows: TableRow[] = [
    {
      week: input.week,
      section: "Overview",
      rank: "",
      headline: top ? `Top signal: ${top.signal_summary}` : "No eligible growth signal collected",
      detail: top ? `${top.app} / ${top.market} / ${top.channel}` : "Run produced no evidence-backed Top 5 item.",
      app: top?.app ?? "",
      market: top?.market ?? "",
      channel: top?.channel ?? "",
      score: top?.score ?? "",
      confidence: top?.confidence ?? "",
      evidence_url: top?.evidence_url ?? "",
      manual_check_needed: false,
    },
  ];

  if (top) {
    rows.push(toSummaryRow(input.week, "Top Growth Signal", 1, top));
  }

  eligible.slice(0, 5).forEach((signal, index) => {
    rows.push(toSummaryRow(input.week, "Top Changes", index + 1, signal));
  });

  const manualRuns = input.sourceRuns.filter((run) => run.manual_check_needed);
  manualRuns.forEach((run, index) => {
    rows.push({
      week: input.week,
      section: "Manual Checks",
      rank: index + 1,
      headline: `${run.source_name}: ${run.status}`,
      detail: run.next_action,
      app: run.app,
      market: run.market,
      channel: "",
      score: "",
      confidence: "",
      evidence_url: run.source_url,
      manual_check_needed: true,
    });
  });

  const lowConfidenceSignals = rankSignals(input.signals).filter(
    (signal) => signal.confidence === "low" && hasEvidence(signal),
  );
  lowConfidenceSignals.slice(0, 5).forEach((signal, index) => {
    rows.push(toSummaryRow(input.week, "Observation Candidates", index + 1, signal));
  });

  return rows;
}

function hasEvidence(signal: GrowthSignal): boolean {
  return Boolean(signal.evidence_url.trim());
}

function toSummaryRow(week: string, section: string, rank: number, signal: GrowthSignal): TableRow {
  return {
    week,
    section,
    rank,
    headline: signal.signal_summary,
    detail: `${signal.signal_type}; ${signal.notes}`.trim(),
    app: signal.app,
    market: signal.market,
    channel: signal.channel,
    score: signal.score,
    confidence: signal.confidence,
    evidence_url: signal.evidence_url,
    manual_check_needed: signal.manual_check_needed,
  };
}
