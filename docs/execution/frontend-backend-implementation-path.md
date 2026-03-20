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
- direct CSV import with preview, field mapping, validation, review, confirm, replace, and merge
- database-backed CSV mapping presets
- guided import flow with real account creation and single-account CSV import review/confirm
- recommendation run generation and persistence

Still pending:

- guided allocation setup in Settings
- richer recommendation engine v2
- async workers for heavy import or recommendation jobs
- broker integrations and raw file storage
- deeper review and correction workflow for invalid imports

## Supporting docs
- `docs/execution/backend-architecture.md`
- `docs/execution/backend-data-model.md`
- `docs/execution/recommendation-engine-v1.md`
