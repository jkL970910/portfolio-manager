# Portfolio Manager MVP PRD

## 1. Summary

This PRD defines the first shippable version of Portfolio Manager, a web application for self-directed Canadian investors. The product helps users import portfolio data, define an investment strategy, understand portfolio health, and decide where new capital should go.

This version is not a full personal finance replacement. It is a portfolio decision-support product with light wealth and spending visibility that supports the contribution workflow.

In Chinese mode, the product also adds a branded Loo国 citizen identity layer for login, registration, and profile display. This changes onboarding and profile presentation, but does not replace the underlying account system.

## 2. Contacts

| Name | Role | Comment |
|---|---|---|
| Project Owner | Product Owner | Owns product direction and prioritization |
| Project Owner | Engineering Lead | Owns architecture and implementation choices |
| Project Owner | Design Reviewer | Owns UX decisions and workflow clarity |

## 3. Background

Many retail investors can see their holdings inside a broker account, but they still struggle to answer a simple question: where should the next contribution go?

Existing tools usually focus on one of two things:

- personal finance and spending visibility
- static broker views of existing holdings

Neither approach is built around capital allocation decisions across multiple accounts. This creates a gap for users who already know the basics of investing but want structured support for portfolio decisions.

Portfolio Manager is intended to fill that gap for a narrow first segment: self-directed Canadian investors using accounts such as TFSA, RRSP, FHSA, and non-registered accounts, with a portfolio style built around ETFs plus selected stock picks.

Why now:

- investors increasingly manage multiple account types and contribution decisions
- spreadsheet-based portfolio review is slow and error-prone
- import-first MVPs are now practical without waiting for bank-grade integrations
- beginners need help setting a target allocation before recommendation systems feel trustworthy
- the Chinese-language experience now needs a distinct branded identity layer without breaking the standard English product flow

## 4. Objective

### Primary Objective

Help a self-directed investor decide where new money should go based on current portfolio structure, target allocation, and account context.

### Secondary Objective

Help the user build or configure a target allocation that the recommendation engine and future portfolio health score can use transparently.

### Why It Matters

For users:
- reduces confusion during contribution decisions
- increases confidence in portfolio management
- improves portfolio alignment over time
- provides a simple spending and cash-availability view without turning into a budgeting-first product

For the product:
- creates a clear differentiated use case
- avoids building a generic finance dashboard
- provides a repeatable monthly workflow
- grounds recommendations in user-defined preferences instead of black-box defaults

### Key Results

1. At least 80% of test users can import holdings data for two or more accounts and see a unified portfolio view in one session.
2. At least 70% of test users can generate a funding recommendation with ranked actions and explanation in under 10 minutes from data import.
3. At least 60% of test users report that the recommendation output is clear enough to support their next contribution decision.
4. At least 50% of active test users return within 30 days to review their portfolio again.
5. At least 60% of new test users can either manually configure or generate a starting target allocation without needing outside help.

## 5. Market Segment(s)

### Primary Segment

Self-directed Canadian investors who:

- manage at least two investment accounts
- contribute new capital regularly
- use ETFs as the portfolio core and may hold selected stocks
- care about account placement, diversification, and allocation drift
- do not want to calculate contribution decisions manually every time

### User Constraints

- may only have CSV exports or manual account data
- may have different tax treatments across accounts
- may not trust black-box recommendations
- may not know how to build a target allocation on their own
- may not update data daily

### Out of Scope Segment

- active traders needing real-time execution support
- users wanting automated trading
- users mainly seeking full budgeting and spending replacement
- users without a portfolio or contribution workflow

## 6. Value Proposition(s)

### Core Value Proposition

Portfolio Manager helps a self-directed investor turn scattered account data into a clear funding plan.

### Customer Job

"I want to know what I own, what is out of balance, and where my next contribution should go."

### Before

- holdings are spread across accounts
- contribution choices are based on memory, habit, or guesswork
- diversification and concentration issues are hard to see quickly
- target allocation preferences may exist only in the user's head, if at all

### How

- import holdings and account data
- normalize the portfolio into a unified view
- configure or generate target allocation preferences
- calculate allocation, concentration, and exposure signals
- compare actual portfolio state with target preferences
- recommend how new capital should be allocated

### After

- user sees a unified wealth and portfolio snapshot
- user understands what is off-target
- user receives a ranked recommendation with explanation and account guidance
- user can inspect a lightweight spending view that helps estimate investable cash

### Alternatives Today

- broker dashboards
- spreadsheets
- general personal finance tools
- manual note-taking and ad hoc decisions

## 7. Solution

### 7.1 UX and User Flow

Primary MVP flow:

1. User adds or imports accounts and holdings
2. User lands on a dashboard that summarizes wealth, portfolio health, and recommendation status
3. User configures investment preferences manually or through a guided setup
4. User reviews portfolio analysis and allocation drift
5. User enters available new capital
6. System returns a transparent funding recommendation
7. User optionally reviews spending and investable cash context

### 7.2 Information Architecture

Primary navigation:

- Dashboard
- Portfolio
- Recommendations
- Spending
- Import
- Settings

Page roles:

- Dashboard: overview, alerts, net worth trend, spending snapshot, recommendation summary
- Portfolio: deep portfolio analysis, drift, performance, concentration, future health-score detail
- Recommendations: detailed funding decisions, account fit, explanation, and assumptions
- Spending: monthly spending, cash availability, category breakdown, transaction detail
- Import: account setup, CSV upload, field mapping, correction flow
- Settings: investment preferences, guided allocation setup, account priorities, recommendation behavior

Chinese-mode identity layer:

- Login becomes "enter Loo国"
- Registration becomes "apply to join Loo国"
- Settings includes a citizen profile section with an ID-card presentation
- English mode keeps the standard Portfolio Manager auth and profile flow

### 7.3 Key Features

#### Feature 1: Account and Holdings Import

Description:
- Support manual entry and CSV import for account holdings and balances
- Normalize accounts into a unified data model

Acceptance criteria:
- User can import at least TFSA and non-registered data
- Imported holdings map to account, ticker, quantity, and value
- User can correct import issues manually

#### Feature 2: Dashboard Overview

Description:
- Show total portfolio value, account breakdown, asset allocation, net worth trend, and recommendation status
- Keep the page summary-level, not a full recommendation workflow

Acceptance criteria:
- Dashboard shows total assets, account totals, and recommendation alert status
- Dashboard includes net worth trend and a light monthly spending snapshot
- Dashboard includes a recommendation summary with a clear CTA to open Recommendations

#### Feature 3: Portfolio Diagnostics

Description:
- Analyze account allocation, sector exposure, gain/loss posture, position concentration, and 6-month performance

Acceptance criteria:
- User can identify top holdings by weight
- System highlights concentration risk based on configurable thresholds
- System shows allocation summaries and 6-month portfolio performance in the Portfolio view

#### Feature 3A: Portfolio Workspace

Description:
- Upgrade Portfolio from a holdings-only diagnostics surface into an account-and-holding workspace

Acceptance criteria:
- Portfolio clearly distinguishes repeated account types such as multiple TFSA or FHSA accounts
- User can understand the difference between account category and concrete account instance
- Portfolio can surface account-first views before forcing the user into holding-level detail

#### Feature 3B: Account Detail and Holding Detail

Description:
- Add drill-down pages for accounts and holdings

Acceptance criteria:
- User can open one account and inspect its value, holdings, and role inside the broader portfolio
- User can open one holding and inspect its basic security information, portfolio role, and price trend
- Recommendation and health-score views can route the user into these concrete detail surfaces

#### Feature 3C: Account and Holding Edit Workflows

Description:
- Allow users to repair imported portfolio structure

Acceptance criteria:
- User can edit account metadata
- User can edit holding metadata
- User can move a holding across accounts
- User can merge duplicate accounts with preview and confirmation

#### Feature 3D: Real Historical Portfolio Performance

Description:
- Replace synthetic trend lines with replayed historical portfolio values

Acceptance criteria:
- Dashboard and Portfolio trends are built from replayed portfolio/account/holding history
- Time series follow imported positions and historical price data rather than placeholder curves

#### Feature 4: Funding Recommendation Engine v1

Description:
- Accept new capital amount and generate ranked allocation suggestions
- Recommend account placement and ticker or asset-bucket priorities
- Explain why each recommendation is proposed

Acceptance criteria:
- User enters a contribution amount
- System returns top recommendations with percentage split
- Output includes explanation, confidence level, and key assumptions
- Recommendation is based on current holdings plus user-configured target allocation rules
- Tax and account-fit language is framed as decision support, not guaranteed advice

#### Feature 5: Investment Preferences

Description:
- Let the user define the target allocation and recommendation behavior that downstream analysis will use

Acceptance criteria:
- User can set risk profile and investment horizon
- User can configure a target allocation that totals 100%
- User can set account funding priorities
- User can configure cash buffer and rebalancing tolerance
- User can define whether recommendations should stay close to current holdings or move more directly toward target

#### Feature 6: Guided Allocation Setup

Description:
- Provide a beginner-friendly flow that generates a suggested starting allocation from a short questionnaire

Acceptance criteria:
- User can answer guided questions about goal, horizon, volatility tolerance, cash needs, and investing style
- System produces a suggested starting allocation with explanation and assumptions
- Suggested allocation is editable before saving
- User can save as draft or apply the allocation directly

#### Feature 7: Watchlist and Candidate Assets

Description:
- User can maintain candidate ETFs or stocks and define watchlist constraints

Acceptance criteria:
- User can add, edit, and remove watchlist items
- User can choose whether recommendations may use new investment suggestions
- User can optionally limit recommendations to watchlist items only

#### Feature 8: Spending Overview

Description:
- Provide a lightweight spending view that supports wealth awareness and investable-cash estimation

Acceptance criteria:
- User can import transactions from CSV
- Spending view shows monthly spending total, savings rate, investable cash estimate, category summary, and recent transactions
- Spending remains secondary to the portfolio-decision workflow

#### Feature 9: Portfolio Health Score Placeholder and P1 Detail

Description:
- Reserve a future-facing dashboard slot for a portfolio health or alignment score
- In P1, expand that score into a detailed radar-based analysis in the Portfolio experience

Acceptance criteria:
- Dashboard includes a placeholder card for Portfolio Health Score with a mini radar preview and P1 framing
- Future P1 detailed analysis uses these dimensions:
  - Asset Allocation Alignment
  - Sector Diversification
  - Account Efficiency
  - Position Concentration
  - Risk Alignment

#### Feature 10: Chinese-Mode Citizen Identity Layer

Description:
- Add a Chinese-only branded citizen identity layer for login, registration, and profile display
- Registration issues a Loo国 citizen card and stores a citizen profile
- Login and Settings can display the citizen card and effective rank information

Acceptance criteria:
- Chinese login page can render an ID-card style login form inside the default citizen template
- Chinese registration flow captures citizen name, gender, and birth date, plus agreement to Loo国 terms
- Registration success shows an issued citizen card modal before the user manually enters the product
- Settings includes a citizen profile section with effective rank, address, and citizen ID
- English mode remains a standard Portfolio Manager auth/profile flow without Loo国 narration

### 7.4 Technology

Technical direction for MVP:

- web application with simple authenticated user model
- import-first architecture using CSV and manual entry
- modular portfolio calculation layer
- rule-based recommendation engine before advanced optimization
- persistent storage for accounts, holdings, watchlist, transactions, and user preferences

### 7.5 Assumptions

1. Manual and CSV import is acceptable for early users.
2. Users prefer explained rule-based guidance over opaque automation.
3. The recommendation engine can create repeat usage without live broker integrations.
4. Canadian account context is valuable enough to differentiate the experience.
5. Spending visibility can remain supportive and secondary without hurting the core use case.
6. Newer users need guided setup help before target allocation feels approachable.

### 7.6 Compliance and Trust Boundary

The product provides decision support, not automated or regulated investment advice. Recommendations must be framed as portfolio guidance based on user-provided targets, current holdings, and configurable rules. Guided allocation output must be presented as a suggested starting allocation that the user can edit before saving.

## 8. Release

### Version 1: Core MVP

Relative timeframe:
- one focused build cycle

Includes:
- account and holdings import
- dashboard overview
- portfolio diagnostics
- funding recommendation engine v1
- investment preferences manual setup
- watchlist support
- dashboard spending snapshot

Excludes:
- automated trading
- real-time financial institution integrations
- full budgeting workflows
- mobile native apps
- simulation and optimizer features

### Version 1.1

Relative timeframe:
- after MVP validation

Includes:
- guided allocation setup
- dedicated Spending page and transaction detail
- better recommendation logic
- stronger explanation layers
- improved import flows

### Version 1.2 and Beyond

Includes:
- portfolio health score with detailed radar analysis
- scenario analysis
- rebalancing support
- richer cash planning if users prove they need it

## Appendix: Explicit Trade-offs

To keep the MVP focused, the team will not try to replace the majority of Monarch functionality in version one. The product wins only if it is clearly better at portfolio decision support than spreadsheets and generic dashboards. Spending support exists to improve wealth awareness and investable-cash context, not to become the product's main identity.
