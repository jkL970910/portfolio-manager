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

Updated now:

- snapshot-backed trend lines are live for:
  - dashboard net worth
  - portfolio workspace
  - account detail
- holding and security detail still use reference curves pending `security_price_history`

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
- holding detail compatibility route retained, but now redirects into the unified symbol page
- security detail page is now the unified symbol route for both recommended and already-held symbols
- dashboard top-holding rows now deep-link into the unified symbol page
- health-score holding drilldowns still target holding ids, but the route now forwards into the unified symbol page with the matching account preselected
- recommendation detail can now open a referenced already-heavy holding directly
- recommendation detail can now also open a security detail page for the recommended lead or alternative symbol
- already-held symbols now default to an aggregate cross-account view on the unified symbol page, with compact first-fold selectors that reveal the full position-detail stack for the selected account
- if the same symbol appears multiple times inside one account, the unified symbol page now keeps the account metrics aggregated and adds a second selector for the exact holding row to review and edit
- health-score and recommendation links that used to target the old holding route now deep-link straight into the unified symbol page with account and holding context preserved
- inspection is no longer the next gap; Phase 3 now covers account/holding edit and repair workflows

3. Add repair workflows
   - account metadata edit
   - holding edit
   - holding classification repair for unknown or wrong security metadata
   - merge duplicate accounts with explicit preview and confirmation

Current state:
- account detail includes a unified maintenance panel for account edit, add-holding, merge, and delete-account confirmation
- the add-holding path now deep-links into import with the current account already locked, instead of duplicating a second manual-create flow inside account detail
- holding detail includes an edit panel with classification repair
- account and holding write paths now feed a shared edit log
- old import and quote-refresh write paths now reuse a shared portfolio-state recalculation helper so weight semantics stay aligned after edits, imports, and refreshes
- quote refresh now protects against ambiguous cross-currency symbol matches when no exchange override is present, so CAD wrappers are not overwritten by mismatched USD prices

4. Replace synthetic trend lines only after the structural model is ready
   - event-backed portfolio history
   - security price history
   - replay-backed snapshots

## Supporting docs
- `docs/execution/backend-architecture.md`
- `docs/execution/backend-data-model.md`
- `docs/execution/recommendation-engine-v1.md`
- `docs/execution/market-data-provider-strategy.md`
