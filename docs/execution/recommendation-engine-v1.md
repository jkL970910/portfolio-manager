# Recommendation Engine V1

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.


## Objective

Document the current rule-based recommendation engine exactly as it exists in the codebase so future engine work can extend it without guessing at hidden assumptions.

## Current implementation location

- `lib/backend/services.ts`
- main entry point: `createRecommendationRun(userId, input)`

## Current scope

The current engine answers one question:

- where should the next contribution go?

It does not attempt full portfolio optimization, tax minimization, sell-side rebalancing, or security-level ranking across a live market universe.

## Inputs

The engine currently uses:

- signed-in `userId`
- current investment accounts
- current holdings
- saved preference profile
- saved target allocation
- contribution amount in CAD

For auto-generated baseline runs after import, the engine also uses:

- recent transaction history
- cash buffer target

## Supporting functions

### Current allocation calculation

`getCurrentAllocationFromHoldings(holdings)`:

- sums total holding market value
- groups holdings by `assetClass`
- converts each asset-class total into a current allocation percentage

### Account selection

`getRecommendedAccountType(accounts, profile, assetClass)`:

- checks the user's `accountFundingPriority`
- prefers account types with remaining contribution room
- falls back to `FHSA -> TFSA -> Taxable` for `Cash`
- otherwise falls back to the first account or `Taxable`

This is a simplified account-fit heuristic, not a full tax-aware placement engine.

### Auto contribution amount

`getAutoRecommendationAmount(profile, transactions)`:

- looks at the latest available transaction month
- computes inflows minus outflows
- subtracts one-twelfth of the configured annual cash buffer target
- rounds to the nearest `500`
- enforces a minimum baseline of `2500`

This is used after successful imports to create a refreshed baseline recommendation run.

## Core recommendation algorithm

`createRecommendationRun(userId, input)` currently executes these steps:

1. Load accounts, holdings, and preference profile for the signed-in user.
2. Fail fast if the user has no accounts or no holdings.
3. Compute current asset-class allocation from holdings.
4. Resolve the target allocation from saved preferences, or fall back to the default allocation for the saved risk profile.
5. Calculate `gapPct` for each target asset class:
   - `gapPct = max(0, targetPct - currentPct)`
6. Keep only underweight asset classes.
7. Sort underweights by largest gap first.
8. Keep the top 3 priorities.
9. If nothing is underweight, fall back to the top 3 target sleeves by target weight.
10. Split the contribution amount across these priorities in proportion to their gap sizes.
11. For each recommended sleeve:
    - choose a target account type
    - attach static ticker options for that asset class
    - generate a rule-based explanation string
12. Persist the run and items to the database.

## Current ticker selection model

Ticker suggestions are static lookups, not dynamically ranked securities.

Current map:

- Canadian Equity: `VCN`, `XIC`
- US Equity: `VFV`, `XUU`
- International Equity: `XEF`, `VIU`
- Fixed Income: `XBB`, `ZAG`
- Cash: `CASH`, `PSA`

## Persisted outputs

Each run is stored as:

- `recommendation_runs`
  - `user_id`
  - `contribution_amount_cad`
  - `assumptions`
  - `created_at`

Each item is stored as:

- `recommendation_items`
  - `recommendation_run_id`
  - `asset_class`
  - `amount_cad`
  - `target_account_type`
  - `ticker_options`
  - `explanation`

## Current assumptions model

Each run stores a short assumptions list. The current assumptions explain:

- which risk-profile target allocation was used
- that account funding priority affects account placement
- whether tax-aware placement was enabled

This gives the frontend enough context to show a transparent recommendation summary, but it is not yet a full explanation trace.

## Current strengths

- user-scoped and persistent
- grounded in saved preference data
- uses actual holdings drift instead of static templates
- produces repeatable ranked outputs
- refreshes automatically after successful imports

## Current limitations

### Allocation logic

- only allocates new money
- does not recommend sells
- does not solve for full rebalance paths

### Tax and account fit

- tax-aware logic is shallow
- no Canadian tax wrapper matrix by asset class
- no account-level optimization beyond simple priority and room checks

### Security selection

- ticker options are static
- no watchlist-aware ranking yet
- no product-level filtering or cost logic

### Portfolio constraints

- no minimum trade threshold logic
- no lot-size or transaction-cost modeling
- no hard exclusion constraints beyond what the preference profile already stores

### Explainability

- explanations are generated from a small rule set
- no structured rationale object yet
- no dimension-level scoring tie-in to future portfolio health analysis

## Recommended V2 upgrade path

1. Make account-fit explicit by asset-class and account-type matrix.
2. Expand tax-aware placement from a flag into real rule objects.
3. Use watchlist and user constraints inside ticker selection.
4. Add structured rationale fields:
   - allocation gap
   - account rationale
   - tax rationale
   - constraint match
5. Distinguish baseline refresh runs from user-triggered recommendation runs more clearly.

## Related files

- `lib/backend/services.ts`
- `app/api/recommendations/route.ts`
- `app/api/recommendations/runs/route.ts`
- `lib/backend/view-builders.ts`
