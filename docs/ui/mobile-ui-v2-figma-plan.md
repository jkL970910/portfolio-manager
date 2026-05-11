# Mobile UI v2 Figma Implementation Plan

Last updated: 2026-05-08

## Purpose

This document is the source of truth for converting the approved Figma UI v2
direction into Flutter screens and reusable components.

The goal is not a surface repaint. The UI v2 work must fix three product
problems at the same time:

- visual quality: move from generic Material-style cards to a premium Loo国
  financial cockpit
- information architecture: make every account, holding, watchlist item, and
  recommendation reachable instead of hiding data behind truncated lists
- information density: replace repeated prose and low-value status cards with
  compact tables, charts, decision cards, and optional AI/deep-dive explanation

## Figma Source

- Design file: `https://www.figma.com/design/aYsiPJ8eybrWa6BcY1peIn`
- Original Make reference:
  `https://www.figma.com/make/kc2PW8X8nnFaUnaeVK9m7r/Loo-King-Design`

Current generated pages:

- `Loo UI v2 Pink Theme`
- `11 Component Library / Rose UI v2`
- `18 Light Theme / Rose Day`

## Visual Direction

### Dark Theme: Rose Treasury

Use this as the first implementation target.

- Background: deep plum / oxblood gradient, not pure black.
- Surface: translucent rose-brown glass cards with subtle borders.
- Accent: brighter rose/pink replacing the original dark-gold emphasis.
- Text: warm ivory for primary text, muted rose-gray for secondary text.
- Data colors: restrained green/red/amber/blue status colors with enough
  contrast on dark surfaces.

### Light Theme: Rose Day

Add after the dark theme foundation is stable.

- Background: warm rose-white, not Material pure white.
- Surface: white/soft blush cards with rose-gray borders.
- Accent: same semantic rose/pink family as dark theme.
- Text: charcoal/plum primary, rose-gray secondary.
- Charts and badges should use the same semantic token names as dark theme.

### Theme Mode

Flutter should eventually support:

- `system`
- `light`
- `dark`

Default should be `system`. Do not hardcode page-specific colors; consume
semantic tokens from the Loo theme layer.

## Component Mapping

| Figma component | Flutter target | Notes |
| --- | --- | --- |
| `HeroHeader` | `LooHeroHeader` | Page first fold, compact subtitle and primary status/action. |
| `GlassCard` | `LooGlassCard` | Base v2 surface. Supports dense and spacious variants. |
| `MetricCard` | `LooMetricCard` | KPI card with value, delta, short context, optional mini chart. |
| `DecisionCard` | `LooDecisionCard` | Deterministic decision labels: `适合考虑`, `继续持有`, `保持观察`, `暂不适合`, `需要数据`. |
| `ChartCard` | `LooChartCard` | Total asset, price history, allocation, and trend sections. |
| `KeyValueTable` | `LooKeyValueTable` | Replace repeated prose/value rows in detail pages. |
| `HealthScoreCard` | `LooHealthScoreCard` | Health score summary with dimension breakdown. |
| `HealthRadarCard` | `LooHealthRadarCard` | Radar view for health dimensions; avoid overlapping timestamp labels. |
| `AccountRow` | `LooAccountRow` | Full row/card tap opens Account Detail. |
| `HoldingRow` | `LooHoldingRow` | Full row/card tap opens Security/Holding Detail. No small arrow required. |
| `WatchlistRow` | `LooWatchlistRow` | Full row/card tap opens Security Detail; actions stay secondary. |
| `SettingRow` | `LooSettingRow` | Compact settings entry with optional status text. |
| `AIQuickScanCard` | `LooAIQuickScanCard` | Decision-first quick-scan display; GPT enhancement is explicit. |
| `MinisterChatBubble` | `LooMinisterChatBubble` | Multi-turn 大臣 chat with compact message groups. |
| `PreferenceDraftCard` | `LooPreferenceDraftCard` | Show generated preference drafts before save. |
| `ImportProviderCard` | `LooImportProviderCard` | Unified `券商同步` provider entry and draft status. |
| `BottomSheet` | `LooBottomSheet` | Used for explanations, filters, and confirmation flows. |
| `Empty/Loading/Error/NeedsData` | `LooStatePanel` | User-facing copy only; no stack traces or provider internals. |

## Page Scope

## Portfolio IA Redesign Decision

Approved direction as of 2026-05-11:

- Keep the bottom nav unchanged: `总览 / 组合 / 推荐 / 导入 / 设置`.
- Do not add separate bottom-nav tabs for accounts, holdings, or securities.
- Make `组合` a focused portfolio dashboard, not a mixed long page that also
  acts as the account list and holding list.
- Split the portfolio domain into explicit routeable surfaces:
  - `/portfolio`: overall portfolio dashboard and health/allocation/risk entry
    points.
  - `/portfolio/accounts`: all-account list and account-level navigation.
  - `/portfolio/accounts/:accountId`: one account's summary, account health,
    allocation, and account-held positions.
  - `/portfolio/holdings`: all-position list and filters.
  - `/portfolio/holdings/:holdingId`: one owned position's cost, return, account
    context, and position health.
  - `/securities/:symbol?...`: security research cockpit for a listing identity;
    preserve `securityId`, `exchange`, and `currency` through query parameters.
- Treat `Security` and `Holding` as separate user concepts:
  - Security Detail owns listing-level facts: quote/history, key levels,
    valuation evidence, profile/fundamentals, external intelligence, and
    candidate-fit research.
  - Holding Detail owns the user's private position: account, quantity, cost
    basis, P/L, account share, portfolio share, and position health.
- Security facts must not be hidden by portfolio/personal guardrails. Portfolio
  fit can affect "is this suitable for me now?", but it must not suppress key
  levels, valuation evidence, or listing facts.
- Overview account/holding entry points should deep-link to the exact list or
  detail target instead of opening the mixed Portfolio page and scrolling to a
  section.
- Implement declarative routing during the first IA split to avoid a second
  migration from `Navigator.push` to deep links later.

### Overview

First fold should answer:

- total assets
- recent trend / freshness
- what needs attention
- high-level daily intelligence

Rules:

- Show complete account entry coverage through a `查看全部` or dense list entry,
  not a hard-coded first 3 only.
- Do not duplicate Settings-style FX policy cards.
- Use concise daily intelligence; deeper source details stay in a drill-down or
  AI 大臣.

### Portfolio

First fold should answer:

- account distribution
- current allocation / health state
- all accounts and holdings entry points

Rules:

- Every account should be reachable.
- Every visible holding/watchlist row should be tappable.
- If the list is long, use search/filter/expand patterns, not silent truncation.
- Dense tables and compact rows are preferred over prose cards.

### Security Detail / Loo国研究台

First fold should answer:

- what listing is this
- what is the current decision
- what changed / what data is fresh
- should the user run or read deeper analysis

Rules:

- Remove intrusive `已更新` / `未持有` badges from the first fold.
- Listing status, held/unheld state, and quote freshness can appear in a subtle
  metadata line or detail section.
- Keep exact `symbol + exchange + currency` visible.
- GPT enhancement is explicit and secondary to deterministic quick scan.

### Account Detail

Use:

- hero summary
- compact metrics
- holdings table/list
- contribution to portfolio risk and health

Do not bury holdings behind long explanatory paragraphs.

### Recommendations

Use:

- decision-first recommendation cards
- portfolio-fit/evidence chips
- compact related intelligence
- direct navigation into Security Detail

Do not re-add a full duplicate `Loo国今日秘闻` card here.

### Import

Use a clear two-level IA:

- `手动同步`
  - manual account
  - manual holding
- `券商同步`
  - IBKR Flex Query
  - Wealthsimple / SnapTrade feasibility path

The page should make manual vs brokerage sync understandable without provider
tabs on the top-level nav.

### Preferences

Keep two paths:

- `新手引导`: questionnaire + AI 大臣 draft assistance, covering all Preference
  Factors V2
- `手动进阶`: direct editing for advanced users or post-guided fine tuning

### Minister

Floating 大臣 remains globally visible. The v2 UI should make chat recovery,
recent sessions, action proposals, and confirmation boundaries obvious without
technical labels.

### Settings

Settings owns:

- theme mode
- AI provider setup
- FX/source/provider details
- worker status
- advanced data-quality tools

Do not surface these as oversized cards on Overview or Portfolio.

### Health

Health v2 should use:

- score hero
- radar chart
- dimension rows
- concise blockers and repair actions

Long explanations should be expandable or delegated to 大臣.

## User-Facing Copy Rules

Avoid primary-surface words:

- `cache`
- `缓存命中`
- `provider`
- `sourceMode`
- `DTO`
- `fallback`
- `run-analysis`
- `worker`
- raw provider IDs
- raw confidence/debug scores without explanation

Allowed when necessary in Settings / advanced details:

- `数据来源`
- `数据新鲜度`
- `后台任务`
- `外部资料`
- `刷新限制`
- `有效期`

## Implementation Order

1. Add Flutter design tokens and theme mode plumbing. Status: first pass
   implemented on 2026-05-08 with `Rose Treasury` / `Rose Day` ThemeData and
   semantic `LooThemeTokens`; app currently defaults to dark mode until the
   Settings toggle is added.
2. Build reusable v2 components under `apps/mobile/lib/core` or a shared
   presentation module before rewriting pages.
   Status: first pass implemented on 2026-05-08 with `LooGlassCard`,
   `LooHeroHeader`, `LooMetricCard`, `LooTappableRow`, `LooKeyValueTable`, and
   `LooStatePanel`.
3. Migrate Overview. Status: first pass implemented on 2026-05-08. The page now
   uses the v2 gradient/card foundation, removes row arrows, makes rows
   whole-card tappable, and no longer hard-limits accounts to 3 or top holdings
   to 5.
4. Migrate Portfolio. Status: first pass implemented on 2026-05-08. The page
   now uses the v2 gradient/card foundation, removes row arrows, shows the full
   returned account and holding lists, and keeps every visible row whole-card
   tappable.
5. Migrate Security Detail / Loo国研究台.
6. Migrate Account Detail and Holding Detail.
7. Migrate Recommendations.
8. Migrate Import and Preferences.
9. Migrate Minister and Settings.
10. Migrate Health.
11. Add light/dark/system setting and final QA.

Each migrated page must preserve current behavior before visual polish is
considered complete.

## Manual QA Expectations

After each major page migration, update `docs/guides/mobile-manual-qa-sop.md`
and provide chat-ready QA steps.

Minimum UI v2 regression checks:

- no horizontal overflow on phone width
- bottom nav and floating 大臣 do not cover primary actions
- every account/holding/watchlist/recommendation entry has a working detail path
- list rows are tappable without relying on arrows
- no debug/internal copy appears in primary cards
- charts and radar cards do not overlap labels
- light/dark theme tokens maintain contrast
- existing AI quick scan, GPT enhancement, and Minister flows still work
