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

### `FxInfoPopoverContent`

- File: [fx-info-popover-content.tsx](E:\Projects\Portfolio%20Manager\components\navigation\fx-info-popover-content.tsx)
- Purpose: shared FX explanation block used inside the global currency control

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

## Chart Components

### `LineChartCard`

- File: [line-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\line-chart.tsx)
- Purpose: trend charts inside analytical cards

### `DonutChartCard`

- File: [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx)
- Purpose: allocation and distribution breakdowns

### `RadarPreview`

- File: [radar-preview.tsx](E:\Projects\Portfolio%20Manager\components\charts\radar-preview.tsx)
- Purpose: small health-score preview surface
- Current status: limited preview usage, not full analysis component yet

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

- [quick-action-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\quick-action-card.tsx)
  - reusable quick action surface for analytical sidebars
- [holding-table.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-table.tsx)
  - reusable holdings detail table with freshness badges
- [refresh-prices-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\refresh-prices-panel.tsx)
  - batch quote refresh workflow

### Recommendations

- [recommendation-run-panel.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-run-panel.tsx)
  - generate recommendation run action panel

### Settings

- [preferences-workbench.tsx](E:\Projects\Portfolio%20Manager\components\settings\preferences-workbench.tsx)
  - guided + manual investment preferences editor

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

