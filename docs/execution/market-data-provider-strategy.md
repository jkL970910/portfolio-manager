# Market Data Provider Strategy

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

## Goal

Add a stable market-data layer that supports:

- security search during import and manual holding entry
- symbol normalization to reduce typos and duplicate securities
- latest-available quotes for gain/loss calculations
- future recommendation-engine upgrades that depend on price and security metadata

## Recommended runtime architecture

Do not couple the app directly to one external provider in page code or business logic.

Use a provider adapter layer:

- `searchSecurities(query)`
- `resolveSecurity(symbol)`
- `getSecurityQuote(symbol)`
- `getBatchSecurityQuotes(symbols)`

All UI and recommendation logic should call this internal layer instead of calling vendor APIs directly.

## Provider selection

### OpenFIGI

Use for:

- security normalization
- identifier mapping
- reducing symbol/name ambiguity

Do not use as the primary quote provider.

### Twelve Data

Use for:

- symbol search / autocomplete
- USD-listed latest-available quote lookup
- future batch quotes and streaming extensions

This remains useful for US-listed securities and broad search, but it is no longer the only quote path. Canadian CAD CDR / CAD-listed wrapper quotes must not fall back to a bare US ticker because that can silently overwrite CAD positions with USD primary-listing prices.

### Yahoo Finance unofficial

Use for:

- CAD-listed quote lookup for the current personal portfolio workflow
- Cboe Canada / NEO CDR symbols such as `NVDA.NE`, `META.NE`, `MSFT.NE`, `NFLX.NE`, and `AVGO.NE`
- TSX-listed Canadian ETFs and stocks through `.TO` symbols

This is an unofficial provider and has no SLA. The app must cache aggressively, validate returned currency, and keep the previous usable price when the provider fails or rate-limits.

### Alpha Vantage

Keep as an optional fallback path for future autocomplete or lightweight lookup work.

It is not the primary recommendation for the app's main runtime data plane.

### OpenBB

Do not use OpenBB as the primary runtime data provider for the product UI.

OpenBB is better treated as a future research and agent-facing aggregation layer, not the first external dependency for core product runtime features.

### First real external API after cloud scheduling

Do not start with raw news, Reddit/forum, Google-like search, or high-frequency
realtime quote APIs.

After Neon/Vercel/Cloudflare scheduler is proven, the first real external
adapter should prefer structured, low-frequency, cacheable data:

- ETF metadata
- company/security profile
- company fundamentals
- dividend / distribution profile

These sources are more useful for Recommendation V3 and AI 大臣 context, cheaper
to cache, and easier to validate than raw news. Raw news/forum/search adapters
should wait until queue/concurrency limits and quality scoring are mature.

## Current implementation

The project now includes:

- `GET /api/market-data/search?query=...`
- `GET /api/market-data/resolve?symbol=...`
- `GET /api/market-data/quote?symbol=...`
- `GET /api/market-data/quotes?symbols=...`
- `npm run worker:market-data:once`

The first-pass market-data worker records each run in
`market_data_refresh_runs`. It uses the same quote refresh path as the mobile
manual refresh, but it is callable from scripts/cron/cloud scheduling and keeps
per-user run status, quota budget context, FX source/as-of, refreshed holding
count, missing quote count, history writes, and snapshot status.

Mobile Settings now reads this ledger through
`GET /api/mobile/market-data/refresh-runs/recent`, so both manual refreshes and
background worker runs can be audited without checking raw database rows.

Provider limit handling is intentionally conservative:

- 429 / API-credit responses from Twelve Data and Yahoo Finance mark that
  provider as temporarily limited in a process-local registry.
- If the provider returns `Retry-After`, the app uses that value; otherwise it
  falls back to `MARKET_DATA_PROVIDER_RETRY_AFTER_SECONDS` or 15 minutes.
- While a provider is marked limited, quote refresh skips that provider and
  preserves previous usable holding prices through fallback quote behavior.
- Refresh run records include the active provider-limit snapshot so Settings can
  show which provider is limited and roughly when retry is safe.

Row-level source lineage is now persisted:

- `holding_positions` stores current quote provider, source mode, status,
  quote identity, provider timestamp, last attempted/successful quote refresh,
  last error, and the linked refresh run id.
- `security_price_history` stores provider, source mode, freshness,
  refresh-run id, reference/fallback markers, and fallback reason.
- `portfolio_snapshots` stores source mode, freshness, refresh-run id, and
  fallback/reference markers.
- Flutter holding rows and Holding Detail surface quote source/status labels so
  stale/fallback/provider-limited values are visible before opening raw data.

The implementation includes an in-process TTL cache to reduce provider usage during local development and single-instance deployments.

Default cache policy:

- search: 6 hours
- normalization: 7 days
- quote: 30 minutes
- FX: 12 hours, with a conservative USD/CAD fallback when the provider is
  limited or unavailable

FX is now a separate data track:

- `fx_rates` stores `base_currency + quote_currency + rate_date + rate`.
- Quote refresh reads the latest stored FX rate, or a conservative fallback if
  no stored value exists.
- Quote refresh does not call a live FX API while refreshing USD holdings.
- Mobile overview/portfolio and quote-refresh results now expose FX as-of,
  source, and freshness so CAD total-asset figures can be audited by the user.
- Live FX lookup may populate `fx_rates` in separate display/refresh paths, but
  it should not change the holding's native quote currency or native price.

If a provider call fails after a cached value exists, the service can return stale cached data instead of failing immediately.

Provider limits must not break the product flow:

- Batch refresh should return partial results instead of failing the whole
  request after a provider limit.
- Quote refresh should preserve previous holding prices when a provider is
  limited.
- FX conversion should fall back to the conservative local rate rather than
  failing a USD holding refresh.
- Mobile/API errors should use product-safe Chinese copy, not raw vendor
  messages or SQL text.

Current provider routing:

- search -> Twelve Data
- normalization -> OpenFIGI
- USD quote -> Twelve Data first, with Yahoo Finance as a lightweight fallback
- CAD quote with `NEO` / Cboe Canada -> Yahoo Finance using `.NE`
- CAD quote with `TSX` -> Yahoo Finance using `.TO`
- CAD quote with `TSXV` -> Yahoo Finance using `.V`
- `Other / Manual` quote -> no automatic provider lookup

If keys are missing, the layer returns safe fallback payloads instead of crashing the app.

Quote identity is now explicit:

- `symbol + exchange + currency` is the quote identity used by refresh flows.
- CAD positions must stay CAD-native at the holding row.
- USD positions must stay USD-native at the holding row.
- CAD conversion happens at aggregation / display time, not by changing a holding's native quote currency.
- FX rate lookup is independent from security quote lookup; refreshing a USD
  holding should not spend an extra equity quote credit just to compute CAD
  display value.
- A provider response whose currency does not match the requested holding currency is rejected.
- Physical assets such as manually tracked gold should be marked `Other / Manual` so a stock ticker collision cannot overwrite them.

## Current product usage

Market-data is already wired into:

- guided manual holding entry
  - search
  - normalization
  - single-symbol quote lookup
- direct CSV import review
  - symbol audit
  - correction review
- portfolio
  - batch price refresh
  - freshness / coverage display
- dashboard
  - top holdings latest-price and freshness display

## Required environment variables

- `OPENFIGI_API_KEY`
- `TWELVE_DATA_API_KEY`
- `ALPHA_VANTAGE_API_KEY` (optional, not used in the first adapter)
- `MARKET_DATA_SEARCH_CACHE_TTL_SECONDS`
- `MARKET_DATA_RESOLVE_CACHE_TTL_SECONDS`
- `MARKET_DATA_QUOTE_CACHE_TTL_SECONDS`

## Next steps

1. add cron/cloud scheduling and durable cache when the app moves beyond single-instance deployment
2. persist provider limits in the database or Redis before multi-instance cloud
   deployment; the current registry is process-local by design
3. add deeper provider dashboards if the app starts using multiple paid data
   sources concurrently
4. validate official provider candidates before switching runtime data:
   EODHD/FMP/QuoteMedia-style providers for North America, Alpha Vantage for
   limited fallback/history, and region-specific providers only if licensing and
   symbol coverage fit the portfolio
5. keep iFinD/Tushare-style sources out of the P0 runtime path unless the
   portfolio scope expands into China A-share/HK-market research, because they
   add access/licensing complexity and do not solve the current US/CAD refresh
   limit directly
6. introduce security-master persistence if import and recommendation logic start depending on richer security metadata
7. add a commodity / metals provider or manual-price workflow for physical gold and other non-equity holdings

## Important deployment note

The current cache is process-local memory, not Redis or Memcached.

This is the correct first step for local development and single-instance demos, but it is not enough for multi-instance cloud deployments. When the app moves to multiple app instances, replace or supplement this cache with Redis.
