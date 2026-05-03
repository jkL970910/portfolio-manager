# Neon Migration Checklist

Last updated: 2026-05-03

## Objective

Move `portfolio-manager` from the WSL-local PostgreSQL database to Neon
Postgres without changing the product architecture.

This is the first cloud deployment step before Vercel API hosting and
Cloudflare Workers Cron scheduling.

## Current Assumptions

- Flutter remains the primary client.
- Next.js / TypeScript remains the backend/API shell.
- Neon becomes the managed Postgres target.
- Drizzle remains the schema/migration tool.
- Existing security identity rules remain mandatory:
  `security_id` first, then strict `symbol + exchange + currency` when needed.
- This migration should not introduce real external APIs yet.

## Required Accounts / Inputs

Before starting:

- Neon account
- GitHub repo access
- current local `DATABASE_URL`
- target Neon `DATABASE_URL`
- local `.env.local` backup
- current Git branch pushed cleanly

Do not paste production database URLs or secrets into chat, docs, Git, or issue
comments.

## Environment Variables

Required for the deployed API:

```env
DATABASE_URL=
AUTH_SECRET=
PORTFOLIO_WORKER_SECRET=
```

Optional / feature-gated:

```env
OPENAI_API_KEY=
LOO_MINISTER_PROVIDER=
LOO_MINISTER_MODEL=
LOO_MINISTER_REASONING_EFFORT=
MARKET_DATA_PROVIDER_RETRY_AFTER_SECONDS=
TWELVE_DATA_API_KEY=
OPENFIGI_API_KEY=
PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH=
PORTFOLIO_ANALYZER_EXTERNAL_WORKER=
PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS=
PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS=
PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA=
```

Do not enable live external research providers during the Neon migration. Keep
external research guarded unless the scheduler/cache/provider policy is being
tested explicitly.

## Phase 1: Prepare Local State

1. Confirm the current branch is clean or committed.
2. Run local checks:

```bash
npm run typecheck
npm run test:backend
cd apps/mobile && flutter analyze
```

3. Back up `.env.local` outside Git.
4. Record the local database connection string privately.
5. Confirm migrations exist through the latest file:

```txt
drizzle/0021_loo_minister_subject_history.sql
```

## Phase 2: Create Neon Project

1. Create a Neon project.
2. Create or select the default database.
3. Copy the pooled or direct connection string.
4. For migration/bootstrap, prefer the direct connection string if Neon
   recommends it for schema changes.
5. Store the Neon `DATABASE_URL` in a private password manager or deployment
   secret store.

## Phase 3: Schema Creation

Recommended first attempt for a new empty Neon database:

```bash
DATABASE_URL="<neon-url>" npx drizzle-kit push
```

Alternative if using migration SQL explicitly:

```bash
DATABASE_URL="<neon-url>" npx drizzle-kit migrate
```

Choose one path and record which path was used. Do not mix schema push and
manual SQL edits without documenting the reason.

## Phase 4: Data Migration

For a personal project, a `pg_dump` / `psql` migration is the simplest path.

Example shape:

```bash
pg_dump "$LOCAL_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file .db-backups/portfolio-manager-local-to-neon.dump
```

Restore:

```bash
pg_restore \
  --no-owner \
  --no-acl \
  --dbname "$NEON_DATABASE_URL" \
  .db-backups/portfolio-manager-local-to-neon.dump
```

If restoring into an already-created schema causes duplicate object errors,
start with a clean Neon branch/database or choose schema-only migration plus
table-level data import. Do not manually delete production data without a fresh
backup and explicit confirmation.

## Phase 5: Local App Against Neon

Temporarily run the local app against Neon:

```bash
DATABASE_URL="<neon-url>" npm run typecheck
DATABASE_URL="<neon-url>" npm run test:backend
DATABASE_URL="<neon-url>" npm run dev
```

Manual smoke checks:

- login
- mobile home API
- portfolio overview API
- security detail API
- Settings API
- AI 大臣 settings API
- market-data refresh recent runs API
- external research usage/recent jobs API

Do not run large market-data refreshes during first smoke. Use bounded worker
limits if testing worker execution:

```bash
DATABASE_URL="<neon-url>" \
MARKET_DATA_REFRESH_MAX_USERS=1 \
MARKET_DATA_REFRESH_MAX_SYMBOLS=5 \
npm run worker:market-data:once
```

## Phase 6: Vercel Environment

Configure Vercel env vars:

```env
DATABASE_URL=<neon-url>
AUTH_SECRET=<strong-random-secret>
PORTFOLIO_WORKER_SECRET=<strong-random-secret>
```

Keep optional external/AI provider vars disabled until baseline API QA passes.

Deploy and verify:

- `/api/mobile/auth/login`
- `/api/mobile/home`
- `/api/mobile/portfolio/overview`
- `/api/mobile/settings/ai-minister`
- `/api/mobile/market-data/refresh-runs/recent`
- `/api/mobile/analysis/external-research-usage`

## Phase 7: Worker Endpoint Smoke

After Vercel deploy and secret configuration:

Expected failure with missing/wrong secret:

```bash
curl -i -X POST "https://<app-domain>/api/workers/market-data/run?maxUsers=1&maxSymbols=1"
```

Expected success with correct secret:

```bash
curl -i -X POST "https://<app-domain>/api/workers/market-data/run?maxUsers=1&maxSymbols=1" \
  -H "Authorization: Bearer <PORTFOLIO_WORKER_SECRET>"
```

External research worker smoke:

```bash
curl -i -X POST "https://<app-domain>/api/workers/external-research/run" \
  -H "Authorization: Bearer <PORTFOLIO_WORKER_SECRET>"
```

Expected:

- wrong/missing secret does not execute worker
- correct secret returns `meta.source = worker-api`
- market-data run ledger updates
- Settings shows worker status
- external-research worker safely reports no ready job or processes a queued
  cached job

## Phase 8: Cloudflare Workers Cron

Only after Vercel endpoint smoke passes:

1. Create Cloudflare Worker.
2. Store `PORTFOLIO_WORKER_SECRET` as a Worker secret.
3. Add cron trigger.
4. Call the Vercel worker endpoint with bounded query params.

Initial schedule should be conservative. Example:

- market data: once daily or every few hours with low `maxSymbols`
- external research: less frequent, only to drain queued jobs

Do not use cron to call live external news/forum/search APIs until provider
budget and queue policy are implemented.

## QA Checklist

Mobile URL:

- Login works.
- Overview loads.
- Portfolio loads.
- Security Detail loads.
- Settings loads.
- AI 大臣 opens.
- AI 大臣 local answer works.
- BYOK/GPT mode still stores key server-side only.

Data:

- total assets match expected local baseline after migration.
- CAD/USD holdings remain separated.
- same ticker CAD/US listings keep separate `security_id`.
- price history does not collapse by ticker.
- FX cache remains visible and auditable.

Worker:

- Settings shows `数据新鲜度策略`.
- Settings shows market-data refresh ledger.
- Settings shows external-research usage and recent jobs.
- worker endpoint rejects missing/wrong secret.
- bounded worker run records status without clearing existing prices.

## Rollback Plan

If Neon migration fails:

1. Keep local WSL Postgres unchanged.
2. Restore `.env.local` to local `DATABASE_URL`.
3. Disable Vercel deployment or point it back to a known-good database only if
   safe.
4. Do not run Cloudflare Cron until the database target is confirmed.
5. Keep the failed Neon branch/database for inspection if it contains no
   sensitive leaked config in logs.

## Next After Neon

1. Vercel deployment.
2. Cloudflare Workers Cron.
3. Real mobile URL QA.
4. First real external API adapter, preferably ETF metadata or company
   fundamentals.
5. Queue evaluation only after cron + DB ledger is insufficient.
