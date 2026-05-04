# SNOW Growth Signal Tracker Design

Date: 2026-05-04
Status: Approved for planning

## Goal

Build a weekly growth-signal tracking system for SNOW, SODA, Foodie, EPIK, and comparable apps such as B612, BeautyPlus, Meitu, and Remini.

The system should maintain one Google Sheets workbook and one page of weekly insight summary. It should track core features, AI features, paid pricing, app-store keywords, ad creative messages, and TikTok/Instagram content patterns across Korea, the United States, and Japan.

The first design target is automation-oriented: Google Sheets and Google Apps Script should run the weekly workflow, generate ranked growth insights, and expose any sources that need manual verification.

## Decisions

- Use Google Sheets as the primary human-facing operating surface.
- Use Google Apps Script as the weekly orchestrator.
- Focus the weekly summary on growth and marketing signals first: ad messages, app-store keywords, TikTok/Instagram content patterns, and channel-level changes.
- Track KR, US, and JP as separate markets.
- Prefer non-login public access for TikTok and Instagram. Blocked social sources become manual-check items instead of hidden failures.
- Generate change detection, importance scores, and weekly action or observation points.
- Use an Apps Script orchestrator structure that can mix automatic sources, manual queues, and optional future external helpers.

## Architecture

The system has five main units.

1. Google Sheets workbook

   The workbook is the operating board and state store. It holds weekly summaries, app comparisons, raw source evidence, run history, source status, and configuration.

2. Apps Script runner

   The runner executes the weekly workflow. It loads config, runs source connectors, normalizes records, compares current data with prior weeks, scores growth signals, writes the summary, and records run status.

3. Source connectors

   Connectors are source-specific modules for App Store, Google Play, official app pages, public ad libraries, TikTok public pages, and Instagram public pages. Stable sources should be automated. Unstable or blocked public web sources should return structured statuses such as `blocked` or `manual_needed`.

4. Signal scoring

   Scoring ranks signals by change strength, growth relevance, evidence confidence, and repetition across sources or markets. High importance and high confidence are separate concepts.

5. Weekly insight generator

   The generator writes a one-page weekly summary with the top growth signal, top changes, app-level notes, country differences, and next-week action points.

## Google Sheets Structure

The workbook should prioritize readable operations tabs first and supporting data tabs afterward.

### Weekly Summary

One-page weekly insight tab. It includes:

- Week
- Top growth signal
- Top five changes
- App-level notes
- Market-level differences for KR, US, and JP
- Recommended action or observation points
- Manual checks required this week

### Growth Signals

Main weekly operating table. Each row represents one signal for a week, app, market, and channel.

Recommended columns:

- `week`
- `app`
- `market`
- `channel`
- `signal_type`
- `signal_summary`
- `growth_relevance`
- `change_strength`
- `confidence`
- `score`
- `evidence_url`
- `source_status`
- `manual_check_needed`
- `notes`

### App Matrix

Feature and monetization comparison across SNOW, SODA, Foodie, EPIK, B612, BeautyPlus, Meitu, and Remini.

Recommended columns:

- `app`
- `market`
- `core_features`
- `ai_features`
- `paid_model`
- `price_summary`
- `subscription_or_credit_notes`
- `last_checked_at`
- `evidence_url`
- `confidence`

### Store Keywords

Store listing and keyword-change tracking for KR, US, and JP.

Recommended columns:

- `week`
- `app`
- `market`
- `store`
- `title`
- `subtitle_or_short_description`
- `keyword_or_message`
- `change_from_prior_week`
- `evidence_url`
- `confidence`

### Ad Messages

Public ad and creative-message tracking.

Recommended columns:

- `week`
- `app`
- `market`
- `source`
- `hook_message`
- `creative_format`
- `cta`
- `targeting_hint`
- `ai_or_growth_angle`
- `first_seen`
- `last_seen`
- `evidence_url`
- `confidence`

### Social Patterns

TikTok and Instagram public observation tracking.

Recommended columns:

- `week`
- `app`
- `market`
- `platform`
- `pattern_summary`
- `content_format`
- `repeated_message`
- `observed_examples`
- `evidence_url`
- `source_status`
- `manual_check_needed`
- `confidence`

### Sources & Runs

Source inventory, weekly run log, and manual-check queue.

Recommended columns:

- `run_id`
- `week`
- `source_name`
- `source_url`
- `app`
- `market`
- `status`
- `last_success_at`
- `error_message`
- `manual_check_needed`
- `next_action`

### Config

Editable setup table for the operator.

Recommended configuration sections:

- Tracked apps
- Markets
- Channels
- Source URLs
- Scoring weights
- Weekly run options
- Summary thresholds

## Weekly Data Flow

The weekly execution flow is:

1. Load `Config`.
2. Validate required tabs and columns.
3. Collect each source.
4. Normalize app, market, channel, signal type, message, price, keyword, URL, and collection date.
5. Compare current records with prior-week records.
6. Score each growth signal.
7. Write `Growth Signals`, `Sources & Runs`, and supporting tabs.
8. Generate `Weekly Summary`.
9. Promote blocked or weak-evidence items into the manual-check queue.

## Scoring Policy

Growth-signal score should be based on:

- Change strength: how different the current signal is from prior weeks.
- Growth relevance: whether the signal relates to acquisition, conversion, retention, virality, monetization, or AI-led differentiation.
- Evidence confidence: how reliable the source is.
- Repetition: whether the same message or content format appears across channels, markets, or multiple examples.

The system should not treat importance and confidence as the same thing. A social trend may have high importance but low confidence if it comes from a small public sample. A store listing change may have high confidence but lower importance if the change is minor.

## Source Status and Confidence

Every source attempt should produce one status:

- `ok`: source was fetched and parsed.
- `partial`: source produced usable data but with missing fields.
- `blocked`: public access was blocked or rate-limited.
- `changed_structure`: the source page changed enough that parsing is unreliable.
- `manual_needed`: the source needs human review this week.
- `error`: unexpected failure.

Every signal should receive one confidence value:

- `high`: official store, official pricing, or clear public ad-library evidence.
- `medium`: repeated public web evidence with some structural uncertainty.
- `low`: limited public social observation, weak samples, or one-off examples.

## Summary Safety Rules

- A signal without an evidence URL must not appear in the Top 5.
- Low-confidence signals can appear only in an observation or manual-check section unless the operator manually promotes them.
- Blocked TikTok or Instagram sources should be visible in `Sources & Runs` and the manual-check section.
- Repeated failures should increase the priority of the manual-check item.

## Testing and Completion Criteria

The implementation plan should include these tests or equivalent verification steps:

- Required workbook tabs and columns are validated before weekly execution.
- Empty or invalid config stops the run before collection starts.
- Each connector can return structured records or structured source-status failures.
- Prior-week comparison detects new messages, keyword changes, pricing changes, and repeated content patterns.
- Scoring separates importance from confidence.
- Weekly summary excludes evidence-free signals from Top 5.
- Low-confidence social signals are routed to observation or manual-check sections.

The first implementation is complete when one Google Sheets workbook can run a `Run Weekly Tracker` action from Apps Script and update `Weekly Summary`, `Growth Signals`, and `Sources & Runs`. It does not need perfect full automation for every source, but it must clearly separate automatic, partial, blocked, and manual-check items.

## Out of Scope for First Version

- Login-based TikTok or Instagram collection.
- Credentialed scraping of private or restricted content.
- Production server infrastructure.
- Perfect historical backfill.
- Automatic decision-making without visible source evidence.

