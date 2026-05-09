# Flutter App Architecture

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-05-08

## Objective

Define the initial Flutter app skeleton and screen ownership before the SDK is installed locally.

Primary target platforms now fixed:

- Android
- Web

Deferred:

- iOS native packaging

## App Package Location

- `apps/mobile`

## Initial Module Layout

- `lib/app`
  - app root
  - router
- `lib/core`
  - theme
  - constants
  - shared presentation primitives
- `lib/features/auth`
- `lib/features/overview`
- `lib/features/portfolio`
- `lib/features/recommendations`
- `lib/features/discover`
- `lib/features/import_flow`
- `lib/features/settings`
- `lib/features/spending`

## UI v2 Architecture Direction

The next Flutter UI implementation should follow
`docs/ui/mobile-ui-v2-figma-plan.md` and the approved Figma design:

- `https://www.figma.com/design/aYsiPJ8eybrWa6BcY1peIn`

Design system targets:

- semantic Loo theme tokens, not page-local raw colors
- `Rose Treasury` dark theme first
- `Rose Day` light theme second
- future theme mode setting: `system` / `light` / `dark`
- reusable v2 components before page rewrites

Recommended shared Flutter structure:

- `lib/core/theme`
  - theme tokens
  - light/dark color schemes
  - typography
  - spacing/radius/elevation constants
  - theme mode persistence
- `lib/core/presentation`
  - `LooGlassCard`
  - `LooHeroHeader`
  - `LooMetricCard`
  - `LooDecisionCard`
  - `LooChartCard`
  - `LooKeyValueTable`
  - `LooAccountRow`
  - `LooHoldingRow`
  - `LooWatchlistRow`
  - `LooStatePanel`
  - `LooBottomSheet`
- feature-specific presentation remains under each feature only when the widget
  owns domain behavior rather than generic layout.

Implementation rule: migrate behavior and layout together. A page is not
complete if it looks better but hides accounts, holdings, watchlist entries,
recommendations, or detail navigation that existed before.

## Initial Screen Ownership

### P0

- auth
- overview
- portfolio workspace
- security detail
- recommendations
- discover
- reusable UI v2 theme/component foundation

### P1

- settings
- watchlist management
- account edit
- holding edit
- recommendation runs

### P2

- import entry and import review
- spending depth
- admin or profile maintenance extras

## Navigation Model

Bottom navigation:

- 总览
- 组合
- 推荐
- 导入
- 设置

Secondary routes:

- 发现
- 标的详情
- 账户详情
- 支出

## Backend Consumption Rules

- treat current `app/api/*` endpoints as the first backend surface
- wrap all network access behind Flutter repositories / API clients
- do not let widgets depend directly on raw JSON shapes
- auth strategy must become mobile-safe before wide migration
- UI v2 must not add frontend-only financial calculations that conflict with
  backend-owned decision, allocation, quote, FX, or freshness logic

## Current Limitation

Flutter app and Flutter Web are now active implementation surfaces. The next
large risk is not SDK availability; it is keeping the UI v2 migration behavior
preserving while replacing scattered page-local layout with shared design-system
components.
