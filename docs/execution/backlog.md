# Loo国的财富宝库 Execution Backlog

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-25

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

| Rank | Feature | Status | Why now |
|---|---|---|---|
| 1 | Backend contract stabilization for Flutter | Planned | Mobile migration fails if API shape stays web-private. |
| 2 | Mobile auth strategy | Planned | Current auth assumptions are still web-oriented. |
| 3 | Flutter app shell and design system | Planned | New UI work must stop landing in the web shell. |
| 4 | Dashboard / Portfolio / Security detail migration | Planned | These are the highest-frequency user flows. |
| 5 | Recommendations / Discover migration | Planned | They preserve the product's differentiating value. |
| 6 | Settings / account edit / holding edit migration | Planned | High-value write flows come after the mobile read shell is stable. |
| 7 | Import entry and review migration | Planned | Important, but higher-friction and harder to get right on mobile. |

## Product Roadmap Priorities That Still Matter

| Feature | Status | Priority Call |
|---|---|---|
| Mobile guided investment setup | Planned | Build next; it restores web's flow-based preference setup |
| Mobile health score drilldown | Planned | Build after guided setup |
| Mobile chart foundation | Planned | Required for asset allocation and price-history pages |
| Mobile asset/security analysis depth | Planned | Build after chart foundation |
| Real historical performance | In Progress | Keep as top product priority |
| Richer import review persistence | In Progress | Build soon |
| Watchlist and target constraints workflow | Planned | Deepen after discovery baseline |
| Cloud-ready cache / worker boundaries | Planned | Build before heavier AI-agent and quote jobs |
| Quote-provider status UX | Planned | Important before mobile users trust refresh state |
| AI-agent assisted analysis | Planned | Add after mobile shell and async boundaries are ready |

## Deferred

| Feature | Reason |
|---|---|
| Full budgeting parity | Still outside the product core |
| Automated trading | Not part of the current thesis |
| Broker-native integrations | CSV remains the right first boundary |
| English-mode support | Explicitly dropped |
| Desktop-first web polish | Explicitly dropped as the primary direction |

## Recommended Build Order From Here

1. finish docs and planning redirection
2. audit backend contracts
3. choose mobile auth approach
4. create Flutter shell and theme tokens
5. migrate overview, portfolio, security detail, recommendations, and discover
6. migrate settings and repair flows
7. migrate import entry and review
8. deepen AI-agent, cloud, and queue boundaries

## Key Trade-offs

- preserve product progress rather than restarting
- preserve backend domain rules where practical
- move read-heavy flows before complex write-heavy workflows
- keep Chinese-only and Loo皇 theme mandatory
- avoid fake "real-time" promises without sustainable market-data support
