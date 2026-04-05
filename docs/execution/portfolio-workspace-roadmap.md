# Portfolio Workspace Roadmap

Last updated: 2026-03-26

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

Current delivery status:
- account detail page is now implemented at `/portfolio/account/[accountId]`
- holding detail compatibility route remains at `/portfolio/holding/[holdingId]`, but now forwards into the unified symbol page with the matching account context
- security detail page at `/portfolio/security/[symbol]` is now the unified symbol route
- Portfolio account rows now expose a concrete account-detail entry point
- holding symbols in the holdings table now deep-link into the unified symbol page
- dashboard top-holding rows now deep-link directly into the unified symbol page instead of stopping at summary cards
- health-score holding drilldowns still preserve object-level targeting, but now land on the unified symbol page with the matching account preselected
- recommendation detail cards can now deep-link into an existing heavy holding when the explanation is explicitly about not adding more to that position
- recommendation detail cards can now also deep-link into a security detail page for the lead or alternative symbol, even before the user holds it
- the unified symbol page now includes:
  - candidate-security mode when the symbol is not yet held
  - aggregate held-position mode when the symbol is already held
  - compact first-fold account selection that reveals the full held-position review / edit / refresh stack for one account
  - an additional holding-row selector when one account contains multiple rows for the same symbol
  - security identity facts
  - quote-source facts
  - delayed-vs-cached explanation
  - stronger visual security mark treatment
- account detail now includes a compact facts layer so the page immediately answers how many positions live there, which sleeve dominates, and how fresh the account's prices are
- Phase 2 currently covers read-only inspection only; edit and merge remain Phase 3

### Phase 3: Edit and repair workflows

Goal:
- let users correct portfolio structure instead of re-importing around mistakes

Scope:
- account metadata edit
- holding edit
- moving holdings across accounts
- account merge flow with preview and confirmation
- edit audit trail
- holding classification repair:
  - security type
  - exchange
  - market sector
  - asset class override when imported classification is wrong or unresolved

User value:
- users can clean up real-life broker/account structure without deleting and re-importing everything
- users can fix `Unknown` or incorrect holding metadata so downstream health and recommendation logic stays trustworthy

Current delivery status:
- account detail now includes one maintenance panel for:
  - account metadata edit
  - add-holding shortcut that routes into import with the current account preselected
  - same-type merge preview + confirmation
  - delete-account confirmation
- account maintenance now keeps edit, add-holding, and merge inside one shared panel, with account deletion moved to the bottom of edit mode
- account maintenance now stays collapsed until the user picks one maintenance action, so edit / add-holding / merge do not compete on first load
- account edit now uses a single-column form so rail layouts stay readable on narrower widths
- holding detail now includes an edit panel for:
  - name
  - account reassignment
  - currency
  - quantity
  - average cost
  - cost basis
  - current price
  - current value
  - asset class override
  - sector override
  - security type override
  - exchange override
  - market sector override
- holding classification suggestions now explicitly cover gold / commodity / REIT / trust-style securities so common Canadian wrappers do not get forced into `Unknown`
- holding amount repair now auto-derives cost basis and current value from quantity, average cost, and current price until the user manually overrides those derived fields
- merge and edit actions now write to a shared `portfolio_edit_logs` table
- holding classification repair is live and should be treated as part of the Phase 3 baseline
- holding deletion is available from holding detail and returns the user to the parent account after confirmation
- holding saves now invalidate related portfolio/account/dashboard/recommendation routes so parent totals and summaries refresh consistently
- quote refresh now skips ambiguous cross-currency quotes when no explicit exchange override exists, so CAD wrappers and CDR-like positions do not get silently overwritten by mismatched USD prices
- Phase 3 cleanup has also tightened:
    - holding-table wording and density with shorter labels
    - quote refresh explanations around missing-vs-cached quotes
    - recommendations first-time guidance through a lighter collapsible hint instead of a permanently expanded coaching block
    - non-home analytical pages now prefer lighter page headers over large hero cards, so density stays high once the page structure is already self-explanatory
    - account detail and holding detail top sections now use compact identity rows instead of large intro cards
    - security detail uses the same compact identity-row pattern and no longer assumes old market-data status badge fields
    - sticky analytical rails were narrowed again so holdings tables keep more horizontal room
    - import now opens with a compact context strip instead of a large explanatory hero

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

Phase 3 now has:
- account edit flows
- account merge preview + confirmation
- holding mutation audit trail
- classification repair stored directly on holding rows through explicit override fields

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
- The account donut lives inside the sticky right rail and uses hover / focus popups for detailed slice labels, so the active-account hint does not permanently stretch the card.
- Account cards use a single-row layout so long account lists do not create empty grid gaps.
- Clicking an account card changes the page context without forcing a scroll jump; the in-card button is the only control that jumps to the holdings table.
- Clicking the already selected account card returns the workspace to the full-portfolio context.
- Dashboard account rows should open account detail directly, instead of behaving like passive summaries.
- Share labels must stay explicit across portfolio, account detail, and holding detail:
  - share of total portfolio
  - share inside the current account
- A global floating scroll-to-top control is available across pages through AppShell.
- Sticky right rails should scroll independently when their own content exceeds viewport height, instead of forcing the whole page to the bottom before lower rail modules become reachable.
- Sticky rails should clear the full floating header and top-nav stack on first paint, and their native scrollbars should stay visually hidden.


- Account detail pages use a true identity block on the left of the first fold instead of a thin context strip, so the top section communicates the account quickly without leaving large empty space.
