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

This repository is in an active Flutter-first alpha build stage. The mobile app,
Next.js BFF, Postgres data model, worker/cache boundaries, and AI decision
support surfaces are all under active implementation.

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
- canonical `security_id` identity registry for listing-safe quote/history,
  recommendations, intelligence, and AI analysis joins
- AI quick scan decision layer with deterministic guardrails, portfolio fit,
  evidence/freshness display, GPT enhancement, and Loo国大臣 handoff boundary
- Loo国大臣 cross-page chat with session continuity and recent conversation
  recovery
- Neon/Vercel/Cloudflare-ready worker boundaries for market data, metadata, FX,
  external research, and cached daily intelligence

Still important to finish:

- real historical performance completion
- cloud production validation for scheduled workers and provider status
- broader metadata/provider QA for watchlist and non-held candidates
- one bounded announcement/filing/earnings-style external information adapter
- mobile UI / IA overhaul after the current data and AI foundations stay stable
- richer import review persistence and future spending/cash-account depth

## New Execution Order

1. keep Flutter mobile as the primary client and Next.js as the BFF/API host
2. preserve listing identity through `symbol + exchange + currency` and
   canonical `security_id`
3. keep financial decisions in backend contracts, not page-level Flutter logic
4. route live/paid data through worker, cache, quota, and ledger boundaries
5. keep GPT and Loo国大臣 explanation-oriented; deterministic quick scan remains
   the decision source of truth
6. continue mobile UI/IA cleanup only after data trust, AI, and cloud behavior
   stay reliable

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
- Flutter mobile implementation and migration direction

The repo is now the source of truth for:

- product scope
- backend behavior
- migration sequencing

It is not the long-term commitment to a web-first frontend.

## Key Docs

- `docs/product/current-product-spec.md`
- `docs/product/requirements-index.md`
- `docs/execution/flutter-mobile-migration-plan.md`
- `docs/execution/backlog.md`
- `docs/execution/frontend-backend-implementation-path.md`
- `docs/source/prd.v1.md`
- `docs/source/brd.md`
- `docs/source/information_arch.md`
