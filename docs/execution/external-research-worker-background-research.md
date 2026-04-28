# External Research Worker Background Research

Last updated: 2026-04-28

## Scope

This research covers the next blocker before enabling live AI external research:

- background job queue boundary
- persisted usage counters
- source allowlist and cost guardrails
- low-cost cloud path for a personal project with under 10 active users

It does not enable live news, forum, institutional, or paid external research.

## Current Repo State

- DB-backed external research job and usage ledger exists in local schema.
- `portfolio_analysis_runs` persists cached AI quick-scan results and worker
  generated cached-external results.
- `lib/backend/portfolio-external-research.ts` now exposes product-owned policy:
  - manual trigger only
  - minimum TTL of 21,600 seconds
  - daily run limit
  - per-run symbol cap
  - worker/provider/adapter readiness flags
  - disabled source allowlist by default
- The repository layer already has a Postgres/Drizzle abstraction, so a DB-backed
  job ledger is the lowest-friction first step.
- P0 job/usage ledger implementation has started:
  - migration `0005_external_research_jobs`
  - `external_research_jobs`
  - `external_research_usage_counters`
  - read-only mobile usage API
  - guarded enqueue API that still refuses live external research until worker
    and providers are enabled
  - repository-level `claimNext`, `markSucceeded`, and `markFailed` methods for
    the future worker loop
  - local one-shot worker command:
    `npm run worker:external-research:once`
  - no-op worker execution that marks claimed jobs failed safely while providers
    are disabled
  - mobile recent-job status API and Settings display for queued/running/succeeded
    /failed visibility
  - cached `market-data` provider adapter. It only reads local holdings and
    cached price history; it does not call external APIs.
  - provider result normalization into `portfolio_analysis_runs` when all
    explicit env flags are enabled.
  - admin-only smoke enqueue command:
    `npm run worker:external-research:enqueue-smoke -- --user-id <uuid>`.
    This creates a queued cached market-data job for local worker validation and
    does not call external APIs.
  - local Postgres smoke validation passed on 2026-04-28 using `VFV + TSX +
    CAD`; the worker marked the job `succeeded` and created a cached-external
    `portfolio_analysis_runs` row without falling back to ticker-only or USD
    price history.
  - mobile recent-job rows include a readable `targetLabel`, for example
    `VFV · TSX · CAD`, so Settings QA does not have to inspect internal cache
    keys.
  - mobile Settings QA passed after the smoke job; the recent task row is
    visible to the matching logged-in user and shows the readable identity
    target.

Required env flags for the cached market-data provider:

- `PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH=enabled`
- `PORTFOLIO_ANALYZER_EXTERNAL_WORKER=enabled`
- `PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS=enabled`
- `PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS=enabled`
- `PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA=enabled`

Local smoke flow:

```bash
PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH=enabled \
PORTFOLIO_ANALYZER_EXTERNAL_WORKER=enabled \
PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS=enabled \
PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS=enabled \
PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA=enabled \
npm run worker:external-research:enqueue-smoke -- \
  --user-id <local-user-id> \
  --symbol VFV \
  --exchange TSX \
  --currency CAD

npm run worker:external-research:once
```

The smoke job preserves `symbol + exchange + currency` in the analyzer request
so CAD-listed/hedged variants and US common shares are not tested through
ticker-only matching.

## External Option Notes

### Vercel Cron

Vercel Cron can invoke a production endpoint, but Hobby cron is limited to once
per day and has hourly scheduling precision. That is enough for daily cleanup or
daily quota reset, but not enough for a responsive queue poller.

Source:
https://vercel.com/docs/cron-jobs/usage-and-pricing

### Cloudflare Queues

Cloudflare Queues now has a Workers Free allocation. Current docs show 10,000
operations per day included on Workers Free, with 24-hour retention on the free
tier. This is attractive later if the backend is deployed near Cloudflare or if a
small Cloudflare Worker can pull and call the API.

Sources:
https://developers.cloudflare.com/queues/platform/pricing/
https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/

### Upstash QStash

QStash Free includes 1,000 messages per day, 10 queues, max queue parallelism 2,
max retry count 3, max delay 7 days, and max HTTP response duration 15 minutes.
This is a good fit for a personal project if we want managed HTTP task delivery
without running a worker process.

Source:
https://upstash.com/docs/qstash/overall/pricing

### Neon Postgres

Neon Free includes 100 CU-hours monthly per project and 0.5 GB storage per
project, with scale-to-zero behavior when idle. This is compatible with a small
DB-backed job ledger and usage counters, assuming job volume remains low.

Source:
https://neon.com/pricing

## Recommendation

For this project, implement queue support in two layers:

1. Product-owned DB ledger first.
2. Optional external queue adapter later.

This avoids early vendor lock-in and keeps local WSL, future cloud Postgres, and
Flutter testing on the same contract.

## Proposed P0 Implementation

### Database

Add two tables:

- `external_research_jobs`
- `external_research_usage_counters`

`external_research_jobs` should store:

- `id`
- `user_id`
- `scope`
- `target_key`
- `request_json`
- `status`: `queued | running | succeeded | failed | cancelled`
- `source_mode`
- `source_allowlist_json`
- `priority`
- `attempt_count`
- `max_attempts`
- `run_after`
- `locked_at`
- `locked_by`
- `started_at`
- `finished_at`
- `error_message`
- `result_run_id`
- `created_at`
- `updated_at`

`external_research_usage_counters` should store:

- `id`
- `user_id`
- `counter_date`
- `scope`
- `run_count`
- `symbol_count`
- `created_at`
- `updated_at`

Use unique index:

- `user_id + counter_date + scope`

### Backend Services

Add pure service functions before any live provider:

- `enqueueExternalResearchJob(userId, request)`
- `assertExternalResearchQuota(userId, request)`
- `claimNextExternalResearchJob(workerId)`
- `markExternalResearchJobSucceeded(jobId, resultRunId)`
- `markExternalResearchJobFailed(jobId, error)`
- `getExternalResearchUsageSummary(userId)`

For P0, `enqueueExternalResearchJob` should still reject if policy says
providers/adapters are disabled. This means the queue contract exists, but no
live external research can run accidentally.

### API

Add mobile endpoints:

- `GET /api/mobile/analysis/external-research-usage`
- `POST /api/mobile/analysis/external-research-jobs`

For the first pass, the POST endpoint can return a clear `400` explaining that
live providers are not enabled yet. The main value is establishing payload shape,
quota checks, and QA coverage before provider work starts.

### Flutter

Settings should show:

- policy status
- usage today
- daily limit
- source allowlist disabled state

Do not add a user-facing "run external research" button until the worker and at
least one source adapter are actually enabled.

## Deferred Adapter Decision

After the DB ledger exists:

- Use DB-only/manual worker for local development.
- Use QStash if hosted on Vercel/Next and we want managed HTTP retries.
- Use Cloudflare Queues if the public test/production edge stays Cloudflare
  oriented.
- Do not use Vercel Hobby cron for responsive job processing; keep it for daily
  cleanup/reset only.

## Next Development Slice

P0 next:

1. Decide whether mobile needs cached-external result detail visibility beyond
   the Settings recent-task row.
2. Add provider result detail visibility if cached-external runs need UI
   drilldown.
3. Only then evaluate QStash or Cloudflare Queues as the hosted delivery layer.
