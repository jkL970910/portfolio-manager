# Security Discovery And Candidate Scoring

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.


## Objective

Turn symbol search, watchlist management, and recommendation-style scoring into a first-class workflow instead of leaving them split across Settings and import-only entry points.

## Why this exists

The current product can:

- persist watchlist symbols
- search symbols during manual holding entry
- score system-selected recommendation candidates

But it still cannot:

- let the user search any symbol from a dedicated page
- let the user add or remove watchlist items directly from discovery flows
- let the user ask, "What does the engine think about this symbol I am considering?"

That makes the recommendation engine feel one-directional. Users can receive recommendations, but they cannot easily bring their own ideas into the same scoring frame.

## Product goal

Let a user:

1. search any security from a dedicated discovery surface
2. open the unified symbol page for that security
3. add or remove it from the watchlist
4. ask the engine to score that candidate using the same decision-support logic already used in recommendation v2

## Scope

### 1. Security discovery page

Route:
- proposed: `/discover` or `/securities`

Core behaviors:
- text search for symbols / names
- result list with:
  - symbol
  - name
  - exchange
  - currency
  - quick watchlist action
  - open-symbol action into `/portfolio/security/[symbol]`

### 2. Watchlist interaction outside Settings

Add watchlist actions to:
- security discovery results
- unified symbol page

Rules:
- Settings remains the bulk-edit location
- discovery and symbol pages become the fast add/remove locations

### 3. Candidate-security scoring

Add a scoring workflow for:
- watchlist symbols
- arbitrary user-selected symbols

Expected output shape:
- security score
- account fit
- tax fit
- FX friction
- concentration or overlap warning
- plain-language summary
- recommendation on whether the candidate looks:
  - strong
  - usable with caveats
  - weak for the current portfolio

### 4. Recommendation engine extension

The engine should support a "candidate scoring" mode that:
- accepts one or more candidate symbols
- evaluates them against the current portfolio and preferences
- reuses the same scoring concepts as recommendation v2
- does not require the symbol to be the engine's default lead candidate

## Suggested backend tasks

1. Add a symbol-search endpoint for dedicated discovery use
2. Add watchlist add/remove endpoints optimized for single-symbol interaction
3. Add a candidate-scoring service in `lib/backend/recommendation-v2.ts` or a sibling module
4. Add a route handler that returns candidate scorecards for one or more requested symbols

## Suggested frontend tasks

1. Create the dedicated discovery page
2. Add search result cards or rows with quick watchlist actions
3. Add watchlist action controls to the unified symbol page
4. Create a candidate-scoring panel that can:
   - score the current symbol
   - score selected watchlist symbols
   - compare a small set of candidate ideas

Implemented now:

- dedicated discovery page at `/discover`
- single-symbol watchlist add/remove from discovery and unified symbol pages
- single-symbol candidate scoring from discovery and unified symbol pages
- batch watchlist comparison inside discovery
- manual comparison for currently selected search results inside discovery
- unified symbol page now supports `1D / 1M / 3M / 6M / 1Y / All` history-range switching on real price data

## Acceptance criteria

1. User can search arbitrary securities from a dedicated discovery route
2. User can add or remove a watchlist symbol from discovery results and from the unified symbol page
3. User can request recommendation-style scoring for a manually selected candidate symbol
4. Scoring output uses the same decision-support language family as recommendation v2
5. The workflow works whether the symbol is already held or not
