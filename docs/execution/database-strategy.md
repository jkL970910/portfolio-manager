# Database Strategy

## Chosen path
- Primary database: PostgreSQL
- ORM / query layer: Drizzle ORM
- Migration tool: drizzle-kit
- Current runtime mode: Postgres-backed repositories behind the same service contracts
- Local developer database: PostgreSQL running on the local machine for seeded multi-user testing

## Why PostgreSQL
- Strong relational fit for accounts, holdings, transactions, preferences, and recommendation runs
- Good support for immutable snapshots such as recommendation outputs
- Straightforward aggregation queries for portfolio and spending analytics
- Mature ecosystem for managed hosting and backups

## Why Drizzle
- Fits a TypeScript-first codebase
- Schema stays close to SQL instead of hiding it
- Easier to reason about than a heavier ORM for this stage
- Works well with a repository + service architecture

## Architecture decision
The application should not let React pages or route handlers depend directly on Drizzle or database tables.

The intended stack is:

1. UI pages
2. route handlers
3. service layer
4. repository interfaces
5. Drizzle/Postgres implementation

This keeps the backend replaceable and makes testing easier.

## Repository modes
### Current runtime
- `postgres-drizzle`
- implemented via `lib/backend/repositories/postgres-repositories.ts`

### Legacy fallback in code only
- `mock`
- retained only behind `lib/backend/repositories/factory.ts`
- no page-level mock data remains in the active app runtime
- local development is expected to use the real Postgres path

## Repositories currently in use
1. `UserRepository`
2. `PreferenceRepository`
3. `AccountRepository`
4. `HoldingRepository`
5. `TransactionRepository`
6. `ImportJobRepository`
7. `RecommendationRepository`

## Current persisted tables
- `users`
- `investment_accounts`
- `holding_positions`
- `cashflow_transactions`
- `preference_profiles`
- `allocation_targets`
- `recommendation_runs`
- `recommendation_items`
- `import_jobs`
- `import_mapping_presets`

## Current next backend coding steps
1. add database-backed guided allocation outputs when Settings flow is implemented
2. store richer import review state instead of relying only on dry-run responses
3. persist more structured recommendation rationale for future explainability
4. prepare object-storage and worker boundaries before broker-scale imports
