# Loo国的财富宝库 Information Architecture

Last updated: 2026-03-17

## Primary Navigation

- Dashboard
- Portfolio
- Recommendations
- Spending
- Import
- Settings

## Page Roles

### Dashboard

Purpose:
- Give a fast overview of wealth, portfolio health, and whether action is needed

Contains:
- KPI cards
- Portfolio Health Score placeholder
- recommendation alert
- account overview
- allocation drift
- asset mix
- top holdings
- net worth trend
- monthly spending snapshot
- recommendation summary

Rules:
- overview only
- no full recommendation table
- no deep tax explanation

### Portfolio

Purpose:
- Provide a portfolio workspace that starts with account structure and supports deeper account and holding drill-down

Contains:
- account card list
- account detail page
- holding detail page
- holdings detail
- account allocation
- sector exposure
- concentration risk
- gain/loss
- 6-month performance
- health-score detail

Rules:
- repeated account types must remain distinguishable
- account category and account instance are different concepts and should both be supported
- account-first reading comes before raw holding-table density
- account detail is the primary drill-down destination from account rows
- account detail now also owns the primary Phase 3 repair entry points for:
  - account metadata edit
  - add-holding flow for new positions
  - account merge preview / confirmation
  - delete-account confirmation
- dashboard account rows should also deep-link directly into account detail, not behave like passive summaries
- dashboard and portfolio account rows should both use a clear whole-row hover affordance so users can tell the full row is clickable before they commit
- holding detail is the primary drill-down destination from symbol links inside holdings tables
- holding detail now also owns the primary Phase 3 repair entry point for:
  - holding edit
  - holding classification repair
- security detail is the primary drill-down destination from recommendation lead/alternative symbols, even when the user does not already hold the symbol
- dashboard top-holding rows should also deep-link into holding detail, not stop at overview-level cards
- health-score holding drilldowns should open concrete holding detail pages when the diagnosis is about a specific position
- recommendation cards should deep-link into concrete holding detail when the explanation explicitly references an already-heavy existing position
- recommendation cards should deep-link into a security detail page when the user wants to inspect a recommended symbol before buying it
- portfolio and holding surfaces must distinguish between:
  - share of total portfolio
  - share inside the current account
- holding detail should clearly answer:
  - what this security is
  - where its current quote came from
  - whether that quote is delayed or cached
  - how large it is globally vs inside the account
- account detail should surface a quick facts layer before the chart, so the user can size up the account before reading the full holdings list

### Recommendations

Purpose:
- Provide detailed funding decisions

Contains:
- contribution amount
- target allocation
- account and tax context
- ranked priorities
- ticker suggestions
- explanation
- assumptions

### Spending

Purpose:
- Show spending and cash-flow context that supports wealth planning

Contains:
- monthly spending total
- savings rate
- investable cash
- spending trend
- category breakdown
- recent transactions

Rule:
- secondary to portfolio decision support

### Import

Purpose:
- Bring holdings and transactions into the product

Contains:
- account setup
- CSV upload
- mapping review
- correction flow
- target setup entry points

### Settings

Purpose:
- Capture the preferences that power recommendations and health scoring

Contains:
- Profile / citizen archive
- guided allocation setup
- manual configuration
- target allocation
- account priorities
- tax-aware placement
- cash buffer
- recommendation strategy
- rebalancing tolerance

## Cross-Page Logic

- Settings defines the target allocation and strategy
- Recommendations uses those settings to generate funding guidance
- Portfolio Health Score measures how well the current portfolio matches those settings
- Portfolio should provide the concrete account and holding destinations that health-score and recommendation explanations point to
- Dashboard summarizes the current state and routes the user to deeper views
- In Chinese mode, login, registration, and Settings profile are wrapped in a Loo国 citizen identity experience
- In English mode, authentication and profile remain standard Portfolio Manager flows

## Design Principles

- Dashboard is overview, not analysis overload
- Recommendations is detailed, not summary-only
- Portfolio must feel like a workspace, not only a diagnostics page
- Spending supports the investing workflow, not the other way around
- Settings must make the recommendation engine feel transparent, not black-box

