# Cloud Deployment Strategy

## Objective

Define a practical cloud deployment path for Portfolio Manager that supports:

- a stable public URL
- cross-device login
- persistent shared data
- minimal infrastructure overhead
- a realistic free-tier evaluation before paid rollout

## Current Stack

- Next.js App Router
- PostgreSQL
- Drizzle ORM
- Auth.js credentials
- Route Handlers and service-layer business logic

This means the lowest-friction deployment path should preserve the monolith rather than split immediately into separate frontend and Python services.

## Deployment Options

### Option A: Vercel + Neon

Best fit for the current stack.

Why:

- Vercel is the native deployment platform for Next.js
- Neon offers a usable free Postgres tier and works well with serverless/web workloads
- this combination gets the project onto a public URL quickly with minimal code changes

Recommended use:

- alpha and early beta deployment
- cross-device login
- low to moderate traffic
- minimal operational overhead

### Option B: Vercel + Supabase

Useful if the project later needs:

- storage
- richer database tooling
- auth-adjacent services
- a more integrated backend platform

Trade-off:

- slightly more operational surface than Neon for the current app
- not necessary unless the product starts depending on Supabase-native capabilities

### Option C: Railway

Better fit if the product soon needs:

- a worker process
- cron-like jobs
- more traditional app + database deployment under one platform

Trade-off:

- less natural than Vercel for a Next.js-first personal project
- no longer the most attractive free option for long-running hosted use

## Free-Tier Reality

### Vercel

The Hobby plan is free and intended for personal projects.

### Neon

Neon currently offers a free tier with:

- 100 projects
- 100 CU-hours monthly per project
- 0.5 GB storage per project
- scale-to-zero style behavior for inactive databases

This is good enough for:

- demos
- low-volume personal usage
- cross-device testing
- small beta traffic

It is not ideal for:

- always-on production workloads
- sustained optimization jobs
- long-running background workers

### Railway

Railway no longer has a durable free hosted plan for normal ongoing use.

Current model:

- one-time free trial credit
- Hobby plan is paid monthly

This means Railway is no longer the preferred zero-cost default for this project.

## Recommended Near-Term Choice

For the current product stage, the best deployment path is:

1. Vercel for the app
2. Neon for PostgreSQL

Why:

- lowest migration cost from the current local stack
- public URL quickly
- cross-device auth works once environment variables are set correctly
- no forced architectural split yet

## Likely Cost Profile

### Can this remain free?

Yes, for a while, if the app remains:

- personal or small-team
- low traffic
- low write volume
- without heavy async compute
- without constant price refresh jobs

### When does it likely become paid?

The project likely moves into paid territory when one or more of these happen:

1. database no longer scales to zero cleanly because it is effectively always active
2. recommendation workloads become async and frequent
3. market-data refreshes become regular background jobs
4. usage exceeds Vercel Hobby limits or Neon free compute/storage ceilings
5. collaboration, preview workflows, or uptime expectations exceed hobby-grade limits

## Deployment Constraints That Matter Later

### Auth

Need to set:

- `AUTH_SECRET`
- application base URL
- secure cookie behavior for production

### Database

Need to set:

- `DATABASE_URL`
- preferably a connection style that behaves well with serverless workloads

### Cache

Current in-memory cache is acceptable for local and single-instance alpha use, but it is not a durable shared cache.

### Jobs

If recommendation recompute, imports, or market-data refresh become heavy, move to a durable Postgres-backed queue before introducing separate infrastructure.

## Recommended Rollout Order

1. deploy current monolith to Vercel
2. attach Neon Postgres
3. run schema push and seed data
4. validate login, import, settings, recommendation run, and quote refresh from a second device
5. only then evaluate queueing, workers, and more advanced infra

## Recommendation

Short answer:

- yes, a free cloud deployment is still realistic for the current stage
- the best free-first path is `Vercel + Neon`
- a paid plan becomes likely once the app needs always-on database activity, async workers, or heavier market-data / optimization workloads
