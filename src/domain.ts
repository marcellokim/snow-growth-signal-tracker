export const SHEET_NAMES = [
  "Weekly Summary",
  "Growth Signals",
  "App Matrix",
  "Store Keywords",
  "Ad Messages",
  "Social Patterns",
  "Sources & Runs",
  "Config",
] as const;

export type SheetName = (typeof SHEET_NAMES)[number];

export type Market = "KR" | "US" | "JP";
export type Channel =
  | "App Store"
  | "Google Play"
  | "Official Web"
  | "Ad Library"
  | "TikTok"
  | "Instagram"
  | "Manual";
export type SourceStatus = "ok" | "partial" | "blocked" | "changed_structure" | "manual_needed" | "error";
export type Confidence = "high" | "medium" | "low";

export type SheetSchema = {
  name: SheetName;
  columns: readonly string[];
};

export const REQUIRED_SHEETS: readonly SheetSchema[] = [
  {
    name: "Weekly Summary",
    columns: [
      "week",
      "section",
      "rank",
      "headline",
      "detail",
      "app",
      "market",
      "channel",
      "score",
      "confidence",
      "evidence_url",
      "manual_check_needed",
    ],
  },
  {
    name: "Growth Signals",
    columns: [
      "week",
      "app",
      "market",
      "channel",
      "signal_type",
      "signal_summary",
      "growth_relevance",
      "change_strength",
      "confidence",
      "score",
      "evidence_url",
      "source_status",
      "manual_check_needed",
      "notes",
    ],
  },
  {
    name: "App Matrix",
    columns: [
      "app",
      "market",
      "core_features",
      "ai_features",
      "paid_model",
      "price_summary",
      "subscription_or_credit_notes",
      "last_checked_at",
      "evidence_url",
      "confidence",
    ],
  },
  {
    name: "Store Keywords",
    columns: [
      "week",
      "app",
      "market",
      "store",
      "title",
      "subtitle_or_short_description",
      "keyword_or_message",
      "change_from_prior_week",
      "evidence_url",
      "confidence",
    ],
  },
  {
    name: "Ad Messages",
    columns: [
      "week",
      "app",
      "market",
      "source",
      "hook_message",
      "creative_format",
      "cta",
      "targeting_hint",
      "ai_or_growth_angle",
      "first_seen",
      "last_seen",
      "evidence_url",
      "confidence",
    ],
  },
  {
    name: "Social Patterns",
    columns: [
      "week",
      "app",
      "market",
      "platform",
      "pattern_summary",
      "content_format",
      "repeated_message",
      "observed_examples",
      "evidence_url",
      "source_status",
      "manual_check_needed",
      "confidence",
    ],
  },
  {
    name: "Sources & Runs",
    columns: [
      "run_id",
      "week",
      "source_name",
      "source_url",
      "app",
      "market",
      "status",
      "last_success_at",
      "error_message",
      "manual_check_needed",
      "next_action",
    ],
  },
  {
    name: "Config",
    columns: ["section", "key", "value", "enabled", "notes"],
  },
] as const;

export type TableRow = Record<string, string | number | boolean>;

export type GrowthSignal = TableRow & {
  week: string;
  app: string;
  market: Market;
  channel: Channel;
  signal_type: string;
  signal_summary: string;
  growth_relevance: number;
  change_strength: number;
  confidence: Confidence;
  score: number;
  evidence_url: string;
  source_status: SourceStatus;
  manual_check_needed: boolean;
  notes: string;
};

export type SourceRun = TableRow & {
  run_id: string;
  week: string;
  source_name: string;
  source_url: string;
  app: string;
  market: Market;
  status: SourceStatus;
  last_success_at: string;
  error_message: string;
  manual_check_needed: boolean;
  next_action: string;
};

export function schemaFor(sheetName: SheetName): SheetSchema {
  const schema = REQUIRED_SHEETS.find((sheet) => sheet.name === sheetName);
  if (!schema) {
    throw new Error(`Unknown sheet: ${sheetName}`);
  }
  return schema;
}

export function buildEmptyRow(sheetName: SheetName): TableRow {
  return Object.fromEntries(schemaFor(sheetName).columns.map((column) => [column, ""]));
}

export function normalizeWeek(input: string): string {
  const match = input.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) {
    throw new Error(`Invalid week: ${input}`);
  }
  const week = Number(match[2]);
  if (week < 1 || week > 53) {
    throw new Error(`Invalid week: ${input}`);
  }
  return `${match[1]}-W${String(week).padStart(2, "0")}`;
}
