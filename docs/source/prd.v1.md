# Loo国的财富宝库 Mobile-First PRD

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.
>
> [!NOTE]
> Historical baseline: this PRD preserves the 2026-04-25 mobile-first pivot.
> Current product requirements now live in
> `docs/product/current-product-spec.md`; current priorities live in
> `docs/execution/backlog.md`.

Last updated: 2026-04-25

## 1. Summary

This PRD defines the next shippable product direction for Loo国的财富宝库.

The product is now:

- Flutter-first
- Chinese-only
- Loo皇-themed
- mobile-first in navigation and layout

The product is not restarting from zero. It is carrying forward the current backend, domain logic, feature scope, and roadmap progress from the existing web implementation.

## 2. Core User Problem

The user needs a phone-friendly way to answer:

`我现在持有什么？哪里失衡了？下一笔钱该投到哪里？`

The old web implementation proved the domain shape, but it is no longer the preferred long-term product surface.

## 3. Product Goal

Help a self-directed investor use a mobile client to:

1. review portfolio structure
2. inspect accounts and holdings
3. configure preferences
4. understand spending context
5. generate recommendation guidance
6. compare candidate securities before buying

## 4. Non-Goals

- keeping a full English-mode product
- treating desktop web as the future primary UX
- becoming a full budgeting replacement
- building broker-native automation before mobile core flows are stable

## 5. Core Navigation

Primary mobile navigation:

- 总览
- 组合
- 推荐
- 导入
- 设置

Secondary or nested flows:

- 发现
- 标的详情
- 账户详情
- 支出

## 6. Feature Scope To Preserve

### Must preserve from current implementation

- authentication
- dashboard / overview
- portfolio workspace
- unified symbol detail
- recommendations
- spending support
- import workflows
- settings and preference persistence
- watchlist
- candidate-security scoring
- market-data search and quote refresh

### Must deepen after migration

- real historical performance
- richer import review persistence
- target-constraint and watchlist impact on recommendations
- cloud-ready queue / worker boundaries

## 7. Product Experience Rules

- Chinese copy only
- Loo皇 identity is the default and only narrative frame
- mobile-first information hierarchy
- no desktop-style giant dashboard chrome as the default pattern
- drill-down before overload
- recommendation and quote provenance must remain explicit

## 8. Migration Strategy

### Phase 1

Stabilize backend contracts and auth strategy for Flutter.

### Phase 2

Build Flutter design system and app shell.

### Phase 3

Migrate high-frequency read flows:

- auth
- overview
- portfolio
- security detail
- recommendations
- discover

### Phase 4

Migrate high-value write flows:

- settings
- watchlist actions
- account / holding edits
- recommendation runs
- import entry flows

### Phase 5

Deepen advanced workflows:

- persistent import review
- AI-agent analysis
- cloud hardening
- provider-status UX

## 9. MVP Success Definition

The new mobile-first MVP is successful when:

1. the user can do regular review and decision-making entirely from Flutter
2. the portfolio and recommendation workflows remain as capable as the web baseline
3. the user does not need English-mode support
4. the product identity feels intentionally Loo皇-themed rather than generic fintech
