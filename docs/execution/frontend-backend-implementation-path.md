# Frontend and Backend Implementation Path

## Chosen foundation
- Frontend shell: Next.js App Router + TypeScript + Tailwind
- UI source of truth: Figma flows plus `design-system/portfolio-manager/MASTER.md`
- Current data mode: PostgreSQL-backed repositories through Drizzle
- Backend handoff mode: route handlers and contracts under `app/api/*`
- Current auth mode: Auth.js credentials with user-scoped session handling

## Frontend path
1. Lock shared design tokens, navigation, card styles, charts, and page shells.
2. Keep pages static first: Dashboard, Portfolio, Recommendations, Spending, Import, Settings.
3. Move page-specific sections into reusable components only after the shape stabilizes.
4. Use server-side data fetching through route handlers or services instead of page-local fixtures.
5. Use shared client-side API helpers for browser fetch flows so invalid JSON or partial payloads degrade to local UI errors instead of crashing the route.

## Backend path
1. Keep API contracts stable by endpoint:
   - `/api/dashboard`
   - `/api/portfolio`
   - `/api/recommendations`
   - `/api/spending`
   - `/api/import`
   - `/api/settings/preferences`
2. Model service boundaries around product domains rather than page files.
3. Route handlers should only return service outputs, never implement business logic directly.
4. Keep route handlers thin and push domain rules into `lib/backend/services.ts`.
5. Preserve repository boundaries so future worker jobs or a separate API service can reuse the same domain logic.

## Parallel work split
### Frontend
- Build visual components and route-level pages.
- Keep forms and import flows aligned to real API behavior.
- Consume stable API envelopes from `app/api/*`.
- Use `lib/client/api.ts` for `safeJson`, error extraction, and payload assertions in client components.

### Backend
- Evolve schema from `docs/execution/backend-data-model.md`.
- Implement services behind `lib/backend/services.ts`.
- Keep imports, preferences, and recommendations user-scoped and persistent.

## Recommended sequence
1. Frontend finalizes layout and component boundaries.
2. Backend stabilizes authenticated user flows and repository-backed reads.
3. Backend deepens import and recommendation write paths.
4. Frontend tightens review states, loading states, and onboarding UX around real backend responses.
5. Backend upgrades recommendation logic and import persistence without breaking the page contracts.

## Current status snapshot

Implemented now:

- authenticated login and registration
- user-scoped database reads and writes
- database-backed portfolio, recommendations, spending, settings, and import views
- direct CSV import with preview, field mapping, validation, symbol audit, review, confirm, replace, and merge
- database-backed CSV mapping presets
- guided import flow with real account creation, manual holding entry, and single-account CSV import review/confirm
- manual holdings entry with security search, normalization, and quote lookup
- manual holdings entry with auto-calculated market value and optional override total value
- portfolio batch quote refresh with persisted valuation updates
- recommendation run generation and persistence
- shared client-side API safety utilities applied across import, settings, recommendations, and portfolio action panels

Still pending:

- guided allocation setup in Settings
- richer recommendation engine v2
- async workers for heavy import or recommendation jobs
- broker integrations and raw file storage
- deeper review and correction workflow for invalid imports

Updated now:

- guided allocation setup in Settings
- recommendation engine v2 foundation
- portfolio health score and radar detail

Next build focus:

- account detail and holding detail surfaces
- account and holding edit workflows
- replay-based historical performance

## Portfolio workspace build path

1. Fix account readability first
   - repeated TFSA / FHSA / RRSP instances must stop collapsing into ambiguous labels
   - Portfolio needs account cards before deeper edit flows

2. Add concrete detail destinations
   - account detail page
   - holding detail page
   - recommendation and health-score pages should deep-link into these surfaces

Current state:
- account detail page implemented
- holding detail page implemented
- next gap is no longer inspection, but account/holding edit and repair workflows

3. Add repair workflows
   - account metadata edit
   - holding edit
   - merge duplicate accounts with explicit preview and confirmation

4. Replace synthetic trend lines only after the structural model is ready
   - event-backed portfolio history
   - security price history
   - replay-backed snapshots

## Supporting docs
- `docs/execution/backend-architecture.md`
- `docs/execution/backend-data-model.md`
- `docs/execution/recommendation-engine-v1.md`
- `docs/execution/market-data-provider-strategy.md`
