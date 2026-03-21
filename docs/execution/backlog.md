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

2. Portfolio diagnostics depth
   - allocation, concentration, sector, and price freshness are present
   - richer portfolio-health analysis is still missing

3. Import review quality
   - symbol audit and correction exist
   - richer persisted correction workflows and staged review state are still missing

## Planned: Highest Priority Next

| Rank | Feature | Priority | Why now |
|---|---|---|---|
| 1 | Guided allocation setup in Settings | P0-next | The current settings page still expects too much manual portfolio knowledge from beginners. |
| 2 | Recommendation engine v2 | P0-next | The current engine works, but it is still a v1 drift allocator with shallow tax/account-fit logic. |
| 3 | Recommendation explanation improvements | P1 | Recommendation trust will plateau without more structured rationale. |
| 4 | Portfolio health score and radar analysis | P1 | The placeholder exists, but the real scoring output is still missing. |
| 5 | Richer import review persistence | P1 | Import review is functional, but corrections are still too session-bound and light. |
| 6 | Watchlist and target constraints workflow | P1 | Preference storage exists, but the UX and recommendation impact are still too shallow. |
| 7 | Cloud-ready cache / worker boundaries | P1 | Current market-data cache is process-local and import/recommendation work is still synchronous. |

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
| Portfolio diagnostics foundation | In Progress | 5 | 4 | 3 | 5 | Deepen next |
| Funding recommendation engine v1 | Completed | 5 | 4 | 4 | 5 | Upgrade to v2 |
| Guided allocation setup | Planned | 5 | 3 | 3 | 5 | Build next |
| Recommendation explanation improvements | Planned | 4 | 2 | 2 | 5 | Build soon |
| Portfolio health score and radar analysis | Planned | 4 | 3 | 3 | 4 | Build after explanation depth improves |
| Spending overview and transactions | In Progress | 3 | 3 | 2 | 3 | Keep secondary |
| Richer import review persistence | Planned | 4 | 3 | 3 | 4 | Build soon |
| Watchlist and target constraints workflow | Planned | 3 | 2 | 2 | 4 | Build after guided setup |
| Cloud-ready cache and async boundaries | Planned | 3 | 4 | 3 | 4 | Build before scale work |
| Rebalancing optimizer | Deferred | 3 | 5 | 5 | 3 | Push later |
| Historical scoring and simulation | Deferred | 3 | 4 | 4 | 3 | Push later |
| Full budgeting workflows | Deferred | 2 | 5 | 3 | 2 | Push later |
| Advanced market signal integration | Deferred | 2 | 4 | 5 | 2 | Push later |

## Recommended Build Order From Here

1. Guided allocation setup in Settings
2. Recommendation engine v2 rules
3. Recommendation explanation model and structured rationale output
4. Portfolio health score and radar analysis
5. Richer import review persistence and correction state
6. Cloud-ready cache and async job boundaries

## Key Trade-offs

- Keep the product centered on portfolio decision support, not full personal-finance breadth.
- Prefer transparent, rule-based recommendation logic over opaque optimization.
- Keep CSV import as the primary ingestion path until broker integrations are clearly justified.
- Use market-data selectively and cache aggressively to protect provider quotas.
- Add sophistication only where it materially improves trust, correctness, or repeat usage.

## Immediate Next Execution Step

Turn the next milestone into engineering tickets for:

1. guided allocation setup in Settings
2. recommendation engine v2 rules
3. recommendation explanation improvements

