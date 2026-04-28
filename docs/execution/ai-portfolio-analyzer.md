# AI Portfolio Analyzer Integration

Last updated: 2026-04-28

## Purpose

This document converts the uploaded `portfolio-analyzer.skill` into a product
implementation plan for `portfolio-manager`.

The skill is useful as an analysis blueprint, but it should not be installed or
executed directly inside the app. The product needs stable backend-owned JSON
contracts that Flutter can render consistently.

## Product Goal

Add structured AI-assisted investment analysis for a Canadian investor across:

- single security detail
- portfolio health
- recommendation explanations

The first implementation must be deterministic and local. It should use existing
portfolio, health, recommendation, quote, and market-identity data. Live news,
institutional research, Reddit/forum sentiment, and long-running AI generation
are deferred until cache/worker boundaries exist.

## Non-Negotiable Domain Rules

- Keep CAD as the base reporting currency.
- Preserve native trading currency on every holding/security.
- Treat `symbol + exchange + currency` as security identity when available.
- Do not merge US common shares with CAD-listed/CDR/CAD-hedged versions by
  symbol alone.
- Include source freshness on every analysis result.
- Cache user-triggered analysis results before adding any live external
  research source.
- Include non-advice disclaimers on every analysis result:
  - `仅用于研究学习，不构成投资建议。`
  - `For research and educational purposes only. Not investment advice.`
- Do not run live web/forum research on normal page load.

## Contract Files

Backend contract:

- `lib/backend/portfolio-analyzer-contracts.ts`

The contract defines:

- `AnalyzerSecurityIdentity`
- `PortfolioAnalyzerRequest`
- `PortfolioAnalyzerResult`
- request validation for `security`, `portfolio`, `account`, and
  `recommendation-run` scopes
- bounded cache controls for user-triggered quick scans
- result validation for disclaimers and source freshness honesty

Backend tests:

- `tests/backend/portfolio-analyzer-contracts.test.ts`

The tests lock these behaviors:

- `symbol + exchange + currency` identity is preserved
- security analysis requires a resolved identity or holding id
- account analysis requires an account id
- requests default to bounded cache reuse
- recommendation-run analysis requires a run id
- result payloads require non-advice disclaimers
- local analysis cannot claim external research freshness

## Mapping From Skill To Product Modules

| Skill step | Product interpretation | First implementation |
|---|---|---|
| Asset classifier | Use existing `securityType`, `assetClass`, `exchange`, and `currency` fields | Local only |
| Market data fetch | Use cached quote/market identity already in backend | Local only |
| Fundamentals / ETF holdings | Future external research module | Deferred |
| News / macro sentiment | Future cached external research | Deferred |
| Factor score engine | Deterministic scorecards from existing fields first | P0-B |
| Event / catalyst analysis | Future cached external research | Deferred |
| Risk guardrail | Use concentration, currency, account placement, quote freshness, and constraints | P0-B |
| Portfolio fit | Use current holdings, health summary, recommendations, and account types | P0-B |
| Forum sentiment | Future worker/cached module | P2 |
| Report generator | JSON result rendered by Flutter cards | P0-C |

## P0-A Contract Shape

Request scope:

- `security`: analyze a resolved security or holding
- `portfolio`: analyze current portfolio health and structure
- `account`: analyze one account's Health context
- `recommendation-run`: explain a recommendation run

Request mode:

- `quick`: first product target; local data only
- `full`: future target; may use cached external research

Result sections:

- `summary`
- `scorecards`
- `risks`
- `taxNotes`
- `portfolioFit`
- `actionItems`
- `sources`
- `dataFreshness`
- `disclaimer`

## P0-B Backend Plan

Implement deterministic quick scan with no new external dependencies.

Current status:

- First backend builder slice is implemented in
  `lib/backend/portfolio-analyzer.ts`.
- Backend tests are implemented in
  `tests/backend/portfolio-analyzer.test.ts`.
- The builder now supports local quick-scan results for:
  - `security`
  - `portfolio`
  - `account`
  - `recommendation-run`
- The route defaults to bounded cache reuse (`prefer-cache`, 15 minutes) and
  supports `refresh` for future explicit re-run controls.

Security quick scan should use:

- mobile security detail data
- held-position aggregate
- asset-class target/current drift
- quote freshness
- account placement context
- security identity fields

Portfolio quick scan should use:

- portfolio health summary
- account drilldowns
- holding drilldowns
- target allocation
- recommendation constraints
- account type and currency distribution

Recommendation-run quick scan should use:

- recommendation v2 output
- recommendation constraints
- preferred/excluded/security-type matches
- account placement matrix
- contribution amount and suggested actions

Remaining P0-B backend work:

- Service/API adapters now call the quick-scan builders with real user data.
- Protected mobile route exists at `POST /api/mobile/analysis/quick-scan`.
- Flutter API client exposes `createAnalyzerQuickScan(...)`.
- Persistence table `portfolio_analysis_runs` exists in migration `0004`.
- Keep routes bearer-token protected and do not trigger external research.
- Add route-level tests later if the test harness starts covering Next route
  handlers directly. Current schema and builder tests cover the contract and
  local quick-scan behavior.

Remaining before Flutter display:

- Define Flutter DTO/parser for `PortfolioAnalyzerResult`.
- Add compact AI analysis cards to Security Detail and Portfolio Health.
- Decide whether to trigger scan on page load or behind a user button. Current
  recommendation: user-triggered button for cost and latency control.

## P0-C Flutter Plan

Add a compact "AI 分析" section to:

- Security Detail
- Portfolio Health

Render only existing contract sections:

- summary thesis
- scorecards
- risks
- tax notes
- portfolio fit notes
- action items
- freshness/disclaimer footer

Do not expose long-form chat or live research controls until the backend has
cache/worker support.

Current status:

- Reusable Flutter card implemented in
  `apps/mobile/lib/features/portfolio/presentation/ai_analysis_card.dart`.
- Security Detail now shows a user-triggered "AI 标的快扫" card and sends
  `symbol`, `exchange`, `currency`, and `name` to the quick-scan API when
  available.
- Portfolio Health now shows a user-triggered "AI 组合快扫" card for full
  portfolio scope.
- Account-scoped Health pages now show a user-triggered "AI 账户快扫" card and
  send the selected `accountId` to the quick-scan API.
- Results render summary, confidence/source mode, scorecards, risks, tax notes,
  portfolio-fit notes, action items, sources, and non-advice disclaimer.

Next analyzer work:

- Health Score now consumes asset-class bands before the analyzer depends more
  heavily on health output.
- Flutter AI analysis cards expose `重新生成` after the first result and send
  `cacheStrategy: "refresh"` to bypass cached results.
- Account Health and account AI quick scan now separate two lenses:
  `账户内适配` for whether the account is a suitable home for its holdings, and
  `全组合目标参考` for how the account contributes to the total portfolio target.
- Allocation gap copy must state whether the current percentage is above or
  below target. Do not describe an overweight sleeve as "只有".
- Manually QA repeated AI quick scans from a real mobile URL.
- Add cached external research only after cache/worker policy is explicit.

## Deferred Work

P1:

- cached news/institutional research
- explicit user-triggered refresh
- saved analysis history UI

P2:

- Reddit/forum sentiment
- AI-generated narrative synthesis
- portfolio comparison reports

P3:

- background worker queue
- scheduled analysis refresh
- cloud-cost controls and rate limits
