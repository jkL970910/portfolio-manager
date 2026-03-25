# Portfolio Workspace Roadmap

Last updated: 2026-03-25

## Why this roadmap exists

The product has already crossed the "recommendation prototype" threshold:

- import is usable
- preferences are usable
- recommendation v2 foundation exists
- portfolio health detail exists

The next major gap is not another scoring layer. It is the absence of a true portfolio workspace.

Users can see holdings, but they still cannot comfortably answer:

- which concrete accounts they have
- how those accounts differ
- which holding is driving the portfolio
- what one holding actually looks like in detail
- how to fix bad account structure or imported account mistakes

This roadmap upgrades Portfolio from a diagnostics page into a real account-and-holding workspace.

## Product problem

Current limitations:

1. The Portfolio page is still holding-first, not account-first.
2. Multiple accounts of the same type are visually ambiguous.
3. There is no account detail page.
4. There is no holding detail page.
5. Account-level edits and merge workflows do not exist.
6. Historical portfolio/per-account performance is still placeholder-based, not replayed from events and historical prices.

## Strategic goal

Turn Portfolio into a workspace where users can:

1. understand the structure of their accounts
2. inspect one account in detail
3. inspect one holding in detail
4. fix account and holding structure mistakes
5. eventually see real historical performance, not synthetic placeholders

## Guiding principles

- The account layer comes before the holding layer in the information hierarchy.
- Holding detail should explain what the position is doing inside the portfolio, not only show security facts.
- Editing and merging must be explicit, previewable, and reversible where possible.
- Real performance history should be event-driven, not mocked.

## Roadmap phases

### Phase 1: Account-centric Portfolio foundation

Goal:
- make the account layer legible before adding deep edit flows

Scope:
- clearer account naming rules
- Portfolio account card list
- account-category vs account-instance visualization clarity
- better donut labeling for repeated TFSA / FHSA / RRSP instances
- deep links from charts/cards into concrete account-focused Portfolio filters

User value:
- user can finally tell which account is which
- repeated account types stop collapsing into confusing identical labels
- the Portfolio page feels like a real workspace, not only a holding table

Out of scope:
- account editing
- account merge
- holding detail page
- real historical performance replay

### Phase 2: Detail surfaces

Goal:
- allow real drill-down from portfolio-level issues to concrete objects

Scope:
- account detail page
- holding detail page
- symbol/security icon support
- account-level summary, holdings, allocation, and trend
- holding-level summary, role in portfolio, and basic price history

User value:
- user can click into one account or one holding and understand it
- recommendation and health-score explanations now have concrete destinations

### Phase 3: Edit and repair workflows

Goal:
- let users correct portfolio structure instead of re-importing around mistakes

Scope:
- account metadata edit
- holding edit
- moving holdings across accounts
- account merge flow with preview and confirmation
- edit audit trail

User value:
- users can clean up real-life broker/account structure without deleting and re-importing everything

### Phase 4: Real historical performance

Goal:
- replace synthetic portfolio trend lines with real replayed history

Scope:
- portfolio events table
- security price history
- portfolio snapshots
- real portfolio/account/holding historical value series

User value:
- Dashboard and Portfolio performance charts finally follow the real portfolio

## Recommended execution order

1. Phase 1: account-centric portfolio foundation
2. Phase 2: account detail and holding detail surfaces
3. Phase 3: account and holding edit workflows
4. Phase 4: real historical performance

## Data-model implications

Phase 1 needs:
- stronger account display naming rules
- account grouping support by account type and account instance

Phase 2 needs:
- richer account and holding detail view models
- security display metadata such as icon/logo support

Phase 3 needs:
- account edit flows
- merge logs or account relationship tracking
- holding mutation audit trail

Phase 4 needs:
- `portfolio_events`
- `security_price_history`
- `portfolio_snapshots`

## How this fits the recommendation system

This roadmap does not replace recommendation v2.

Instead it gives recommendation and health-score systems better surfaces:

- recommendation cards can link to the affected account or holding
- health-score drilldowns become actionable
- future account-level recommendation logic becomes more natural

## Phase 1 definition of done

Phase 1 is done when:

1. repeated TFSA / FHSA / RRSP accounts are no longer visually ambiguous
2. Portfolio shows account cards clearly enough that users can understand account structure before opening the holding table
3. account distribution visualizations can distinguish between account category and concrete account instance
4. the Portfolio page feels account-aware, not only holding-aware


## Phase 1 Layout Decisions

- Portfolio uses a two-column workspace: a wide primary column for trend, account rows, and holdings; a sticky right rail for context, health preview, account donut, and next-page actions.
- The account donut no longer exposes a local type/account toggle. It always represents real account instances and follows the currently selected account.
- Account cards use a single-row layout so long account lists do not create empty grid gaps.
- Clicking an account card changes the page context without forcing a scroll jump; the in-card button is the only control that jumps to the holdings table.
- A global floating scroll-to-top control is available across pages through AppShell.
