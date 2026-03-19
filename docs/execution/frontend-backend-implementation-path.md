# Frontend and Backend Implementation Path

## Chosen foundation
- Frontend shell: Next.js App Router + TypeScript + Tailwind
- UI source of truth: Figma flows plus `design-system/portfolio-manager/MASTER.md`
- Current data mode: typed mock repositories
- Backend handoff mode: route handlers and contracts under `app/api/*`

## Frontend path
1. Lock shared design tokens, navigation, card styles, charts, and page shells.
2. Keep pages static first: Dashboard, Portfolio, Recommendations, Spending, Import, Settings.
3. Move page-specific sections into reusable components only after the shape stabilizes.
4. Replace direct mock imports with repository functions or server fetch calls when backend endpoints are ready.

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
4. Use `lib/backend/mock-store.ts` only as a transition layer until repositories are backed by a database.

## Parallel work split
### Frontend
- Build visual components and route-level pages.
- Keep contracts typed in `lib/contracts.ts`.
- Consume stable API envelopes from `app/api/*`.

### Backend
- Define schema from `docs/execution/backend-data-model.md`.
- Implement services behind `lib/backend/services.ts`.
- Swap mock-store reads for repository reads as the database comes online.

## Recommended sequence
1. Frontend finalizes layout and component boundaries.
2. Backend implements preference profile and import job persistence.
3. Backend implements holdings and portfolio analytics.
4. Backend implements recommendation generation.
5. Frontend swaps page-level data fetching from mock imports to route or repository calls.

## Supporting docs
- `docs/execution/backend-architecture.md`
- `docs/execution/backend-data-model.md`
