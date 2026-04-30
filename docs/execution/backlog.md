# Loo国的财富宝库 Execution Backlog

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-30

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
| 2    | Cloud-ready quote/FX worker boundaries        | Planned     | Quote, FX, history, and snapshot refresh should move out of user-facing request paths with quota budgeting and retry behavior before heavier AI-agent jobs depend on them.       |
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
| Cloud-ready cache / worker boundaries     | In Progress | First-pass market-data refresh worker, persisted run ledger, mobile Settings run-status readout, and DB-backed provider retry-after guard exist; next is cron/cloud scheduling before heavier AI-agent jobs                                                                                |
| Quote-provider status UX                  | In Progress | Refresh results, Settings, holding rows, price-history records, and persisted provider-limit snapshots now expose source/status lineage; remaining work is deeper per-provider dashboards                                                                                                  |
| Loo国 AI Minister assistant               | In Progress | Backend and Flutter first-pass page-context DTOs exist; global floating 大臣 entry receives Overview/Portfolio/detail/Health context; Settings can switch Local/GPT-5.5, choose official OpenAI or OpenRouter-compatible provider, save encrypted BYOK API key, and surface usage/retry/failure observability |
| P0.5 external consultation skill pipeline | In Progress | The uploaded `portfolio-analyzer.skill` is productized as cached/guarded analysis work. Next priority is proving it on real cached market data before enabling live external research adapters or UI-heavy redesign.                                                                        |
| Recommendation V2.1 preference fit        | In Progress | V2 now starts consuming Preference Factors V2 for light candidate ordering and explanation while preserving deterministic target-allocation/account-placement behavior.                                                                             |
| Recommendation V3 external intelligence   | In Progress | See `docs/execution/recommendation-v3-external-intelligence.md`. Mobile now labels the cached-intelligence layer as `V3 Overlay / V2.1 Core` when saved external/local analysis is available. |
| Loo国今日秘闻                             | In Progress | Curated cached-intelligence card exists for holdings/watchlist/recommendation candidates. It is source/freshness-aware and still must not become a raw news feed.                                                                            |

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
| Security Identity Registry                   | P0       | Canonical `security_id` registry with exchange aliases, provider symbols, underlying-vs-listing separation, and DB unique constraints. This replaces ticker/exchange string fallback as the final identity solution. |
| Per-investment-account AI Minister opt-in    | P1       | Let users enable/disable GPT analysis per TFSA/RRSP/FHSA/Taxable/account instance after global BYOK flow is stable |
| Persist draggable Minister button position   | P1       | Current drag position is session-local; persist later after UX settles                                             |
| Minister usage/cost dashboard with estimates | P1       | Current logs store provider/model/status/token counts; cost estimates can be added after pricing policy is fixed   |
| Mobile UI / IA overhaul                      | P1       | Large visual/content hierarchy pass after true data, provider status, AI analysis, and external-consultation skill flows are stable |

## Recommended Build Order From Here

1. Stabilize P0.5 real-data foundations: scheduled quote/history/FX refresh, provider retry-after persistence, and source/freshness lineage that AI can trust.
2. Complete Security Identity Registry P0 before deeper Recommendation V3 scoring: canonical `security_id` must become the shared join key for holdings, price history, recommendations, AI analysis, and external intelligence.
3. Run the external consultation / `portfolio-analyzer.skill` pipeline on cached real market data first; keep live external research disabled until worker/cache/provider quota policy is proven.
4. Align AI 标的分析 and AI 大臣: AI 标的分析 produces structured saved analysis; 大臣 answers cross-page questions, explains current context, and references or triggers saved analysis instead of duplicating a full report.
5. Define Recommendation V3 external-signal contracts before adding live news/forum adapters.
6. Extend Preference Factors V2 with AI 大臣问答式参数生成, using the same payload as the manual Flutter editor.
7. Add a local/cached `Loo国今日秘闻` API before live provider integration.
8. QA the real mobile URL for GPT-5.5/BYOK, cached-external analysis, provider status, history hydration, and CAD/USD identity separation.
9. Continue backend contract typing for detail pages and AI context DTOs so mobile stops relying on page-level `Map<String, dynamic>` parsing.
10. Harden mobile auth with revocable refresh tokens and production storage policy.
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

Guardrails:

- CAD/USD listings must remain separate `security_id` values.
- Provider aliases such as `TSX`, `XTSE`, `Toronto Stock Exchange`, and
  `XBB.TO` must point to the same canonical listing.
- Listing-level facts include price, history, quote provider, refresh status,
  FX, and chart freshness.
- Underlying-level facts include company/fund news, broad thesis, industry
  context, and non-price external research.

- `0015_market_data_provider_limits` persists provider retry-after windows so
  multi-process/cloud refresh jobs do not immediately forget `429` responses
  after restart.
- External consultation cached market-data now filters price history by
  `symbol + exchange + currency`, not ticker alone.
- AI 标的/组合/账户快扫 now consumes cached quote lineage, security price
  history, and portfolio snapshot freshness when available. Analysis results
  expose `quoteSourceSummary`, `quoteFreshnessSummary`, price-history point
  counts, fallback counts, and market-data sources so stale/reference data is
  visible instead of hidden inside the AI explanation.
- Mobile Recommendations now includes a first-pass `Loo国今日秘闻` card sourced
  from cached analysis runs. This is an intelligence overlay only: it does not
  automatically change deterministic V2.1 ordering, and it must not trigger
  live news/forum research on page load.
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
- Loo国大臣 prompts now carry fact source tags and explicitly prefer
  `analysis-cache` / `cached-external` facts when present.
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
