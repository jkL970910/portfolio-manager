# Backend Architecture

## Objective
Maintain a backend foundation that supports authenticated, user-scoped portfolio workflows without forcing UI rewrites as persistence and logic deepen.

## Domain boundaries
- Portfolio aggregation
- Recommendation engine
- Spending aggregation
- Import normalization
- Preference profile management
- Market-data integration

## Core entities
### UserProfile
Represents the current signed-in user context and base currency.

### InvestmentAccount
Stores account wrapper, institution, nickname, account currency, native market value, CAD-normalized market value, and available contribution room.

### HoldingPosition
Stores portfolio positions, asset classification, sector attribution, native currency valuation inputs, CAD-normalized analytics values, and performance metrics.

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
2. Route handler resolves the signed-in user session.
3. Route handler validates request payloads and calls a backend service in `lib/backend/services.ts`.
4. Service orchestrates repositories and transforms raw domain data into view models or persisted records.
5. Route returns a stable API envelope from `lib/backend/contracts.ts`.

## Why this split matters
- Route handlers stay thin.
- UI contracts stay stable.
- Database migration can happen behind service functions.
- Recommendation logic can be implemented independently from React pages.

## Current runtime shape

### Auth and user scope
- Auth.js credentials flow
- local registration endpoint
- all major routes and services execute in `user_id` scope

### Repository mode
- current primary mode: `postgres-drizzle`
- page-level mock data has been removed from the runtime path
- repository and service boundaries remain in place so future storage changes do not affect UI contracts

### Implemented write paths
- register user
- patch preference profile
- create recommendation run
- create guided import account
- validate and confirm direct CSV import
- create guided single-account CSV imports
- refresh holding prices from market-data providers
- create, rename, and delete import mapping presets
- apply symbol corrections during import review

## Current external data integration
- OpenFIGI for security normalization
- Twelve Data for search and latest-available quotes
- process-local TTL cache for local and single-instance rate protection

## Current import/runtime behavior
- direct CSV import supports preview, mapping, dry-run validation, symbol audit, correction, and confirm import
- guided import supports:
  - new or existing account selection
  - manual multi-holding entry
  - single-account CSV import with review/confirm
- portfolio accounts and holdings support CAD and USD native currency inputs
- users can switch the global display currency between CAD and USD without changing the underlying CAD-normalized analytics model
- portfolio holdings can refresh batch quotes and persist updated valuation data
- for holding imports, `market_value` is treated as the explicit total value override; if it is present, it wins over `quantity x last_price`

## Candidate storage model
Recommended production storage shape:
- Postgres for durable product data
- object storage for raw import files
- background job worker for import normalization and recommendation runs

## Recommended implementation order
1. Deepen recommendation engine rules beyond drift-only allocation.
2. Add saved guided-allocation outputs in Settings.
3. Move import correction and review into a richer state machine.
4. Add broker or file-source abstractions for future integrations.
5. Split heavy import and recommendation work into background jobs when runtime cost justifies it.
