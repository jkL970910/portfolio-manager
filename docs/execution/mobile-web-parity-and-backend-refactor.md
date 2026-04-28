# Mobile/Web Parity And Backend Refactor Plan

Last updated: 2026-04-27

## Purpose

This document tracks the gap between the legacy Next.js web surface and the new
Flutter mobile surface, and explains why backend refactoring is now a product
requirement rather than optional cleanup.

The project direction remains:

- Flutter-first
- Android and Flutter Web first
- Chinese-only
- Loo皇 / Loo国 theme only
- Next.js web remains a reference implementation and temporary API host

## Current Page-Level Parity

| Feature area | Legacy web surface | Current Flutter surface | Gap / decision |
|---|---|---|---|
| Auth | Login/register through web session | Mobile login, token persistence, refresh/retry, logout | Mobile auth works, but backend refresh tokens are still stateless and logout is not server-revoking |
| Dashboard / Overview | Dense dashboard with metrics, accounts, drift, charts, recommendation preview, spending rhythm | Mobile overview with metrics, health entry, key accounts, top holdings, recommendation theme | Mobile intentionally smaller; spending rhythm and full dashboard chart density are not migrated |
| Portfolio workspace | Full account/holding workspace, filters, account/security/holding routing, repair/edit workflows | Portfolio overview, account detail, holding detail, security detail, health score, asset-class drilldown, account-type filtered view | Mobile has core read/drilldown flows; full workspace filtering and all edit/repair paths are still incomplete |
| Portfolio health | Dedicated web health page | First-pass mobile health score page with drivers, radar, actions, account/holding drilldowns | Mobile is usable; visual polish and deeper historical context remain |
| Charts | Web has donut, line, radar preview components | Flutter has first-pass line chart, allocation distribution, health radar/score widgets | Mobile chart foundation exists; data depth is still uneven |
| Security detail | Web security page and linked holding context | Mobile security detail with summary, facts, price trend, target drift, account distribution | Mobile lacks some web density and still uses formatted/read-model data instead of raw analytics contracts |
| Holding detail | Web holding route redirects into security context | Mobile holding detail page exists and opens by holding id | Mobile is now stronger for holding-specific drilldown than the current web redirect |
| Recommendations | Web recommendation page with run panel, ranking, scenarios, explanations, constraints | Mobile recommendations with regenerate, scoring explanation, watchlist, scenarios, alternatives, execution steps | Mobile has strong first-pass parity; hard constraints still need backend model work |
| Discover / market search | Web supports symbol search/validation and watchlist discovery | Mobile uses market-data search/resolve in import and recommendation/watchlist flows | Must preserve symbol + exchange + currency identity to avoid USD common share vs CAD-listed/CDR confusion |
| Import | Web supports guided/direct flows, manual entry, CSV-oriented paths, preview/review concepts | Mobile intentionally keeps manual guided entry for accounts/holdings; CSV not migrated | This is an explicit product decision. Mobile CSV is deferred/omitted unless a future need appears |
| Settings / preferences | Web has guided setup, manual workbench, profile/citizen panel, preference source context | Mobile has guided draft, manual edit, recommendation constraint edit, display currency, quote refresh | Citizen/admin profile depth and some web workbench density are not migrated |
| Spending | Web has spending page and import separation | Mobile has no meaningful spending tab yet | Deferred until investment core and backend boundaries are stable |
| Brand / Loo page | Web has brand page | Mobile theme applies Loo identity in app shell and pages | No separate mobile brand page needed now |

## Why Backend Refactor Is Needed Now

The Flutter migration has reached the point where UI-only work is no longer the
main blocker. The remaining gaps mostly come from backend contracts that were
originally shaped for web pages, not for stable mobile/API clients.

### 1. Web page read models leak into mobile contracts

Several backend services still return display-oriented strings, page chrome,
hrefs, nested view models, and presentation fields. That worked when the only
consumer was a Next.js page, but Flutter needs stable contracts that separate:

- raw domain values
- formatted display text
- navigation identifiers
- chart-ready series
- explainability fields
- edit/create payload contracts

Without this split, Flutter pages keep parsing `Map<String, dynamic>` and will
break at runtime when web-shaped payloads drift.

### 2. Recommendation constraints need real domain fields

Mobile now edits first-pass recommendation constraints:

- watchlist symbols
- recommendation strategy
- tax-aware placement
- account funding priority

The next recommendation features need stronger rules that should not be hidden
inside UI state or loosely interpreted preference blobs:

- excluded symbols
- preferred symbols by asset class
- asset-class minimum/maximum bands
- account-level allow/avoid rules
- security-type constraints
- CAD-listed / USD-listed identity constraints

These should become explicit backend contract fields, with validation and
persistence, before AI-agent or cloud workers use them.

### 3. Market identity must stay backend-owned

This project already has a critical correctness rule: `symbol`, listing market,
and trading currency together define the security identity. Flutter should not
guess whether `AMZN`, a CAD-listed CDR, a CAD-hedged ETF, or a USD common share
are the same asset.

Backend APIs need to keep returning resolved identity fields and validation
status so mobile import/search/watchlist flows do not accidentally merge:

- US common shares
- CAD-listed versions
- CDRs
- CAD-hedged ETFs
- physically based gold / special holdings

### 4. Auth and token lifecycle are still not production-grade

Flutter can log in and persist tokens, but the backend still has mobile auth
gaps:

- refresh tokens are stateless JWTs
- logout does not revoke refresh tokens
- `/api/mobile/*` can fall back to web session cookies
- token/session behavior is hard to validate in Flutter Web because browser web
  sessions can mask missing bearer-token wiring

This is acceptable for local MVP testing, but not for a shared mobile/web URL
used by multiple real users.

### 5. Cloud and AI-agent work need async boundaries

Future features will require heavier jobs:

- quote refresh
- price-history hydration
- recommendation generation
- AI-agent analysis
- import review persistence

If these stay as request-time page/service calls, the app will become slow,
fragile, and expensive to run in the cloud. The backend needs cache/job/worker
boundaries before AI-agent features become central.

## Recommended Backend Refactor Priority

1. Mobile contract typing and DTO cleanup
   - Replace page-shaped mobile parsing with typed DTOs.
   - Keep raw IDs and raw values where mobile needs charting/filtering.
   - Keep display strings only as display helpers, not as the only source.

2. Recommendation constraints v2
   - Add explicit fields for exclusions, preferred symbols, asset-class bands,
     and account/security-type rules.
   - Validate all symbol constraints through market identity resolution.
   - Keep CAD/USD/listing identity in the backend result.

3. Market-data identity and validation API hardening
   - Normalize search/resolve/quote response shapes.
   - Always expose symbol, name, exchange, currency, security type, provider,
     confidence, and warning text.
   - Use the same identity contract in import, watchlist, recommendations, and
     quote refresh.

4. Auth hardening
   - Add revocable refresh-token storage.
   - Make mobile bearer-token auth strict unless an endpoint explicitly allows
     web-session fallback.
   - Preserve Flutter Web compatibility without masking token bugs.

5. Worker/cache boundary design
   - Move heavy quote/history/recommendation/AI tasks toward queued or cached
     flows.
   - Keep request handlers as thin API boundaries.

## Practical Next Development Slice

The next implementation slice should be `Recommendation constraints v2`.

Minimum useful scope:

- extend preference contracts with hard constraints
- add backend validation for symbol constraints using market search/resolve
- expose those constraints in mobile settings
- make recommendation scoring consume them
- keep existing first-pass mobile UI usable while fields are added

This is more important than adding more Flutter pages because the current mobile
surface already exposes the main product loops. The next quality jump comes from
better backend rules and safer contracts.

## Recommendation Constraints V2 Progress

Status: in progress

First backend slice implemented:

- Added a normalized `recommendationConstraints` object to preference profiles.
- Added a DB column and migration for `preference_profiles.recommendation_constraints`.
- Added schema validation for:
  - `excludedSymbols`
  - `preferredSymbols`
  - `assetClassBands`
  - `avoidAccountTypes`
  - `preferredAccountTypes`
  - `allowedSecurityTypes`
- Kept the API backward-compatible: existing mobile/web preference updates can
  omit `recommendationConstraints` and the backend preserves the current stored
  constraints.
- Recommendation v2 now consumes:
  - `excludedSymbols` to remove symbols from the generated universe when possible
  - `preferredSymbols` to boost candidate scoring
- Preference updates now run preferred/excluded symbols through the market-data
  resolver before writing. Resolver work stays outside the DB transaction.
- Recommendation explanations now surface preferred/excluded-symbol effects.
- Constraint storage now supports security identity objects with `symbol`,
  `exchange`, `currency`, `name`, and `provider`, while keeping legacy symbol
  arrays for compatibility.
- Account placement scoring now consumes `preferredAccountTypes` and
  `avoidAccountTypes`.
- Asset-class band constraints now adjust effective target percentages used by
  recommendation gap scoring.
- `allowedSecurityTypes` now affects candidate scoring and candidate-pool
  selection. If matching candidates exist, the engine prioritizes allowed types;
  otherwise it degrades instead of returning no recommendation.
- Backend tests now cover recommendation constraint normalization and invariant
  behavior for excluded symbols, preferred symbols, allowed security types, and
  asset-class bands without locking exact recommendation scores.
- Preference schema tests now cover malformed Recommendation Constraints v2
  payloads, including invalid security identity currency, impossible asset-class
  bands, oversized symbol lists, valid resolved identity objects, and legacy
  payload compatibility when `recommendationConstraints` is omitted.

First mobile slice implemented:

- Mobile Settings recommendation-constraint editor can now edit:
  - watchlist symbols
  - preferred symbols
  - excluded symbols
  - preferred account types
  - avoided account types
  - asset-class min/max bands
  - allowed security types
  - recommendation strategy
  - tax-aware placement
  - account funding priority
- Mobile accepts preferred/excluded identities in the lightweight format
  `SYMBOL|EXCHANGE|CURRENCY`, while still allowing symbol-only entries.
- Mobile Settings now includes a search picker for preferred/excluded
  constraint securities. Picker selections preserve resolved `symbol`,
  `exchange`, `currency`, `name`, and `provider` where the market-data search
  API supplies them.

Remaining work:

- Replace the remaining lightweight `SYMBOL|EXCHANGE|CURRENCY` fallback with
  chip-based editing once the picker UX is stable.
- Add better validation messaging for asset-class bands.
- Decide whether asset-class bands should also affect Health Score, not only
  recommendation gap scoring.

Next priority order:

1. Decide whether Health Score should consume asset-class bands.
2. Replace text fallback with chip-based constraint editing.
3. Add better mobile validation messaging for asset-class bands.
4. Harden DB migration metadata before the next push if drizzle migration tooling
   expects journal/snapshot entries.
