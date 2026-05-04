import { DEFAULT_SCORING_WEIGHTS } from "./config";
import type { Confidence, GrowthSignal, TableRow } from "./domain";

const CONFIDENCE_VALUE: Record<Confidence, number> = {
  high: 100,
  medium: 65,
  low: 35,
};

export function scoreSignal(signal: GrowthSignal, repetition: number): GrowthSignal {
  if (!signal.evidence_url.trim()) {
    return {
      ...signal,
      score: 0,
      notes: appendNote(signal.notes, "Excluded from Top 5 because evidence_url is empty."),
    };
  }

  const raw =
    clampScoreInput(signal.change_strength) * (DEFAULT_SCORING_WEIGHTS.changeStrength / 100) +
    clampScoreInput(signal.growth_relevance) * (DEFAULT_SCORING_WEIGHTS.growthRelevance / 100) +
    CONFIDENCE_VALUE[signal.confidence] * (DEFAULT_SCORING_WEIGHTS.confidence / 100) +
    clampScoreInput(repetition) * (DEFAULT_SCORING_WEIGHTS.repetition / 100);

  return {
    ...signal,
    score: clampScoreInput(Math.round(raw)),
  };
}

export function compareStoreKeywordRows(previousRows: TableRow[], currentRows: TableRow[]): TableRow[] {
  return currentRows.map((row) => {
    const prior = previousRows.find(
      (candidate) => candidate.app === row.app && candidate.market === row.market && candidate.store === row.store,
    );
    const priorMessage = String(prior?.keyword_or_message ?? "");
    const currentMessage = String(row.keyword_or_message ?? "");
    return {
      ...row,
      change_from_prior_week: prior ? (priorMessage === currentMessage ? "unchanged" : "changed") : "new",
    };
  });
}

export function rankSignals(signals: GrowthSignal[]): GrowthSignal[] {
  return [...signals].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return confidenceRank(b.confidence) - confidenceRank(a.confidence);
  });
}

export function repetitionScore(signal: GrowthSignal, allSignals: GrowthSignal[]): number {
  const sameMessageCount = allSignals.filter(
    (candidate) =>
      candidate.app === signal.app &&
      candidate.market === signal.market &&
      candidate.signal_summary.toLowerCase() === signal.signal_summary.toLowerCase(),
  ).length;
  return Math.min(100, sameMessageCount * 35);
}

function confidenceRank(confidence: Confidence): number {
  return CONFIDENCE_VALUE[confidence];
}

function appendNote(existing: string, note: string): string {
  return existing ? `${existing} ${note}` : note;
}

function clampScoreInput(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}
