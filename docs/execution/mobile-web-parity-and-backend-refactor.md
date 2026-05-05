# Mobile/Web Parity And Backend Refactor Plan

Last updated: 2026-04-30

## Purpose

This document tracks the gap between the legacy Next.js web surface and the new
Flutter mobile surface, and explains why backend refactoring is now a product
requirement rather than optional cleanup.

The project direction remains:

- Flutter-first
- Android and Flutter Web first
- Chinese-only
- Loo皇 / Loo国 theme only
- Next.js web remains a reference implementation and temporary API host

## Current Page-Level Parity

| Feature area             | Legacy web surface                                                                               | Current Flutter surface                                                                                                                                                                                                              | Gap / decision                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                     | Login/register through web session                                                               | Mobile login, token persistence, refresh/retry, logout                                                                                                                                                                               | Mobile auth works, but backend refresh tokens are still stateless and logout is not server-revoking                                               |
| Dashboard / Overview     | Dense dashboard with metrics, accounts, drift, charts, recommendation preview, spending rhythm   | Mobile overview with metrics, health entry, key accounts, top holdings, recommendation theme, and net-worth / invested-asset trend freshness labels                                                                                  | Mobile intentionally smaller; spending rhythm and full dashboard chart density are not migrated                                                   |
| Portfolio workspace      | Full account/holding workspace, filters, account/security/holding routing, repair/edit workflows | Portfolio overview, account detail, holding detail, security detail, health score, asset-class drilldown, account-type filtered view                                                                                                 | Mobile has core read/drilldown flows; full workspace filtering and all edit/repair paths are still incomplete                                     |
| Portfolio health         | Dedicated web health page                                                                        | First-pass mobile health score page with drivers, radar, actions, account/holding drilldowns                                                                                                                                         | Mobile is usable; visual polish and deeper historical context remain                                                                              |
| Charts                   | Web has donut, line, radar preview components                                                    | Flutter has first-pass line chart, allocation distribution, health radar/score widgets; Security, Overview, Portfolio value, Account Detail, Holding Detail, and Asset Class drilldown charts now use typed freshness contracts      | Remaining work is richer interactions/tooltips, not basic mobile chart coverage                                                                   |
| Security detail          | Web security page and linked holding context                                                     | Mobile security detail with summary, facts, price trend, target drift, account distribution                                                                                                                                          | Security chart now has a typed series DTO with freshness/source labels; other detail sections still use read-model display data                   |
| Holding detail           | Web holding route redirects into security context                                                | Mobile holding detail page exists and opens by holding id                                                                                                                                                                            | Mobile is now stronger for holding-specific drilldown than the current web redirect                                                               |
| Recommendations          | Web recommendation page with run panel, ranking, scenarios, explanations, constraints            | Mobile recommendations with regenerate, scoring explanation, watchlist, scenarios, alternatives, execution steps                                                                                                                     | Mobile has strong first-pass parity; hard constraints still need backend model work                                                               |
| Discover / market search | Web supports symbol search/validation and watchlist discovery                                    | Mobile now has a first-pass `搜索标的` flow launched from the Recommendations tab for CAD/USD symbol/name search, identity display, watchlist add/remove, and security-detail navigation; import/settings still reuse search/resolve locally | Candidate scoring and watchlist comparison are not yet migrated; all search-result navigation must preserve symbol + exchange + currency identity; non-CAD/USD listings stay out of current product scope until quote/recommendation provider coverage expands |
| Import                   | Web supports guided/direct flows, manual entry, CSV-oriented paths, preview/review concepts      | Mobile intentionally keeps manual guided entry for accounts/holdings; CSV not migrated                                                                                                                                               | This is an explicit product decision. Mobile CSV is deferred/omitted unless a future need appears                                                 |
| Settings / preferences   | Web has guided setup, manual workbench, profile/citizen panel, preference source context         | Mobile has guided draft, manual edit, recommendation constraint edit, display currency, quote refresh                                                                                                                                | Citizen/admin profile depth and some web workbench density are not migrated                                                                       |
| Spending                 | Web has spending page and import separation                                                      | Mobile has no meaningful spending tab yet                                                                                                                                                                                            | Deferred until investment core and backend boundaries are stable                                                                                  |
| Brand / Loo page         | Web has brand page                                                                               | Mobile theme applies Loo identity in app shell and pages                                                                                                                                                                             | No separate mobile brand page needed now                                                                                                          |

## Current Mobile UX Risk

The mobile app now has enough migrated functionality that UI/IA quality is a
product blocker, not a cosmetic follow-up.

Observed issues from manual phone QA:

- Many pages expose backend/debug concepts too directly, including provider
  status, fallback labels, retry/failure internals, and source explanations.
- Detail pages have too many equal-weight cards, making the most important
  action or data point hard to identify.
- Some status chips use misleading wording, for example implying a quote still
  needs refresh after the backend already recorded a fresh quote.
- Charts and historical summaries can look like fake/mock data when fallback or
  legacy performance arrays are presented without strong enough hierarchy.
- Floating controls can cover content and should be considered in every dense
  detail-page layout.

UI overhaul priority:

1. Redesign detail-page hierarchy first: Security, Holding, Account, Asset Class,
   and Health pages.
2. Then clean Overview and Portfolio cards so totals, source/freshness, and
   primary navigation are easier to scan.
3. Then simplify Recommendations, Import, and Settings copy so advanced/debug
   details move behind expandable sections or Settings diagnostics.

## Why Backend Refactor Is Needed Now

The Flutter migration has reached the point where UI-only work is no longer the
main blocker. The remaining gaps mostly come from backend contracts that were
originally shaped for web pages, not for stable mobile/API clients.

### 1. Web page read models leak into mobile contracts

Several backend services still return display-oriented strings, page chrome,
hrefs, nested view models, and presentation fields. That worked when the only
consumer was a Next.js page, but Flutter needs stable contracts that separate:

- raw domain values
- formatted display text
- navigation identifiers
- chart-ready series
- explainability fields
- edit/create payload contracts

Without this split, Flutter pages keep parsing `Map<String, dynamic>` and will
break at runtime when web-shaped payloads drift.

### 2. Recommendation constraints need real domain fields

Mobile now edits first-pass recommendation constraints:

- watchlist symbols
- recommendation strategy
- tax-aware placement
- account funding priority

The next recommendation features need stronger rules that should not be hidden
inside UI state or loosely interpreted preference blobs:

- excluded symbols
- preferred symbols by asset class
- asset-class minimum/maximum bands
- account-level allow/avoid rules
- security-type constraints
- CAD-listed / USD-listed identity constraints

These should become explicit backend contract fields, with validation and
persistence, before AI-agent or cloud workers use them.

### 3. Market identity must stay backend-owned

This project already has a critical correctness rule: `symbol`, listing market,
and trading currency together define the security identity. Flutter should not
guess whether `AMZN`, a CAD-listed CDR, a CAD-hedged ETF, or a USD common share
are the same asset.

Backend APIs need to keep returning resolved identity fields and validation
status so mobile import/search/watchlist flows do not accidentally merge:

- US common shares
- CAD-listed versions
- CDRs
- CAD-hedged ETFs
- physically based gold / special holdings

### 4. Auth and token lifecycle are still not production-grade

Flutter can log in and persist tokens, but the backend still has mobile auth
gaps:

- refresh tokens are stateless JWTs
- logout does not revoke refresh tokens
- `/api/mobile/*` can fall back to web session cookies
- token/session behavior is hard to validate in Flutter Web because browser web
  sessions can mask missing bearer-token wiring

This is acceptable for local MVP testing, but not for a shared mobile/web URL
used by multiple real users.

### 5. Cloud and AI-agent work need async boundaries

Future features will require heavier jobs:

- quote refresh
- price-history hydration
- recommendation generation
- AI-agent analysis
- import review persistence

If these stay as request-time page/service calls, the app will become slow,
fragile, and expensive to run in the cloud. The backend needs cache/job/worker
boundaries before AI-agent features become central.

## Recommended Backend Refactor Priority

1. Loo国 AI Minister integration
   - Convert the uploaded `portfolio-analyzer.skill` into product-owned
     analysis and assistant contracts, not a raw Codex-only skill dependency.
   - Treat the agent as the Loo国 "大臣": a cross-feature, context-aware
     assistant that can answer user questions from Overview, Portfolio,
     Account/Holding/Security Detail, Recommendations, Import, Settings, and
     future Spending pages.
   - Start with structured JSON outputs and page-context DTOs that Flutter can
     render or pass to the assistant API.
   - Keep Canadian investor context, CAD base currency, account-tax awareness,
     risk guardrails, overlap checks, and source freshness/disclaimer rules.
   - Do not run full live web/forum research on every page load; gate expensive
     analysis behind explicit user actions, cache, or future worker jobs.

2. Mobile contract typing and DTO cleanup
   - Replace page-shaped mobile parsing with typed DTOs.
   - Keep raw IDs and raw values where mobile needs charting/filtering.
   - Keep display strings only as display helpers, not as the only source.

3. Recommendation constraints v2
   - Add explicit fields for exclusions, preferred symbols, asset-class bands,
     and account/security-type rules.
   - Validate all symbol constraints through market identity resolution.
   - Keep CAD/USD/listing identity in the backend result.

4. Market-data identity and validation API hardening
   - Normalize search/resolve/quote response shapes.
   - Always expose symbol, name, exchange, currency, security type, provider,
     confidence, and warning text.
   - Use the same identity contract in import, watchlist, recommendations, and
     quote refresh.

5. Auth hardening
   - Add revocable refresh-token storage.
   - Make mobile bearer-token auth strict unless an endpoint explicitly allows
     web-session fallback.
   - Preserve Flutter Web compatibility without masking token bugs.

6. Worker/cache boundary design
   - Move heavy quote/history/recommendation/AI tasks toward queued or cached
     flows.
   - Keep request handlers as thin API boundaries.

## Practical Next Development Slice

The next implementation slice is now `Loo国 AI Minister integration`.

This is P0 because the user explicitly wants the uploaded
`portfolio-analyzer.skill` integrated into the product direction. The right
implementation path is not to install and execute the skill directly. The skill
should become a product-owned backend analysis and assistant specification with
stable output contracts.

Minimum useful scope:

- add a project document that maps the skill's analysis modules into product
  features
- define backend request/result contracts for:
  - single security quick scan
  - portfolio diagnostic quick scan
  - recommendation-run explanation
  - cross-page minister Q&A
  - AI-guided investment preference sessions and drafts
- preserve the existing security identity rule: `symbol + exchange + currency`
  defines the instrument
- start with deterministic/local analysis using existing portfolio, health,
  recommendation, quote, and market-identity data
- defer live web/news/forum research until cache/worker boundaries exist
- expose results to Flutter as JSON cards, not React artifacts
- treat page context DTOs as first-class inputs, so the minister can answer
  user questions without scraping UI text or relying on unstable page-shaped
  maps

`Recommendation constraints v2` remains active but moves underneath the AI
analyzer work because it supplies important preference and guardrail inputs.
Its remaining useful scope is:

- extend preference contracts with hard constraints
- add backend validation for symbol constraints using market search/resolve
- expose those constraints in mobile settings
- make recommendation scoring consume them
- keep existing first-pass mobile UI usable while fields are added

The next quality jump should now come from structured AI analysis contracts,
not from adding more standalone Flutter pages.

## Portfolio Analyzer Skill Integration

Status: P0 planning accepted

Uploaded skill source:

- `portfolio-analyzer.skill`
- Contains `portfolio-analyzer/SKILL.md`
- Purpose: Canadian investor stock, ETF, and portfolio analysis pipeline

Product interpretation:

- Treat the skill as an analysis blueprint, not as app runtime code.
- Convert the workflow into backend-owned modules and JSON contracts.
- Flutter should render structured analysis cards; it should not run or parse a
  raw agent prompt.
- Every analysis result must keep data freshness and non-advice disclaimer
  fields.

Best-fit project areas:

1. Security Detail
   - single-stock / ETF quick scan
   - factor scorecard
   - risk alerts
   - CAD/USD/listing identity summary
   - optional future news/forum sentiment

2. Portfolio Health
   - overlap and concentration diagnostics
   - account tax-efficiency warnings
   - MER/cost drag notes
   - missing exposure / gap analysis
   - action queue explanations

3. Recommendations
   - explain why a candidate is suggested or avoided
   - connect recommendation constraints to user-readable rationale
   - include account-placement and tax-awareness reasoning
   - flag conflicts with excluded/preferred/security-type constraints

Recommended product phases:

1. P0-A: Analyzer contract and docs
   - Status: implemented.
   - Added `docs/execution/ai-portfolio-analyzer.md`.
   - Added `lib/backend/portfolio-analyzer-contracts.ts`.
   - Added backend contract tests for identity preservation, scope validation,
     disclaimer requirements, and source freshness honesty.

2. P0-B: Deterministic quick scan backend
   - Status: implemented for first deterministic slice.
   - Added `lib/backend/portfolio-analyzer.ts`.
   - Added backend tests in `tests/backend/portfolio-analyzer.test.ts`.
   - Implemented local quick-scan builders for `security`, `portfolio`, and
     `recommendation-run` scopes.
   - Added account-scoped quick scan for account-level Health explanations.
   - No live Reddit/news scraping in this slice.
   - Added protected route `POST /api/mobile/analysis/quick-scan`.
   - Added Flutter API client method `createAnalyzerQuickScan(...)`.
   - Remaining: live/cached external research is deferred behind cache/worker
     boundaries.

3. P0-C: Flutter rendering surface
   - Status: implemented for first pass.
   - Added reusable Flutter AI analysis card.
   - Security Detail exposes user-triggered "AI 标的快扫".
   - Portfolio Health exposes user-triggered "AI 组合快扫" for full-portfolio
     scope.
   - Account-scoped Health pages expose user-triggered "AI 账户快扫" with the
     selected `accountId`.
   - Results render summary, confidence/source mode, scorecards, risks, tax
     notes, portfolio-fit notes, action items, sources, and disclaimer.

4. P1: Cached external research
   - Current foundation: analyzer requests default to bounded cache reuse and
     can persist results in `portfolio_analysis_runs` once migration `0004` is
     applied.
   - Add explicit user-triggered refresh for news/institutional research.
   - Cache analysis results with freshness timestamps.
   - Keep source attribution and copyright-safe paraphrasing.

5. P2: Forum sentiment
   - Add Reddit/community sentiment only after the cache/worker boundary exists.
   - Treat it as supplemental signal, not recommendation authority.

Open implementation rule:

- The analyzer must never collapse CAD-listed/CDR/CAD-hedged securities into US
  common shares by symbol alone. All analysis inputs must carry `symbol`,
  `exchange`, and `currency` when available.

## Recommendation Constraints V2 Progress

Status: in progress

First backend slice implemented:

- Added a normalized `recommendationConstraints` object to preference profiles.
- Added a DB column and migration for `preference_profiles.recommendation_constraints`.
- Added schema validation for:
  - `excludedSymbols`
  - `preferredSymbols`
  - `assetClassBands`
  - `avoidAccountTypes`
  - `preferredAccountTypes`
  - `allowedSecurityTypes`
- Kept the API backward-compatible: existing mobile/web preference updates can
  omit `recommendationConstraints` and the backend preserves the current stored
  constraints.
- Recommendation v2 now consumes:
  - `excludedSymbols` to remove symbols from the generated universe when possible
  - `preferredSymbols` to boost candidate scoring
- Preference updates now run preferred/excluded symbols through the market-data
  resolver before writing. Resolver work stays outside the DB transaction.
- Recommendation explanations now surface preferred/excluded-symbol effects.
- Constraint storage now supports security identity objects with `symbol`,
  `exchange`, `currency`, `name`, and `provider`, while keeping legacy symbol
  arrays for compatibility.
- Account placement scoring now consumes `preferredAccountTypes` and
  `avoidAccountTypes`.
- Asset-class band constraints now adjust effective target percentages used by
  recommendation gap scoring.
- `allowedSecurityTypes` now affects candidate scoring and candidate-pool
  selection. If matching candidates exist, the engine prioritizes allowed types;
  otherwise it degrades instead of returning no recommendation.
- Backend tests now cover recommendation constraint normalization and invariant
  behavior for excluded symbols, preferred symbols, allowed security types, and
  asset-class bands without locking exact recommendation scores.
- Preference schema tests now cover malformed Recommendation Constraints v2
  payloads, including invalid security identity currency, impossible asset-class
  bands, oversized symbol lists, valid resolved identity objects, and legacy
  payload compatibility when `recommendationConstraints` is omitted.

First mobile slice implemented:

- Mobile Settings recommendation-constraint editor can now edit:
  - watchlist symbols
  - preferred symbols
  - excluded symbols
  - preferred account types
  - avoided account types
  - asset-class min/max bands
  - allowed security types
  - recommendation strategy
  - tax-aware placement
  - account funding priority
- Mobile accepts preferred/excluded identities in the lightweight format
  `SYMBOL|EXCHANGE|CURRENCY`, while still allowing symbol-only entries.
- Mobile Settings now includes a search picker for preferred/excluded
  constraint securities. Picker selections preserve resolved `symbol`,
  `exchange`, `currency`, `name`, and `provider` where the market-data search
  API supplies them.

Remaining work:

- Constraint securities now use chip-based editing in mobile Settings; search
  results preserve `symbol`, `exchange`, `currency`, `name`, and `provider`.
- Mobile Settings now validates asset-class band input before save and reports
  line-level Chinese errors for bad format, unsupported asset class, invalid
  number, out-of-range values, or min greater than max.
- Health Score now consumes asset-class bands as effective target constraints,
  not only Recommendation gap scoring.
- Mobile account Health now has a visible `评分口径` explanation card that
  separates `账户内适配` from `全组合目标参考`, so account-level scores cannot be
  read as a requirement that one account must mirror the total portfolio target.
- Holding Detail now has its own `持仓价值走势` chart contract, separate from
  Security Detail's ticker-level `价格走势`.
- Portfolio quote refresh now writes daily price-history points keyed by
  `symbol + exchange + currency + date` and exposes `historyPointCount` /
  `snapshotRecorded` in the refresh response, so mobile QA can confirm refresh
  improves future chart freshness.
- FX rates now have an independent `fx_rates` store. Quote refresh reads stored
  FX or a conservative fallback for CAD aggregation, instead of calling a live
  FX API while refreshing USD holdings.
- Mobile Overview, Portfolio, and Settings refresh results now expose FX
  as-of/source/freshness, so total-asset CAD values can be traced back to the
  exact stored/fallback USD/CAD rate being used.
- Mobile Overview total-asset metric now uses the same net-worth scope as the
  total-asset trend when cash-account balances are present: investment accounts
  plus current cash balances. Pure investment assets should be shown as a
  separate metric if needed, not mixed into the total-asset label.
- Mobile Overview/Portfolio historical value replay now groups price history by
  `symbol + exchange + currency` and converts USD prices through the FX index
  before CAD aggregation. This prevents USD common shares and CAD CDR/listed
  versions from being replayed with the same ticker-only price.
- `security_price_history` now has exchange-aware identity through migration
  `0008_security_price_history_exchange_identity`. Old exchange-less rows remain
  available for compatibility but new refresh writes exchange-aware rows.
- Overview and Portfolio value charts now append/replace today's point with the
  current state-table total. Historical replay may still be incomplete for older
  dates, but the latest chart point must agree with the visible total asset /
  current portfolio value card.

Next priority order:

1. Stabilize P0.5 real-data AI foundations: scheduled quote/history/FX refresh,
   provider retry-after persistence, and source/freshness lineage that AI can
   trust.
   - Status: in progress.
   - `market_data_provider_limits` now persists provider retry-after windows for
     DB-backed Settings/run-ledger snapshots and cloud/multi-process readiness.
2. Productize the external consultation / `portfolio-analyzer.skill` pipeline
   on cached real market data first. Live external research remains disabled
   until worker/cache/provider quota policy is proven.
   - Status: in progress.
   - Cached market-data external consultation now uses full
     `symbol + exchange + currency` identity when reading local price history.
3. Align AI 标的分析 and AI 大臣 around the same backend-owned context:
   structured saved analysis for symbol/account/portfolio scopes, and
   cross-page conversational explanation that references or triggers those
   analyses instead of duplicating them.
   - Status: in progress.
   - 大臣 prompts now include fact source tags and prefer `analysis-cache` /
     `external-intelligence` facts when present. Backend answer requests now
     auto-enrich page context from the standalone `Loo国今日秘闻` feed.
4. Normalize Flutter API contracts into typed DTOs and reduce page-level
   `Map<String, dynamic>` parsing.
   - Status: in progress.
   - First slice extracted Settings market-data refresh status parsing into
     typed Flutter DTOs.
   - Second slice extracted Overview and Portfolio snapshot parsing into typed
     Flutter DTOs, including home health/trend, portfolio performance,
     allocation, and asset-class drilldown models.
   - Third slice extracted Recommendations snapshot, preference-context,
     priority, constraint, and scenario parsing into typed Flutter DTOs.
   - Fourth slice extracted Import guide, existing account, action-card, and
     security-search candidate parsing into typed Flutter DTOs.
   - Fifth slice extracted Settings preference profile, recommendation
     constraints, guided draft, and target allocation models into typed Flutter
     DTOs. This explicitly treats AI-guided preference setup as current-phase
     model work, not a future bolt-on.
   - Next slice should cover deeper detail-page DTO cleanup while preserving AI
     Minister page-context fields.
5. Defer Mobile UI / IA overhaul to P1. Layout polish remains important, but it
   should follow credible real-data AI/provider behavior rather than lead it.
6. Harden mobile auth: revocable refresh tokens, server-side logout, and
   production storage policy.
7. Start mobile spending/cash account monitoring as a separate account class
   from investment accounts.

Migration metadata status:

- `drizzle/meta/_journal.json` now registers migrations `0001` through `0010`.
- It also registers later mobile/AI migrations through
  `0015_market_data_provider_limits`.
- Local Postgres `5434` has migrations `0006`, `0007`, `0008`, `0009`, and
  `0010` applied for currency-aware history, independent FX rates,
  exchange-aware history, market-data refresh run tracking, and row-level
  market-data source lineage.
