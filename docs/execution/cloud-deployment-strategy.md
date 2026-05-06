# Cloud Deployment Strategy

> [!IMPORTANT]
> As of 2026-04-25, this project is Flutter-first, mobile-first, Chinese-only,
> and Loo皇-themed. Flutter is the primary client. Next.js remains the backend /
> API shell until there is a clear reason to split it.

Last updated: 2026-05-03

## Objective

Define a low-cost cloud path for a personal portfolio product with fewer than
10 expected active accounts, real market-data caching, AI analysis, and future
external research.

The target is not infrastructure purity. The target is a reliable data flow:

1. ingest or refresh data through bounded workers
2. persist source/freshness/cost metadata
3. let Flutter, recommendations, and AI 大臣 consume cached backend contracts

## Current Project Context

### Client / backend split

- Flutter is the primary UI client for Android and Flutter Web URL access.
- Next.js remains the backend/API host:
  - `app/api/mobile/*`
  - `app/api/workers/*`
  - `lib/backend/*`
  - auth/session handling
  - Drizzle/Postgres access
  - recommendation / health / market-data logic
  - AI 大臣 and AI 标的分析 APIs
- This is intentionally a BFF-style architecture. Flutter must not directly
  access Postgres, provider APIs, OpenAI/Router keys, or financial business
  logic.

### Financial logic runtime

Keep financial logic in the existing Next.js / TypeScript backend for the
current phase.

Do not introduce a Java, Python, or separate quantitative microservice yet.

Reasons:

- Existing services, workers, API routes, tests, Drizzle repositories, Health
  Score, Recommendation V2.1, Security Identity Registry, AI context DTOs, and
  market-data lineage already live in TypeScript.
- The expected scale is small enough that a microservice split would add more
  operational risk than value.
- Current bottlenecks are data consistency, source freshness, worker scheduling,
  provider limits, and AI/external API cost control, not numerical performance.

Recommended current shape:

```txt
Flutter = UI client
Next.js / TypeScript = backend + BFF + financial business logic
Postgres / Neon = source of truth + cache + run ledger
Cloudflare Workers Cron = scheduler trigger
External API providers = worker-only ingestion source
AI 大臣 / AI 快扫 = cached/backend-context consumer
```

## Security Identity Rule

Cloud deployment and external providers must preserve the existing identity
contract:

- `security_id` is the canonical internal listing identity.
- `symbol + exchange + currency` is the strict listing key when a registry id is
  missing or during audit/repair.
- CAD/USD listings must remain separate securities.
- Ticker-only matching is never enough for quote/history/recommendation/AI
  joins when exchange or currency is available.

Future provider identifiers should be stored as aliases, not replace the
internal key:

- FIGI
- ISIN
- CUSIP
- provider-specific security ids
- exchange aliases such as `TSX`, `XTSE`, `TOR`, `Toronto Stock Exchange`

The correct future extension is a provider alias table attached to
`security_id`, not replacing `security_id` with FIGI/ISIN as the product
primary key.

## Recommended Cloud Stack

### Free-tier reality check

For this project scale, the free tiers are enough to start:

- Neon Free: 100 CU-hours / project / month, 0.5 GB storage / project, scale-to-zero
  on idle, up to 100 projects.
- Vercel Hobby: free plan for personal projects, 1,000,000 function invocations / month,
  100 GB-hours function duration, 4 CPU-hrs, 360 GB-hrs memory.
- Cloudflare Workers Free: 100,000 requests / day, 10 ms CPU per request, 100,000
  requests/day for Pages Functions too, 5 Cron Triggers/account, 50 subrequests/request.

Implication:

- Use free tiers for local dev, QA, and low-traffic personal use.
- Keep scheduled workers bounded and batched.
- Move to paid plans only when worker fan-out, data retention, or usage volume grows.

### Database: Neon Free

Use Neon as the first cloud Postgres target.

Why:

- Best fit for the existing Postgres/Drizzle architecture.
- Lower operational overhead than AWS RDS for a personal project.
- Avoids introducing Supabase BaaS assumptions before they are needed.
- Good enough for portfolio data, price history, FX cache, run ledgers, AI
  analysis cache, and external-intelligence documents at the expected scale.

Primary validation after migration:

- login
- mobile overview
- portfolio and holdings
- security detail
- Settings
- market-data refresh ledger
- AI 大臣 settings/logs/sessions
- AI analysis runs

### App/API host: Vercel Hobby

Use Vercel to deploy the Next.js backend/API shell.

Why:

- The app is already Next.js.
- Deployment friction is low.
- It keeps the current API routes and backend code path intact.
- It is suitable for the low-traffic personal MVP.

Boundary:

- Vercel hosts API and Flutter Web/static output if needed.
- Do not rely on Vercel Hobby Cron as the main high-frequency worker scheduler.
- Do not run unbounded long tasks inside normal user-facing API requests.

### Scheduler: Cloudflare Workers Cron

Use Cloudflare Workers Cron as the first scheduler.

Why:

- Cheap/free-tier friendly for lightweight HTTP scheduling.
- Can call Vercel-hosted worker endpoints.
- Avoids keeping an always-on worker server.
- Works well with the current protected worker API boundary.
- Keep each cron run short, bounded, and batch-based. On Workers Free, cron CPU
  time is only 10 ms; if the app needs more time or heavier fan-out, move the
  cron trigger to the paid plan or split work across multiple smaller invocations.

Protected worker endpoints already exist:

```txt
POST /api/workers/market-data/run
POST /api/workers/external-research/run
```

Authentication:

```txt
Authorization: Bearer <PORTFOLIO_WORKER_SECRET>
```

or:

```txt
x-worker-secret: <PORTFOLIO_WORKER_SECRET>
```

Safety behavior:

- missing server secret returns `503`
- wrong request secret returns `401`
- correct secret reuses the same worker functions as local npm scripts

### Queue: defer

Do not add QStash, Cloudflare Queues, or AWS SQS in the first cloud slice.

The project already has DB-backed ledgers:

- `market_data_refresh_runs`
- `external_research_jobs`
- `external_research_usage_counters`

Cron plus DB ledger is enough until one of these becomes true:

- many users need fan-out processing
- per-symbol retry must be independent
- external providers require strict concurrency/rate limiting
- AI/news summarization jobs become slow or variable
- failure/retry behavior needs queue-level delivery guarantees

When that happens, evaluate Cloudflare Queues or Upstash QStash before AWS SQS.

## Why Not AWS First

AWS is viable later, but not the best first cloud target for this project.

Main reasons:

- RDS, NAT Gateway, CloudWatch, egress, and always-on components can create
  unexpected cost.
- IAM/VPC/networking adds operational complexity before the product needs it.
- The current app needs inexpensive scheduled HTTP execution and Postgres, not a
  full cloud platform.

Use AWS only if the project later needs:

- strict production isolation
- richer queues/workflows
- private networking
- larger paid database/runtime scale
- enterprise-style observability and infrastructure control

## Rollout Plan

### Phase 1: Neon database migration

Goal:

- Create Neon Postgres.
- Configure `DATABASE_URL`.
- Run migrations / Drizzle push strategy safely.
- Move or seed required local data.

Validation:

- login works
- mobile overview loads
- portfolio holdings load
- security detail loads
- Settings loads
- AI 大臣 settings and logs still work
- market-data run ledger can write

### Phase 2: Vercel API deployment

Goal:

- Deploy the existing Next.js app/API to Vercel.
- Configure required environment variables:

```env
DATABASE_URL=
AUTH_SECRET=
PORTFOLIO_WORKER_SECRET=
OPENAI_API_KEY=optional
LOO_MINISTER_* provider settings as needed
LOO_MINISTER_CONTEXT_PACK_STORE=postgres
MARKET_DATA_* provider settings as needed
PORTFOLIO_ANALYZER_EXTERNAL_* flags as needed
```

Validation:

- Flutter Web/mobile URL can call the deployed API.
- Auth works from the deployed URL.
- Overview / Portfolio / Security Detail / Settings work.
- AI 大臣 local mode works.
- BYOK/GPT mode does not expose the API key to Flutter.
- 大臣 Context Pack cache writes to `loo_minister_context_packs` when
  `LOO_MINISTER_CONTEXT_PACK_STORE=postgres`, so repeated project/portfolio/
  security context hydration can survive Vercel cold starts and instance swaps.
- The same daily Cloudflare Cron run also calls
  `/api/workers/loo-minister/context-packs/prune` to delete expired context-pack
  rows. This is separate from TTL freshness checks: TTL prevents stale reads,
  pruning prevents stale rows from piling up in Neon.

### Phase 3: Cloudflare Workers Cron

Goal:

- Create a Cloudflare Worker with cron triggers.
- Call the protected worker endpoints with `PORTFOLIO_WORKER_SECRET`.
- Keep worker batches bounded.

Initial scheduling should be conservative:

- market-data: low frequency first, with `maxUsers` and `maxSymbols`
- external-research: low frequency first, only to drain explicitly queued jobs

Example endpoint calls:

```txt
POST https://<app-domain>/api/workers/market-data/run?maxUsers=1&maxSymbols=20
POST https://<app-domain>/api/workers/external-research/run
```

Validation:

- run ledger records are written
- Settings shows refresh status
- external research task status shows queued/running/succeeded/failed
- retry/TTL/freshness labels are visible
- provider retry-after windows persist

### Phase 4: first real external API adapter

Only start after scheduler + cache + Settings status are verified.

Preferred first provider category:

- ETF metadata
- company fundamentals
- company/security profile

Why:

- structured
- low frequency
- cacheable
- more reliable for Recommendation V3 and AI 大臣 than raw news

Avoid as the first provider:

- raw news feeds
- Reddit/forum/social feeds
- Google-like wild search
- high-frequency real-time quotes
- many providers in parallel

All external results must:

- be ingested by workers, not page load
- be persisted before product use
- carry source/provider
- carry freshness/TTL
- carry identity (`security_id` or complete `symbol + exchange + currency`)
- be visible in Settings/run ledgers where relevant

## Cost Control Rules

- Flutter pages must read cached data by default.
- Normal page load must not trigger live paid external APIs.
- AI 大臣 must prefer project/cache context before provider calls.
- Expensive actions require explicit user confirmation.
- Run ledger / usage counters must be checked before expensive work.
- If provider data is fresh enough, reuse it.
- If provider is limited, preserve old usable data and show status.
- Force refresh should remain a conscious user action, not a hidden fallback.

Future enhancements:

- request collapsing for duplicate symbol requests
- semantic cache for repeated AI summaries
- provider daily budget ledger
- per-provider cost estimates in Settings
- queue-level concurrency control

## Current Recommended Priority

1. Commit/push current P0.1/P0.2 worker and freshness work.
2. Follow `docs/execution/neon-migration-checklist.md` for database migration.
3. Deploy Next.js API to Vercel against Neon.
4. Add Cloudflare Workers Cron to call protected worker endpoints.
5. QA mobile URL against the cloud backend.
6. Only then implement the first real external API adapter, preferably ETF
   metadata or company fundamentals.

## Non-Goals Right Now

- AWS-first deployment
- Java/Python financial microservice split
- always-on worker server
- live news/forum research on page load
- high-frequency realtime quote streaming
- queue service before cron + DB ledger proves insufficient
