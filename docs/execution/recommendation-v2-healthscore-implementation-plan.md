# Recommendation V2 + Health Score Implementation Plan

## Objective

Implement Recommendation Engine V2 and Portfolio Health Score locally before cloud deployment.

This execution plan turns the existing reviewed V2 design into a concrete coding sequence for the current Next.js + PostgreSQL + Drizzle architecture.

## Scope for this implementation pass

### Included

1. Recommendation V2 heuristic engine foundation
- explicit account-fit matrix
- heuristic security universe and ranking
- configurable-style FX friction inference from current account setup
- structured rationale persistence
- richer recommendation run metadata

2. Portfolio Health Score foundation
- overall score
- five-dimension radar
- dimension-level highlights
- dashboard and portfolio integration

3. UI integration
- recommendations page upgraded to show V2 metadata and rationale
- dashboard replaces health placeholder with real score preview
- portfolio page adds deeper health analysis card

### Deferred

1. full sell-side rebalancing
2. ACB reconstruction and superficial-loss logic
3. real provider-backed security master
4. alternate optimization modes such as risk parity as the default engine
5. async job queue and cloud worker setup

## Implementation sequence

### Phase 1: Data model and persistence

Add structured V2 fields to recommendation persistence:
- run-level
  - engineVersion
  - objective
  - confidenceScore
  - notes
- item-level
  - securitySymbol
  - securityName
  - securityScore
  - allocationGapBeforePct
  - allocationGapAfterPct
  - accountFitScore
  - taxFitScore
  - fxFrictionPenaltyBps
  - rationale

### Phase 2: Recommendation V2 engine

Create a dedicated backend module that:
- resolves current allocation and target allocation
- scores account placement by asset class and account type
- ranks candidate securities inside each sleeve
- allocates contribution with a target-tracking heuristic
- emits structured rationale and confidence

### Phase 3: Portfolio Health Score

Create a dedicated backend module that scores:
- allocation fit
- diversification
- account efficiency
- concentration
- risk balance

Output:
- total score
- status band
- radar data
- strongest dimension
- weakest dimension
- action-oriented highlights

### Phase 4: View models

Update dashboard, portfolio, and recommendations view builders so they expose:
- persisted V2 metadata
- formatted health score and radar data
- structured recommendation explanation summaries

### Phase 5: UI integration

Use existing shared components where possible:
- `RadarPreviewCard`
- `MetricCard`
- `Card`
- `Badge`
- `SectionHeading`

Avoid introducing new shared components unless reuse becomes obvious.

## Current implementation assumptions

1. Target-tracking remains the default recommendation engine.
2. FX friction is not a hard-coded universal penalty.
3. Risk-parity-style thinking is used for diagnostics, not default execution planning.
4. The project remains on a single Next.js app plus PostgreSQL for this phase.

## Validation checklist

1. `npm run db:push`
2. `npm run typecheck`
3. `npm run build`
4. smoke test
- settings save
- recommendation run generation
- dashboard health score rendering
- portfolio health/radar rendering

## Deployment handoff after local completion

After local validation, deployment work should focus on:
1. cloud database provisioning
2. auth environment setup
3. serverless-safe database connection validation
4. recommendation run smoke test in cloud
5. import + settings + recommendations end-to-end verification
