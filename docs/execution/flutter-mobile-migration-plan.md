# Flutter Mobile Migration Plan

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.


Last updated: 2026-04-25

## Decision

Portfolio Manager is now a Flutter-first mobile product.

This project is no longer pursuing ongoing web-first feature development as the primary delivery path. Existing Next.js code remains the current implementation baseline and backend/API host, but all new product-facing UX decisions should assume:

- Flutter is the primary client surface
- mobile ergonomics come before desktop density
- Chinese is the only supported product language
- the Loo皇 / Loo国 identity is the only supported brand and narrative layer

When older docs conflict with this file, this file wins.

## What stays the same

The product thesis does not change:

- help a self-directed investor understand portfolio structure
- connect spending visibility to investable cash
- configure investment preferences
- analyze holdings and concentration
- generate recommendation and candidate-security guidance

The core feature scope also stays the same:

- authentication
- dashboard
- portfolio workspace
- recommendations
- spending
- import
- settings
- watchlist and discovery
- quote refresh and market-data routing

The roadmap sequencing also stays recognizable:

1. preserve the current MVP core flows
2. finish the highest-value unfinished work
3. migrate those flows into Flutter in a mobile-native form
4. then deepen cloud, AI-agent, and market-data capabilities

## What changes

### Platform direction

- New UI work targets Flutter, not Next.js pages.
- Existing web pages become a reference implementation and temporary backend host, not the long-term primary client.
- Backend contracts should be treated as product APIs for Flutter rather than page-private route helpers.

### Language direction

- Remove English-facing product requirements.
- Remove bilingual UX obligations from future scope.
- Keep only Chinese copy and Loo皇-themed product presentation.

### Design direction

- Mobile-first layout rules replace desktop-first dashboard density as the default assumption.
- One-hand usage, compact drill-down flows, and staged detail reveal are now first-class requirements.
- The Loo皇 theme should remain expressive and intentional rather than generic fintech minimalism.

### Design reference workflow

The requested `VoltAgent/awesome-design-md` repository should be treated as a design-reference source for future Flutter UI exploration, not as the current source of truth for implementation contracts. The repo provides `DESIGN.md` reference systems that can guide visual direction, but the product-specific rules still live in this repo's docs.

## Migration principles

1. Do not rewrite backend domain logic unless mobile requirements force it.
2. Preserve current product progress instead of restarting feature definition from zero.
3. Move read-heavy flows first, then edit flows, then complex import workflows.
4. Keep portfolio accuracy, quote identity, and recommendation transparency ahead of cosmetic speed.
5. Avoid promising true real-time behavior unless a sustainable licensed data source exists.

## Recommended execution plan

### Phase 0: Freeze web-first product direction

Goal:
- stop expanding the web app as the long-term primary UX

Actions:
- update product and execution docs to Flutter-first
- treat existing Next.js routes as temporary UI plus backend/API host
- remove English-mode requirements from current planning

Status:
- in progress now

### Phase 1: Backend contract stabilization for Flutter

Goal:
- make the current implementation consumable by a mobile client

Actions:
- audit all existing `app/api/*` contracts
- separate session/web concerns from reusable API concerns
- define mobile-safe auth strategy
- normalize payloads for dashboard, portfolio, recommendations, import, and settings

Definition of done:
- Flutter can authenticate and read the main portfolio surfaces without depending on web-page conventions

### Phase 2: Flutter foundation and design system

Goal:
- create the mobile shell and theme system

Actions:
- define Flutter app shell, navigation, typography, spacing, chart, card, and form primitives
- encode Chinese-only copy assumptions
- encode Loo皇 theme tokens
- use `awesome-design-md` references as mood-board input, not blind copy targets

Definition of done:
- reusable Flutter component system exists for dashboard, list/detail, forms, and charts

### Phase 3: Core read flows migration

Goal:
- move the most important high-frequency surfaces into Flutter

Priority order:
1. auth
2. dashboard
3. portfolio workspace
4. security detail
5. recommendations
6. discover / watchlist

Definition of done:
- the product is usable on mobile for daily review, refresh, and decision support

### Phase 4: Core write flows migration

Goal:
- move the most important edit and setup workflows into Flutter

Priority order:
1. settings / preferences
2. watchlist management
3. account and holding edits
4. recommendation runs
5. import entry flows

Definition of done:
- the user can maintain portfolio structure and preferences from mobile without falling back to web for normal use

### Phase 5: Complex import, AI-agent, and cloud expansion

Goal:
- finish the highest-friction advanced workflows after the mobile shell is already real

Includes:
- richer import review persistence
- AI-agent assisted analysis and explanation
- quote-provider status UX
- cloud deployment hardening
- optional worker boundaries for heavy analysis jobs

## Current progress carry-over from the web implementation

These capabilities already exist conceptually and should be preserved during migration:

- account and holdings import foundation
- recommendation engine baseline
- portfolio workspace with account and symbol drill-down
- holding/account edit flows
- market-data search and quote refresh
- symbol + exchange + currency quote identity routing so USD common shares and CAD-listed / CAD-hedged variants are not merged accidentally
- mobile investment preference editing for risk profile, target allocation, account priority, tax-aware placement, cash buffer, and rebalance tolerance
- mobile recommendation regeneration and watchlist management
- discovery, watchlist, and candidate scoring baseline
- spending visibility as a supporting workflow

## Near-term backlog in the new direction

1. rewrite docs to mobile-first scope
2. map existing backend contracts to Flutter feature slices
3. pick mobile auth approach
4. design Flutter navigation and mobile information hierarchy
5. migrate dashboard + portfolio + security detail first
6. keep unfinished roadmap items:
   - real historical performance completion
   - richer import review persistence
   - candidate scoring and recommendation explanation depth on mobile
   - watchlist and target constraints deepening
   - cloud-ready cache / worker boundaries

## Mobile Gap Register

Current Flutter mobile coverage is now strong enough for account login, overview,
portfolio detail, manual import, edit/delete, quote refresh, investment preference
editing, recommendation regeneration, and watchlist maintenance. It is not yet at
web feature parity for analysis-heavy flows.

Highest-priority gaps:

1. Guided investment setup
   - Web has a flow-based question path that creates a suggested preference draft.
   - Mobile currently has direct/manual editing only.
   - This should be implemented first because it controls recommendation quality.
2. Health score drilldown
   - Mobile now has a first-pass portfolio/account health drilldown page.
   - It covers score, status, highlights, action queue, radar dimensions,
     dimension drivers, and account/holding drilldown lists.
   - Holding drilldown rows can now jump into the affected holding detail.
   - Account drilldown rows now open a filtered portfolio view for that account
     type, matching the current backend account-type grouping contract.
3. Chart foundation
   - Build reusable Flutter chart primitives before adding deeper analysis pages.
   - Execution order:
     1. add dependency-free chart widgets for line trend, allocation distribution,
        and health radar/score views
     2. attach security price history to Security Detail
     3. attach portfolio/account asset allocation visuals
     4. upgrade Health Score visual polish and drilldown navigation
4. Asset and security analysis depth
   - Security detail now has a first-pass price trend visualization.
   - Portfolio and account pages now have first-pass allocation distribution
     visuals.
   - Security detail now exposes target-vs-current asset-class drift and
     account distribution for held positions.
   - Remaining depth is richer asset-class drilldown across the whole portfolio.
5. Candidate scoring depth
   - Watchlist management exists.
   - Mobile recommendation cards now expose scoreline, gap summary, why/why-not
     explanations, constraints, execution steps, and alternatives.

Implementation priority:

1. Chart foundation
   - reusable line chart
   - reusable allocation distribution bar
   - reusable health radar/score chart
2. Security and asset analysis depth
3. Guided preference tuning based on real usage
4. Cloud-ready worker/cache boundaries
5. Mobile spending migration

## Explicit non-goals right now

- ongoing desktop-first polish work
- preserving English-mode UX
- rewriting the backend into a separate microservice architecture before Flutter proves out
- buying expensive real-time data infrastructure before mobile core workflows are stable
