# Loo国的财富宝库 Execution Backlog

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-05-03

## Objective

Track execution against the new Flutter-first direction while preserving the current feature baseline and development progress.

## Status Legend

- `Completed`: implemented and usable in the current codebase baseline
- `In Progress`: started, but still missing important depth
- `Planned`: agreed direction, not yet migrated or finished
- `Deferred`: intentionally pushed later

## Completed Baseline To Preserve

1. Authentication and user-scoped persistence
2. Account and holdings import foundation
3. Import mapping, preview, validation, and confirm foundation
4. Dashboard / Portfolio / Recommendations / Spending / Import / Settings baseline
5. Investment preferences persistence
6. Recommendation engine baseline
7. Portfolio workspace and repair workflows
8. Market-data search and quote refresh
9. Watchlist persistence and candidate-scoring baseline

These are now migration-preserve items, not features to redefine from zero.

## In Progress

1. Real historical performance completion
2. Security discovery and candidate-scoring depth
3. Spending support depth
4. Import review persistence

## New Migration Priorities

See `docs/execution/mobile-web-parity-and-backend-refactor.md` for the current
Flutter/Web feature gap matrix and why backend refactoring is now prioritized
over simply adding more Flutter screens.

| Rank | Feature                                       | Status      | Why now                                                                                                                                                                   |
| ---- | --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | P0.5 real-data AI / external consultation     | In Progress | Before UI overhaul, make AI 标的分析, AI 大臣, and the portfolio-analyzer skill consume trustworthy cached quote/history/FX/provider data with explicit freshness/source boundaries. |
| 2    | Cloud-ready quote/FX worker boundaries        | In Progress | Protected worker API endpoints now exist. Next is Neon/Vercel/Cloudflare scheduler wiring before real external providers are enabled.       |
| 3    | Recommendation V3 external intelligence       | In Progress | V3 overlay now surfaces cached intelligence and preference-fit explanations on top of deterministic V2.1; next is calibrated scoring from cached external documents.               |
| 4    | Preference Factors V2                         | In Progress | Backend JSONB contract, validation, Flutter manual editor, and guided-draft generation exist; next is AI 大臣问答式参数生成 and V3 deeper scoring.                                      |
| 5    | Market-data identity and validation hardening | In Progress | Current quote/history paths preserve symbol, exchange, and currency; next is provider-grade scheduled history refresh and cached data QA.                                      |
| 6    | Backend contract typing for Flutter           | In Progress | Settings market-data refresh, Overview / Portfolio, Recommendations, Import, and Settings preference profile/guided draft DTOs are typed; continue detail-page DTO depth.       |
| 7    | Recommendation constraints v2                 | In Progress | Backend and mobile now support preferred/excluded identities, account rules, and asset-class bands; next is picker UX and tests.                                                |
| 8    | Mobile auth hardening                         | Planned     | Current token refresh/logout behavior is good enough for MVP, not shared production use.                                                                                        |
| 9    | Mobile spending migration                     | Planned     | Useful after investment core and backend boundaries are stable.                                                                                                                 |
| 10   | Mobile UI / IA overhaul                       | P1 Planned  | Current mobile feature coverage is usable, but QA shows cramped layouts, display shortages, debug-like labels, and unclear content hierarchy. Defer until real-data AI flows pass. |

## Product Roadmap Priorities That Still Matter

| Feature                                   | Status      | Priority Call                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile guided investment setup            | Implemented | First-pass guided draft flow exists in Flutter settings                                                                                                                                                                                                                                        |
| Mobile health score drilldown             | Implemented | First-pass score, charts, holding links, account-type filtered views, and account-scope scoring explanation exist                                                                                                                                                                              |
| Mobile chart foundation                   | Implemented | First-pass reusable line, allocation distribution, health radar, and typed freshness charts for overview/portfolio/account/holding/security/asset-class pages exist                                                                                                                            |
| Mobile UI / IA overhaul                   | P1 Planned  | Large task deferred until P0.5 real-data AI/external-consultation flows are trustworthy: reduce debug-like copy, fix cramped card layouts, improve page content hierarchy, unify status labels, and make primary actions/critical data easier to scan on phone screens                              |
| Mobile asset/security analysis depth      | In Progress | Security detail and asset-class drilldown now include target drift and correction actions                                                                                                                                                                                                      |
| Real historical performance               | In Progress | Quote refresh records daily price history/current-day snapshots, uses independent stored FX rates for CAD aggregation, stores history by symbol+exchange+currency, backfills safe older exchange-less rows, and anchors chart latest points to current totals; next work is scheduled refresh/worker depth |
| Richer import review persistence          | In Progress | Build soon                                                                                                                                                                                                                                                                                     |
| Watchlist and target constraints workflow | In Progress | Mobile can edit watchlist, strategy, tax-aware placement, and account priority constraints                                                                                                                                                                                                     |
| Cloud-ready cache / worker boundaries     | In Progress | First-pass market-data refresh worker, persisted run ledger, mobile Settings run-status readout, DB-backed provider retry-after guard, unified data freshness policy, external-research summary/retry/TTL status, and protected worker API endpoints exist. Cloud target is Neon Postgres + Vercel Next.js/API + Cloudflare Workers Cron, with queue deferred until cron + DB ledger is insufficient. Settings now includes a unified `云端后台任务中心` backed by `/api/mobile/workers/status`, showing market-data, security metadata, external-research, and provider usage ledger status in one place. |
| Quote-provider status UX                  | In Progress | Refresh results, Settings, holding rows, price-history records, and persisted provider-limit snapshots now expose source/status lineage; remaining work is deeper per-provider dashboards                                                                                                  |
| Loo国 AI Minister assistant               | P0 In Progress | Backend and Flutter first-pass page-context DTOs exist; global floating 大臣 entry receives Overview/Portfolio/detail/Health context; backend now auto-enriches answers with cached `今日秘闻` as `external-intelligence`; Settings can switch Local/GPT-5.5, choose official OpenAI or OpenRouter-compatible provider, save encrypted BYOK API key, and surface usage/retry/failure observability. Overview/Portfolio/Health/Recommendations questions now receive a backend-owned `portfolio-context.v1` DTO with total assets/cash, accounts, asset allocation gaps, concentration, Health summary, Preference Factors V2, latest recommendation, cached intelligence, analysis-cache summary, and freshness boundaries. All Security/Holding detail questions receive `security-context.v1` with listing identity, holding exposure, economic exposure, market/freshness, cached intelligence, analysis-cache summary, context completeness, and identity rules. Candidate-buy-fit reasoning uses a derived `candidate-fit.v1` DTO before any GPT/provider call. The fit DTO explicitly separates `candidate-new-buy` vs `existing-holding-review`, current exposure, target gap, Preference Factors V2, latest recommendation match, data freshness, and context completeness. `currentExposure=0` is never a blocking condition; provider answers that still convert 0%/missing page context into “cannot analyze” are replaced by the deterministic local answer and logged as `candidate_fit_quality_guard`. Multi-turn Chat Session first pass now persists session/message history, structured subject history, and recent conversation/project context into follow-up answers. Product-help knowledge and Context Resolver first pass now let 大臣 answer “怎么用/是什么/下一步” and “和 VFV 比呢” style questions by auto-hydrating project/security context before falling back to missing-context messaging. Response-speed second pass now parallelizes independent context enrichment, resolves multiple mentioned tickers concurrently, sends compact OpenRouter-compatible prompts instead of full JSON dumps, and cleans user-facing debug jargon into reader-facing Chinese. Context-pack cache now wraps project knowledge, chat subject history, security mention resolution, cached external intelligence, preference, and latest recommendation reads with explicit TTL/source/freshness metadata behind a cloud-replaceable store interface. Tool-triggered analysis handoff now promotes existing `run-analysis` actions into confirmation-gated suggested actions and, after confirmation, triggers the current page-owned `AiAnalysisCard` rather than asking the user to find the button manually. App-level action routing now supports read-only navigation to Overview/Portfolio/Recommendations/Discover/Import/Settings/Health/Account/Holding/Security destinations, while form/update/refresh actions only route the user to the correct page and still require page-level confirmation. Next P0 is cloud scheduler wiring and deeper feature-specific action handlers where page-level confirmation already exists. |
| P0.5 external consultation skill pipeline | In Progress | The uploaded `portfolio-analyzer.skill` is productized as cached/guarded analysis work. Next priority is proving it on real cached market data before enabling live external research adapters or UI-heavy redesign.                                                                        |
| AI quick-scan readability / exposure split | In Progress | Security quick scan now separates listing identity from economic exposure through shared `security-economic-exposure.ts`, used by AI 快扫, Recommendation V2.1, Health Score, and 大臣 context. CAD-listed US ETFs stay `US Equity` economically; CGL.C / gold / precious-metals instruments are treated as `Commodity` / 商品贵金属 exposure instead of Canadian Equity solely because they are CAD/TSX-listed. Mobile AI result layout is now `核心结论 / 当前分析结论 / 风险护栏 / 组合适配 / 数据依据 / 来源详情`, with debug-like market-data strings kept out of the opening thesis. |
| Security metadata registry                 | P0 In Progress | `securities` now has a cloud-ready metadata layer for `economic_asset_class`, `economic_sector`, `exposure_region`, metadata source/confidence/as-of/confirmed-at/notes. Classification priority is manual/provider high-confidence metadata, then project registry, then conservative heuristic. Metadata refresh now has a provider contract, local project-registry provider, OpenFIGI profile provider boundary, protected worker endpoint, worker script, security-metadata run ledger, provider usage ledger, and mobile Settings review/correction UI. OpenFIGI remains off by default until API key/quota QA passes. Next work is provider QA on real listings and deeper automated coverage for non-held candidates. |
| Recommendation V2.1 Core                  | In Progress | `Recommendation V2` is deprecated as a product-facing version. Current execution is `V2.1 Core`: target allocation, account/tax/FX placement, Preference Factors V2, recommendation constraints, security identity, and data-freshness boundaries. |
| Recommendation V3 external intelligence   | In Progress | See `docs/execution/recommendation-v3-external-intelligence.md`. Mobile now labels the cached-intelligence layer as `V3 Overlay / V2.1 Core` when saved external/local analysis or persisted external research documents are available. |
| Loo国今日秘闻                             | In Progress | Standalone mobile API now combines persisted external research documents and saved analysis runs into a curated feed. Flutter Overview keeps the full daily briefing card, Recommendations uses a collapsed summary entry, Portfolio no longer loads the feed to avoid repetition, and identity-filtered Security Detail keeps the strict listing-level card. It is source/freshness-aware and still must not become a raw news feed. |

## Deferred

| Feature                    | Reason                                      |
| -------------------------- | ------------------------------------------- |
| Full budgeting parity      | Still outside the product core              |
| Automated trading          | Not part of the current thesis              |
| Broker-native integrations | CSV remains the right first boundary        |
| English-mode support       | Explicitly dropped                          |
| Desktop-first web polish   | Explicitly dropped as the primary direction |

## P1 List

| Feature                                      | Priority | Note                                                                                                               |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| Security Identity Registry                   | P0       | Canonical `security_id` registry with exchange aliases, provider symbols, underlying-vs-listing separation, and DB repair tooling. This replaces ticker/exchange string fallback as the final identity solution. |
| Per-investment-account AI Minister opt-in    | P1       | Let users enable/disable GPT analysis per TFSA/RRSP/FHSA/Taxable/account instance after global BYOK flow is stable |
| Persist draggable Minister button position   | P1       | Current drag position is session-local; persist later after UX settles                                             |
| Minister usage/cost dashboard with estimates | P1       | Current logs store provider/model/status/token counts; cost estimates can be added after pricing policy is fixed   |
| Mobile UI / IA overhaul                      | P1       | Large visual/content hierarchy pass after true data, provider status, AI analysis, and external-consultation skill flows are stable |

## Recommended Build Order From Here

1. Stabilize P0.5 real-data foundations: scheduled quote/history/FX refresh, security metadata refresh, provider retry-after persistence, and source/freshness lineage that AI can trust. P0.1 now exposes a unified mobile freshness policy for quote, FX, history, identity, and external intelligence plus external-research retry/TTL status. P0.2 now has protected worker API endpoints for market-data, security-metadata, and external-research execution. P0.3 now has Neon/Vercel/Cloudflare deployment scaffolding, batched market-data worker refresh, security-metadata run ledger, provider usage ledger, mobile `云端后台任务中心`, and mobile `标的资料修正` review flow for manual metadata locks. Current cloud decision: Neon Free for Postgres, Vercel Hobby for Next.js API/BFF, Cloudflare Workers Cron for scheduler, queue deferred until cron + DB ledger is insufficient.
2. Complete Security Identity Registry P0 before deeper Recommendation V3 scoring: canonical `security_id` must become the shared join key for holdings, price history, recommendations, AI analysis, and external intelligence.
3. Run the external consultation / `portfolio-analyzer.skill` pipeline on cached real market data first; keep live external research disabled until worker/cache/provider quota policy is proven.
4. Align AI 标的分析 and AI 大臣: AI 标的分析 produces structured saved analysis; 大臣 answers cross-page questions, explains current context, and references or triggers saved analysis instead of duplicating a full report.
5. Upgrade AI 大臣 Chat Session depth before deeper UI polish: first-pass persisted multi-turn sessions, structured subject history, project-feature knowledge, context resolver/tool registry, staged UI status, user-controlled slow-response fallback, page-context switching guardrails, parallel context enrichment, compact GPT prompt construction, app-level suggested-action routing, and a cloud-replaceable context-pack store interface exist; context-pack cache now reduces repeated project/security/preference/recommendation lookups with explicit TTL/source/freshness metadata. Whole-portfolio questions now use `portfolio-context.v1`; Security/Holding detail questions use `security-context.v1`; candidate-fit reasoning for “这个标的是否适合买入/是否适配” derives from `candidate-fit.v1`, so future work should extend these DTOs rather than reintroduce prompt-only, ticker-only, or current-position-only logic. Next improve deeper feature-specific knowledge and wire Redis/DB store implementation during cloud deployment.
6. Define Recommendation V3 external-signal contracts before adding live news/forum adapters. First real external API should be structured, low-frequency, and cacheable, such as ETF metadata or company fundamentals; raw news/forum/search is later. Current implementation has the metadata-provider contract, OpenFIGI profile provider boundary, worker run ledger, and provider usage ledger, but only the project-registry provider is active by default until API key/quota QA passes.
7. Extend Preference Factors V2 with AI 大臣问答式参数生成, using the same payload as the manual Flutter editor.
8. Add a local/cached `Loo国今日秘闻` API before live provider integration.
9. QA the real mobile URL for GPT-5.5/BYOK, cached-external analysis, Settings freshness policy, provider status, history hydration, and CAD/USD identity separation.
10. Continue backend contract typing for detail pages and AI context DTOs so mobile stops relying on page-level `Map<String, dynamic>` parsing.
11. Harden mobile auth with revocable refresh tokens and production storage policy.
11. Move Mobile UI / IA overhaul to P1 after the data/AI layer is credible.
12. Migrate spending/cash account monitoring into a dedicated mobile flow.

## P1 Mobile UI / IA Overhaul Scope

Treat this as a large product task, not a one-card visual cleanup.

P1 goals:

- Remove debug-like wording from user-facing cards, especially provider internals, raw fallback labels, and implementation explanations that belong in Settings or QA only.
- Fix display shortages on phone screens: avoid truncated labels, oversized values, crowded two-column cards, and floating controls covering content.
- Rebuild detail-page order around user intent: top summary, primary action, real chart/status, then deeper explanation.
- Standardize status language across quote freshness, chart freshness, AI fallback, and provider limits so “needs refresh” is not shown after a successful refresh.
- Keep Loo国 tone, but make it concise and actionable rather than verbose.

P1 follow-up goals:

- Add reusable mobile section/card patterns for dense financial data.
- Add page-specific empty/loading/error states with less technical copy.
- Add visual hierarchy for “real data”, “cached data”, “reference/fallback”, and “action needed”.

## Key Trade-offs

- preserve product progress rather than restarting
- preserve backend domain rules where practical
- move read-heavy flows before complex write-heavy workflows
- keep Chinese-only and Loo皇 theme mandatory
- avoid fake "real-time" promises without sustainable market-data support

## P0.5 Implementation Notes

### Security Identity Registry P0

Goal: replace ticker/exchange-string fallback with a durable canonical security
registry. This is required before Recommendation V3 and external intelligence
can safely combine real market data, cached analysis, and provider research.

Final identity model:

- `securities`: one row per concrete listing, keyed by
  `symbol + canonical_exchange + currency`.
- `security_aliases`: provider/exchange/MIC aliases pointing to exactly one
  `security_id`.
- `underlying_id`: groups related listings for company/fund-level intelligence,
  without sharing listing-level quote/history/FX data.

Implementation status:

1. P0-A complete: registry tables, resolver, alias canonicalization, and tests.
2. P0-B complete: `security_id` backfill exists for holdings, security price
   history, and recommendation items. Old symbol/exchange/currency columns stay
   as audit/display fields.
3. P0-C complete: quote/history refresh writes and reads listing data by
   `security_id`; strict legacy identity matching remains only for requests that
   still lack a resolved registry id.
4. P0-D complete: recommendation items carry `security_id`, canonical exchange,
   MIC, and trading currency into mobile navigation.
5. P0-E complete for listing-level AI cache: analyzer target keys, cached market
   data lookup, and security quick-scan payloads prefer `security_id`. Shared
   `underlying_id` intelligence remains the basis for Recommendation V3 news /
   forum aggregation.
6. P0-F complete: `npm run audit:security-identity` reports missing registry
   ids, duplicate same-listing history rows, and listing-specific alias
   conflicts. It never auto-merges or deletes rows.
7. P0-G complete: `npm run repair:security-identity-duplicates` safely merges
   historical duplicate listing rows created by provider exchange-label drift
   such as `TOR` vs `TSX/XTSE`, moves holdings/price history/recommendation
   items/external research to the surviving canonical `security_id`, normalizes
   price-history exchange fields, removes duplicate alias rows, and supports
   `--dry-run` before applying.

Guardrails:

- CAD/USD listings must remain separate `security_id` values.
- Provider aliases such as `TSX`, `TOR`, `XTSE`, `Toronto Stock Exchange`, and
  `XBB.TO` must point to the same canonical listing.
- Listing-level facts include price, history, quote provider, refresh status,
  FX, and chart freshness.
- Underlying-level facts include company/fund news, broad thesis, industry
  context, and non-price external research.
- Exchange-label aliases alone are not enough to resolve a security. Future
  resolution should use canonical listing identity first, and only use provider
  symbols as direct aliases when symbol/currency validation also matches.

- `0015_market_data_provider_limits` persists provider retry-after windows so
  multi-process/cloud refresh jobs do not immediately forget `429` responses
  after restart.
- Mobile Settings now exposes a `标的资料修正` card. It reviews current user's
  held securities, highlights low-confidence/unconfirmed metadata, supports
  bounded metadata refresh, and lets the user manually confirm asset class,
  sector, region, and notes. Manual confirmation writes source `manual`,
  confidence `100`, and `confirmed_at`, so later registry/provider refreshes do
  not overwrite user-confirmed classification.
- External consultation cached market-data now filters price history by
  `symbol + exchange + currency`, not ticker alone.
- AI 标的/组合/账户快扫 now consumes cached quote lineage, security price
  history, and portfolio snapshot freshness when available. Analysis results
  expose `quoteSourceSummary`, `quoteFreshnessSummary`, price-history point
  counts, fallback counts, and market-data sources so stale/reference data is
  visible instead of hidden inside the AI explanation.
- Mobile Recommendations now includes a first-pass `Loo国今日秘闻` card sourced
  from persisted external research documents and cached analysis runs. This is
  an intelligence overlay only: it does not automatically change deterministic
  V2.1 ordering, and it must not trigger live news/forum research on page load.
- `GET /api/mobile/intelligence/daily` now provides the same curated feed as a
  standalone mobile contract. Flutter Overview displays the full daily briefing,
  Recommendations displays a collapsed summary entry, Portfolio no longer loads
  the feed to avoid duplicating the overview/recommendation surfaces, and
  identity-filtered Security Detail displays a strict listing-level card from
  that API; account/holding detail reuse remains a P1 UI expansion, not a
  backend rewrite.
- Loo国大臣 answer requests now auto-read that curated feed server-side and add
  up to three `external-intelligence` facts. If the current page has a resolved
  security subject, the enrichment first matches the same `symbol + exchange +
  currency` listing.
- Recommendation priority cards now attach cached intelligence references by
  canonical identity first. Exact `security_id` matches are `当前上市版本情报`;
  exact `symbol + exchange + currency` remains a strict fallback for older
  records; unresolved ticker-only matches are downgraded to `底层资产情报` so
  company/fund context can be reused without pretending that quote, FX, or
  freshness data belongs to the current listing.
- When cached intelligence is present, mobile recommendations label the engine
  as `V3 Overlay / V2.1 Core`: external intelligence is visible as coverage and
  related-secret references, while V2.1 target-allocation/account/tax rules
  remain the execution baseline.
- Recommendation priorities now carry an explicit V3 overlay score DTO:
  `baselineScore`, `preferenceFitScore`, `externalInsightScore`, `finalScore`,
  `signals`, and `riskFlags`. Current weighting is conservative at 70% V2.1
  baseline, 15% Preference Factors V2, and 15% cached intelligence.
- When a V3 match comes from a persisted external research document, cached
  intelligence scoring uses document `confidence`, `relevanceScore`,
  `sourceReliability`, and `riskFlags` instead of only the older fixed
  source/scope/freshness heuristic.
- External research now has a source-agnostic structured document contract for
  future news/announcement/forum/institutional adapters. Documents carry source
  type, identity scope, TTL, confidence, sentiment, relevance, reliability, key
  points, and risk flags. Ticker-only documents are unresolved and cannot be
  used as listing-level evidence.
- Security metadata now has a source-agnostic provider contract and worker
  boundary. `npm run worker:security-metadata:once` refreshes known securities
  through enabled providers; `/api/workers/security-metadata/run` exposes the
  same cloud-protected endpoint using `PORTFOLIO_WORKER_SECRET`. The only
  enabled provider by default is the project registry; future FMP/Twelve
  Data/ETF-profile adapters must use the same contract and must not run on page
  load.
- Cached market-data external research now writes a structured
  `external_research_documents` record through the worker and mobile
  Recommendations reads fresh records directly for V3 overlay matching. This is
  the closed-loop P0.5 path before live news/forum adapters are introduced.
- Loo国大臣 prompts now carry fact source tags and explicitly prefer
  `analysis-cache` / `external-intelligence` facts when present.
- `0016_preference_factors` adds the first Preference Factors V2 storage
  boundary. The current slice is backend-only: safe defaults, validation, and
  persistence for behavior, sector/style tilt, life goals, tax strategy,
  liquidity, and external-info preferences. Recommendation V3 and Flutter
  editing will consume it in later slices.
- Recommendation V2.1 now consumes a bounded subset of Preference Factors V2:
  preferred/avoided sectors, style/thematic tilts, risk capacity,
  concentration tolerance, and near-term home-purchase risk buffer. This only
  adjusts candidate ordering/explanation; it does not override target
  allocation.
- Recommendation cards now expose `偏好契合` and `进阶偏好因子` directly in the
  scoreline/constraint sections, so users can see whether sector/style, buy-home,
  or concentration preferences affected the recommendation.
- Flutter Settings now has a `进阶` preference editor and the guided setup flow
  generates a visible Preference Factors V2 draft before applying it. Manual
  config remains the source of truth; AI-guided parameter generation should
  reuse the same payload and display a diff before applying.
- The `进阶` editor now includes a Loo国大臣 draft helper. The helper can call
  GPT-5.5 when the user's AI Minister provider is enabled, otherwise it falls
  back to a deterministic local draft. In both cases it only fills the form;
  the user must explicitly save before preferences change.
- Investment preference entry points are simplified to two user-facing paths:
  `新手引导` for questionnaire/AI-assisted setup, and `手动进阶` for users who
  want to directly edit basic allocation, recommendation rules, and advanced
  factors.
- `新手引导` must cover the full Preference Factors V2 surface, not only the old
  five allocation questions. It should include sector/style tilts, buy-home
  planning, tax priority, USD funding path, liquidity, and external information
  consent. AI 大臣 assistance belongs inside this beginner flow as a structured
  draft helper before the user applies changes.
