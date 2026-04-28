# Mobile/Web Parity And Backend Refactor Plan

Last updated: 2026-04-28

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
| Dashboard / Overview     | Dense dashboard with metrics, accounts, drift, charts, recommendation preview, spending rhythm   | Mobile overview with metrics, health entry, key accounts, top holdings, recommendation theme                                                                                                                                         | Mobile intentionally smaller; spending rhythm and full dashboard chart density are not migrated                                                   |
| Portfolio workspace      | Full account/holding workspace, filters, account/security/holding routing, repair/edit workflows | Portfolio overview, account detail, holding detail, security detail, health score, asset-class drilldown, account-type filtered view                                                                                                 | Mobile has core read/drilldown flows; full workspace filtering and all edit/repair paths are still incomplete                                     |
| Portfolio health         | Dedicated web health page                                                                        | First-pass mobile health score page with drivers, radar, actions, account/holding drilldowns                                                                                                                                         | Mobile is usable; visual polish and deeper historical context remain                                                                              |
| Charts                   | Web has donut, line, radar preview components                                                    | Flutter has first-pass line chart, allocation distribution, health radar/score widgets                                                                                                                                               | Mobile chart foundation exists; next step is standardized chart contracts in `docs/execution/mobile-chart-contracts.md`                           |
| Security detail          | Web security page and linked holding context                                                     | Mobile security detail with summary, facts, price trend, target drift, account distribution                                                                                                                                          | Security chart now has a typed series DTO with freshness/source labels; other detail sections still use read-model display data                   |
| Holding detail           | Web holding route redirects into security context                                                | Mobile holding detail page exists and opens by holding id                                                                                                                                                                            | Mobile is now stronger for holding-specific drilldown than the current web redirect                                                               |
| Recommendations          | Web recommendation page with run panel, ranking, scenarios, explanations, constraints            | Mobile recommendations with regenerate, scoring explanation, watchlist, scenarios, alternatives, execution steps                                                                                                                     | Mobile has strong first-pass parity; hard constraints still need backend model work                                                               |
| Discover / market search | Web supports symbol search/validation and watchlist discovery                                    | Mobile now has a first-pass `搜索标的` flow launched from the Recommendations tab for symbol/name search, identity display, watchlist add/remove, and security-detail navigation; import/settings still reuse search/resolve locally | Candidate scoring and watchlist comparison are not yet migrated; all search-result navigation must preserve symbol + exchange + currency identity |
| Import                   | Web supports guided/direct flows, manual entry, CSV-oriented paths, preview/review concepts      | Mobile intentionally keeps manual guided entry for accounts/holdings; CSV not migrated                                                                                                                                               | This is an explicit product decision. Mobile CSV is deferred/omitted unless a future need appears                                                 |
| Settings / preferences   | Web has guided setup, manual workbench, profile/citizen panel, preference source context         | Mobile has guided draft, manual edit, recommendation constraint edit, display currency, quote refresh                                                                                                                                | Citizen/admin profile depth and some web workbench density are not migrated                                                                       |
| Spending                 | Web has spending page and import separation                                                      | Mobile has no meaningful spending tab yet                                                                                                                                                                                            | Deferred until investment core and backend boundaries are stable                                                                                  |
| Brand / Loo page         | Web has brand page                                                                               | Mobile theme applies Loo identity in app shell and pages                                                                                                                                                                             | No separate mobile brand page needed now                                                                                                          |

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

1. AI portfolio analyzer integration
   - Convert the uploaded `portfolio-analyzer.skill` into product-owned
     analysis contracts, not a raw Codex-only skill dependency.
   - Start with structured JSON outputs that Flutter can render in Security
     Detail, Portfolio Health, and Recommendations.
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

The next implementation slice is now `AI portfolio analyzer integration`.

This is P0 because the user explicitly wants the uploaded
`portfolio-analyzer.skill` integrated into the product direction. The right
implementation path is not to install and execute the skill directly. The skill
should become a product-owned backend analysis specification with stable output
contracts.

Minimum useful scope:

- add a project document that maps the skill's analysis modules into product
  features
- define backend request/result contracts for:
  - single security quick scan
  - portfolio diagnostic quick scan
  - recommendation-run explanation
- preserve the existing security identity rule: `symbol + exchange + currency`
  defines the instrument
- start with deterministic/local analysis using existing portfolio, health,
  recommendation, quote, and market-identity data
- defer live web/news/forum research until cache/worker boundaries exist
- expose results to Flutter as JSON cards, not React artifacts

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

Next priority order:

1. Apply/verify migration `0004_portfolio_analysis_runs` in the target dev DB.
2. Manual QA that AI quick scans still generate normally, `重新生成` bypasses
   cache, and repeated navigation/reload does not break the card.
3. Manual QA account Health wording: account-level pages must show
   `账户内适配 + 全组合目标参考`, and overweight allocation copy must say
   `高于目标`, not `只有`.
4. Manual QA Settings `AI 最近分析` after generating at least one quick scan.
5. Commit/push the analyzer refresh UI, Health wording fix, and recent analysis
   history after
   validation.
6. External research is now guarded off by default, and the worker/cost policy
   plus source allowlist are exposed through the mobile policy API/settings
   card. Next work is the actual background worker queue and persisted usage
   counters before any live adapter. Background research is captured in
   `docs/execution/external-research-worker-background-research.md`.
7. Migration `0005_external_research_jobs` starts the DB-backed job/usage
   ledger and mobile usage readout. Enqueue remains guarded off until worker
   claim/succeed/fail logic and a provider adapter exist.
8. Chart-heavy UX should now start with the mobile chart contract in
   `docs/execution/mobile-chart-contracts.md`, then migrate Security Detail
   before account/portfolio charts.

Migration metadata status:

- `drizzle/meta/_journal.json` now registers migrations `0001` through `0004`.
- `npx drizzle-kit check` passes after the journal update.
