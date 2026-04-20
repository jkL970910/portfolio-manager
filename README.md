# Loo国的财富宝库

Loo国的财富宝库 is an AI-assisted investing product prototype for self-directed investors. The product focuses on one operational question:

`Where should my next dollar go?`

It combines:

- portfolio analytics
- contribution recommendation workflows
- spending visibility
- import and normalization workflows
- investment preference configuration

This repository was planned, documented, designed, and implemented with AI-agent-assisted workflows. The point is not "AI built it automatically"; the point is to show a realistic product-building workflow where AI accelerates research, UX iteration, implementation, and documentation while engineering decisions still stay explicit.

## Why This Project Exists

Most retail finance apps are good at tracking balances or budgets, but weak at helping users decide how to allocate new capital across real account constraints.

Loo国的财富宝库 is designed to help users:

- understand portfolio health
- identify allocation drift
- connect spending capacity to investable cash
- import and normalize real account data
- configure preferences without advanced portfolio expertise
- generate recommendation runs tied to current holdings and account priorities

## Core Product Features

### 1. Dashboard
- portfolio summary
- global CAD / USD display toggle
- contribution room visibility
- portfolio risk snapshot
- asset mix and top holdings
- top holdings price freshness
- net worth trend
- monthly spending snapshot
- recommendation summary

### 2. Portfolio Analysis
- account allocation analysis
- holdings detail
- drift and concentration review
- price refresh workflow
- quote freshness and coverage display

### 3. Recommendation Engine v1
- contribution-based allocation suggestions
- account-aware placement
- persisted recommendation runs
- transparent rationale based on current drift and configured preferences

### 4. Spending
- spending summary
- category breakdown
- transaction view
- investable cash framing

### 5. Import
- guided setup flow
- direct CSV import flow
- single-account CSV onboarding
- manual entry with security search and quote lookup
- multi-currency account and holding entry for CAD / USD
- field mapping presets
- dry-run review, symbol audit, correction, and confirm import

### 6. Investment Preferences
- user-scoped preference persistence
- target allocation setup
- guided allocation setup with saved draft persistence
- funding priority configuration
- tax-aware placement settings
- watchlist and transition preferences
- future link to Portfolio Health Score and guided allocation setup

## AI Agent Contribution

AI agents were used for:

- BRD analysis and revision
- PRD generation
- backlog structuring and prioritization
- Notion project and backlog setup
- information architecture design
- Figma Make review and iteration
- frontend scaffolding
- backend contract design
- implementation planning
- market-data provider evaluation

## Tech Stack

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- Lucide React

### Backend / Data
- Next.js Route Handlers
- PostgreSQL
- Drizzle ORM
- Auth.js credentials flow
- user-scoped repository + service architecture

### Market Data
- OpenFIGI for symbol normalization
- Twelve Data for security search and latest-available quotes
- in-process TTL cache for provider-rate protection in local and single-instance environments

### Product / Documentation Workflow
- Markdown docs in-repo
- Notion MCP for backlog and project management
- Figma Make for UI exploration
- Figma MCP for design review workflows

### AI Workflow
- Codex project skills
- product strategy / PRD / prioritization skills
- UI/UX Pro Max skill for design-system and implementation direction

## Current Status

This repository is in `working prototype / alpha` stage.

Implemented now:

- authenticated login and local registration
- PostgreSQL schema and Drizzle-backed repositories
- user-scoped API routes and services
- Dashboard, Portfolio, Recommendations, Spending, Import, and Settings pages
- recommendation runs persisted to the database
- direct CSV import with:
  - preview
  - mapping
  - presets
  - dry-run review
  - symbol audit
  - confirm import
  - replace / merge modes
- guided import with:
  - new or existing account selection
  - manual holdings entry
  - single-account CSV import
  - preset reuse
- manual holdings entry with:
  - security search
  - symbol normalization
  - quote lookup
  - auto-calculated market value
  - optional override total value
  - derived cost basis / gain-loss
- CAD / USD display switching across dashboard, portfolio, recommendations, and spending
- portfolio price refresh with:
  - batch quote refresh
  - freshness / coverage status
- persistent investment preferences and import mapping presets
- persisted guided allocation questionnaire drafts
- unified client-side API safety helpers for fetch payload validation

Not finished yet:

- recommendation engine v2
- richer review persistence for invalid imports
- broker integrations and async workers
- production auth providers beyond local credentials
- cloud-scale cache / object storage / background jobs

## Quick Start

### Prerequisites
- Node.js 20+
- npm

### One-command local startup
```bash
npm run local:start
```

This will:

- prepare local env files
- initialize local PostgreSQL
- push schema
- seed demo data if needed
- start the Next.js dev server

### Validation
```bash
npm run typecheck
npm run build
```

### Demo login
- `jiekun@example.com` / `demo1234`
- `casey@example.com` / `demo1234`

### Important local pages
- `/dashboard`
- `/portfolio`
- `/recommendations`
- `/spending`
- `/import`
- `/settings`

## Project Structure

```text
app/                  Next.js pages and API handlers
components/           shared UI, chart, and feature components
lib/                  backend services, repositories, auth, db, and market-data code
docs/                 BRD, PRD, UX specs, execution docs, guides
design-system/        persisted design-system output from AI-assisted UI workflow
.codex/skills/        local project skills used by Codex
```

## Interview / Demo Angle

This project demonstrates:

- product thinking and scope control
- practical AI-agent collaboration in a real workflow
- translation from BRD/PRD to backlog to Figma to implementation
- repository/service architecture before backend complexity grows
- pragmatic handling of import workflows, market-data tradeoffs, and user-scoped persistence

## Next Steps

1. implement guided allocation setup in Settings
2. deepen recommendation engine rules and explanation quality
3. persist richer import review and correction state
4. add cloud-ready cache and object-storage boundaries
5. introduce broker-scale background jobs when runtime cost justifies them

