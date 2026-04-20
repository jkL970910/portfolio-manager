# Component Library

## Goal

This document defines the reusable component library for Loo国的财富宝库.

Use it as the source of truth before introducing any new UI component.

## Principles

- Prefer extension over duplication
- Keep primitives generic and domain components explicit
- Separate layout, navigation, display, forms, and finance-specific concerns
- Promote repeated page patterns into reusable components quickly
- Keep the Chinese `Loo国` worldbuilding scoped to Chinese-mode surfaces that intentionally use it; shared English pages should keep standard `Portfolio Manager` wording.

## Current Structure

```text
components/
  brand/
  charts/
  import/
  layout/
  navigation/
  portfolio/
  recommendations/
  settings/
  ui/
```

## Shared Primitives

### `Button`

- File: [button.tsx](E:\Projects\Portfolio%20Manager\components\ui\button.tsx)
- Purpose: primary, secondary, and ghost actions
- Variants:
  - `primary`
  - `secondary`
  - `ghost`
- Supports:
  - button mode
  - link mode via `href`
  - leading / trailing icons

### `Card`

- File: [card.tsx](E:\Projects\Portfolio%20Manager\components\ui\card.tsx)
- Purpose: base surface for all analytical modules
- Subparts:
  - `Card`
  - `CardHeader`
  - `CardTitle`
  - `CardContent`

### `Badge`

- File: [badge.tsx](E:\Projects\Portfolio%20Manager\components\ui\badge.tsx)
- Purpose: compact status and category labels
- Variants:
  - `primary`
  - `success`
  - `warning`
  - `neutral`

### `SectionHeading`

- File: [section-heading.tsx](E:\Projects\Portfolio%20Manager\components\ui\section-heading.tsx)
- Purpose: section-level title and supporting description

### `MetricCard`

- File: [metric-card.tsx](E:\Projects\Portfolio%20Manager\components\ui\metric-card.tsx)
- Purpose: primary KPI and overview metric presentation
- Supports:
  - label
  - value
  - detail
  - optional icon
  - optional badge

### `InfoRow`

- File: [info-row.tsx](E:\Projects\Portfolio%20Manager\components\ui\info-row.tsx)
- Purpose: repeated icon + explanation / status row used in import and note-heavy workflows
- Tones:
  - `default`
  - `success`
  - `warning`
  - `danger`

### `StatBlock`

- File: [stat-block.tsx](E:\Projects\Portfolio%20Manager\components\ui\stat-block.tsx)
- Purpose: compact metric block used for small analytical summaries

### `EmptyStatePanel`

- File: [empty-state-panel.tsx](E:\Projects\Portfolio%20Manager\components\ui\empty-state-panel.tsx)
- Purpose: shared empty-state surface with supporting text and optional mascot sticker
- Use when:
  - a table or workflow has no usable records yet
  - the product should keep a warm helper tone without inventing a page-specific empty card

## Navigation Components

### `TopNav`

- File: [top-nav.tsx](E:\Projects\Portfolio%20Manager\components\navigation\top-nav.tsx)
- Purpose: primary app navigation
- Includes:
  - section links
  - global display-currency control

### `DisplayCurrencyToggle`

- File: [display-currency-toggle.tsx](E:\Projects\Portfolio%20Manager\components\navigation\display-currency-toggle.tsx)
- Purpose: global CAD/USD display control
- Includes:
  - active currency state
  - API update
  - FX info hover/focus popover

### `DisplayLanguageToggle`

- File: [display-language-toggle.tsx](E:\Projects\Portfolio%20Manager\components\navigation\display-language-toggle.tsx)
- Purpose: global UI language control for the Chinese `Loo国的财富宝库` theme and the English `Portfolio Manager` theme
- Includes:
  - compact dropdown trigger
  - CN / US language options
  - cookie + user preference update
  - optimistic route refresh
  - elevated dropdown layer that must remain visible above page hero badges

### `FxInfoPopoverContent`

- File: [fx-info-popover-content.tsx](E:\Projects\Portfolio%20Manager\components\navigation\fx-info-popover-content.tsx)
- Purpose: shared FX explanation block used inside the global currency control

## Brand Components

### `LooMascot`

- File: [loo-mascot.tsx](E:\Projects\Portfolio%20Manager\components\brand\loo-mascot.tsx)
- Purpose: original brand mascot used in hero areas, onboarding, summaries, and empty states
- Moods:
  - `guide`
  - `smirk`
  - `side-eye`
  - `proud`
- Rules:
  - keep it out of dense analytical tables
  - use it as a companion surface, not decorative noise

### `MascotAsset`

- File: [mascot-asset.tsx](E:\Projects\Portfolio%20Manager\components\brand\mascot-asset.tsx)
- Purpose: wrapper for user-supplied static mascot images dropped into `public/mascot`
- Use when:
  - a provided sticker or reaction image should be placed into a hero, summary, or review surface
- Do not use inside:
  - dense tables
  - row-by-row diagnostics

## Auth Components

### `CitizenIdentityCard`

- File: [citizen-identity-card.tsx](E:\Projects\Portfolio%20Manager\components\auth\citizen-identity-card.tsx)
- Purpose: shared identity-card surface for the Chinese `Loo国` citizen flow
- Use when:
  - rendering the default citizen template on login
  - rendering an issued citizen card after registration
  - showing the active citizen archive in Settings
- Notes:
  - uses a structured ID-card layout inspired by the Figma citizen card template
  - supports embedded children so login/register inputs can live inside the card body
  - supports rank and address visual stamps when matching mascot assets exist
  - login and register should keep stamps decorative-only, with hover-scale affordance but no lore popover
  - Settings owns the deeper lore interaction by opening a centered modal card from the stamp click target

### `CitizenLoreDialog`

- File: [citizen-lore-dialog.tsx](E:\Projects\Portfolio%20Manager\components\settings\citizen-lore-dialog.tsx)
- Purpose: centered modal card for citizen rank and residence explanations
- Use when:
  - a Settings-level citizen stamp needs deeper world-building copy and an enlarged visual
- Rules:
  - only one lore dialog should be open at a time
  - `Esc` and backdrop click must dismiss it
  - do not reuse it on login/register where auth flow should stay lightweight

### `LooTermsDialog`

- File: [loo-terms-dialog.tsx](E:\Projects\Portfolio%20Manager\components\auth\loo-terms-dialog.tsx)
- Purpose: shared modal for the Chinese-mode oath / terms copy
- Use when:
  - login and register require explicit acceptance of `Loo国条例`

### `LooApprovalDialog`

- File: [loo-approval-dialog.tsx](E:\Projects\Portfolio%20Manager\components\auth\loo-approval-dialog.tsx)
- Purpose: shared approval / issuance modal for Chinese-mode `Loo国` auth flows
- Use when:
  - registration succeeds and a citizen ID must be issued
  - registration or review fails and the user needs a branded rejection surface

### `ChineseLoginPanel`

- File: [chinese-login-panel.tsx](E:\Projects\Portfolio%20Manager\components\auth\chinese-login-panel.tsx)
- Purpose: Chinese-mode identity-gate login panel that embeds credentials inside the default citizen card
- Scope:
  - Chinese mode only
  - switches between default card and active citizen card based on session state

### `ChineseRegisterPanel`

- File: [chinese-register-panel.tsx](E:\Projects\Portfolio%20Manager\components\auth\chinese-register-panel.tsx)
- Purpose: Chinese-mode citizen application workflow with terms acceptance and issuance modal
- Scope:
  - Chinese mode only
  - creates the user and shows the issued citizen card before manual entry
  - includes gender-based citizen preview and Loo皇 approval / rejection result modals

## Layout Components

### `AppShell`

- File: [app-shell.tsx](E:\Projects\Portfolio%20Manager\components\layout\app-shell.tsx)
- Purpose: page shell and sticky floating header
- Responsibilities:
  - signed-in header
  - branding
  - compact non-home header mode so detail and analysis pages do not keep oversized hero-style title blocks
  - sticky compression behavior
  - top navigation
- Rules:
  - keep the home/dashboard overview expressive
  - non-home analytical pages should prefer lighter page headers over large hero cards when the page structure already explains itself
  - non-home page titles should stay compact enough that the first analytical block is visible without a large hero-style gap

### `FloatingHeaderFrame`

- File: [floating-header-frame.tsx](E:\Projects\Portfolio%20Manager\components\layout\floating-header-frame.tsx)
- Purpose: scroll-aware wrapper for the floating header
- Responsibility: compact header visuals after scroll threshold

### `ScrollToTopButton`

- File: [scroll-to-top-button.tsx](E:\Projects\Portfolio%20Manager\components\layout\scroll-to-top-button.tsx)
- Purpose: fixed global return-to-top control for long analytical pages
- Rules:
  - stays hidden near the top of the page
  - appears after meaningful scroll depth
  - returns the current page to the top smoothly

### `StickyRail`

- File: [sticky-rail.tsx](E:\Projects\Portfolio%20Manager\components\layout\sticky-rail.tsx)
- Purpose: shared desktop sticky side rail wrapper for long analytical pages
- Rules:
  - remains sticky below the floating header
  - scrolls independently when its own content becomes taller than the viewport
  - when the rail itself reaches the top or bottom, wheel scrolling should continue the main page instead of trapping the pointer
- should sit low enough to clear the full floating header + nav stack on first paint
- should stay narrow enough that the main analytical column keeps priority; treat the rail as context, not the primary reading surface

## Portfolio Components

### `AccountOverviewCard`

- File: [account-overview-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\account-overview-card.tsx)
- Purpose: single-row account summary surface inside the Portfolio workspace
- Supports:
  - click-to-switch account context
  - hover lift / subtle scale to signal that the whole row is interactive
  - explicit locked-state pill when the row is the active account context
  - separate holdings-jump action
  - dedicated account-detail entry point
  - compact gain/loss line directly beneath the current account value
  - share-of-portfolio shown as lighter helper text instead of competing with the main value
  - action buttons must stop event bubbling so row-level context toggling does not swallow detail navigation

### `HoldingTable`

- File: [holding-table.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-table.tsx)
- Purpose: detailed holdings table used in portfolio and account detail surfaces
- Supports:
  - one primary security entry point in the symbol area instead of parallel `持仓详情 / Holding detail` and `标的资料 / Security page` buttons
  - the single entry should open the shared security route, where already-held symbols can still expose position-specific drill-downs without duplicating the first navigation step
  - compact account-detail mode that hides the redundant account column and tightens widths so the sticky rail does not clip the final columns
  - filtered / highlighted states
  - explicit display of total shares, average cost, and current value
  - short readable Chinese headers instead of long analytical phrases
  - separate share labels for:
    - share of total portfolio
    - share inside the current account
  - Chinese holding guidance rendered in a `Loo皇审核` tone instead of neutral analysis phrasing
  - clean UTF-8 Chinese copy; do not allow mojibake regressions in shared holding labels
  - tighter current-value column that keeps estimate, current price, freshness, and last-updated information compact enough that the value column does not tower over adjacent columns
  - keeps native rail scrollbars visually hidden
  - should be reused anywhere a right-side analytical rail needs to stay visible without forcing the whole page to bottom out first

### `SecurityMark`

- File: [security-mark.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\security-mark.tsx)
- Purpose: compact visual identity for a holding or security when no issuer logo exists
- Supports:
  - asset-class tone
  - symbol monogram fallback
  - optional short hint pill such as `ETF`
- Use when:
- rendering a holding detail hero
- showing a holding row or account surface without depending on external logos

### `AccountMaintenancePanel`

- File: [account-maintenance-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\account-maintenance-panel.tsx)
- Purpose: unified account maintenance surface mounted inside account detail
- Supports:
  - account metadata edit
  - add-holding flow for new positions
  - merge preview and confirmation
  - delete-account confirmation
- Rules:
  - keep edit and merge inside one shared maintenance card so "modify" actions are not split across multiple surfaces
  - segmented mode switching should be the main navigation inside the card
  - default state should be collapsed until the user chooses one maintenance action
  - account edit should use a single-column form instead of side-by-side field grids
  - destructive delete should live at the bottom of edit mode, not as a parallel top-level action card
  - deletion must always require a confirm dialog
  - delete should fail safely when holdings still exist and explain the next step in plain language

### `HoldingEditPanel`

- File: [holding-edit-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-edit-panel.tsx)
- Purpose: holding repair surface mounted inside the selected account view of the unified symbol page
- Supports:
  - holding field edits
  - account reassignment
  - classification repair
  - override reset
  - delete-holding confirmation
  - expanded classification suggestions for gold / commodity / REIT / trust-style instruments
- Rules:
  - stays collapsed by default
  - must show the original system-read classification separately from user overrides
  - edits should improve recommendation and health-score trust, not just cosmetics
  - amount inputs should stack vertically so labels and values do not clip inside narrow rails
  - cost basis and current value should auto-derive from quantity, average cost, and current price until the user manually overrides them
  - save behavior must refresh both the holding itself and parent account totals so returning to account/portfolio surfaces reflects the latest state

### `Holding Detail Role Cards`

- File: [unified-security-detail.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\unified-security-detail.tsx)
- Purpose: compact first-read interpretation of what the selected account-level holding means inside the portfolio
- Rules:
  - render as ultra-compact parallel cards with a small icon and one short judgment
  - do not let these cards grow into tall prose blocks or multi-paragraph explanations
  - keep this section scannable in one pass before the user moves into deeper quote or review detail

### `Holding Quote Source And Review`

- File: [unified-security-detail.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\unified-security-detail.tsx)
- Purpose: compact source-of-truth block for quote freshness and review notes inside the selected account view of the unified symbol page
- Rules:
  - first fold should show only a short summary plus the most useful quote facts
  - longer quote notes should live behind a collapsible panel
  - avoid turning this section into another tall explanatory stack that competes with the holding overview
  - single-security refresh must be visible in the first fold of holding detail
  - in the selected account view it should sit as the first card in the right summary rail, directly above the holding edit panel

### `RefreshSecurityPricePanel`

- File: [refresh-security-price-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\refresh-security-price-panel.tsx)
- Purpose: refresh one symbol without re-running the full portfolio refresh
- Rules:
  - support a compact rail variant for narrow right-side summary stacks
  - compact mode should still show symbol, cached quote time, freshness, action button, and success/error feedback
  - avoid using the full-width layout inside detail pages once a stable right rail exists

### `UnifiedSecurityDetail`

- File: [unified-security-detail.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\unified-security-detail.tsx)
- Purpose: single symbol workspace for both candidate securities and already-held positions
- Supports:
  - one unified symbol route at `/portfolio/security/[symbol]`
  - default aggregate held-position view across all accounts
  - compact first-fold dropdown selection inside the metric rail instead of a separate large context card
  - timeframe filters for symbol history:
    - `1D`
    - `1W`
    - `1M`
    - `3M`
    - `6M`
    - `1Y`
    - `All`
  - aggregate and account-level quantity / average-cost summaries
  - record selection inside one account when the same symbol exists in multiple holding rows there
  - reuse of the existing holding repair and single-symbol refresh panels inside the selected account view
- Rules:
  - if the symbol is not held, keep the page in candidate-security mode
  - if the symbol is held, default to the aggregate view before drilling into one account
  - symbol price history should stay symbol-level even when the user switches account context
  - aggregate view should show combined quantity and blended average cost before the user selects an account
  - account selection should live as a compact dropdown in the first fold and reveal the same repair / refresh / review depth that used to live only on the holding detail route
  - if one account contains multiple holding rows for the same symbol, keep the header metrics aggregated at the account level and add a second selector for the exact row being reviewed or edited
  - old holding routes may remain as compatibility redirects, but the primary browsing route is the unified symbol page

### `WatchlistToggleButton`

- File: [watchlist-toggle-button.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\watchlist-toggle-button.tsx)
- Purpose: fast add/remove control for a single symbol outside the Settings bulk-edit workflow
- Supports:
  - compact mode for dense discovery and symbol surfaces
  - optimistic local watchlist state after API completion
- Rules:
  - use this on discovery results and unified symbol pages
  - Settings remains the bulk-edit surface; this control is for quick single-symbol actions

### `CandidateScorePanel`

- File: [candidate-score-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\candidate-score-panel.tsx)
- Purpose: request recommendation-style scoring for one user-selected candidate symbol
- Supports:
  - one-click score request for the current symbol
  - scorecard display with:
    - overall score
    - account fit
    - tax fit
    - security score
    - warnings
- Rules:
  - use for discovery results and unified symbol pages
  - keep the language consistent with recommendation v2
  - when the asset class is heuristic, the warnings section must say so explicitly

### `SecurityDiscoveryWorkbench`

- File: [security-discovery-workbench.tsx](E:\Projects\Portfolio%20Manager\components\discover\security-discovery-workbench.tsx)
- Purpose: dedicated discovery surface for arbitrary symbol lookup before moving into the unified symbol page
- Supports:
  - free-text symbol / name search
  - quick watchlist actions on search results
  - recommendation-style scoring on search results
  - deep-link into `/portfolio/security/[symbol]`
- Rules:
  - keep search, watchlist, and score actions together on the same result card
  - discovery is for user-directed idea exploration, not only for replaying system recommendations

### `WatchlistComparePanel`

- File: [watchlist-compare-panel.tsx](E:\Projects\Portfolio%20Manager\components\discover\watchlist-compare-panel.tsx)
- Purpose: compare a small set of watchlist symbols side by side using recommendation-style scoring
- Supports:
  - multi-select from the current watchlist
  - batch candidate comparison request
  - ranked result cards
- Rules:
  - use this inside discovery rather than inside Settings
  - comparison should stay lightweight and decision-oriented, not drift into a full backtesting tool

### `PortfolioSecurityDetailPage`

- File: [page.tsx](E:\Projects\Portfolio%20Manager\app\portfolio\security\[symbol]\page.tsx)
- Purpose: unified symbol detail surface for recommended or already-held symbols
- Rules:
- should work even when the user does not already own the symbol
- should also work as the primary route for symbols the user already owns
- should keep candidate-security and held-position views inside the same route instead of splitting them into two first-level pages
- should follow the same first-fold pattern as holding and account detail:
  - left overview card that combines identity and the 6-month reference trend
  - right compact metrics grid
  - no repeated ratio/fact cards immediately below that restate the same numbers
- should show a reference trend, identity facts, quote-source facts, and any related holdings already inside the portfolio
- when the symbol is already held:
  - default to an aggregate held-position view across all accounts
  - offer an account selector
  - reveal the full held-position review / repair rail once an account is selected
- the single-security refresh action should be visible in the first fold as the first card in the right summary rail

### Detail Overview Pattern

- Files:
  - [app/portfolio/account/[accountId]/page.tsx](E:\Projects\Portfolio%20Manager\app\portfolio\account\[accountId]\page.tsx)
  - [app/portfolio/holding/[holdingId]/page.tsx](E:\Projects\Portfolio%20Manager\app\portfolio\holding\[holdingId]\page.tsx)
  - [app/portfolio/security/[symbol]/page.tsx](E:\Projects\Portfolio%20Manager\app\portfolio\security\[symbol]\page.tsx)
- Purpose: unify first-fold layout across account, holding, and security detail pages
- Rules:
  - left side carries the overview story: identity first, then the 6-month trend in the same visual block
  - right side carries compact metrics and summary-only support
  - on account detail, the account-internal donut belongs in the right-side summary stack rather than as a large full-width block below
  - the account-detail donut in the right-side stack should use the compact donut size and avoid redundant helper text beneath it
  - account detail should keep both first-fold columns visually balanced: make the left overview card full-height and keep the right summary rail narrow enough that compact metrics read as short values such as `48%` or `CAD $50,000`
  - on account detail, the first-fold metric order should be:
    - current account value
    - account gain/loss
    - account currency
    - available room
  - share of total portfolio belongs under the current account value as helper copy, not as a separate equal-weight metric card
  - do not repeat ratio, gain/loss, or “what to look at first” facts immediately below if they already appear in the first fold
  - keep the title row consistent: title on the left, key pills directly on the right, subtitle only when it adds new information
  - right side carries only compact metrics
  - do not repeat the same share/gain/loss facts in both the right metrics rail and a second facts grid below
  - account, holding, and security detail should all feel like the same family of page, not three separate layouts
  - title-row layout should stay consistent across account, holding, and security detail:
    - title on the left
    - key pills immediately to the right of the title
    - supporting subtitle below only when it adds new information
- Rules:
  - use two independent first-fold cards instead of one oversized shell: an overview card on the left and a compact primary-metrics card on the right
  - keep identity information on the left
  - keep primary metrics in a narrow 2x2 card rather than pinning detached stat cards to the far right
  - compact primary metrics should show the shortest useful value, for example `48%` instead of `大约占整个组合 48%`, and `CAD $50,000` instead of a full sentence about remaining room
  - place secondary facts in a lower grid after the first-fold cards
  - do not repeat the same conclusion on both sides of the first fold; the left overview should stay identity-first while the right metrics explain scale and proportion
  - reduce icon size and remove redundant explanatory copy when the facts already explain the object

### `ImportExperience`

- File: [import-experience.tsx](E:\Projects\Portfolio%20Manager\components\import\import-experience.tsx)
- Purpose: guided and direct import workspace
- Rules:
  - keep the top intro lightweight on non-home surfaces
  - use a short context strip instead of a large hero card once the workflow options themselves already explain the next step

## Chart Components

### `LineChartCard`

- File: [line-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\line-chart.tsx)
- Purpose: trend charts inside analytical cards

### `DonutChartCard`
- File: [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx)
- Purpose: shared donut chart shell for both main-column and right-rail summary use
- Supports:
  - optional compact side legend
  - fixed-width donut container in narrow rails
  - optional helper text
  - optional `className` so page-level layouts can stretch summary donuts to fill a right-rail slot

- File: [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx)
- Purpose: shared donut chart shell for allocation summaries
- Supports:
  - hover tooltip detail
  - active-slice emphasis
  - compact size tuning for right-rail use
  - optional compact side legend for dense summary stacks
- Rules:
  - right-rail donuts should prefer the compact side legend over long helper paragraphs
  - when a compact side legend is enabled, keep the donut container at a fixed summary width so the ring never disappears in narrow rails
  - keep the ring small enough that it reads as a summary, not a second main panel

- File: [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx)
- Purpose: allocation and distribution breakdowns
- Supports:
  - optional active slice emphasis
  - optional detail text per slice
  - optional header actions such as local view toggles
  - slice hover tooltip with the full label, detail text, and share
  - optional compact sizing controls for narrow summary stacks
- Rules:
  - the surface must allow overflow so slice detail popups are not clipped by the card boundary
  - do not keep a permanent right-side legend list inside sticky rails
  - keep the chart visually centered and let hover/focus reveal the detail
  - explicitly suppress chart labels and label lines so dense account mixes do not spill text into the card
  - let hover tooltip carry the account detail so the chart stays visually centered
  - optional helper copy below the chart
  - compact right-rail donuts should usually omit extra helper copy when the surrounding card title already explains the context
  - compact right-rail donuts should also reduce header and content spacing so the chart reads like a summary widget rather than a second large content block

### `RadarPreview`

- File: [radar-preview.tsx](E:\Projects\Portfolio%20Manager\components\charts\radar-preview.tsx)
- Purpose: small health-score preview surface
- Current status: limited preview usage, not full analysis component yet
- Supports:
  - optional CTA href
  - optional CTA label

## Domain Components

### Dashboard

- [recommendation-summary-card.tsx](E:\Projects\Portfolio%20Manager\components\dashboard\recommendation-summary-card.tsx)
  - reusable dashboard summary block for recommendation guidance

### Import

- [workflow-option-card.tsx](E:\Projects\Portfolio%20Manager\components\import\workflow-option-card.tsx)
  - reusable workflow entry / mode selection card
- [import-experience.tsx](E:\Projects\Portfolio%20Manager\components\import\import-experience.tsx)
  - guided portfolio import workflow
- [import-job-panel.tsx](E:\Projects\Portfolio%20Manager\components\import\import-job-panel.tsx)
  - direct portfolio CSV import workflow
- [spending-import-panel.tsx](E:\Projects\Portfolio%20Manager\components\import\spending-import-panel.tsx)
  - spending import workflow

### Portfolio

- [account-overview-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\account-overview-card.tsx)
  - primary account-instance summary card used at the top of the portfolio workspace
  - shows unique account naming, institution, currency, portfolio share, top holdings, and room summary
  - clicking the card body toggles that account context on and off
  - the secondary button is reserved for jumping down to the holdings table, not for changing the page context semantics
- [account-breakdown-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\account-breakdown-panel.tsx)
  - sticky right-rail account-instance donut summary that follows the currently selected account context
  - relies on slice hover detail instead of permanently mounted legend labels
- [quick-action-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\quick-action-card.tsx)
  - reusable quick action surface for analytical sidebars
  - now supports optional `href` so sidebar actions can jump into deeper analysis surfaces
- [holding-table.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-table.tsx)
  - reusable holdings detail table with freshness badges
  - supports optional highlighted rows when health drill-down cards deep-link back into `/portfolio`
  - the share column must distinguish between:
    - share of total portfolio
    - share inside the current account
  - do not collapse those two meanings into one generic "weight" label
- [refresh-prices-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\refresh-prices-panel.tsx)
  - batch quote refresh workflow
  - explains that a missing quote means no new quote returned on this refresh, not necessarily that the row has no usable cached price
- [health-dimension-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-dimension-card.tsx)
  - detailed health-score breakdown card for a single dimension
- [health-action-queue.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-action-queue.tsx)
  - ordered action list used by the health detail page
- [health-drilldown-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-drilldown-card.tsx)
  - account-level and holding-level diagnostic card used by the health detail page
  - account drill-down is grouped by account type, not by individual account nickname
  - each drill-down card can deep-link back into `/portfolio`, where the matching rows should remain visually highlighted
  - supports a card-level contribution amount switcher so the user can compare which dimension would improve first under different next-contribution sizes
- [app/portfolio/health/page.tsx](E:\Projects\Portfolio%20Manager\app\portfolio\health\page.tsx)
- health detail pages should use a compact overview card beside the radar card, followed by a short action/highlights row, then full-width dimension cards and single-column drill-down sections
  - avoid separate top hero columns that leave empty space beneath a shorter left summary
  - keep the second row linear rather than split into mismatched columns: first a full-width action queue, then a full-width reminders / recommendation handoff card, followed by a full-width dimension stack

### Recommendations

- [recommendation-run-panel.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-run-panel.tsx)
  - generate recommendation run action panel
- [recommendation-priority-stack.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-priority-stack.tsx)
  - controller layer for ranked recommendation cards
  - keeps only one recommendation expanded at a time so the page height stays bounded
- [recommendation-detail-card.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-detail-card.tsx)
  - compact recommendation summary card with a short top summary, a single amount rail, and a cleaner expanded layout
  - uses wide summary blocks and stacked explanation groups instead of narrow text columns
  - defaults to the first three decision steps and can expand into the full trace on demand
  - keeps long Chinese copy out of narrow multi-column stacks
  - adds short plain-language trace tags plus hover/focus glossary chips for core terms such as account fit and FX friction
  - Chinese mode should phrase recommendation reasoning as `Loo皇审核`, while English stays in plain Portfolio Manager language
  - the lead symbol and any alternative symbols should deep-link into the shared security detail page
  - can expose a direct link into an already-heavy existing holding when the recommendation is explicitly avoiding further concentration there
- [scenario-compare-card.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\scenario-compare-card.tsx)
  - re-solved scenario compare surface with change-summary text versus the current recommendation run
- [recommendations/page.tsx](E:\Projects\Portfolio%20Manager\app\recommendations\page.tsx)
  - the top input summary must distinguish between:
    - the saved account funding order
    - the usable order for the current contribution
  - if a sheltered account has `available room <= 0`, do not present it as the first usable path for that run
  - exhausted sheltered accounts should be called out in plain language instead of forcing the user to infer the problem from deeper recommendation details
  - exhausted account-order rows should render as a weaker or warning-style summary instead of looking equivalent to fully usable account paths
  - Chinese recommendation copy should sound like `Loo皇审核`; English should remain neutral and non-roleplay
  - first-time reading help should stay lightweight or collapsible once the page structure already explains itself
  - the “how the system is thinking” summaries should stack vertically, and the longer explainer belongs behind a collapsible detail panel instead of staying permanently open in the first fold

### Settings

- [preferences-workbench.tsx](E:\Projects\Portfolio%20Manager\components\settings\preferences-workbench.tsx)
  - guided + manual investment preferences editor
- [citizen-profile-panel.tsx](E:\Projects\Portfolio%20Manager\components\settings\citizen-profile-panel.tsx)
  - Chinese-mode citizen archive and admin override surface inside Settings

## Next Components To Extract

No high-priority extraction candidates remain in the current navigation and dashboard layer.

## Promotion Rule

Promote a page-specific pattern into the component library when any of these are true:

- It appears in 2 or more places
- It mixes data display with repeated styling logic
- It is likely to be reused by another product surface
- It becomes part of the design language, not just one page

## Do Not Package Yet

Do not split this into a separate npm package yet.

Current stage:
- single application
- evolving domain model
- fast iteration

Correct target now:
- stable in-repo component library
- documented reuse rules
- gradual extraction of repeated patterns


