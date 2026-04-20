# Personal Wealth Intelligence Platform
## Business Requirements Document (BRD)

Version: 1.2
Status: Draft
Author: Project Owner
Last Updated: 2026-03-17

---

# 1. Executive Summary

The Personal Wealth Intelligence Platform is a web-based application designed to help individual investors consolidate financial data, analyze portfolio structures, configure an investment strategy, and receive actionable capital-allocation guidance.

Unlike traditional personal finance tools that focus mainly on expense tracking, this platform focuses on investment decision support, with light spending visibility retained only where it supports wealth and contribution decisions.

Primary value:

- Aggregate financial data across accounts
- Provide portfolio intelligence and diagnostics
- Help users configure or generate a target allocation
- Recommend where new capital should be allocated
- Align portfolio with long-term investment strategy

Core philosophy:

> Wealth overview is the entry point. Investment decision support is the core value.

---

# 2. Product Vision

Create a centralized wealth decision platform that allows users to:

1. Understand their financial position
2. Analyze investment portfolio structure
3. Configure an investment strategy they trust
4. Receive structured investment guidance
5. Improve portfolio alignment with long-term goals

The system combines:

- light wealth management
- portfolio analytics
- investment-preference configuration
- recommendation engine

into one platform.

---

# 3. Target User

Primary user profile:

- Individual investor
- Based in Canada
- Uses self-directed brokerage accounts
- Accounts may include TFSA, RRSP, FHSA, and non-registered
- Investment strategy: ETF core plus selective stocks
- Long-term growth focus

Key characteristics:

| Attribute | Description |
|---|---|
| Investment style | ETF core + selective stocks |
| Risk tolerance | Balanced growth |
| Primary accounts | TFSA, RRSP, FHSA, Non-registered |
| Primary need | Decide how new capital should be allocated |

---

# 4. Product Objectives

## Objective 1
Provide a unified wealth and portfolio overview

Including:

- net worth overview
- transaction import support
- spending visibility that informs investable cash
- financial visualization

## Objective 2
Provide portfolio intelligence capabilities

Including:

- account allocation analysis
- sector exposure analysis
- gain/loss insights
- concentration diagnostics
- future portfolio health scoring

## Objective 3
Answer the key investment question:

> Where should new capital be allocated?

## Objective 4
Help users configure or generate a target allocation that recommendations can use transparently

---

# 5. Product Scope

## In Scope

- Multi-account asset aggregation
- Net worth tracking
- Portfolio analytics
- Funding recommendation engine
- Investment preference settings
- Guided allocation setup
- Watchlist system
- Portfolio health score placeholder in MVP and detailed scoring in P1
- Basic spending analysis

## Out of Scope (initial versions)

- Automated trading
- Real-time bank integrations
- Social investing
- Mobile native apps
- Full budgeting parity with spending-first finance tools

---

# 6. System Architecture Overview

Wealth Intelligence Platform

- Asset System
- Portfolio Intelligence
- Investment Preferences
- Funding Recommendation Engine
- Spending System

---

# 7. Core Feature Modules

## 7.1 Asset System

Purpose:

Aggregate financial data from multiple accounts and provide a unified wealth overview.

### Features

- Account management
- Net worth calculation
- Asset allocation visualization
- Historical net worth tracking

### Supported Accounts

- TFSA
- RRSP
- FHSA
- Non-registered
- bank accounts
- credit cards

### Key Outputs

- Net worth
- Total assets
- Asset distribution
- Account distribution

## 7.2 Portfolio Intelligence

Purpose:

Analyze portfolio structure and identify structural risks.

### Analysis Dimensions

- Account allocation
- Sector exposure
- Gain/loss distribution
- Position concentration
- Allocation drift

### Outputs

- Portfolio diagnostics
- Exposure warnings
- Concentration alerts
- 6-month performance analysis

## 7.2A Portfolio Workspace

Purpose:

Turn Portfolio into a workspace where users can understand account structure, drill into one account or holding, and eventually repair imported portfolio structure.

### Required capabilities

- account-first portfolio reading
- clear distinction between account categories and concrete account instances
- account detail surface
- holding detail surface
- future account merge and holding edit workflows

### Why it matters

- recommendation and health-score explanations need concrete account and holding destinations
- repeated TFSA / FHSA / RRSP accounts are otherwise ambiguous
- users must be able to inspect and fix portfolio structure, not only import it

## 7.3 Investment Preferences

Purpose:

Capture or generate the target allocation and strategy settings that the product uses for recommendations and future health scoring.

### Features

- Risk profile
- Target asset allocation
- Account funding priorities
- Tax-aware asset placement rules
- Cash buffer target
- Recommendation behavior
- Rebalancing tolerance
- Guided allocation setup

### Outputs

- Saved target allocation
- Strategy configuration
- Suggested starting allocation for beginners

## 7.4 Funding Recommendation Engine

Purpose:

Provide structured guidance on how new investment capital should be allocated.

### Recommendation Layers

Layer 1: asset-class priorities

Layer 2: account placement

Layer 3: ticker suggestions

### Recommendation Outputs

- Priority ranking
- Allocation percentages
- Suggested accounts
- Explanation reasoning
- Confidence level

## 7.5 Spending System

Purpose:

Provide awareness of financial spending patterns and investable cash without becoming a full budgeting product.

### Features

- CSV transaction import
- Monthly spending analysis
- Category breakdown
- Savings-rate view
- Investable-cash estimate

### Outputs

- Monthly spending summary
- Savings rate
- Top spending categories
- Recent transactions

## 7.6 Portfolio Health Score (P1 Feature)

Purpose:

Measure how well the portfolio aligns with the user's investment strategy.

### Outputs

- Overall score
- Radar chart visualization
- Dimension scoring
- Suggested improvements

### Evaluation Dimensions

1. Asset Allocation Alignment
2. Sector Diversification
3. Account Efficiency
4. Position Concentration
5. Risk Alignment

---

# 8. UI Architecture

Primary navigation:

- Dashboard
- Portfolio
- Recommendations
- Spending
- Import
- Settings

---

# 9. Home Page Overview

Purpose:

Provide a wealth overview, show whether action is needed, and direct the user to deeper recommendation detail.

### Components

- Total portfolio
- Available room
- Portfolio risk
- Portfolio health score placeholder (P1 preview)
- Recommendation alert
- Account overview
- Allocation drift
- Asset mix
- Top holdings
- Net worth trend
- Spending summary
- Recommendation summary

---

# 10. Portfolio Page

Purpose:

Provide detailed portfolio analysis.

### Sections

- account card list
- Holdings detail
- Account allocation
- Sector exposure
- Concentration risk
- Gain/loss
- 6-month performance
- Future portfolio health score detail
- future account detail page
- future holding detail page

---

# 11. Recommendations Page

Purpose:

Provide actionable investment guidance.

### Sections

1. Contribution amount
2. Target allocation
3. Account and tax fit
4. Ranked funding priorities
5. Suggested tickers
6. Explanation
7. Risk notes

---

# 12. Spending Page

Purpose:

Provide monthly spending and transaction visibility that supports wealth planning and contribution decisions.

### Sections

1. Spending summary
2. Spending trend
3. Category breakdown
4. Recent transactions
5. Investable cash estimate

---

# 13. Settings Page

Purpose:

Allow the user to configure or generate investment preferences that drive recommendations and future health scoring.

### Sections

1. Guided allocation setup
2. Profile / citizen archive
3. Manual configuration
4. Target allocation
5. Account funding priorities
6. Tax-aware placement preferences
7. Cash buffer target
8. Recommendation strategy
9. Rebalancing tolerance

---

# 14. Data Model Overview

Core entities:

- User
- Citizen Profile
- Accounts
- Holdings
- Transactions
- Watchlist
- Preferences

---

# 15. MVP Feature List

MVP features include:

- Asset aggregation
- Net worth dashboard
- Portfolio analysis
- Funding recommendation engine
- Investment preferences manual setup
- Watchlist system
- CSV data import
- Basic spending snapshot

---

# 16. P1 Feature List

Planned enhancements:

- Guided allocation setup
- Portfolio health score
- Radar chart portfolio diagnostics
- Dedicated spending page
- Enhanced recommendation logic
- Chinese-mode citizen identity layer
- Portfolio workspace phase 1
- account detail and holding detail pages

---

# 17. P2 Feature List

Future advanced capabilities:

- Portfolio simulation
- Rebalancing optimizer
- Historical portfolio scoring
- Market signal integration
- account merge workflows
- holding edit workflows
- replay-based historical portfolio performance

---

# 18. Success Metrics

The platform succeeds if users can:

1. Clearly visualize total wealth and portfolio structure
2. Configure a target allocation they understand and trust
3. Receive structured capital allocation guidance
4. Use light spending visibility to understand investable cash

---

# 19. Next Steps

1. Freeze UI/UX baseline
2. Finalize information architecture and preference flow
3. Update execution backlog
4. Build frontend implementation skeleton

---

# End of Document
