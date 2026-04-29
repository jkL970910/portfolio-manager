# Loo国的财富宝库 Execution Backlog

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-29

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

| Rank | Feature                                       | Status      | Why now                                                                                                                          |
| ---- | --------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Recommendation constraints v2                 | In Progress | Backend and mobile now support preferred/excluded identities, account rules, and asset-class bands; next is picker UX and tests. |
| 2    | Cloud-ready quote/FX worker boundaries        | Planned     | Quote, FX, history, and snapshot refresh should move out of user-facing request paths with quota budgeting and retry behavior.   |
| 3    | Backend contract typing for Flutter           | Planned     | Mobile should stop depending on web-shaped read models and runtime map parsing.                                                  |
| 4    | Market-data identity and validation hardening | In Progress | Current quote/history paths preserve symbol, exchange, and currency; next is provider-grade scheduled history refresh.           |
| 5    | Mobile auth hardening                         | Planned     | Current token refresh/logout behavior is good enough for MVP, not shared production use.                                         |
| 6    | Mobile spending migration                     | Planned     | Useful after investment core and backend boundaries are stable.                                                                  |
| 7    | Remaining mobile polish and parity            | Planned     | Add only after core contracts are safe.                                                                                          |

## Product Roadmap Priorities That Still Matter

| Feature                                   | Status      | Priority Call                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile guided investment setup            | Implemented | First-pass guided draft flow exists in Flutter settings                                                                                                                                                                                                           |
| Mobile health score drilldown             | Implemented | First-pass score, charts, holding links, account-type filtered views, and account-scope scoring explanation exist                                                                                                                                                 |
| Mobile chart foundation                   | Implemented | First-pass reusable line, allocation distribution, health radar, and typed freshness charts for overview/portfolio/account/holding/security/asset-class pages exist                                                                                               |
| Mobile asset/security analysis depth      | In Progress | Security detail and asset-class drilldown now include target drift and correction actions                                                                                                                                                                         |
| Real historical performance               | In Progress | Quote refresh records daily price history/current-day snapshots, uses independent stored FX rates for CAD aggregation, stores history by symbol+exchange+currency, and anchors chart latest points to current totals; next work is scheduled refresh/worker depth |
| Richer import review persistence          | In Progress | Build soon                                                                                                                                                                                                                                                        |
| Watchlist and target constraints workflow | In Progress | Mobile can edit watchlist, strategy, tax-aware placement, and account priority constraints                                                                                                                                                                        |
| Cloud-ready cache / worker boundaries     | Planned     | Next priority: queue worker, quota budgeting, retry-after behavior, persisted provider status, and scheduled FX/quote/history refresh before adding heavier AI-agent jobs                                                                                         |
| Quote-provider status UX                  | In Progress | Refresh results now expose history writes, snapshot recording, and FX as-of/source/freshness; provider limit/stale/fallback status dashboard is still needed                                                                                                      |
| AI-agent assisted analysis                | Planned     | Add after mobile shell and async boundaries are ready                                                                                                                                                                                                             |

## Deferred

| Feature                    | Reason                                      |
| -------------------------- | ------------------------------------------- |
| Full budgeting parity      | Still outside the product core              |
| Automated trading          | Not part of the current thesis              |
| Broker-native integrations | CSV remains the right first boundary        |
| English-mode support       | Explicitly dropped                          |
| Desktop-first web polish   | Explicitly dropped as the primary direction |

## Recommended Build Order From Here

1. Implement scheduled quote/FX/history worker boundaries with quota budgeting.
2. Persist provider status, retry-after, stale/fallback state, and worker run history.
3. Normalize mobile API contracts into typed DTOs instead of page-level maps.
4. Harden mobile auth with revocable refresh tokens and production storage policy.
5. Migrate spending/cash account monitoring into a dedicated mobile flow.
6. Deepen AI-agent analysis after async market-data and research boundaries are stable.

## Key Trade-offs

- preserve product progress rather than restarting
- preserve backend domain rules where practical
- move read-heavy flows before complex write-heavy workflows
- keep Chinese-only and Loo皇 theme mandatory
- avoid fake "real-time" promises without sustainable market-data support
