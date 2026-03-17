# Portfolio Manager MVP Backlog Prioritization

## Prioritization Goal

The current product goal is to help a self-directed investor import portfolio data, define a target strategy, understand portfolio health, and decide where new capital should go. Features are prioritized using four criteria:

- impact on the core user outcome
- implementation effort
- delivery risk
- strategic alignment with the MVP

Scoring scale:
- Impact: 1 low to 5 high
- Effort: 1 low to 5 high
- Risk: 1 low to 5 high
- Alignment: 1 low to 5 high

## Top 5 Recommended Features

| Rank | Feature | Impact | Effort | Risk | Alignment | Recommendation |
|---|---|---:|---:|---:|---:|---|
| 1 | Account and holdings import | 5 | 3 | 2 | 5 | Build first |
| 2 | Investment preferences settings | 5 | 3 | 3 | 5 | Build first |
| 3 | Unified portfolio dashboard | 5 | 3 | 2 | 5 | Build in MVP |
| 4 | Portfolio diagnostics | 5 | 3 | 3 | 5 | Build in MVP |
| 5 | Funding recommendation engine v1 | 5 | 4 | 4 | 5 | Build in MVP, but keep rules simple |

## Rationale For Top 5

### 1. Account and Holdings Import

Why it is first:
- no data means no product value
- unlocks every downstream workflow
- import-first is feasible without live integrations

Trade-off:
- do not wait for broker API integration

### 2. Investment Preferences Settings

Why it is second:
- recommendations are not trustworthy without explicit user preferences
- target allocation, account priorities, and cash buffer are core inputs
- creates the product logic needed for future health scoring

Trade-off:
- start with manual setup first if guided setup creates too much MVP risk

### 3. Unified Portfolio Dashboard

Why it is third:
- creates immediate visible value after import
- gives users confidence that their data is correct
- serves as the overview surface for wealth, alerts, and recommendation summary

Trade-off:
- keep dashboard as an overview page, not a full recommendation page

### 4. Portfolio Diagnostics

Why it is fourth:
- helps users understand what is wrong before suggesting what to do next
- supports trust in the recommendation engine
- provides strong differentiated value over generic finance apps

Trade-off:
- focus on a few high-signal analyses first: allocation, concentration, sector exposure, and performance

### 5. Funding Recommendation Engine v1

Why it is fifth:
- this is the core differentiator
- directly answers the product's main user question
- drives repeat usage when users contribute new money

Trade-off:
- ship a transparent rule-based engine before advanced optimization

## Secondary Scope For Early Releases

| Feature | Why it matters | Release tendency |
|---|---|---|
| Guided allocation setup | Lowers friction for beginners and improves trust in target allocation | P1 unless MVP can absorb it |
| Spending overview and transactions | Supports investable cash awareness without becoming the product core | P1 |
| Recommendation explanation improvements | Increases trust and clarity | P1 |
| Portfolio health score and radar analysis | Strong strategic value, but depends on stable preference and diagnostic inputs | P1 |

## Deprioritized For Initial MVP

| Feature | Why it is deprioritized |
|---|---|
| Full budgeting parity with finance apps | High scope, weak differentiation, and distracts from the core investment decision workflow |
| Deep transaction categorization rules | Useful but not critical to capital allocation decisions |
| Rebalancing optimizer | High complexity and high trust burden for early product stage |
| Historical scoring and simulation | Better for later maturity, not for first user validation |
| Real-time integrations | Expensive and not required to validate the core workflow |
| Market signal integration | High uncertainty and not needed for first release |

## MVP Release Backlog

### P0: Must Ship

1. Account and holdings import
2. Investment preferences settings
3. Unified portfolio dashboard
4. Portfolio diagnostics
5. Funding recommendation engine v1

### P1: Should Ship If Stable

1. Guided allocation setup
2. Watchlist and target constraints
3. Recommendation explanation improvements
4. Spending overview and transactions
5. Portfolio health score and radar analysis

### P2: Defer

1. Rebalancing optimizer
2. Advanced market signal integration
3. Full budgeting workflows
4. Historical portfolio scoring extensions

## Recommended Build Order

1. Data model for accounts, holdings, transactions, watchlist, and preferences
2. CSV and manual import flow
3. Investment preferences settings and saved target allocation
4. Dashboard with wealth overview and recommendation summary
5. Portfolio diagnostics calculations and alerts
6. Recommendation rules engine
7. Guided setup and spending support once the core loop is stable

## Key Trade-offs

- Choose import-first over integration-first
- Choose rule-based guidance over black-box optimization
- Choose portfolio decision support over finance platform breadth
- Choose settings transparency over hidden defaults
- Choose spending support as a secondary workflow, not the product identity

## Next Execution Step

Turn the P0 backlog into engineering tickets with explicit acceptance criteria and dependencies. The first technical milestone should end with a user who can import data, configure a target allocation, and see a trustworthy dashboard and recommendation summary in one session.
