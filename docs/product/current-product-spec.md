# Loo国的财富宝库 Current Product Spec

Last updated: 2026-05-09

## Purpose

This is the current product specification for Loo国的财富宝库.

Older source documents under `docs/source/` remain useful historical baselines,
but this document is the product-level source of truth for current behavior,
requirements, and near-term feature direction. Execution details, code-level
plans, and QA procedures stay in `docs/execution/` and `docs/guides/`.

## Current Product Thesis

Loo国的财富宝库 is a Flutter-first, Chinese-only, Loo国-themed personal
portfolio decision-support product for a small Canadian investing household.

The core question remains:

`我的下一笔钱应该放到哪里？`

The product should answer that question through private context:

- current holdings and account types
- CAD/USD listing identity and FX display conversion
- investment preferences, constraints, tax/account placement, and cash goals
- quote/history freshness and source credibility
- cached external information and AI explanation boundaries

The product is not trying to become a professional day-trading terminal.
It should help a beginner/intermediate self-directed investor avoid obvious
mistakes, understand context, and make better-researched decisions.

## Platform Direction

- Primary client: Flutter mobile.
- P0 access targets: Android app and Flutter Web URL access for iPhone testing.
- Backend/API: Next.js BFF with PostgreSQL/Drizzle.
- Web app: legacy/reference surface and temporary backend host, not primary UX.
- Cloud target: Vercel for Next.js/API, Neon for Postgres, Cloudflare Workers
  Cron for protected worker endpoints.

## Product Principles

1. Mobile-first information density.
2. Chinese-only UI and Loo国/Loo皇 tone.
3. Backend-owned financial logic; Flutter should render decisions, not invent
   them.
4. Security identity is `security_id` plus `symbol + exchange + currency`, not
   ticker alone.
5. Quote refresh preserves native trading currency; portfolio display converts
   with cached FX only at aggregation/display time.
6. Live/paid external calls must go through worker, cache, quota, and ledger
   boundaries.
7. GPT and AI 大臣 explain, guide, and propose; deterministic backend quick scan
   remains the decision source of truth.
8. User-facing copy must avoid debug/internal terms such as raw provider IDs,
   DTO, sourceMode, fallback, run-analysis, and non-interactive cache jargon.
9. Mobile UI should use progressive disclosure: decision, numbers, charts, and
   clear actions first; long explanations move to expandable sections, AI 大臣,
   or explicit detail screens.

## Mobile UI v2 Direction

The next Flutter design system is Figma-led and should replace the current
scattered Material-style layout with a coherent `Rose Treasury` visual system.

Source design file:

- Figma Design: `https://www.figma.com/design/aYsiPJ8eybrWa6BcY1peIn`

Design direction:

- Keep the Loo国 identity and warm rose/pink brand tone.
- Use a dark `Rose Treasury` theme for the current premium look.
- Add a matching light `Rose Day` theme for future light/dark/system switching.
- Use semantic color tokens, not raw one-off colors inside widgets.
- Prefer dense financial cards, tables, compact charts, decision cards, radar
  health views, and tappable list rows over long prose cards.
- Remove intrusive list badges such as `已更新` / `未持有` from account, holding,
  recommendation, and watchlist rows. Put those details inside the detail page
  or subtle metadata line when actually useful.
- Remove small detail arrows from list rows. The whole row/card should be the
  tap target.
- Technical configuration and source details belong in Settings or advanced
  expandable blocks, not the first fold of Overview, Portfolio, or Security
  Detail.
- The implementation plan and component mapping live in
  `docs/ui/mobile-ui-v2-figma-plan.md`.

### Portfolio / Account / Holding / Security IA

Approved direction as of 2026-05-11:

- The bottom nav remains `总览 / 组合 / 推荐 / 导入 / 设置`.
- `组合` is the overall portfolio dashboard. It should focus on portfolio-level
  health, allocation, concentration, risk, and entry points.
- Account list, holding list, account detail, holding detail, and security
  detail are explicit second-level routes rather than hidden sections inside one
  long Portfolio page.
- `Security Detail` and `Holding Detail` are separate concepts:
  - `Security Detail` is the public/listing research cockpit for facts, quote
    history, key levels, valuation evidence, external intelligence, and
    candidate fit.
  - `Holding Detail` is the user's private position page for account, quantity,
    cost, return, portfolio/account share, and position health.
- Overview links should navigate directly to the intended target: account list,
  holding list, account detail, holding detail, or security research cockpit.
- The mobile app should use declarative routes for these surfaces so Flutter Web
  can eventually support precise URLs.

## Current Core Features

### 1. Authentication And Session

- Mobile login/session persistence exists.
- AI 大臣 chat session continuity exists: closing and reopening the floating
  sheet should restore the latest session, and recent conversations can be
  reopened or deleted.
- Future hardening: revocable refresh tokens and production auth/storage policy.

### 2. Portfolio Overview

- Overview shows total assets, account/holding summaries, chart freshness, Health
  entry points, and Loo国今日秘闻.
- Total asset and chart values must use the same backend aggregation/Fx logic.
- Reference/synthetic curves must not be presented as real market movement.

### 3. Portfolio And Detail Pages

- Portfolio page shows real backend account/holding data and chart freshness.
- Account Detail and Holding Detail exist.
- Security Detail is now the research cockpit surface for a single listing.
- Watchlist chips and recommendation entries must open Security Detail while
  preserving listing identity.
- Allocation, Health, recommendation, and Security Detail fit logic must use
  economic exposure rather than raw listing labels. A CAD/TSX-listed wrapper can
  still route quotes as CAD/TSX while being counted as US Equity, Global Equity,
  Fixed Income, or Commodity / Precious Metals based on its underlying exposure.
  This prevents ZQQ/VFV-style CAD wrappers and CGL.C-style gold products from
  being incorrectly treated as Canadian Equity.

### 4. Loo国研究台 And 智能快扫

Security Detail starts with `Loo国研究台`:

- direct conclusion
- portfolio fit
- data trust
- main reminders
- listing/economic exposure chips
- account/portfolio scope tabs for held securities, where listing-level facts
  stay stable and only the user's holding/account lens changes

The `Loo国研究工作台` smart scan then shows:

- 投资判断
- 当前结论
- 为什么现在看
- 主要护栏
- 判断前提 / 确认事项
- 仓位思路
- 组合适配
- 观察触发点
- 可信度与依据
- 来源详情

Default quick scans are deterministic, backend-owned smart scans. They do not
automatically call external GPT. GPT enhancement is a user-triggered explanation
layer that must not override quick-scan conclusions, guardrails, or position
boundaries.

### 5. Security Decision Layer

The current decision system is backend-first:

- P0.1 Decision Layer DTO: completed.
- P0.2 Guardrail Rules: completed.
- P0.3 Portfolio Fit Engine: completed.
- P0.4 Quick Scan Refactor: completed.
- P0.5 Security Research Cockpit UI: completed.
- P0.6 Evidence & Freshness Layer: completed.
- P0.7 GPT / Minister Boundary Cleanup: completed.
- P0.8 Manual QA SOP: completed.
- P0.9 Minister Session Continuity: completed.
- P0.10 Security Research Cockpit Plan Lock: completed / implementation started.

Decision wording must not be driven by allocation gap alone. Avoided sectors,
low risk capacity, home-purchase/cash goals, stale data, duplicate exposure,
USD/account/tax friction, and missing identity/history can downgrade or block a
candidate.

Unheld securities must still be analyzable. `0%` means not currently held; it is
not a reason to say the app has no context.

The next research-workbench expansion is `Security Research Cockpit /
估值证据链`. It should not become an automated DCF or trading-signal module.
The backend must treat valuation as evidence with confidence and sanity checks,
then combine it with portfolio fit, account/tax constraints, preference
factors, market pulse, and entry key levels. ETF/fund analysis must use macro /
rebalancing / DCA framing rather than stock-style intrinsic price ranges. GPT
and AI 大臣 may explain or discuss the result, but deterministic backend
guardrails remain authoritative.

Current first pass:

- `SecurityResearchDecision` is an additive backend result block; legacy smart
  scan fields remain populated for mobile compatibility.
- `SecurityExposureProfile` is the shared exposure model for listing identity
  vs economic exposure. It includes primary asset class, region, sector, themes,
  listing label, confidence/source notes, and localized explanation copy.
- Security-level facts must be separate from user-specific fit decisions.
  `securityResearchProfile` owns listing-level facts such as valuation
  evidence, key levels, quote/history freshness, market pulse, and evidence
  sources. These facts should remain visible even when `securityResearchDecision`
  says the current user's portfolio has a blocker or guardrail.
- Cached `alpha-vantage-profile` external-research documents can contribute
  valuation anchors such as analyst target, P/E, forward P/E, PEG, P/B, 52-week
  range, dividend yield, market cap, and beta.
- ETF/fund candidates keep an `etf_macro_proxy` path and must not claim
  stock-style intrinsic price targets.
- ETF/fund proxy first pass combines cached profile anchors, target allocation
  gap, and cached market pulse (`FGI/VIX/strategy`) to frame DCA, wait,
  neutral accumulation, or rebalance-watch paths.
- Entry timing first pass uses cached-history key levels and valuation anchors
  only: MA200 when enough history exists, recent/52-week high-low, analyst
  target, 52-week range, and market pulse. It does not synthesize complex
  support/resistance zones. These raw levels must still be mapped into
  user-facing roles (`当前价 / 回撤观察区 / 上方压力 / 估值锚点`) so the mobile
  view reads like a price map rather than an evidence table.
- Action plans now carry explicit priority/status/trigger/evidence fields so
  the UI can distinguish `ready`, `wait`, `blocked`, and `needs_data` without
  recalculating financial logic on the client. Portfolio-fit blockers retain
  veto precedence over attractive valuation evidence.
- Flutter Security Detail now parses and renders this research decision as
  dedicated `研究结论 / 行动计划 / 估值证据 / 关键价位 / 组合适配 / 主要护栏 /
  研究证据` sections. Portfolio/account/recommendation smart scans keep the
  legacy renderer until their own contracts are upgraded.
- `估值证据` should render as a compact evidence dashboard first: target price,
  PE/Forward PE, 52-week range, Beta, market cap, and one extra valuation anchor
  when available. Longer provider summaries, sanity checks, and extra metrics
  should be collapsed behind optional detail sections.
- Security Detail should expose one user-facing `研究资料状态 / 更新` entry for
  quote/history refresh, profile refresh, institutional refresh, and local
  research regeneration. The backend actions stay separate; the mobile UI should
  not scatter separate `刷新报价`、`刷新资料`、`重新生成` buttons across unrelated
  cards.
- The update sheet must show the user-facing manual-refresh boundary: daily
  remaining quota, cache TTL/window, latest task state, and source-specific
  availability for profile vs institutional refresh. Source status must be
  matched by complete security identity and source id, not ticker-only.
- Page load remains cache-only; new provider documents can invalidate old
  quick-scan cache entries so evidence is refreshed without live Flutter calls.

### 6. AI 大臣

AI 大臣 is a cross-page Loo国 steward, not a single-page chatbot.

It should:

- answer questions from Overview, Portfolio, Account/Holding/Security Detail,
  Recommendations, Import, Settings, Health Score, and future Spending pages
- keep multi-turn session history
- use current page hints, recent subject stack, backend Context Resolver, and
  cached Context Packs
- answer feature-help questions such as “这个功能是什么 / 怎么用 / 下一步做什么”
- answer portfolio/security questions using backend context, not raw Flutter UI
  copy
- suggest actions with explicit confirmation instead of silently refreshing,
  saving, importing, or running expensive workers

Long-term target: AI 大臣 should feel like ChatGPT with Loo国/project/user
context, while remaining cost-controlled and auditable.

### 7. Recommendations

Current recommendation direction:

- `Recommendation V2` is deprecated as product-facing language.
- `V2.1 Core` is the deterministic recommendation engine: target allocation,
  account/tax/FX placement, Preference Factors V2, recommendation constraints,
  security identity, and freshness boundaries.
- `V3 Overlay` uses cached external intelligence and market pulse as supporting
  context only. It must not directly override identity rules or target
  allocation.

Recommendations should expose why a candidate matters, whether it is a watch,
review, or possible fit, and what data is missing.

The `推荐` tab is being reframed in mobile copy as `进货`: a compact Loo国
workbench for deciding how the next contribution should enter the treasury.
The product behavior remains rules-first:

- The backend decides from exposure gaps, account/tax fit, FX friction,
  concentration, cash/home goals, and clean security identity.
- Watchlist entries are candidate ideas, not user commands. If a watched
  security is overweight, identity-incomplete, poor-fit, or price-stretched, the
  engine should explain why it was not chosen.
- LLM, AI 大臣, external news, and Daily Briefs are evidence/explanation layers
  only. They must not override deterministic guardrails.

Accepted V3 foundation:

- `Core ETF Universe`: a curated Canadian-investor core pool with
  tax/account-routing metadata. It is the high-trust default candidate set for
  closing allocation gaps.
- `CandidateBrief`: an additive mobile contract for the `进货` workbench. It
  carries compact fields for action (`lump_sum`, `dca`, `wait_pullback`,
  `avoid`), recommended amount, target account, portfolio-impact, badges,
  blockers, rejection reason, and future Daily Brief references.
- `Daily Brief Worker`: planned as deterministic snapshot diffing first. It
  compares guardrail, valuation, key-level, and market-pulse state over time.
  GPT summaries should be optional or triggered only by material changes.

Next V3 engine rule:

- `CandidatePoolPolicy` is the hard eligibility gate before scoring. It uses
  Preference Factors V2, recommendation constraints, account availability,
  clean identity, economic exposure, concentration, liquidity/cash goals, and
  provider confidence to decide which candidates may enter the ranking.
- If the user's hard filters are too strict and remove every candidate, the app
  should not fabricate or force a default recommendation. It should show
  `进货规矩过严，暂无可推荐标的`, list the blockers, and let the user explicitly
  relax the rule set.
- Fallback is allowed only after user confirmation, should be limited to
  high-confidence core-pool candidates, and must be visibly labeled as
  `放宽规则后的核心池候选`.
- Dynamic provider discovery belongs to workers and a reviewed candidate
  registry. Low-confidence or identity-incomplete rows belong in `待鉴定包裹`,
  not the main recommendation list.

### 8. Preferences

Investment preferences support:

- guided beginner flow
- manual advanced editing
- Preference Factors V2 for risk, volatility, concentration, sector/style
  tilt, liquidity, cash, tax, home-purchase, and account-placement concerns
- AI 大臣 assisted draft generation as a future/ongoing flow

AI-generated preference changes must be shown as a draft for confirmation before
being applied.

### 9. Discover And Watchlist

Discover/search should return only supported CAD/USD North American listings for
now. Search, watchlist, recommendations, and detail navigation must preserve
`symbol + exchange + currency` and resolved `security_id`.

Unsupported listings should be filtered or clearly rejected rather than shown as
usable candidates.

### 10. Data And Market Providers

Current data model:

- canonical `security_id` registry
- aliases for provider/exchange/MIC variations
- underlying-vs-listing separation
- native-currency quote storage
- separate FX cache for CAD display conversion
- price history by listing identity
- persisted provider limits and worker ledgers

Provider strategy:

- OpenFIGI is identity/alias support.
- Alpha Vantage profile is the first bounded structured external data adapter.
- Alpha Vantage institutional earnings is the second bounded structured adapter
  for company-style earnings context.
- Twelve Data / Yahoo-style quote paths exist behind provider boundaries.
- Raw news/forum/search feeds are not the first provider target.

### 11. Loo国今日秘闻

Daily intelligence is cached, not live page-load research.

Current placement:

- Overview has the full `Loo国今日秘闻` card.
- Recommendation page shows lightweight external-material status and item-level
  related intelligence.
- Portfolio page should not duplicate the full card.
- Security Detail does not show the full news card. Single-security research
  stays in `Loo国研究台`; overview-level news remains on Overview/Recommendation
  surfaces to avoid repeated provider calls.

Current provider direction:

- Alpha Vantage `NEWS_SENTIMENT` is the first real news adapter.
- The adapter writes `news` documents into `external_research_documents`.
- Flutter reads cached daily intelligence only; it must not trigger live news
  calls while rendering Overview.
- If Alpha Vantage is used, news calls share the same real provider API key
  quota as profile/earnings calls. Product copy and Settings should keep daily
  news cache status separate from manual security profile/earnings refreshes.

Planned next step: cloud-smoke the worker with `source=news`, verify at least
three cached news/intelligence cards, then decide whether a separate news
provider such as Finnhub/NewsAPI is needed for better quota isolation.

### 12. Cloud And Workers

Current direction:

- Vercel: Next.js/API backend.
- Neon: Postgres.
- Cloudflare Workers Cron: scheduled calls to protected worker endpoints.
- Queue is deferred until cron + DB ledger is insufficient.

Worker-managed areas:

- market data refresh
- FX refresh
- security metadata refresh
- external research/profile documents
- daily overview intelligence
- provider usage and retry-after status

Normal page load must not trigger expensive live research or quota-consuming
background jobs.

### 13. Import And Spending

Mobile Import should preserve the current guided/manual flow and omit mobile CSV
unless explicitly requested.

Brokerage import should use one simple `券商同步` entry instead of separate
IBKR / Wealthsimple tabs. The unified flow is:

1. select or connect a brokerage source
2. pull account, holding, cash, transaction, dividend, and fee data into a
   review draft
3. resolve every security by `symbol + exchange + currency`
4. show an import preview/diff
5. write to the ledger only after explicit user confirmation

Provider priority:

- `IBKR Flex Query` is the first build target. It is suitable for personal IBKR
  account/holding/cash/transaction imports, but not for realtime quotes.
- `Wealthsimple via SnapTrade` is the first feasibility spike. Before a formal
  integration, verify Wealthsimple coverage, returned investment fields,
  account/currency fidelity, OAuth/reconnect behavior, and free-plan limits.
- `Plaid` and `Flinks` remain backup research paths. They should not be
  implemented before SnapTrade feasibility is known.

The architecture source of truth for this P1 flow is
`docs/execution/brokerage-import-architecture.md`. It defines draft quarantine,
unresolved-security blockers, idempotency keys, snapshot import modes, and
cross-provider conflict handling.

Future spending/cash-account monitoring is planned after investment and AI
foundations are stable. Cash/spending accounts should eventually support
Monarch-like transaction visibility, but this is not current P0.

## Current P0/P1 Priorities

### P0 Next

1. Finish the active Overview UI v2 QA/polish pass and keep the mobile surface
   compact, non-debug, and phone-readable.
2. Lock `P0.10 Security Research Cockpit / 估值证据链` architecture before
   coding the next analysis feature.
3. Run cloud scheduled daily-overview profile/institutional smoke and verify
   Overview, Recommendation, Settings worker status, and AI 大臣 context.
4. Add explicit single-security manual intelligence refresh on Security Detail
   with daily quota and TTL reuse.
5. Broaden security metadata provider QA from held securities to watchlist and
   non-held candidates.

### P1

1. Mobile UI / IA v2 implementation from the approved Figma design.
2. Security Research Cockpit / 估值证据链 implementation:
   backend DTO, valuation evidence, ETF macro proxy, entry key levels,
   action-plan orchestration, and Flutter research UI first passes are
   implemented; next work is manual QA, visual polish, and deeper provider data.
3. AlphaPick screenshot ingestion as a reviewed OCR/import pipeline.
4. IBKR Flex Query import and Wealthsimple/SnapTrade feasibility spike under the
   unified `券商同步` flow.
5. Per-account AI 大臣 opt-in.
6. Minister usage/cost dashboard.
7. Persist draggable 大臣 button position.
8. Spending/cash-account monitoring.

## Related Execution Docs

- `docs/execution/backlog.md`
- `docs/execution/ai-portfolio-analyzer.md`
- `docs/execution/security-research-cockpit.md`
- `docs/execution/cloud-deployment-strategy.md`
- `docs/execution/cloud-deployment-runbook.md`
- `docs/execution/market-data-provider-strategy.md`
- `docs/execution/recommendation-v3-external-intelligence.md`
- `docs/guides/mobile-manual-qa-sop.md`
