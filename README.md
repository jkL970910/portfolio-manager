# Portfolio Manager

Portfolio Manager is an AI-assisted personal investing platform prototype focused on one core question:

`Where should my next dollar go?`

It combines portfolio analytics, contribution recommendations, spending visibility, and guided investment preferences into a single decision-support workflow for self-directed investors.

This repository was planned, documented, and scaffolded with AI agent collaboration. Product definition, information architecture, UI/UX iteration, backlog setup, and the current frontend baseline were all produced through coordinated agent-assisted workflows.

## Why This Project Exists

Most retail finance tools are strong at tracking or budgeting, but weak at helping users make portfolio allocation decisions with context.

Portfolio Manager is designed to close that gap by helping users:

- understand portfolio health
- identify allocation drift
- decide where new capital should be allocated
- connect spending capacity with investable cash
- configure investment preferences without requiring advanced portfolio expertise

## Core Product Features

### 1. Dashboard
- high-level portfolio summary
- available contribution room
- portfolio risk snapshot
- recommendation alert
- asset mix and top holdings
- net worth trend
- monthly spending snapshot
- recommendation summary

### 2. Portfolio Analysis
- account allocation analysis
- sector exposure
- holdings detail
- performance context
- drift and concentration review

### 3. Recommendation Engine
- contribution-based funding priorities
- account-aware allocation suggestions
- transparent recommendation logic
- confidence and rationale display

### 4. Spending
- monthly spending summary
- category breakdown
- recent transactions
- investable cash framing

### 5. Import
- staged onboarding flow
- CSV-first import path
- review and correction workflow
- setup handoff into investment preferences

### 6. Investment Preferences
- manual portfolio preference setup
- guided allocation setup for beginner users
- account priority configuration
- tax-aware placement settings
- future link to portfolio health scoring

## AI Agent Contribution

This project is intentionally built as an example of practical AI-agent-assisted product development.

AI agents were used to help with:

- BRD analysis and revision
- PRD generation
- backlog structuring and prioritization
- Notion project and backlog setup
- information architecture design
- Figma Make review and iteration
- frontend scaffolding
- API contract placeholder design

The goal is not to claim “AI built everything automatically.” The value is in showing a realistic workflow where an engineer or product builder uses AI agents to accelerate product planning and implementation while still making the product decisions.

## Tech Stack

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- Lucide React

### Product / Documentation Workflow
- Markdown docs in-repo
- Notion MCP for backlog and project management
- Figma Make for UI exploration
- Figma MCP for design-review workflows

### Backend / Data
- Next.js Route Handlers
- PostgreSQL
- Drizzle ORM
- Auth.js credentials flow

### AI Workflow
- Codex project skills
- product strategy / PRD / prioritization skills
- UI/UX Pro Max skill for design-system and implementation direction

## Current Status

This repository is currently in working prototype stage.

What already exists:

- local BRD / PRD / UX docs
- Notion backlog and project structure
- Figma-informed dashboard and app layout
- authenticated frontend pages for all major product areas
- PostgreSQL schema and Drizzle data layer
- user-scoped API routes and repository-backed services
- direct CSV import with preview, mapping, review, confirm, replace, and merge
- guided import flow with real account creation and single-account CSV import
- recommendation runs persisted to the database
- persistent investment preferences and import mapping presets

What is not finished yet:

- guided allocation setup in Settings
- recommendation engine v2 logic
- richer import review and correction persistence
- broker integrations and async workers
- production auth provider options beyond local credentials
- production-ready chart polish and edge-state handling

## Quick Start

### Prerequisites
- Node.js 20+
- npm

### Install
```bash
npm install
```

### Start local database
```bash
npm run db:start
```

### Run locally
```bash
npm run dev
```

### Validation
```bash
npm run typecheck
npm run build
```

### Demo login
- `jiekun@example.com` / `demo1234`
- `casey@example.com` / `demo1234`

## Project Structure

```text
app/                  Next.js routes and API handlers
components/           shared UI, layout, chart, and feature components
lib/                  backend services, repositories, auth, and database code
docs/                 BRD, PRD, UX specs, execution docs
design-system/        persisted design-system output from AI-assisted UI workflow
.codex/skills/        local project skills used by Codex
```

## Interview / Demo Angle

This project is useful as a portfolio piece because it demonstrates:

- product thinking, not just code execution
- structured AI-agent collaboration in a real workflow
- translation from BRD/PRD to backlog to UI to implementation scaffold
- ability to design systems and API contracts before backend completion
- practical judgment around where AI should accelerate work and where product decisions still need explicit ownership

## Next Steps

The most natural next implementation steps are:

1. define backend data models for accounts, holdings, transactions, and preferences
2. implement guided allocation setup in Settings
3. deepen recommendation engine rules and explanation quality
4. refine page-level interactions and loading / empty states
