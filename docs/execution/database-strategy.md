# Database Strategy

## Chosen path
- Primary database: PostgreSQL
- ORM / query layer: Drizzle ORM
- Migration tool: drizzle-kit
- Initial runtime mode: mock repository
- Future production mode: Postgres-backed repositories behind the same service contracts

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
### Current
- `mock`
- implemented via `lib/backend/repositories/mock-repositories.ts`

### Planned
- `postgres-drizzle`
- to be implemented behind `lib/backend/repositories/factory.ts`

## First repository implementations to build
1. `PreferenceRepository`
2. `AccountRepository`
3. `HoldingRepository`
4. `ImportJobRepository`
5. `RecommendationRepository`
6. `TransactionRepository`

## Immediate next backend coding steps
1. install Drizzle + postgres driver
2. add schema files for the tables in `docs/execution/backend-data-model.md`
3. implement repository methods for preferences and accounts first
4. switch `repositoryMode` from `mock` to `postgres-drizzle` once parity is ready
