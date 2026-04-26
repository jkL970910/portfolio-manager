# Frontend and Backend Implementation Path

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-25

## Chosen Foundation

- frontend shell: Flutter
- backend baseline: current Next.js route handlers + `lib/backend/services.ts`
- persistence: PostgreSQL
- product language: Chinese only
- product identity: Loo皇 / Loo国 only

## Architecture Rule

The backend is preserved before it is replaced.

That means:

- keep domain logic in services
- keep route handlers thin
- stop treating backend payloads as web-only page data
- turn current backend contracts into mobile product APIs

## Frontend Path

1. define Flutter app shell
2. define Flutter theme tokens and mobile component primitives
3. encode Chinese-only and Loo皇-theme assumptions in the design system
4. migrate high-frequency read flows first
5. migrate complex write and import flows second

## Backend Path

1. audit all current `app/api/*` endpoints
2. normalize payloads for Flutter consumption
3. separate session/web assumptions from reusable API behavior
4. choose a mobile-safe auth approach
5. preserve repository and service boundaries so later worker jobs or separate services can reuse the same logic

## Migration Sequence

### Phase 1: Contract audit

Target endpoints:

- `/api/dashboard`
- `/api/portfolio`
- `/api/recommendations`
- `/api/spending`
- `/api/import`
- `/api/settings/preferences`
- `/api/settings/watchlist`
- `/api/market-data/*`

Goal:

- define which payloads are already mobile-safe
- identify where web-specific assumptions leak through

### Phase 2: Flutter shell

Build:

- navigation
- page scaffolds
- card and metric primitives
- list/detail patterns
- chart containers
- form controls

### Phase 3: Read-flow migration

Migrate in order:

1. auth
2. dashboard
3. portfolio workspace
4. security detail
5. recommendations
6. discover

### Phase 4: Write-flow migration

Migrate in order:

1. settings
2. watchlist actions
3. account / holding edits
4. recommendation runs
5. import entry flows

### Phase 5: Advanced workflow migration

- richer import review persistence
- AI-agent analysis jobs
- queue / worker boundaries
- cloud hardening

## Current Baseline Already Available

- authenticated reads and writes
- portfolio and recommendation persistence
- import foundations
- unified symbol workspace
- account and holding repair workflows
- quote refresh and discovery baseline
- watchlist and candidate scoring baseline

These should be reused, not redefined.

## Explicitly Dropped Direction

- no ongoing desktop-first UI buildout
- no bilingual UX requirement
- no assumption that Flutter is a second-class companion app
