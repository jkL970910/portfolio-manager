# Component Inventory

## Status Labels

- `stable`: reusable as-is
- `candidate`: should be extracted or generalized
- `domain`: intentionally specific to one workflow

## Stable Shared Components

| Component | Status | File | Notes |
|---|---|---|---|
| Button | stable | [button.tsx](E:\Projects\Portfolio%20Manager\components\ui\button.tsx) | Shared action primitive |
| Card | stable | [card.tsx](E:\Projects\Portfolio%20Manager\components\ui\card.tsx) | Shared surface primitive |
| Badge | stable | [badge.tsx](E:\Projects\Portfolio%20Manager\components\ui\badge.tsx) | Shared status primitive |
| SectionHeading | stable | [section-heading.tsx](E:\Projects\Portfolio%20Manager\components\ui\section-heading.tsx) | Shared section header |
| MetricCard | stable | [metric-card.tsx](E:\Projects\Portfolio%20Manager\components\ui\metric-card.tsx) | Shared KPI / hero metric surface |
| InfoRow | stable | [info-row.tsx](E:\Projects\Portfolio%20Manager\components\ui\info-row.tsx) | Shared icon + explanation row |
| StatBlock | stable | [stat-block.tsx](E:\Projects\Portfolio%20Manager\components\ui\stat-block.tsx) | Shared compact metric block |
| TopNav | stable | [top-nav.tsx](E:\Projects\Portfolio%20Manager\components\navigation\top-nav.tsx) | Shared top-level nav |
| DisplayCurrencyToggle | stable | [display-currency-toggle.tsx](E:\Projects\Portfolio%20Manager\components\navigation\display-currency-toggle.tsx) | Global CAD/USD control |
| FxInfoPopoverContent | stable | [fx-info-popover-content.tsx](E:\Projects\Portfolio%20Manager\components\navigation\fx-info-popover-content.tsx) | Shared FX explanation block |
| AppShell | stable | [app-shell.tsx](E:\Projects\Portfolio%20Manager\components\layout\app-shell.tsx) | Shared page shell |
| FloatingHeaderFrame | stable | [floating-header-frame.tsx](E:\Projects\Portfolio%20Manager\components\layout\floating-header-frame.tsx) | Shared sticky header behavior |
| LineChartCard | stable | [line-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\line-chart.tsx) | Shared trend chart shell |
| DonutChartCard | stable | [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx) | Shared donut chart shell |
| RadarPreview | stable | [radar-preview.tsx](E:\Projects\Portfolio%20Manager\components\charts\radar-preview.tsx) | Shared preview chart |
| QuickActionCard | stable | [quick-action-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\quick-action-card.tsx) | Shared analytical sidebar action card |
| HoldingTable | stable | [holding-table.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-table.tsx) | Shared holdings detail table |
| RecommendationSummaryCard | stable | [recommendation-summary-card.tsx](E:\Projects\Portfolio%20Manager\components\dashboard\recommendation-summary-card.tsx) | Shared dashboard recommendation surface |

## Stable Domain Components

| Component | Status | File | Notes |
|---|---|---|---|
| ImportExperience | domain | [import-experience.tsx](E:\Projects\Portfolio%20Manager\components\import\import-experience.tsx) | Guided portfolio import orchestration |
| WorkflowOptionCard | domain | [workflow-option-card.tsx](E:\Projects\Portfolio%20Manager\components\import\workflow-option-card.tsx) | Shared workflow entry card inside import surfaces |
| ImportJobPanel | domain | [import-job-panel.tsx](E:\Projects\Portfolio%20Manager\components\import\import-job-panel.tsx) | Direct portfolio CSV workflow |
| SpendingImportPanel | domain | [spending-import-panel.tsx](E:\Projects\Portfolio%20Manager\components\import\spending-import-panel.tsx) | Spending import workflow |
| RefreshPricesPanel | domain | [refresh-prices-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\refresh-prices-panel.tsx) | Quote refresh interaction |
| RecommendationRunPanel | domain | [recommendation-run-panel.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-run-panel.tsx) | Recommendation generation action |
| PreferencesWorkbench | domain | [preferences-workbench.tsx](E:\Projects\Portfolio%20Manager\components\settings\preferences-workbench.tsx) | Guided + manual settings workflow |

## Extraction Candidates

No high-priority extraction candidates remain in the current shared layer. New candidates should only be added when a pattern appears in at least two surfaces.

## Inventory Rule

When a new reusable component is created:

1. Add it to this file
2. Mark whether it is `stable`, `candidate`, or `domain`
3. If it is shared, also document it in `component-library.md`
