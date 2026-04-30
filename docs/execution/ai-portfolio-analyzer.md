# Loo国 AI Minister Integration

Last updated: 2026-04-30

## Purpose

This document converts the uploaded `portfolio-analyzer.skill` into a product
implementation plan for `portfolio-manager`.

The skill is useful as an analysis blueprint, but it should not be installed or
executed directly inside the app. The product needs stable backend-owned JSON
contracts that Flutter can render consistently.

## Product Goal

Add a structured AI-assisted "Loo国大臣" layer for a Canadian investor across
the whole mobile product. The agent is not limited to investment-preference
recommendation or a standalone analyzer page. It should be able to answer
context-aware user questions and explain what the user is seeing from any major
feature surface, including:

- overview / dashboard
- portfolio workspace
- account detail
- holding detail
- single security detail
- portfolio health
- recommendation explanations
- import and symbol validation
- settings / investment preferences
- future spending and cash-account monitoring

The first implementation remains deterministic and local where possible. It
should use existing portfolio, health, recommendation, quote, preference,
import, and market-identity data. Live news, institutional research,
Reddit/forum sentiment, and long-running AI generation are deferred until
cache/worker boundaries exist.

## Product Role: Loo国大臣

The AI agent should behave as a product-owned assistant role:

- It answers user questions in Chinese using the Loo国 / 大臣 theme.
- It explains page-specific data in beginner-friendly language.
- It can propose drafts, next steps, and warnings, but must not silently mutate
  real user settings or portfolio data.
- It must ground every answer in a structured page context DTO rather than
  scraping Flutter widgets or relying on free-form page text.
- It must preserve the current product boundary: AI explains and drafts;
  backend validators and explicit user confirmation decide what is saved.

Initial page-context examples:

| Page / Feature            | Minister context input                                                                           | Useful answers                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Overview                  | net worth metrics, trend freshness, FX context, health score, top accounts/holdings              | "为什么总资产变化了？", "哪些数据是参考曲线？", "今天最该检查什么？"              |
| Portfolio                 | account cards, holding cards, asset-class allocation, quote lineage, chart freshness             | "哪个账户偏离最大？", "USD/CAD 换算怎么影响总资产？", "哪些报价可能过期？"        |
| Account Detail            | account scope, holdings, account-level health, account-vs-total score lens                       | "这个账户适合放哪些资产？", "为什么账户评分和总组合评分不同？"                    |
| Holding / Security Detail | resolved identity, exchange, currency, quote status, price chart, target drift, related holdings | "这是美股正股还是 CAD 版本？", "为什么价格没有刷新？", "这个标的在组合里做什么？" |
| Recommendations           | recommendation run, constraints, strategy, watchlist, candidate scoring                          | "为什么推荐这个？", "为什么没有推荐某个标的？", "排除/偏好规则如何影响结果？"     |
| Import                    | manual account/holding draft, symbol search/resolve result, exchange/currency validation         | "我应该选哪个交易所？", "为什么不能只填 ticker？", "CAD CDR 和 USD 正股区别？"    |
| Settings / Preferences    | preference profile, guided session, draft, validation, constraints                               | "我该选什么风险等级？", "目标配置为什么要合计 100？", "这个偏好会怎样影响推荐？"  |
| Future Spending           | cash account, transactions, budget/rhythm signals                                                | "这笔支出影响现金缓冲吗？", "是否需要调整投资金额？"                              |

This means current DTO work must model AI context as a first-class contract, not
as a future bolt-on. Mobile pages should gradually expose reusable context DTOs
that can be sent to the minister API when the user explicitly asks a question.

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
- External research is disabled by default. Requests with
  `includeExternalResearch: true` must fail clearly until cache TTL and worker
  policy are configured.

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

Future cross-page minister contracts should be added as product-owned backend
contracts rather than Flutter-only shapes:

- `LooMinisterPageContext`
- `LooMinisterQuestionRequest`
- `LooMinisterAnswerResult`
- `LooMinisterSuggestedAction`
- `GuidedPreferenceSession`
- `PreferenceDraft`
- `PreferenceDraftValidation`

The first page-specific context contracts should reuse existing typed DTOs where
possible instead of inventing parallel shapes. For example, Overview,
Portfolio, Import, Recommendations, and Settings preference DTOs should become
valid sources for minister context.

Current status:

- First backend contract slice exists in
  `lib/backend/loo-minister-contracts.ts`.
- Backend invariant tests exist in
  `tests/backend/loo-minister-contracts.test.ts`.
- First Flutter context DTO slice exists in
  `apps/mobile/lib/features/shared/data/loo_minister_context_models.dart`.
- Flutter model tests exist in
  `apps/mobile/test/loo_minister_context_models_test.dart`.
- The contract currently covers:
  - cross-page `LooMinisterPageContext`
  - `LooMinisterQuestionRequest`
  - `LooMinisterAnswerResult`
  - `LooMinisterSuggestedAction`
  - security identity preservation with `symbol + exchange + currency`
  - explicit confirmation for mutating / refresh / run-analysis actions
  - disabled live external research until worker/cache policy is enabled
  - reference-curve honesty, so reference charts cannot be marked as local real
    movement

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

| Skill step                  | Product interpretation                                                           | First implementation |
| --------------------------- | -------------------------------------------------------------------------------- | -------------------- |
| Asset classifier            | Use existing `securityType`, `assetClass`, `exchange`, and `currency` fields     | Local only           |
| Market data fetch           | Use cached quote/market identity already in backend                              | Local only           |
| Fundamentals / ETF holdings | Future external research module                                                  | Deferred             |
| News / macro sentiment      | Future cached external research                                                  | Deferred             |
| Factor score engine         | Deterministic scorecards from existing fields first                              | P0-B                 |
| Event / catalyst analysis   | Future cached external research                                                  | Deferred             |
| Risk guardrail              | Use concentration, currency, account placement, quote freshness, and constraints | P0-B                 |
| Portfolio fit               | Use current holdings, health summary, recommendations, and account types         | P0-B                 |
| Forum sentiment             | Future worker/cached module                                                      | P2                   |
| Report generator            | JSON result rendered by Flutter cards                                            | P0-C                 |

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
- Mobile Settings now exposes `AI 最近分析`, a compact history view backed by
  `portfolio_analysis_runs`.
- External research guard exists in `lib/backend/portfolio-external-research.ts`.
  It rejects live research by default and requires an explicit long-cache policy
  before any external adapter can run.
- External research policy is now product-owned and visible to mobile clients:
  `/api/mobile/analysis/external-research-policy` exposes manual-trigger-only
  status, cache TTL, daily run cap, per-run symbol cap, worker/provider adapter
  readiness, and the current source allowlist. The default state remains
  `未启用`, with all live sources disabled.
- Account Health and account AI quick scan now separate two lenses:
  `账户内适配` for whether the account is a suitable home for its holdings, and
  `全组合目标参考` for how the account contributes to the total portfolio target.
- Allocation gap copy must state whether the current percentage is above or
  below target. Do not describe an overweight sleeve as "只有".
- Manually QA repeated AI quick scans from a real mobile URL.
- Next analyzer work: implement a real background worker queue and persisted
  usage counters before enabling any external research adapter.
- Background research for that queue/cost layer is recorded in
  `docs/execution/external-research-worker-background-research.md`.
- Migration `0005_external_research_jobs` adds the DB-backed job ledger and
  usage counters. Mobile Settings now reads today's external research usage
  through `/api/mobile/analysis/external-research-usage`; enqueue remains
  guarded off until a worker adapter and provider source are implemented.
- External research job repositories now expose worker lifecycle methods:
  `claimNext`, `markSucceeded`, and `markFailed`.
- Local no-op worker command exists:
  `npm run worker:external-research:once`. It claims one ready job and marks it
  failed safely while providers remain disabled, without calling external APIs.
- Mobile Settings can now read recent external research job status through
  `/api/mobile/analysis/external-research-jobs/recent`, so queued/running
  /failed states are visible before provider integration.
- Cached `market-data` provider adapter exists in
  `lib/backend/portfolio-external-research-providers.ts`. It only reads local
  holdings and cached price history, never external APIs. It requires all
  external-research env flags plus
  `PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA=enabled`.
- Worker success now normalizes cached provider output into
  `portfolio_analysis_runs` and marks the job succeeded.
- Admin-only smoke enqueue command exists:
  `npm run worker:external-research:enqueue-smoke -- --user-id <uuid>`.
  It creates a queued cached market-data job for local worker validation, keeps
  `symbol + exchange + currency` in the request, and does not call external
  APIs.
- Local Postgres smoke validation passed for `VFV + TSX + CAD`: worker created
  a `cached-external` analysis run and did not mix in ticker-only/USD cached
  data when CAD price history was absent.
- Mobile recent external-research jobs expose a readable target label such as
  `VFV · TSX · CAD` in addition to the internal cache key, so QA can verify
  identity separation from the Settings page.
- Mobile Settings QA passed for recent external-research job visibility after
  the local smoke run.
- `AI 最近分析` now exposes compact result details on mobile, including
  scorecards, risks, action items, sources, source mode, and the non-advice
  disclaimer.

## Deferred Work

P1:

- cached news/institutional research
- explicit user-triggered refresh
- saved analysis history detail/drilldown
- background worker queue and persisted usage counters for external research
- cached-external result detail visibility if mobile needs drilldown
- standardized chart DTO migration, starting with Security Detail. See
  `docs/execution/mobile-chart-contracts.md`.

P2:

- Reddit/forum sentiment
- AI-generated narrative synthesis
- portfolio comparison reports

P3:

- scheduled analysis refresh
- cloud-cost controls and rate limits
