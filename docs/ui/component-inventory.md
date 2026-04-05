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
| AppShell | stable | [app-shell.tsx](E:\Projects\Portfolio%20Manager\components\layout\app-shell.tsx) | Shared page shell with a compact non-home page-title treatment that keeps analytical pages dense and avoids hero-like empty space |
| FloatingHeaderFrame | stable | [floating-header-frame.tsx](E:\Projects\Portfolio%20Manager\components\layout\floating-header-frame.tsx) | Shared sticky header behavior |
| ScrollToTopButton | stable | [scroll-to-top-button.tsx](E:\Projects\Portfolio%20Manager\components\layout\scroll-to-top-button.tsx) | Global floating return-to-top control for long pages |
| StickyRail | stable | [sticky-rail.tsx](E:\Projects\Portfolio%20Manager\components\layout\sticky-rail.tsx) | Shared sticky side rail wrapper with its own overflow-y scroll when rail content exceeds viewport height, a lowered top offset under the full header stack, hidden native scrollbars, wheel handoff back to the main page at rail boundaries, and a deliberately narrow width so the main analytical column keeps priority |
| LineChartCard | stable | [line-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\line-chart.tsx) | Shared trend chart shell |
| DonutChartCard | stable | [donut-chart.tsx](E:\Projects\Portfolio%20Manager\components\charts\donut-chart.tsx) | Shared donut chart shell with active-slice emphasis and slice hover tooltips, explicit suppression of chart labels so sticky rails stay clean, compact size options for narrower right-rail stacks, reduced internal spacing for summary-sized donut cards, optional compact side legend for fixed distribution labels, and page-level stretch support for right-rail summary slots |
| RadarPreview | stable | [radar-preview.tsx](E:\Projects\Portfolio%20Manager\components\charts\radar-preview.tsx) | Shared preview chart with optional CTA destination and label |
| AccountOverviewCard | stable | [account-overview-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\account-overview-card.tsx) | Shared portfolio account-instance summary row with unique account naming, hover-lift affordance, click-to-toggle account context, an explicit locked-state pill, a dedicated account-detail entry point, a separate holdings-jump action, and a compact gain/loss line beneath the main value |
| AccountBreakdownPanel | stable | [account-breakdown-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\account-breakdown-panel.tsx) | Sticky right-rail account-instance donut summary that follows the selected account context and exposes account detail through slice hover instead of a permanent legend list |
| QuickActionCard | stable | [quick-action-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\quick-action-card.tsx) | Shared analytical sidebar action card with optional deep-link support |
| HoldingTable | stable | [holding-table.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-table.tsx) | Shared holdings detail table with optional deep-link highlight state, one primary security entry pill instead of parallel holding/security buttons, explicit total-shares and average-cost display, a clear split between share of total portfolio and share inside the current account, shorter Chinese headers, a compressed current-value column, clean UTF-8 copy, and Loo皇-style review copy in Chinese mode |
| SecurityMark | stable | [security-mark.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\security-mark.tsx) | Shared security visual with asset-class tone, monogram fallback, and optional short hint pill for detail pages |
| WatchlistToggleButton | domain | [watchlist-toggle-button.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\watchlist-toggle-button.tsx) | Fast single-symbol watchlist action used in discovery and unified symbol pages, keeping add/remove outside the Settings bulk-edit workflow |
| AccountMaintenancePanel | domain | [account-maintenance-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\account-maintenance-panel.tsx) | Unified Phase 3 maintenance panel for account edit, import-routed add-holding, merge preview/confirm, and guarded account deletion, collapsed by default, using single-column forms and keeping destructive delete at the bottom of edit mode |
| HoldingEditPanel | domain | [holding-edit-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\holding-edit-panel.tsx) | Collapsed Phase 3 repair panel for holding edits, account reassignment, and classification overrides, with vertically stacked amount fields, expanded gold/commodity/REIT/trust suggestions, auto-derived cost-basis/current-value inputs until manually overridden, save behavior that refreshes parent account totals, and a selected-account symbol view that keeps the old holding-detail depth inside the unified security route |
| CandidateScorePanel | domain | [candidate-score-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\candidate-score-panel.tsx) | Recommendation-style scorecard panel for one user-selected symbol, used in discovery results and unified symbol pages to show overall score, account fit, tax fit, security score, and warnings |
| UnifiedSecurityDetail | domain | [unified-security-detail.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\unified-security-detail.tsx) | Unified symbol workspace that keeps candidate securities and already-held positions on the same route, defaults held symbols to an aggregate cross-account view, uses compact metric-rail dropdown selectors for account and record context, reveals the full holding-detail repair/review stack after the user selects one account, and adds a second record selector when that account contains multiple holding rows for the same symbol |
| RecommendationSummaryCard | stable | [recommendation-summary-card.tsx](E:\Projects\Portfolio%20Manager\components\dashboard\recommendation-summary-card.tsx) | Shared dashboard recommendation surface |

## Stable Domain Components

| Component | Status | File | Notes |
|---|---|---|---|
| ImportExperience | domain | [import-experience.tsx](E:\Projects\Portfolio%20Manager\components\import\import-experience.tsx) | Guided portfolio import orchestration with a compact top context strip instead of a large onboarding hero |
| SecurityDiscoveryWorkbench | domain | [security-discovery-workbench.tsx](E:\Projects\Portfolio%20Manager\components\discover\security-discovery-workbench.tsx) | Dedicated discovery surface for arbitrary symbol search, quick watchlist actions, and recommendation-style candidate scoring before opening the unified symbol page |
| WorkflowOptionCard | domain | [workflow-option-card.tsx](E:\Projects\Portfolio%20Manager\components\import\workflow-option-card.tsx) | Shared workflow entry card inside import surfaces |
| ImportJobPanel | domain | [import-job-panel.tsx](E:\Projects\Portfolio%20Manager\components\import\import-job-panel.tsx) | Direct portfolio CSV workflow |
| SpendingImportPanel | domain | [spending-import-panel.tsx](E:\Projects\Portfolio%20Manager\components\import\spending-import-panel.tsx) | Spending import workflow |
| RefreshPricesPanel | domain | [refresh-prices-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\refresh-prices-panel.tsx) | Quote refresh interaction with explicit explanation that missing quotes may still leave older cached prices visible |
| RefreshSecurityPricePanel | domain | [refresh-security-price-panel.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\refresh-security-price-panel.tsx) | Single-symbol refresh panel with a compact right-rail variant used as the first card in holding and security detail summary rails |
| HealthDimensionCard | domain | [health-dimension-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-dimension-card.tsx) | Health-score dimension breakdown card for the dedicated portfolio health page |
| HealthActionQueue | domain | [health-action-queue.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-action-queue.tsx) | Ordered action queue for the portfolio health detail surface |
| HealthDrilldownCard | domain | [health-drilldown-card.tsx](E:\Projects\Portfolio%20Manager\components\portfolio\health-drilldown-card.tsx) | Account-type-level and holding-level drill-down card for the portfolio health detail surface, with a shared next-contribution amount switcher |
| Portfolio health detail layout | stable | [page.tsx](E:\Projects\Portfolio%20Manager\app\portfolio\health\page.tsx) | Health detail pages should read top-to-bottom: a compact overview card beside the radar card, then a full-width action queue, then a full-width reminders / recommendation handoff card, then full-width dimension cards, then single-column drill-down sections. Keep all copy in clean UTF-8 and avoid split layouts that leave a blank left gutter. |
| PortfolioSecurityDetailPage | domain | [page.tsx](E:\Projects\Portfolio%20Manager\app\portfolio\security\[symbol]\page.tsx) | Unified symbol brief for recommended or already-held symbols, using the shared detail-overview pattern, defaulting held symbols to a combined cross-account view, and expanding into account-level holding detail once the user selects an account |
| Detail overview pattern | stable | [account page](E:\Projects\Portfolio%20Manager\app\portfolio\account\[accountId]\page.tsx), [security page](E:\Projects\Portfolio%20Manager\app\portfolio\security\[symbol]\page.tsx) | Shared first-fold layout for detail pages: left identity-plus-trend overview, right compact metrics only, no repeated ratio/gain-loss facts immediately restated below, a consistent title-row where key pills sit directly to the right of the title, account detail keeps only a short main-holdings strip instead of a longer explainer paragraph, the account detail metric priority is current value -> gain/loss -> currency -> room, share of total portfolio lives as helper copy under current value, and the right summary rail should use short values plus a compact donut so both columns stay visually balanced |
| RecommendationRunPanel | domain | [recommendation-run-panel.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-run-panel.tsx) | Recommendation generation action with a smaller companion mascot block so the left rail stays dense |
| RecommendationPriorityStack | domain | [recommendation-priority-stack.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-priority-stack.tsx) | Controller layer that keeps only one ranked recommendation expanded at a time |
| RecommendationDetailCard | domain | [recommendation-detail-card.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\recommendation-detail-card.tsx) | Recommendation card with a short top summary, wide 2x2 summary blocks, a readable expanded layout for long Chinese copy, Chinese `Loo皇审核` reasoning, neutral English copy, grouped practical checks, direct links into the lead and alternative security briefs, and related heavy-holding detail links when relevant |
| ScenarioCompareCard | domain | [scenario-compare-card.tsx](E:\Projects\Portfolio%20Manager\components\recommendations\scenario-compare-card.tsx) | Re-solved scenario compare surface with delta summary versus the current run |
| Recommendations input summary | domain | [recommendations/page.tsx](E:\Projects\Portfolio%20Manager\app\recommendations\page.tsx) | Top-of-page context block that separates the saved funding order from the usable order for this contribution, weakens or warns on sheltered accounts whose room is exhausted, keeps Chinese copy in `Loo皇审核` tone while English stays neutral, uses a collapsible first-time reading hint instead of a permanently expanded onboarding block, stacks the three “how the system is thinking” summaries vertically, and keeps the longer explainer behind a collapsible detail panel so the first fold stays dense |
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

