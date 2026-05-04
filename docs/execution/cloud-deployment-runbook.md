# Cloud Deployment Runbook

Last updated: 2026-05-03

## Current Target

Deploy the current Flutter-first app with this low-cost split:

- Neon Postgres: production database.
- Vercel: Next.js backend/API/BFF.
- Cloudflare Worker Cron: scheduled calls into protected worker endpoints.
- Flutter Web: served separately from a static host, or from `/mobile` if a
  prebuilt bundle is copied into `public/mobile`.

Do not put provider API keys in Flutter. Flutter must only call our backend API.

## Required Secrets

Vercel:

```env
DATABASE_URL=<neon pooled connection string>
REPOSITORY_MODE=postgres-drizzle
AUTH_SECRET=<strong random secret>
PORTFOLIO_WORKER_SECRET=<same strong worker secret used by Cloudflare>
LOO_MINISTER_ENCRYPTION_SECRET=<32+ char secret>
LOO_MINISTER_PROVIDER_ENABLED=false
LOO_MINISTER_ALLOW_SERVER_KEY=false
SECURITY_METADATA_PROVIDER_ENABLED=false
OPENFIGI_DAILY_QUOTA_LIMIT=25
MARKET_DATA_REFRESH_MAX_USERS=1
MARKET_DATA_REFRESH_MAX_SYMBOLS=20
MARKET_DATA_REFRESH_BATCH_SIZE=20
MARKET_DATA_REFRESH_MAX_BATCHES_PER_RUN=3
MARKET_DATA_REFRESH_MAX_RUNTIME_SECONDS=45
SECURITY_METADATA_REFRESH_MAX_SECURITIES=50
SECURITY_METADATA_REFRESH_MAX_AGE_DAYS=30
```

Optional later:

```env
TWELVE_DATA_API_KEY=
OPENFIGI_API_KEY=
ALPHA_VANTAGE_API_KEY=
OPENAI_API_KEY=
```

Keep live external/news/forum providers disabled until worker/cache/quota QA
passes.

Cloudflare Worker:

```env
APP_BASE_URL=https://<your-vercel-domain>
ENABLE_SECURITY_METADATA_WORKER=true
ENABLE_MARKET_DATA_WORKER=true
ENABLE_EXTERNAL_RESEARCH_WORKER=false
```

Secret:

```bash
wrangler secret put PORTFOLIO_WORKER_SECRET
```

## Phase 1: Vercel API

1. Import the GitHub repo into Vercel.
2. Use `npm run cloud:build` as the build command.
3. Add the required Vercel env vars above.
4. Deploy.

Smoke test:

```bash
APP=https://<your-vercel-domain>

curl -i "$APP/api/mobile/home"

curl -i -X POST "$APP/api/workers/security-metadata/run?maxSecurities=1" \
  -H "Authorization: Bearer <PORTFOLIO_WORKER_SECRET>"

curl -i -X POST "$APP/api/workers/market-data/run?maxUsers=1&maxSymbols=1" \
  -H "Authorization: Bearer <PORTFOLIO_WORKER_SECRET>"
```

Expected:

- `/api/mobile/home` returns `401` without login token.
- worker endpoints return `200` only with the correct secret.
- wrong/missing worker secret returns `401` or `503`.

## Phase 2: Flutter Web URL

For the first production test, build Flutter Web locally and upload the static
bundle to a static host such as Cloudflare Pages:

```bash
cd /home/jkliu97/projects/portfolio-manager
LOO_API_BASE_URL=https://<your-vercel-domain> \
  FLUTTER_WEB_BASE_HREF=/ \
  npm run mobile:build:web:prod
```

Upload:

```bash
wrangler pages deploy apps/mobile/build/web --project-name portfolio-manager-mobile
```

If serving from the same Vercel domain under `/mobile`, build with:

```bash
LOO_API_BASE_URL=https://<your-vercel-domain> \
  FLUTTER_WEB_BASE_HREF=/mobile/ \
  npm run mobile:build:web:prod
```

Then copy the generated files to `public/mobile` before Vercel build. Do not
commit large generated web builds unless explicitly requested.

## Phase 3: Cloudflare Cron

Copy the template:

```bash
cd /home/jkliu97/projects/portfolio-manager/infra/cloudflare
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml`:

```toml
APP_BASE_URL = "https://<your-vercel-domain>"
```

Deploy:

```bash
wrangler secret put PORTFOLIO_WORKER_SECRET
wrangler deploy
```

Manual cron smoke:

```bash
curl -i "https://<cloudflare-worker-domain>/run-once" \
  -H "Authorization: Bearer <PORTFOLIO_WORKER_SECRET>"
```

Expected:

- `security-metadata` returns success or safe skipped rows.
- `market-data` writes a run ledger row.
- `market-data` refreshes in bounded batches. Keep `MARKET_DATA_REFRESH_BATCH_SIZE=20`
  and use `MARKET_DATA_REFRESH_MAX_BATCHES_PER_RUN` / runtime limits to avoid
  unbounded provider calls. If the list grows beyond the current run budget, the
  run should be `partial` with a mobile-readable “remaining symbols will refresh
  next run” status, not a full skip.
- `external-research` stays disabled unless explicitly enabled.

Mobile visibility:

- Settings now has a `云端后台任务中心` card backed by
  `/api/mobile/workers/status`.
- The card summarizes the latest market-data run, security metadata run, and
  external-research queue state.
- It also shows recent provider usage from `provider_usage_ledger`, including
  request/success/failure/skipped counts and any configured daily quota.
- This is the user-facing place to confirm worker freshness after Cloudflare
  Cron runs.
- Settings also has an advanced `标的资料可信度` card backed by
  `/api/mobile/settings/security-metadata`.
- That card is a data-quality fallback path, not a normal user maintenance
  workflow. It defaults to low-confidence / incomplete items only, can run a
  bounded small-batch refresh, and lets advanced users confirm asset class /
  sector / region only when provider data is wrong or incomplete.
- Manual confirmations are locked as source `manual` with confidence `100`, so
  project-registry/OpenFIGI refreshes must not overwrite them.

## Phase 4: First Real Provider

Only after Phases 1-3 pass:

1. Add or enable a structured metadata provider adapter.
2. Keep it behind `SECURITY_METADATA_PROVIDER_ENABLED=true`.
3. Ingest only by `security_id` or full `symbol + exchange + currency`.
4. Persist metadata source, confidence, as-of, and notes.
5. Never call it from Flutter page load.

Current first provider boundary:

- `openfigi-profile` is implemented as a structured metadata provider.
- It is disabled by default and only runs when both
  `SECURITY_METADATA_PROVIDER_ENABLED=true` and `OPENFIGI_API_KEY` are present.
- It only applies results when ticker and listing identity match. Equivalent MIC
  labels such as `XTSE -> TSX`, `XNAS -> NASDAQ`, and `XNYS -> NYSE` are
  normalized before comparison.
- The OpenFIGI lookup is listing-aware: the query/cache key includes the current
  symbol, exchange, and currency instead of ticker alone.
- `alpha-vantage-profile` is implemented as the first economic profile provider.
  It is disabled by default and only runs when
  `SECURITY_METADATA_PROVIDER_ENABLED=true`,
  `ALPHA_VANTAGE_PROFILE_PROVIDER_ENABLED=true`, and `ALPHA_VANTAGE_API_KEY`
  are present. It reads Alpha Vantage `ETF_PROFILE` / `OVERVIEW` for asset
  class, sector, and region metadata; it is not used for page-load calls.
- For provider QA, restrict the first run with
  exact listing identities such as
  `SECURITY_METADATA_REFRESH_SYMBOLS=CGL.C:TSX:CAD,ZQQ:TSX:CAD,XBB:TSX:CAD,RKLB:NASDAQ:USD,VFV:TSX:CAD`
  or the worker API query
  `?symbols=CGL.C:TSX:CAD,ZQQ:TSX:CAD,XBB:TSX:CAD,RKLB:NASDAQ:USD,VFV:TSX:CAD&maxSecurities=5&force=true`.
  Do not enable broad provider refresh until those representative listings pass.
- It updates economic exposure metadata through the same confidence/manual
  override guard as the project registry. Manual locks are never overwritten,
  and lower-confidence provider results do not replace curated project-registry
  classifications.
- Provider calls are counted in `provider_usage_ledger`; use
  `OPENFIGI_DAILY_QUOTA_LIMIT` and `ALPHA_VANTAGE_DAILY_QUOTA_LIMIT` to show
  conservative daily quotas in mobile Settings.

Preferred first provider data:

- ETF/company profile.
- asset class / sector / region.
- fund type / security type.

Do not start with raw news/forum/search feeds.

## QA Checklist

- Login from mobile URL.
- Overview loads.
- Portfolio loads.
- Security detail loads.
- AI 大臣 opens in local mode.
- Settings shows `云端后台任务中心` with market-data, security-metadata,
  external-research, and provider usage status.
- Settings shows advanced `标的资料可信度`; if there are no low-confidence items,
  it should say no manual maintenance is needed. Low-confidence items are
  visible by default, small-batch refresh is bounded, and manual confirmations
  persist after page refresh.
- Worker endpoint rejects wrong secret.
- Worker endpoint succeeds with correct secret.
- `CGL.C` remains `商品/贵金属`.
- `ZQQ` remains US equity exposure despite CAD listing.
- CAD/USD same ticker listings remain separate.
