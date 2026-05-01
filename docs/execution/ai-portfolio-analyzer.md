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

- It is the user's Loo国 steward / 管家, not a single-page helper. Its long-term
  job is to explain the product, the user's portfolio data, and the current
  decision context across all features.
- It answers user questions in Chinese using the Loo国 / 大臣 theme.
- It explains page-specific data in beginner-friendly language.
- It should support follow-up questions like ChatGPT, with conversation memory
  scoped to the user's explicit chat session and grounded in current backend
  context rather than stale UI text.
- It can propose drafts, next steps, and warnings, but must not silently mutate
  real user settings or portfolio data.
- It must ground every answer in a structured page context DTO rather than
  scraping Flutter widgets or relying on free-form page text.
- It must preserve the current product boundary: AI explains and drafts;
  backend validators and explicit user confirmation decide what is saved.

Target mature behavior:

- Explain project features and how to use them, including Import, Discover,
  Recommendations, Health Score, Preferences, quote refresh, cached intelligence,
  and future Spending.
- Answer feature-specific questions using the active page context, for example
  why a chart is stale, why a recommendation was selected, or why an account
  score differs from total-portfolio health.
- Answer candidate-investment questions using current exposure, target
  allocation, Preference Factors V2, latest recommendation path, account/tax/FX
  fit, cached intelligence, and data freshness. A 0% holding should be treated
  as "not currently held", not as "cannot analyze".
- Help users understand and refine Preference Factors V2 through guided Q&A,
  then show a structured draft for confirmation before applying changes.
- Reference saved AI 标的/组合/账户 analysis when available instead of
  regenerating a full report inside every answer.
- Maintain clear source boundaries: local cache, stale cache, external
  intelligence, GPT answer, user input, and deterministic backend facts must be
  distinguishable in the response and logs.

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

## P0.5 Focus: Real Data Before UI Overhaul

Current priority is to prove the AI and external-consultation layer against
real cached project data before spending a major slice on UI/IA redesign.

P0.5 work order:

1. Keep quote, price history, FX, and provider status as the source of truth.
   AI must read those cached/backend-owned facts and must not invent freshness
   or live-data claims.
2. Productize the uploaded `portfolio-analyzer.skill` as an external
   consultation pipeline that can run on cached market data first. Live external
   sources stay disabled until worker scheduling, cache TTL, source limits, and
   provider failure handling are proven.
3. Separate the two AI surfaces:
   - `AI 标的分析` produces structured, saved analysis for a
     symbol/account/portfolio scope.
   - `AI 大臣` is the cross-page conversational layer. It answers questions
     using the current page context, cites known source/freshness state, and
     references or triggers saved analysis instead of duplicating full reports.
4. Keep mobile UI polish at P1 until real-data AI flows are reliable enough for
   QA.

## Non-Negotiable Domain Rules

- Keep CAD as the base reporting currency.
- Preserve native trading currency on every holding/security.
- Treat `security_id` as the canonical listing identity. `symbol + exchange +
  currency` is only a strict legacy/audit identity when a registry id is not
  available; never use ticker-only fallback for market data joins.
- Do not merge US common shares with CAD-listed/CDR/CAD-hedged versions by
  symbol alone.
- Native quote data stays in the listing currency; CAD display conversion uses
  the independent FX cache only at aggregation/display time.
- Include source freshness on every analysis result.
- If a source is cached, stale, fallback, or disabled, the AI response must say
  that plainly in Chinese.
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
- Overview now builds a first page-specific minister context through
  `MobileHomeSnapshot.toMinisterContext(...)`, including metrics, health, FX
  context, chart freshness, recommendation theme, and safe allowed actions.
- Portfolio now builds a page-specific minister context through
  `MobilePortfolioSnapshot.toMinisterContext(...)`, including health score,
  quote status, FX context, portfolio chart freshness, account allocation,
  asset-class drift, and safe allowed actions.
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
- Guarded backend question API exists at `POST /api/mobile/minister/ask`.
  It is bearer/session protected, validates `LooMinisterQuestionRequest`, keeps
  live external research disabled, and currently returns a deterministic local
  `LooMinisterAnswerResult`.
- Flutter API client exposes `askLooMinister(...)`.
- Mobile shell now owns a persistent floating `问大臣` entry. Overview and
  Portfolio report their page-context DTOs into the shell, so the same floating
  entry can answer with current page context without injecting a separate card
  into every page.
- Account Detail, Holding Detail, Security Detail, and Health pages now report
  first-pass page-context DTOs into the global minister scope. The floating
  entry remains above pushed detail routes instead of being limited to the
  bottom-tab shell.
- GPT-5.5 / external-model integration should happen server-side through a
  Responses-compatible endpoint. Flutter/Web must never receive the raw API key.
  Keep the deterministic local answer as fallback when the BYOK key is absent,
  invalid, or provider calls are disabled.

API integration plan:

1. Backend env switches now exist: `LOO_MINISTER_PROVIDER_ENABLED=false`,
   `LOO_MINISTER_ALLOW_SERVER_KEY=false`, `LOO_MINISTER_ENCRYPTION_SECRET`,
   `LOO_MINISTER_REASONING_EFFORT=medium`, and
   `LOO_MINISTER_DISABLE_RESPONSE_STORAGE=true`.
   `LOO_MINISTER_OPENROUTER_BASE_URL` optionally sets the default
   OpenRouter-compatible endpoint; the current local setup mirrors the Codex
   router config with `https://openrouter.icu` and Responses wire, while model
   and reasoning effort remain configurable. Current local defaults are model
   `gpt-5.5` and reasoning effort `medium`. User-supplied API keys are encrypted
   server-side before storage.
2. `/api/mobile/settings/ai-minister` exposes Local/GPT-5.5 mode, provider
   selection, model slug, reasoning effort, base URL, BYOK key status, provider
   availability, and recent usage logs to Flutter Settings.
3. `/api/mobile/minister/ask` remains the only Flutter-facing answer endpoint.
   It routes to the selected Responses-compatible endpoint only when the user
   setting, provider env flag, and API key are all present; otherwise it falls
   back to the deterministic local answer.
4. GPT output is parsed back into `LooMinisterAnswerResult` and validated before
   being returned to mobile. Official OpenAI calls can use strict JSON Schema.
   OpenRouter-compatible calls use a single-message plain-text context summary
   with JSON object mode plus the same backend validator, because the current
   router proxy can return 5xx for multi-message Responses input or raw JSON
   context payloads.
5. `loo_minister_usage_logs` records page, mode, provider, model, status, token
   counts when available, retry count, failure kind, and fallback/error
   messages. Flutter Settings surfaces these fields in recent-call rows so QA
   can distinguish provider 5xx, empty output, invalid JSON, and contract
   validation failures without querying the database.
6. Live external research stays disabled until worker/cache/provider quota
   boundaries are production-ready.
7. Per-investment-account AI opt-in is intentionally P1, after the global
   BYOK/user-setting flow is stable.

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
- Quick-scan builders now consume cached market-data lineage when available:
  holding quote provider/status fields, security price history keyed by
  `symbol + exchange + currency`, and portfolio snapshot freshness. Results
  expose quote source/freshness summaries, price-history point counts, fallback
  point counts, and market-data sources.
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
- Service adapters now pass cached price history and portfolio snapshots into
  quick scans. Missing or fallback history lowers confidence and is shown as a
  limitation instead of being hidden.
- Analyzer cache reuse is invalidated when refreshed quote/history/snapshot data
  is newer than the cached AI result. Security Detail also re-runs the visible
  AI quick scan after a successful quote refresh if a result was already shown,
  so stale `缓存行情可信度` scorecards do not remain on screen.
- `缓存行情可信度` now separates "no market cache" from "fresh quote but shallow
  history": a single refreshed quote should lift the score out of the 45-point
  fallback band, while still warning that trend analysis needs deeper history.
- Security analysis cache keys and cached price-history lookup now prefer
  canonical `security_id`. Exchange-label differences such as `TSX` vs
  `Toronto Stock Exchange` must resolve through the registry, not through
  ticker-only or symbol+currency fuzzy fallback.
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
- Cached market-data external consultation now filters local price history by
  the full `symbol + exchange + currency` identity when exchange is available.
  A request such as `VFV + NASDAQ + USD` must not reuse CAD/TSX or exchange-less
  cached history.
- Loo国大臣 prompt construction now includes fact source tags and instructs the
  provider to prefer `analysis-cache` / `external-intelligence` facts when
  present. Backend answer requests automatically enrich page context with up to
  three cached `Loo国今日秘闻` facts, matched by listing identity when the page
  has a resolved security subject. This keeps 大臣 as a cross-page explainer
  over the same analysis layer rather than a duplicate report generator.
- Candidate-buy-fit questions now get a dedicated backend context enrichment:
  current exposure, Preference Factors V2 summary, target allocation, latest
  recommendation match, cached intelligence, and source freshness. This makes
  questions such as "这个标的适合买入吗？" answerable even when the security is not
  currently held.
- Provider retry-after windows are now persisted in
  `market_data_provider_limits`; refresh ledgers can snapshot DB-backed limits
  for Settings QA and later cloud workers.

## Deferred Work

P1:

- cached news/institutional research
- explicit user-triggered refresh
- saved analysis history detail/drilldown
- Recommendation V3 external-intelligence overlay. See
  `docs/execution/recommendation-v3-external-intelligence.md`.
- Loo国今日秘闻 curated daily intelligence feed is now a backend API and 大臣
  context source; next work is broader UI placement outside Recommendations.
- Preference Factors V2 for sector/style/life/tax/cash preferences that can
  improve health score and recommendation scoring.
- production-grade background scheduling and persisted provider-limit behavior
  for external research
- cached-external result detail visibility if mobile needs drilldown
- standardized chart DTO migration, starting with Security Detail. See
  `docs/execution/mobile-chart-contracts.md`.
- multi-turn AI 大臣 chat sessions with user-scoped conversation history,
  bounded summarization, and project-level context injection
- mobile UI / IA overhaul after P0.5 real-data AI/external-consultation flows
  pass QA

P2:

- Reddit/forum sentiment
- AI-generated narrative synthesis
- portfolio comparison reports

P3:

- scheduled analysis refresh
- cloud-cost controls and rate limits
