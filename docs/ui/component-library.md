# Component Library

## Goal

This document defines the reusable component library for Loo国的财富宝库.

Use it as the source of truth before introducing any new UI component.

## Principles

- Prefer extension over duplication
- Keep primitives generic and domain components explicit
- Separate layout, navigation, display, forms, and finance-specific concerns
- Promote repeated page patterns into reusable components quickly

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
  - sticky compression behavior
  - top navigation

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

## Chart Components

### `LineChartCard`

- File: [line-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\line-chart.tsx)
- Purpose: trend charts inside analytical cards

### `DonutChartCard`

- File: [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx)
- Purpose: allocation and distribution breakdowns
- Supports:
  - optional active slice emphasis
  - optional active legend badge for deep-linked account focus
  - optional detail text per slice
  - optional header actions such as local view toggles

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
- [account-breakdown-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\account-breakdown-panel.tsx)
  - local controller for switching the shared donut chart between account-type view and specific-account view
  - keeps repeated TFSA / FHSA accounts readable without adding a second chart block
- [quick-action-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\quick-action-card.tsx)
  - reusable quick action surface for analytical sidebars
  - now supports optional `href` so sidebar actions can jump into deeper analysis surfaces
- [holding-table.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-table.tsx)
  - reusable holdings detail table with freshness badges
  - supports optional highlighted rows when health drill-down cards deep-link back into `/portfolio`
- [refresh-prices-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\refresh-prices-panel.tsx)
  - batch quote refresh workflow
- [health-dimension-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-dimension-card.tsx)
  - detailed health-score breakdown card for a single dimension
- [health-action-queue.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-action-queue.tsx)
  - ordered action list used by the health detail page
- [health-drilldown-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-drilldown-card.tsx)
  - account-level and holding-level diagnostic card used by the health detail page
  - account drill-down is grouped by account type, not by individual account nickname
  - each drill-down card can deep-link back into `/portfolio`, where the matching rows should remain visually highlighted
  - supports a card-level contribution amount switcher so the user can compare which dimension would improve first under different next-contribution sizes

### Recommendations

- [recommendation-run-panel.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-run-panel.tsx)
  - generate recommendation run action panel
- [recommendation-priority-stack.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-priority-stack.tsx)
  - controller layer for ranked recommendation cards
  - keeps only one recommendation expanded at a time so the page height stays bounded
- [recommendation-detail-card.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-detail-card.tsx)
  - compact recommendation summary card with on-demand expansion into the unified decision trace, alternatives, constraint trace, and execution detail
  - defaults to the first three decision steps and can expand into the full trace on demand
  - adds short plain-language trace tags plus hover/focus glossary chips for core terms such as support, constraint, account fit, and FX friction
- [scenario-compare-card.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\scenario-compare-card.tsx)
  - re-solved scenario compare surface with change-summary text versus the current recommendation run

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

