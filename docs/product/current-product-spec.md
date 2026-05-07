# Loo国的财富宝库 Current Product Spec

Last updated: 2026-05-07

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

### 4. Loo国研究台 And 智能快扫

Security Detail starts with `Loo国研究台`:

- direct conclusion
- portfolio fit
- data trust
- main reminders
- listing/economic exposure chips

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

Decision wording must not be driven by allocation gap alone. Avoided sectors,
low risk capacity, home-purchase/cash goals, stale data, duplicate exposure,
USD/account/tax friction, and missing identity/history can downgrade or block a
candidate.

Unheld securities must still be analyzable. `0%` means not currently held; it is
not a reason to say the app has no context.

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
- Security Detail shows strict listing-matched intelligence only.

Planned next step: daily worker refresh for overview-level intelligence, plus a
bounded single-security manual refresh with daily quota and TTL reuse.

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

Future spending/cash-account monitoring is planned after investment and AI
foundations are stable. Cash/spending accounts should eventually support
Monarch-like transaction visibility, but this is not current P0.

## Current P0/P1 Priorities

### P0 Next

1. Run cloud scheduled daily-overview profile smoke and verify Overview,
   Recommendation, Settings worker status, and AI 大臣 context.
2. Add one bounded announcement/filing/earnings-calendar style adapter behind
   worker/cache/quota/document boundaries.
3. Add explicit single-security manual intelligence refresh on Security Detail
   with daily quota and TTL reuse.
4. Broaden security metadata provider QA from held securities to watchlist and
   non-held candidates.
5. Finish production cloud validation for Vercel env, Cloudflare cron secret,
   worker smoke runs, Settings status, and provider usage visibility.

### P1

1. Mobile UI / IA overhaul.
2. AlphaPick screenshot ingestion as a reviewed OCR/import pipeline.
3. Per-account AI 大臣 opt-in.
4. Minister usage/cost dashboard.
5. Persist draggable 大臣 button position.
6. Spending/cash-account monitoring.

## Related Execution Docs

- `docs/execution/backlog.md`
- `docs/execution/ai-portfolio-analyzer.md`
- `docs/execution/cloud-deployment-strategy.md`
- `docs/execution/cloud-deployment-runbook.md`
- `docs/execution/market-data-provider-strategy.md`
- `docs/execution/recommendation-v3-external-intelligence.md`
- `docs/guides/mobile-manual-qa-sop.md`
