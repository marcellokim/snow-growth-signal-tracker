import type { Channel, Confidence, GrowthSignal, Market, SourceRun, SourceStatus, TableRow } from "./domain";

export type FetchText = (url: string) => Promise<string>;
export type Now = () => string;

export type ConnectorResult = {
  status: SourceStatus;
  sourceRun: SourceRun;
  signals: GrowthSignal[];
  storeKeywords: TableRow[];
  appMatrix: TableRow[];
};

export type AppStoreCollectInput = {
  week: string;
  app: string;
  market: Market;
  term: string;
};

export type PublicUrlCollectInput = {
  week: string;
  app: string;
  market: Market;
  channel: Channel;
  sourceName: string;
  sourceUrl: string;
};

export type ManualCollectInput = PublicUrlCollectInput & {
  nextAction: string;
};

export class AppStoreSearchConnector {
  constructor(
    private readonly fetchText: FetchText,
    private readonly now: Now,
  ) {}

  async collect(input: AppStoreCollectInput): Promise<ConnectorResult> {
    const url = `https://itunes.apple.com/search?entity=software&country=${encodeURIComponent(input.market)}&term=${encodeURIComponent(input.term)}`;
    try {
      const payload = JSON.parse(await this.fetchText(url)) as { results?: Array<Record<string, unknown>> };
      const first = payload.results?.[0];
      if (!first) {
        return this.emptyResult(input, url, "manual_needed", "Verify App Store listing manually; search returned no app result.");
      }
      const title = String(first.trackName ?? input.app);
      const description = String(first.description ?? "");
      const price = String(first.formattedPrice ?? "Unknown");
      const evidenceUrl = String(first.trackViewUrl ?? url);
      const keyword = [title, description].filter(Boolean).join(" | ");

      return {
        status: "ok",
        sourceRun: this.sourceRun(input.week, "App Store Search", url, input.app, input.market, "ok", "", false, "Review extracted listing changes."),
        signals: [],
        storeKeywords: [
          {
            week: input.week,
            app: input.app,
            market: input.market,
            store: "App Store",
            title,
            subtitle_or_short_description: description.slice(0, 240),
            keyword_or_message: keyword.slice(0, 500),
            change_from_prior_week: "",
            evidence_url: evidenceUrl,
            confidence: "high",
          },
        ],
        appMatrix: [
          {
            app: input.app,
            market: input.market,
            core_features: "",
            ai_features: extractAiKeywords(description),
            paid_model: price === "Free" ? "Free app; in-app purchases require manual pricing check" : "Paid app",
            price_summary: price,
            subscription_or_credit_notes: "Manual paywall or subscription check required for exact in-app pricing.",
            last_checked_at: this.now(),
            evidence_url: evidenceUrl,
            confidence: "high",
          },
        ],
      };
    } catch (error) {
      return this.emptyResult(input, url, "error", errorMessage(error));
    }
  }

  private emptyResult(input: AppStoreCollectInput, url: string, status: SourceStatus, nextAction: string): ConnectorResult {
    return {
      status,
      sourceRun: this.sourceRun(input.week, "App Store Search", url, input.app, input.market, status, status === "error" ? nextAction : "", true, nextAction),
      signals: [],
      storeKeywords: [],
      appMatrix: [],
    };
  }

  private sourceRun(
    week: string,
    sourceName: string,
    sourceUrl: string,
    app: string,
    market: Market,
    status: SourceStatus,
    error: string,
    manual: boolean,
    nextAction: string,
  ): SourceRun {
    return {
      run_id: `${week}-${sourceName}-${app}-${market}`.replace(/\s+/g, "-"),
      week,
      source_name: sourceName,
      source_url: sourceUrl,
      app,
      market,
      status,
      last_success_at: status === "ok" ? this.now() : "",
      error_message: error,
      manual_check_needed: manual,
      next_action: nextAction,
    };
  }
}

export class PublicUrlConnector {
  constructor(
    private readonly fetchText: FetchText,
    private readonly now: Now,
  ) {}

  async collect(input: PublicUrlCollectInput): Promise<ConnectorResult> {
    try {
      const html = await this.fetchText(input.sourceUrl);
      const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
      const description = extractTag(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i);
      const summary = [title, description].filter(Boolean).join(" | ").trim();
      const status: SourceStatus = summary ? "partial" : "changed_structure";
      const confidence: Confidence = input.channel === "Official Web" ? "medium" : "low";
      return {
        status,
        sourceRun: this.sourceRun(input, status, "", status !== "partial", status === "partial" ? "Review extracted public page summary." : "Review source manually; parser found no title or description."),
        signals: summary
          ? [
              {
                week: input.week,
                app: input.app,
                market: input.market,
                channel: input.channel,
                signal_type: "public_page_message",
                signal_summary: summary.slice(0, 500),
                growth_relevance: containsGrowthLanguage(summary) ? 70 : 40,
                change_strength: 0,
                confidence,
                score: 0,
                evidence_url: input.sourceUrl,
                source_status: status,
                manual_check_needed: confidence === "low",
                notes: "Public page extraction; compare with prior week before ranking.",
              },
            ]
          : [],
        storeKeywords: [],
        appMatrix: [],
      };
    } catch (error) {
      return {
        status: "blocked",
        sourceRun: this.sourceRun(input, "blocked", errorMessage(error), true, "Open the public source manually without logging in and record visible patterns."),
        signals: [],
        storeKeywords: [],
        appMatrix: [],
      };
    }
  }

  private sourceRun(input: PublicUrlCollectInput, status: SourceStatus, error: string, manual: boolean, nextAction: string): SourceRun {
    return {
      run_id: `${input.week}-${input.sourceName}-${input.app}-${input.market}`.replace(/\s+/g, "-"),
      week: input.week,
      source_name: input.sourceName,
      source_url: input.sourceUrl,
      app: input.app,
      market: input.market,
      status,
      last_success_at: status === "partial" || status === "ok" ? this.now() : "",
      error_message: error,
      manual_check_needed: manual,
      next_action: nextAction,
    };
  }
}

export class ManualQueueConnector {
  constructor(private readonly now: Now) {}

  async collect(input: ManualCollectInput): Promise<ConnectorResult> {
    return {
      status: "manual_needed",
      sourceRun: {
        run_id: `${input.week}-${input.sourceName}-${input.app}-${input.market}`.replace(/\s+/g, "-"),
        week: input.week,
        source_name: input.sourceName,
        source_url: input.sourceUrl,
        app: input.app,
        market: input.market,
        status: "manual_needed",
        last_success_at: "",
        error_message: "",
        manual_check_needed: true,
        next_action: `${input.nextAction} Created at ${this.now()}.`,
      },
      signals: [],
      storeKeywords: [],
      appMatrix: [],
    };
  }
}

function extractAiKeywords(description: string): string {
  const matches = description.match(/\b(AI|artificial intelligence|headshot|avatar|retouch|enhance|filter|template)\b/gi);
  return [...new Set(matches ?? [])].join(", ");
}

function containsGrowthLanguage(text: string): boolean {
  return /AI|viral|trend|template|avatar|headshot|beauty|edit|share|photo/i.test(text);
}

function extractTag(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return decodeHtml(match?.[1]?.replace(/\s+/g, " ").trim() ?? "");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
