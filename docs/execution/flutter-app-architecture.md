# Flutter App Architecture

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-25

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

## Initial Screen Ownership

### P0

- auth
- overview
- portfolio workspace
- security detail
- recommendations
- discover

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

## Current Limitation

Flutter SDK is not installed in the local environment yet, so this scaffold is a repository-level starter structure rather than a verified runnable app.
