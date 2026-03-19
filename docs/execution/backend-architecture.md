# Backend Architecture Baseline

## Objective
Establish a backend foundation that can evolve from mock services to real persistence without forcing UI rewrites.

## Domain boundaries
- Portfolio aggregation
- Recommendation engine
- Spending aggregation
- Import normalization
- Preference profile management

## Core entities
### UserProfile
Represents the current signed-in user context and base currency.

### InvestmentAccount
Stores account wrapper, institution, nickname, market value, and available contribution room.

### HoldingPosition
Stores portfolio positions, asset classification, sector attribution, market value, and performance metrics.

### CashflowTransaction
Stores spending and inflow records used to calculate spending summary, savings rate, and investable cash.

### PreferenceProfile
Stores target allocation, funding priority, transition preference, tax-aware placement, and recommendation behavior.

### RecommendationRun
Stores the generated recommendation payload, assumptions, and contribution context.

### ImportJob
Tracks CSV import state from creation to validation and completion.

## Service flow
1. Route handler receives request.
2. Route handler calls a backend service in `lib/backend/services.ts`.
3. Service orchestrates repositories and transforms raw domain data into view models.
4. Route returns a stable API envelope from `lib/backend/contracts.ts`.

## Why this split matters
- Route handlers stay thin.
- UI contracts stay stable.
- Database migration can happen behind service functions.
- Recommendation logic can be implemented independently from React pages.

## Near-term repository plan
### Mock repository phase
- use in-memory fixtures in `lib/backend/mock-store.ts`
- keep frontend moving while backend contracts stabilize

### Database-backed phase
Replace mock-store access with repositories for:
- accounts
- holdings
- transactions
- preference profiles
- recommendation runs
- import jobs

## Candidate storage model
Recommended first production storage shape:
- Postgres for durable product data
- object storage for raw import files
- background job worker for import normalization and recommendation runs

## Recommended implementation order
1. Implement preference profile persistence.
2. Implement account and holdings persistence.
3. Implement import job creation and normalization.
4. Implement portfolio analytics service.
5. Implement recommendation run generation.
6. Implement spending aggregation from transaction records.
