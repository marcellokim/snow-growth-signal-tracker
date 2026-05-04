import type { Market } from "./domain";

export type TrackedApp = {
  name: string;
  company: "SNOW" | "Competitor";
  searchTerms: Record<Market, string>;
};

export type ScoringWeights = {
  changeStrength: number;
  growthRelevance: number;
  confidence: number;
  repetition: number;
};

export const DEFAULT_MARKETS: readonly Market[] = ["KR", "US", "JP"] as const;

export const DEFAULT_TRACKED_APPS: readonly TrackedApp[] = [
  { name: "SNOW", company: "SNOW", searchTerms: { KR: "SNOW 스노우", US: "SNOW camera", JP: "SNOW camera" } },
  { name: "SODA", company: "SNOW", searchTerms: { KR: "SODA 카메라", US: "SODA camera", JP: "SODA camera" } },
  { name: "Foodie", company: "SNOW", searchTerms: { KR: "Foodie 푸디", US: "Foodie camera", JP: "Foodie camera" } },
  { name: "EPIK", company: "SNOW", searchTerms: { KR: "EPIK 에픽", US: "EPIK photo editor", JP: "EPIK photo editor" } },
  { name: "B612", company: "Competitor", searchTerms: { KR: "B612 카메라", US: "B612 camera", JP: "B612 camera" } },
  { name: "BeautyPlus", company: "Competitor", searchTerms: { KR: "BeautyPlus", US: "BeautyPlus", JP: "BeautyPlus" } },
  { name: "Meitu", company: "Competitor", searchTerms: { KR: "Meitu", US: "Meitu", JP: "Meitu" } },
  { name: "Remini", company: "Competitor", searchTerms: { KR: "Remini", US: "Remini", JP: "Remini" } },
];

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  changeStrength: 35,
  growthRelevance: 30,
  confidence: 20,
  repetition: 15,
};
