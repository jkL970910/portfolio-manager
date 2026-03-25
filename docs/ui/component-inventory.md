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
| EmptyStatePanel | stable | [empty-state-panel.tsx](E:\Projects\Portfolio%20Manager\components\ui\empty-state-panel.tsx) | Shared empty-state surface with optional sticker |
| TopNav | stable | [top-nav.tsx](E:\Projects\Portfolio%20Manager\components\navigation\top-nav.tsx) | Shared top-level nav |
| DisplayLanguageToggle | stable | [display-language-toggle.tsx](E:\Projects\Portfolio%20Manager\components\navigation\display-language-toggle.tsx) | Global zh/en UI language control with an elevated dropdown overlay |
| DisplayCurrencyToggle | stable | [display-currency-toggle.tsx](E:\Projects\Portfolio%20Manager\components\navigation\display-currency-toggle.tsx) | Global CAD/USD control |
| FxInfoPopoverContent | stable | [fx-info-popover-content.tsx](E:\Projects\Portfolio%20Manager\components\navigation\fx-info-popover-content.tsx) | Shared FX explanation block |
| LooMascot | stable | [loo-mascot.tsx](E:\Projects\Portfolio%20Manager\components\brand\loo-mascot.tsx) | Shared original brand mascot for hero and onboarding surfaces |
| MascotAsset | stable | [mascot-asset.tsx](E:\Projects\Portfolio%20Manager\components\brand\mascot-asset.tsx) | Wrapper for user-supplied mascot images stored in `public/mascot` |
| CitizenIdentityCard | stable | [citizen-identity-card.tsx](E:\Projects\Portfolio%20Manager\components\auth\citizen-identity-card.tsx) | Shared structured ID-card surface for the Chinese Loo国 citizen flow, with embedded auth-field support, visual stamps, click-to-open lore popovers, single-open behavior, and `Esc` dismiss |
| LooTermsDialog | stable | [loo-terms-dialog.tsx](E:\Projects\Portfolio%20Manager\components\auth\loo-terms-dialog.tsx) | Shared terms / oath modal for Chinese-mode auth |
| LooApprovalDialog | stable | [loo-approval-dialog.tsx](E:\Projects\Portfolio%20Manager\components\auth\loo-approval-dialog.tsx) | Shared Chinese-mode approval / issuance modal used for citizen registration results |
| AppShell | stable | [app-shell.tsx](E:\Projects\Portfolio%20Manager\components\layout\app-shell.tsx) | Shared page shell |
| FloatingHeaderFrame | stable | [floating-header-frame.tsx](E:\Projects\Portfolio%20Manager\components\layout\floating-header-frame.tsx) | Shared sticky header behavior |
| LineChartCard | stable | [line-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\line-chart.tsx) | Shared trend chart shell |
| DonutChartCard | stable | [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx) | Shared donut chart shell |
| RadarPreview | stable | [radar-preview.tsx](E:\Projects\Portfolio%20Manager\components\charts\radar-preview.tsx) | Shared preview chart with optional CTA destination and label |
| QuickActionCard | stable | [quick-action-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\quick-action-card.tsx) | Shared analytical sidebar action card with optional deep-link support |
| HoldingTable | stable | [holding-table.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-table.tsx) | Shared holdings detail table with optional deep-link highlight state |
| DonutChartCard | stable | [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx) | Shared donut chart shell with optional active-slice emphasis for deep-linked account focus |
| RecommendationSummaryCard | stable | [recommendation-summary-card.tsx](E:\Projects\Portfolio%20Manager\components\dashboard\recommendation-summary-card.tsx) | Shared dashboard recommendation surface |

## Stable Domain Components

| Component | Status | File | Notes |
|---|---|---|---|
| ImportExperience | domain | [import-experience.tsx](E:\Projects\Portfolio%20Manager\components\import\import-experience.tsx) | Guided portfolio import orchestration |
| WorkflowOptionCard | domain | [workflow-option-card.tsx](E:\Projects\Portfolio%20Manager\components\import\workflow-option-card.tsx) | Shared workflow entry card inside import surfaces |
| ImportJobPanel | domain | [import-job-panel.tsx](E:\Projects\Portfolio%20Manager\components\import\import-job-panel.tsx) | Direct portfolio CSV workflow |
| SpendingImportPanel | domain | [spending-import-panel.tsx](E:\Projects\Portfolio%20Manager\components\import\spending-import-panel.tsx) | Spending import workflow |
| RefreshPricesPanel | domain | [refresh-prices-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\refresh-prices-panel.tsx) | Quote refresh interaction |
| HealthDimensionCard | domain | [health-dimension-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-dimension-card.tsx) | Health-score dimension breakdown card for the dedicated portfolio health page |
| HealthActionQueue | domain | [health-action-queue.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-action-queue.tsx) | Ordered action queue for the portfolio health detail surface |
| HealthDrilldownCard | domain | [health-drilldown-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-drilldown-card.tsx) | Account-type-level and holding-level drill-down card for the portfolio health detail surface, with a shared next-contribution amount switcher |
| RecommendationRunPanel | domain | [recommendation-run-panel.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-run-panel.tsx) | Recommendation generation action |
| RecommendationPriorityStack | domain | [recommendation-priority-stack.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-priority-stack.tsx) | Controller layer that keeps only one ranked recommendation expanded at a time |
| RecommendationDetailCard | domain | [recommendation-detail-card.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-detail-card.tsx) | Compact recommendation summary card with on-demand expansion into a unified decision trace, plain-language tags, glossary hover help, constraints, alternatives, and execution detail |
| ScenarioCompareCard | domain | [scenario-compare-card.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\scenario-compare-card.tsx) | Re-solved scenario compare surface with delta summary versus the current run |
| PreferencesWorkbench | domain | [preferences-workbench.tsx](E:\Projects\Portfolio%20Manager\components\settings\preferences-workbench.tsx) | Guided + manual settings workflow |
| ChineseLoginPanel | domain | [chinese-login-panel.tsx](E:\Projects\Portfolio%20Manager\components\auth\chinese-login-panel.tsx) | Chinese-mode citizen identity gate for login |
| ChineseRegisterPanel | domain | [chinese-register-panel.tsx](E:\Projects\Portfolio%20Manager\components\auth\chinese-register-panel.tsx) | Chinese-mode citizen application flow with gender cards and shared Loo皇 approval / rejection dialogs |
| CitizenProfilePanel | domain | [citizen-profile-panel.tsx](E:\Projects\Portfolio%20Manager\components\settings\citizen-profile-panel.tsx) | Chinese-mode citizen archive with admin override controls |

## Extraction Candidates

No high-priority extraction candidates remain in the current shared layer. New candidates should only be added when a pattern appears in at least two surfaces.

## Inventory Rule

When a new reusable component is created:

1. Add it to this file
2. Mark whether it is `stable`, `candidate`, or `domain`
3. If it is shared, also document it in `component-library.md`
