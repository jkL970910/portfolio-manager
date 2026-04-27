# Loo国的财富宝库

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Loo国的财富宝库 is now a Flutter-first mobile product for self-directed investors. The project keeps the original portfolio decision-support thesis, but it no longer treats the web app as the long-term primary client.

The core question remains:

`我的下一笔钱应该放到哪里？`

## Current Direction

- primary client: Flutter mobile app
- backend baseline: existing Next.js + PostgreSQL implementation
- product language: Chinese only
- product identity: Loo皇 / Loo国 only
- web status: reference implementation and temporary backend host, not the future primary UX

## Product Scope

The product still combines:

- portfolio analytics
- recommendation workflows
- spending visibility
- import and normalization workflows
- investment preference configuration
- watchlist and candidate-security analysis

## What We Are Preserving

The migration does not reset product progress. The Flutter rewrite must preserve:

- authentication
- dashboard
- portfolio workspace
- recommendations
- spending
- import
- settings
- market-data search and quote refresh
- watchlist and candidate scoring

The roadmap also stays consistent with the current implementation state:

1. preserve current MVP feature coverage
2. finish the highest-value unfinished backend/product work
3. migrate the main UX to Flutter
4. then deepen AI-agent, cloud, and market-data capabilities

## Current Build Status

This repository is in `alpha migration planning` stage.

Implemented already in the current codebase:

- authenticated login and local registration
- PostgreSQL schema and Drizzle-backed repositories
- dashboard, portfolio, recommendations, spending, import, settings, and discover surfaces
- recommendation runs persisted to the database
- direct CSV import with preview, mapping, symbol audit, correction, confirm, replace, and merge
- guided import with account creation, manual holdings entry, and single-account CSV import
- account detail, unified symbol detail, and account/holding repair workflows
- market-data search, quote lookup, batch refresh, and symbol + exchange + currency quote identity routing
- Flutter mobile investment preference editing for risk profile, target allocation, account priority, tax-aware placement, cash buffer, and rebalance tolerance
- Flutter mobile guided investment preference setup and health score drilldown
- Flutter mobile recommendation regeneration plus watchlist management
- watchlist persistence and candidate-scoring baseline

Still important to finish:

- real historical performance completion
- richer import review persistence
- watchlist and target-constraint deepening
- candidate scoring and recommendation explanation depth on mobile
- reusable mobile chart foundation for asset allocation and price-history views
- cloud-ready cache / worker boundaries

## New Execution Order

1. update docs and planning to the Flutter-first direction
2. stabilize backend contracts for Flutter
3. define the mobile navigation and Flutter design system
4. migrate dashboard, portfolio, security detail, recommendations, and discover
5. migrate settings, edits, and import workflows
6. deepen AI-agent and cloud infrastructure later

## Design Direction

UI work should follow these rules:

- mobile-first before desktop density
- Chinese-only copy
- strong Loo皇 theme instead of generic fintech minimalism
- explicit visual personality with disciplined information hierarchy
- `awesome-design-md` references may inform the Flutter visual system, but they do not replace repo docs as the source of truth

## Repository Role

Today this repository contains:

- the current Next.js implementation baseline
- backend route handlers and service logic
- product and execution docs
- future Flutter migration direction

The repo is now the source of truth for:

- product scope
- backend behavior
- migration sequencing

It is not the long-term commitment to a web-first frontend.

## Key Docs

- `docs/execution/flutter-mobile-migration-plan.md`
- `docs/execution/backlog.md`
- `docs/execution/frontend-backend-implementation-path.md`
- `docs/source/prd.v1.md`
- `docs/source/brd.md`
- `docs/source/information_arch.md`
