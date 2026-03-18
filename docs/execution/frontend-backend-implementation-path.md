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
2. Model service boundaries around product domains rather than page files:
   - portfolio aggregation
   - recommendation engine
   - spending aggregation
   - import normalization
   - preference storage
3. Preserve response shapes where possible so UI changes stay localized to the data layer.

## Parallel work split
### Frontend
- Build visual components and route-level pages.
- Keep contracts typed in `lib/contracts.ts`.
- Pull from `lib/mock-data.ts` until backend services are ready.

### Backend
- Define database schema and domain services against the same contracts.
- Replace route handlers from mock repository to real service orchestration.
- Add POST and PATCH handlers after the read flows are stable.

## Recommended sequence
1. Frontend finalizes layout and component boundaries.
2. Backend defines entities for accounts, holdings, contributions, transactions, preferences, and recommendation runs.
3. Frontend and backend agree on contract changes in `app/api/contracts/route.ts`.
4. Route handlers switch from mock data to actual services without changing page structure.

## Core backend domains to implement next
- Accounts and holdings ingestion
- Portfolio analytics and drift calculations
- Recommendation inputs and ranking logic
- Spending aggregation and category mapping
- Investment preferences and guided allocation output

## Risk control
- Do not couple chart components to raw database models.
- Keep recommendation explanation text in service outputs, not UI-only constants.
- Keep tax-aware language advisory and preference-driven, not absolute.
