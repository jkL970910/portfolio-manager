# Loo国的财富宝库 Execution Backlog

## Objective

Track execution against the current alpha build, reflect what is already implemented, and clarify the next sequence of work toward a stronger MVP.

## Current Product Goal

Help a self-directed investor:

- import and normalize portfolio data
- configure investment preferences
- understand portfolio health and allocation drift
- connect spending visibility to investable cash
- decide where new capital should go

## Status Legend

- `Completed`: implemented and usable in the current alpha
- `In Progress`: implemented enough to use, but still missing important depth or polish
- `Planned`: not implemented yet, but still part of the near roadmap
- `Deferred`: intentionally pushed later

## Execution Snapshot

### Completed

1. Authentication and user-scoped persistence
   - local registration and login
   - user-scoped API access
   - Postgres-backed persistence

2. Account and holdings import foundation
   - direct CSV import
   - guided import account creation
   - guided single-account CSV import
   - manual multi-holding entry

3. Import review and mapping foundation
   - preview
   - field mapping
   - saved mapping presets
   - dry-run validation
   - confirm import
   - replace / merge modes

4. Core portfolio surfaces
   - Dashboard
   - Portfolio
   - Recommendations
   - Spending
   - Import
   - Settings

5. Investment preferences settings
   - target allocation persistence
   - funding priorities
   - tax-aware placement flag
   - transition preference
   - watchlist symbol persistence

6. Recommendation engine v1
   - drift-based allocation logic
   - account-aware placement heuristic
   - persisted recommendation runs
   - auto baseline recommendation refresh after import

7. Market-data integration v1
   - security search
   - symbol normalization
   - single-quote lookup
   - batch quote refresh
   - portfolio quote freshness and coverage
   - dashboard top-holdings price freshness

## In Progress

1. Spending overview and transactions
   - page exists and is DB-backed
   - deeper categorization and budgeting workflows are still missing

2. Import review quality
   - symbol audit and correction exist
   - richer persisted correction workflows and staged review state are still missing

## Planned: Highest Priority Next

| Rank | Feature | Priority | Why now |
|---|---|---|---|
| 1 | Account and holding edit workflows | P0-next | Users can now inspect accounts and holdings in detail, but still cannot repair duplicate accounts, wrong account mapping, or holding placement mistakes. |
| 2 | Real historical performance | P1 | Portfolio and dashboard trend lines still rely on synthetic history instead of replayed portfolio events. |
| 3 | Richer import review persistence | P1 | Import review is functional, but corrections are still too session-bound and light. |
| 4 | Watchlist and target constraints workflow | P1 | Preference storage exists, but the UX and recommendation impact are still too shallow. |
| 5 | Cloud-ready cache / worker boundaries | P1 | Current market-data cache is process-local and import/recommendation work is still synchronous. |
| 6 | Citizen/profile admin workflow | P1 | The citizen layer exists, but admin override and profile management are still minimal. |

## Deprioritized / Deferred

| Feature | Status | Reason |
|---|---|---|
| Full budgeting parity | Deferred | Too broad and weakly differentiated for the product's core decision-support thesis. |
| Deep transaction categorization rules | Deferred | Useful later, but not required to validate the capital-allocation workflow. |
| Rebalancing optimizer | Deferred | Higher trust burden and higher implementation complexity than the current stage supports. |
| Historical scoring and simulation | Deferred | Better after recommendation and scoring logic become more stable. |
| Advanced market signal integration | Deferred | Not required for core workflow validation. |
| Broker-native integrations | Deferred | CSV import is sufficient for current validation and faster to iterate. |

## Prioritization Table

| Feature | Status | Impact | Effort | Risk | Alignment | Priority Call |
|---|---|---:|---:|---:|---:|---|
| Authentication and user-scoped persistence | Completed | 5 | 3 | 2 | 5 | Keep stable |
| Account and holdings import foundation | Completed | 5 | 4 | 3 | 5 | Keep stable |
| Investment preferences settings | Completed | 5 | 3 | 3 | 5 | Keep stable |
| Unified portfolio dashboard | Completed | 5 | 3 | 2 | 5 | Keep stable |
| Portfolio diagnostics foundation | Completed | 5 | 4 | 3 | 5 | Keep stable |
| Funding recommendation engine v1 | Completed | 5 | 4 | 4 | 5 | Keep as baseline |
| Guided allocation setup | Completed | 5 | 3 | 3 | 5 | Keep stable |
| Chinese-mode citizen identity layer | Completed | 4 | 4 | 3 | 5 | Keep stable |
| Recommendation engine v2 | Completed | 5 | 4 | 4 | 5 | Keep deepening |
| Recommendation explanation improvements | Completed | 4 | 2 | 2 | 5 | Keep refining |
| Portfolio health score and radar analysis | Completed | 4 | 3 | 3 | 4 | Keep refining |
| Portfolio workspace phase 1 | Completed | 5 | 3 | 2 | 5 | Keep stable |
| Account detail and holding detail surfaces | Completed | 5 | 4 | 3 | 5 | Keep stable |
| Account and holding edit workflows | Planned | 5 | 4 | 4 | 5 | Build after detail surfaces |
| Real historical performance | Planned | 5 | 5 | 4 | 5 | Build after edit foundation |
| Spending overview and transactions | In Progress | 3 | 3 | 2 | 3 | Keep secondary |
| Richer import review persistence | Planned | 4 | 3 | 3 | 4 | Build soon |
| Watchlist and target constraints workflow | Planned | 3 | 2 | 2 | 4 | Build after guided setup |
| Cloud-ready cache and async boundaries | Planned | 3 | 4 | 3 | 4 | Build before scale work |
| Rebalancing optimizer | Deferred | 3 | 5 | 5 | 3 | Push later |
| Historical scoring and simulation | Deferred | 3 | 4 | 4 | 3 | Push later |
| Full budgeting workflows | Deferred | 2 | 5 | 3 | 2 | Push later |
| Advanced market signal integration | Deferred | 2 | 4 | 5 | 2 | Push later |

## Recommended Build Order From Here

1. Account and holding edit workflows
2. Real historical performance
3. Richer import review persistence and correction state
4. Watchlist and target constraints workflow
5. Citizen/profile admin workflow expansion
6. Cloud-ready cache and async job boundaries

## Key Trade-offs

- Keep the product centered on portfolio decision support, not full personal-finance breadth.
- Prefer transparent, rule-based recommendation logic over opaque optimization.
- Keep CSV import as the primary ingestion path until broker integrations are clearly justified.
- Use market-data selectively and cache aggressively to protect provider quotas.
- Add sophistication only where it materially improves trust, correctness, or repeat usage.
- Fix account readability before adding more analytics layers.
- Prefer account-first and holding-first drilldowns over adding more summary cards.

## Immediate Next Execution Step

Turn the next milestone into engineering tickets for:

1. portfolio workspace phase 1
2. account detail and holding detail surfaces
3. account and holding edit workflows



