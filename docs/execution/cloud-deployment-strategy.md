# Cloud Deployment Strategy

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-25

## Objective

Define the cloud path for a Flutter-first product whose current backend baseline still lives in this repo.

## Current Assumptions

- user scale is small and personal
- backend should stay cheap and simple
- market-data and AI calls are more likely to become the cost driver than general app hosting
- the first cloud move should preserve velocity, not maximize infrastructure purity

## Platform Strategy

### Near term

- keep the current backend as the hosted API baseline
- move database and public hosting to a cheap cloud path
- let Flutter become the primary client over time

### Mid term

- add durable queue / worker boundaries for heavy AI-agent or quote jobs
- separate mobile auth needs from web-session assumptions

### Long term

- retire the web app as the primary client surface
- keep only the backend or an admin/reference shell if still useful

## Deployment Recommendation

### Recommended default

- app host: low-cost serverless or hobby-grade host for the current backend
- database: low-cost PostgreSQL host with pause/scale-to-zero behavior where acceptable
- object/file storage: add only when import persistence or report assets require it

### Why

- the project is still personal-scale
- infrastructure cost is not the main problem yet
- the app should not move to heavyweight cloud complexity before Flutter proves out

## Constraints That Matter

1. mobile auth compatibility
2. quote refresh background behavior
3. AI-agent job triggering and result caching
4. database connection behavior under bursty mobile traffic
5. explicit logging around market-data refresh and analysis runs

## Rollout Order

1. host the current backend/API baseline publicly
2. move PostgreSQL to the chosen cloud host
3. validate Flutter against that backend
4. add queue/worker boundaries only when AI-agent and analysis jobs justify it
5. only then decide whether the remaining web shell should stay alive

## Non-Goals Right Now

- premature microservice split
- expensive always-on infrastructure
- true real-time quote streaming promises without a sustainable provider model
